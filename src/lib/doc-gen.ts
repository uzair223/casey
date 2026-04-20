import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { DocGeneratorStatementData } from "@/types";
import expressionParser from "docxtemplater/expressions";
import ImageModule from "docxtemplater-image-module-free";

interface DocxtemplaterWithTags extends Docxtemplater {
  getTags(): { document: { tags: Record<string, unknown> } };
}

export const generateDoc = async (
  data: DocGeneratorStatementData,
  templateDocument?: Blob | ArrayBuffer | Uint8Array | null,
): Promise<Blob> => {
  const renderData = buildTemplateData(data);
  if (templateDocument) {
    try {
      return await renderTemplateDocument(templateDocument, renderData);
    } catch (error) {
      console.warn(
        "Uploaded DOCX template could not be rendered. Falling back to generated template.",
        error,
      );
    }
  }

  const generatedTemplate = await generateStarterDoc({
    templateName: "Witness Statement Template",
    config: data.config,
  });

  return await renderTemplateDocument(generatedTemplate, renderData);
};

export const signDoc = async (params: {
  data: DocGeneratorStatementData;
  signatureImage: Blob | ArrayBuffer | Uint8Array;
  templateDocument?: Blob | ArrayBuffer | Uint8Array | null;
}): Promise<Blob> => {
  const renderData = buildTemplateData(params.data);
  const signatureImage = await toUint8Array(params.signatureImage);

  const sourceTemplate =
    params.templateDocument ??
    (await generateStarterDoc({
      templateName: "Witness Statement Template",
      config: params.data.config,
    }));

  return await renderSignedTemplateDocument(
    sourceTemplate,
    renderData,
    signatureImage,
  );
};

export const validateDocxTemplateDocument = async (params: {
  config: DocGeneratorStatementData["config"];
  templateDocument: Blob | ArrayBuffer | Uint8Array;
  throw?: boolean;
}): Promise<string[]> => {
  const sections: Record<string, string> = {};
  for (const section of params.config.sections ?? []) {
    sections[section.id] = `${section.title || section.id} sample value`;
  }

  const caseMetadata: Record<string, string> = {};
  for (const key of params.config.case_metadata_deps ?? []) {
    caseMetadata[key] = `sample_${key}`;
  }

  const witnessMetadata: Record<string, string> = {};
  for (const field of params.config.witness_metadata_fields ?? []) {
    witnessMetadata[field.id] = `sample_${field.id}`;
  }

  const sampleData: DocGeneratorStatementData = {
    caseTitle: "Validation Case",
    caseMetadata,
    witnessName: "Validation Witness",
    witnessEmail: "validation@example.com",
    witnessMetadata,
    sections,
    config: params.config,
  };

  const renderData = buildTemplateData(sampleData);
  try {
    await renderTemplateDocument(params.templateDocument, renderData);
    return [];
  } catch (error) {
    if (params.throw) throw error;
    return formatDocxtemplaterValidationError(error);
  }
};

export const getDocxTemplateFieldWarnings = async (params: {
  config: DocGeneratorStatementData["config"];
  templateDocument: Blob | ArrayBuffer | Uint8Array;
}): Promise<{ unknown: string[]; unused: string[] }> => {
  const allowed = getAllowedDocxTemplateFields(params.config);
  const identifiers = await extractDocxTemplateIdentifiers(
    params.templateDocument,
  );

  return {
    unknown: Array.from(identifiers.difference(allowed)),
    unused: Array.from(allowed.difference(identifiers)),
  };
};

export async function generateStarterDoc(params: {
  templateName: string;
  config: DocGeneratorStatementData["config"];
}): Promise<Blob> {
  const { config } = params;

  // ── Key resolution helpers ─────────────────────────────────────────────────
  const PARTY_KEYS = new Set(["court", "claimNumber", "claimant", "defendant"]);
  const depSet = new Set(config.case_metadata_deps ?? []);
  const nonPartyDeps = (config.case_metadata_deps ?? []).filter(
    (d) => !PARTY_KEYS.has(d),
  );
  const hasDep = (key: string) => depSet.has(key);

  const witnessFieldIds = new Set(
    (config.witness_metadata_fields ?? []).map((f) => f.id),
  );
  const hasAddress = witnessFieldIds.has("address");
  const hasOccupation = witnessFieldIds.has("occupation");

  const INLINE_WITNESS_KEYS = new Set(["address", "occupation"]);
  const remainingWitnessMeta = (config.witness_metadata_fields ?? []).filter(
    (f) => !INLINE_WITNESS_KEYS.has(f.id),
  );

  // ── Design tokens ──────────────────────────────────────────────────────────
  // Font sizes (half-points): 20 = 10pt footer, 22 = 11pt body, 24 = 12pt heading, 28 = 14pt title
  const SZ = { footer: 20, body: 22, heading: 24, title: 28 } as const;
  // Spacing grid (twips, multiples of 80): 80≈1.7mm, 160≈3.4mm, 240≈5mm, 320≈6.7mm, 400≈8.5mm
  const SP = { xs: 80, sm: 160, md: 240, lg: 320, xl: 400 } as const;

  // ── Paragraph builders ─────────────────────────────────────────────────────

  const centered = (
    text: string,
    sz: number = SZ.heading,
    sp: number = SP.xs,
    bold = true,
  ) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: sp },
      children: [new TextRun({ text, bold, size: sz })],
    });

  const spacer = (after: number) =>
    new Paragraph({ spacing: { after }, children: [new TextRun("")] });

  // Full-width heavy rule — heavier (sz=8) to read cleanly at A4 margins
  const heavyRule = () =>
    new Paragraph({
      spacing: { before: SP.sm, after: SP.sm },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 8,
          color: "000000",
          space: 1,
        },
      },
      children: [new TextRun("")],
    });

  // Section heading: bold 12pt with a hairline bottom border
  const sectionHeading = (title: string) =>
    new Paragraph({
      spacing: { before: SP.md, after: SP.xs },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: "000000",
          space: 12,
        },
      },
      children: [new TextRun({ text: title, bold: true, size: SZ.heading })],
    });

  // Section body: black (formal), standard body size
  const sectionBody = (tag: string) =>
    new Paragraph({
      spacing: { after: SP.sm },
      children: [new TextRun({ text: tag, size: SZ.body })],
    });

  // Plain body paragraph: consistent rhythm, no ad-hoc before/after pairs
  const bodyPara = (
    text: string,
    opts?: { bold?: boolean; italics?: boolean; size?: number },
  ) =>
    new Paragraph({
      spacing: { after: SP.sm },
      children: [
        new TextRun({
          text,
          size: opts?.size ?? SZ.body,
          bold: opts?.bold,
          italics: opts?.italics,
        }),
      ],
    });

  // ── Opening "I, ..." paragraph ─────────────────────────────────────────────
  const openingRuns: TextRun[] = [
    new TextRun({ text: "I, " }),
    new TextRun({ text: "{witnessName}", bold: true }),
  ];
  if (hasAddress) {
    openingRuns.push(new TextRun({ text: ", of {witnessMetadata.address}" }));
  }
  if (hasOccupation) {
    openingRuns.push(new TextRun({ text: ", {witnessMetadata.occupation}" }));
  }
  openingRuns.push(new TextRun({ text: ", will say as follows:" }));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: SZ.body } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
          },
        },
        children: [
          // ── Non-party case metadata ──────────────────────────────────────
          ...(nonPartyDeps.length > 0
            ? [
                bodyPara("Case Metadata", { bold: true }),
                ...nonPartyDeps.map((dep) =>
                  bodyPara(`${dep}: {caseMetadata.${dep}}`),
                ),
                spacer(SP.sm),
              ]
            : []),

          // ── Court & claim number ─────────────────────────────────────────
          ...(hasDep("court")
            ? [centered("IN THE {caseMetadata.court}", SZ.heading, SP.md)]
            : []),
          ...(hasDep("claimNumber")
            ? [centered("CLAIM NO: {caseMetadata.claimNumber}", SZ.body, SP.md)]
            : []),

          // ── Parties block ────────────────────────────────────────────────
          ...(hasDep("claimant") && hasDep("defendant")
            ? [
                centered("BETWEEN:", SZ.body, SP.sm),
                centered("{caseMetadata.claimant}", SZ.body, SP.xs),
                centered("Claimant", SZ.body, SP.sm, false),
                centered("- and -", SZ.body, SP.sm),
                centered("{caseMetadata.defendant}", SZ.body, SP.xs),
                centered("Defendant", SZ.body, SP.md, false),
              ]
            : []),

          // ── Heavy rule ───────────────────────────────────────────────────
          heavyRule(),
          spacer(SP.xs),

          // ── Witness statement title ───────────────────────────────────────
          centered("WITNESS STATEMENT OF {witnessName}", SZ.title),
          spacer(SP.md),

          // ── Opening paragraph ─────────────────────────────────────────────
          new Paragraph({
            spacing: { after: SP.md },
            children: openingRuns,
          }),

          // ── Remaining witness metadata fields ─────────────────────────────
          ...(remainingWitnessMeta.length > 0
            ? [
                sectionHeading("1. Witness Details"),
                bodyPara(
                  remainingWitnessMeta
                    .map((f) => `${f.label}: {witnessMetadata.${f.id}}`)
                    .join("\n"),
                ),
              ]
            : []),

          // ── Statement sections ────────────────────────────────────────────
          ...(config.sections ?? []).flatMap((section, i) => [
            sectionHeading(
              `${i + (!remainingWitnessMeta.length ? 1 : 2)}. ${section.title}`,
            ),
            sectionBody(`{sections.${section.id}}`),
          ]),

          // ── Heavy rule before Statement of Truth ──────────────────────────
          spacer(SP.md),
          heavyRule(),
          spacer(SP.sm),

          // ── Statement of Truth ────────────────────────────────────────────
          new Paragraph({
            spacing: { after: SP.sm },
            children: [
              new TextRun({
                text: "STATEMENT OF TRUTH",
                bold: true,
                size: SZ.heading,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: SP.lg },
            children: [
              new TextRun({
                text:
                  "I believe that the facts stated in this witness statement are true. " +
                  "I understand that proceedings for contempt of court may be brought against " +
                  "anyone who makes, or causes to be made, a false statement in a document " +
                  "verified by a statement of truth without an honest belief in its truth.",
                size: SZ.body,
              }),
            ],
          }),

          // ── Signature block ───────────────────────────────────────────────
          new Paragraph({
            spacing: { after: SP.sm },
            children: [
              new TextRun({ text: "Signed:  " }),
              new TextRun({ text: "{signatureImage}" }),
            ],
          }),
          new Paragraph({
            spacing: { after: SP.xs },
            children: [new TextRun({ text: "Full name:  {witnessName}" })],
          }),
          new Paragraph({
            spacing: { after: SP.xs },
            children: [new TextRun({ text: "Date:  {signatureDate}" })],
          }),

          // ── Heavy rule after signature ────────────────────────────────────
          spacer(SP.sm),
          heavyRule(),
          spacer(SP.xs),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

type DocxTemplateRenderData = {
  caseTitle: string;
  caseMetadata: Record<string, string>;
  witnessName: string;
  witnessEmail: string;
  witnessMetadata: Record<string, string>;
  signatureImage: string;
  signatureDate: string;
  sections: Record<string, string>;
};

function buildTemplateData(
  data: DocGeneratorStatementData,
): DocxTemplateRenderData {
  const sectionMap: Record<string, string> = {};

  for (const [key, value] of Object.entries(data.sections)) {
    sectionMap[key] = value ?? "";
  }

  const caseMetadata = (data.caseMetadata ?? {}) as Record<
    string,
    string | number | null | undefined
  >;
  const caseMetadataMap: Record<string, string> = {};
  for (const key of data.config.case_metadata_deps ?? []) {
    const value = caseMetadata[key];
    caseMetadataMap[key] = value == null ? "" : String(value);
  }
  for (const [key, value] of Object.entries(caseMetadata)) {
    if (key in caseMetadataMap) continue;
    caseMetadataMap[key] = value == null ? "" : String(value);
  }

  const witnessMetadata = (data.witnessMetadata ?? {}) as Record<
    string,
    string | number | null | undefined
  >;

  const witnessMetadataMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(witnessMetadata)) {
    witnessMetadataMap[key] = value == null ? "" : String(value);
  }

  return {
    caseTitle: data.caseTitle,
    caseMetadata: caseMetadataMap,
    witnessName: data.witnessName,
    witnessEmail: data.witnessEmail ?? "",
    witnessMetadata: witnessMetadataMap,
    signatureImage: "{signatureImage}",
    signatureDate: new Date().toLocaleDateString("en-GB"),
    sections: sectionMap,
  };
}

async function toArrayBuffer(
  templateDocument: Blob | ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  if (templateDocument instanceof Blob) {
    return await templateDocument.arrayBuffer();
  }

  if (templateDocument instanceof Uint8Array) {
    return templateDocument.buffer.slice(
      templateDocument.byteOffset,
      templateDocument.byteOffset + templateDocument.byteLength,
    ) as ArrayBuffer;
  }

  return templateDocument;
}

async function toUint8Array(
  source: Blob | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    return source;
  }

  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }

  return new Uint8Array(source);
}

async function getTemplateDoc(
  templateDocument: Blob | ArrayBuffer | Uint8Array,
  modules?: any[],
) {
  const templateBuffer = await toArrayBuffer(templateDocument);
  const parser = expressionParser.configure({});
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    parser,
    modules: modules ?? [],
    paragraphLoop: true,
    linebreaks: true,
  });
  return doc as unknown as DocxtemplaterWithTags;
}

async function buildSigningTemplate(
  templateDocument: Blob | ArrayBuffer | Uint8Array,
) {
  const templateBuffer = await toArrayBuffer(templateDocument);
  const zip = new PizZip(templateBuffer);

  const zipFiles = Object.keys(zip.files);
  for (const fileName of zipFiles) {
    if (!fileName.startsWith("word/") || !fileName.endsWith(".xml")) {
      continue;
    }

    const file = zip.file(fileName);
    if (!file) {
      continue;
    }

    const content = file.asText();
    if (!content.includes("{signatureImage}")) {
      continue;
    }

    zip.file(
      fileName,
      content.replace(/\{signatureImage\}/g, "{%signatureImage}"),
    );
  }

  return zip.generate({ type: "uint8array" });
}

async function renderTemplateDocument(
  templateDocument: Blob | ArrayBuffer | Uint8Array,
  data: DocxTemplateRenderData,
): Promise<Blob> {
  const doc = await getTemplateDoc(templateDocument);
  doc.render(data);

  return doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }) as Blob;
}

async function renderSignedTemplateDocument(
  templateDocument: Blob | ArrayBuffer | Uint8Array,
  data: DocxTemplateRenderData,
  signatureImage: Uint8Array,
): Promise<Blob> {
  const imageModule = new ImageModule({
    centered: false,
    getImage: (tagValue: unknown) => {
      if (tagValue instanceof Uint8Array) {
        return tagValue;
      }

      throw new Error("signatureImage value is invalid");
    },
    getSize: () => [220, 72],
  });

  const preparedTemplate = await buildSigningTemplate(templateDocument);
  const doc = await getTemplateDoc(preparedTemplate, [imageModule]);
  doc.render({
    ...data,
    signatureImage,
  });

  return doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }) as Blob;
}

function getAllowedDocxTemplateFields(
  config: DocGeneratorStatementData["config"],
): Set<string> {
  const allowed = new Set<string>([
    "caseTitle",
    "incidentDate",
    "witnessName",
    "witnessEmail",
    "signatureImage",
    "signatureDate",
  ]);

  for (const dep of config.case_metadata_deps ?? []) {
    if (dep?.trim()) {
      allowed.add(`caseMetadata.${dep.trim()}`);
    }
  }

  for (const section of config.sections ?? []) {
    if (section.id?.trim()) {
      allowed.add(`sections.${section.id.trim()}`);
    }
  }

  for (const field of config.witness_metadata_fields ?? []) {
    if (field.id?.trim()) {
      allowed.add(`witnessMetadata.${field.id.trim()}`);
    }
  }

  return allowed;
}

async function extractDocxTemplateIdentifiers(
  templateDocument: Blob | ArrayBuffer | Uint8Array,
): Promise<Set<string>> {
  const doc = await getTemplateDoc(templateDocument);
  return new Set(Object.keys(doc.getTags().document.tags));
}

function formatDocxtemplaterValidationError(error: unknown): string[] {
  if (!error || typeof error !== "object") {
    return ["DOCX validation failed."];
  }

  const docxError = error as {
    message?: unknown;
    properties?: {
      id?: unknown;
      explanation?: unknown;
      errors?: Array<{
        message?: unknown;
        properties?: { id?: unknown; explanation?: unknown };
      }>;
    };
  };

  return (
    docxError.properties?.errors?.map((e) => String(e.message)) ?? [
      "DOCX validation failed",
    ]
  );
}
