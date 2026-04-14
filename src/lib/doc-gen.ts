import { Document, Packer, Paragraph, TextRun } from "docx";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { DocGeneratorStatementData } from "@/types";
import expressionParser from "docxtemplater/expressions";

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
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: params.templateName, bold: true, size: 28 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "This template keeps the merge tags used by the app. Preserve them if you edit the layout.",
                italics: true,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Case title: {caseTitle}" })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "\nCase metadata dependencies\n",
                bold: true,
              }),
            ],
          }),
          ...(params.config.case_metadata_deps ?? []).map(
            (dep) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `${dep}: {caseMetadata.${dep}}` }),
                ],
              }),
          ),
          ...(params.config.case_metadata_deps?.length
            ? []
            : [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Example: {caseMetadata.fieldKey}",
                    }),
                  ],
                }),
              ]),
          new Paragraph({
            children: [new TextRun({ text: "Witness name: {witnessName}" })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Witness email: {witnessEmail}" })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "\nStatement sections\n", bold: true }),
            ],
          }),
          ...(params.config.sections ?? []).flatMap((section) => [
            new Paragraph({
              children: [new TextRun({ text: section.title, bold: true })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `{sections.${section.id}}` })],
            }),
          ]),
          ...(params.config.sections?.length
            ? []
            : [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Example: {sections.sectionKey}" }),
                  ],
                }),
              ]),
          new Paragraph({
            children: [
              new TextRun({ text: "\nWitness metadata\n", bold: true }),
            ],
          }),
          ...(params.config.witness_metadata_fields ?? []).map(
            (field) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${field.label}: {witnessMetadata.${field.id}}`,
                  }),
                ],
              }),
          ),
          ...(params.config.witness_metadata_fields?.length
            ? []
            : [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Example: {witnessMetadata.fieldKey}",
                    }),
                  ],
                }),
              ]),
          new Paragraph({
            children: [new TextRun({ text: "Signature name: {witnessName}" })],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Signature date: {signatureDate}" }),
            ],
          }),
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

async function getTemplateDoc(
  templateDocument: Blob | ArrayBuffer | Uint8Array,
) {
  const templateBuffer = await toArrayBuffer(templateDocument);
  const parser = expressionParser.configure({});
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    parser,
    paragraphLoop: true,
    linebreaks: true,
  });
  return doc as unknown as DocxtemplaterWithTags;
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

function getAllowedDocxTemplateFields(
  config: DocGeneratorStatementData["config"],
): Set<string> {
  const allowed = new Set<string>([
    "caseTitle",
    "incidentDate",
    "witnessName",
    "witnessEmail",
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
