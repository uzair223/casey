import {
  createEvidenceExhibits,
  getEvidenceDocumentsFromSupportingRows,
} from "@/lib/evidence";
import type {
  StatementConfig,
  StatementSupportingDocument,
  UploadedDocument,
} from "@/types";

type EvidenceSection = StatementConfig["sections"][number];

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function getProgrammaticEvidenceSection(
  config: Pick<StatementConfig, "sections">,
): EvidenceSection | null {
  return (
    config.sections.find((section) => {
      const id = normalizeText(section.id);
      const title = normalizeText(section.title);
      const description = normalizeText(section.description);
      return (
        id.includes("evidence") ||
        id.includes("exhibit") ||
        title.includes("evidence") ||
        title.includes("exhibit") ||
        description.includes("evidence") ||
        description.includes("exhibit")
      );
    }) ?? null
  );
}

function getDocumentSummary(row: StatementSupportingDocument) {
  return (
    row.descriptors.summary ||
    row.document.description ||
    `${row.title || row.document.name} was uploaded as supporting evidence.`
  );
}

function getDocumentDetails(row: StatementSupportingDocument) {
  const details = [
    row.descriptors.documentType
      ? `Document type: ${row.descriptors.documentType}.`
      : null,
    ...(row.descriptors.keyDetails ?? []).map((detail) => `Key detail: ${detail}.`),
    ...(row.descriptors.concerns ?? []).map((concern) => `Review point: ${concern}.`),
  ];

  return details.filter(Boolean) as string[];
}

function getDocumentKey(document: UploadedDocument) {
  return [document.path, document.name, document.uploadedAt].join("\u001f");
}

export function buildProgrammaticEvidenceSection(params: {
  config: Pick<StatementConfig, "sections">;
  rows: StatementSupportingDocument[];
  witnessName: string;
}) {
  const section = getProgrammaticEvidenceSection(params.config);
  if (!section) {
    return null;
  }

  if (!params.rows.length) {
    return {
      sectionId: section.id,
      content: "No supporting evidence has been provided.",
    };
  }

  const rowsByDocumentKey = new Map(
    params.rows.map((row) => [getDocumentKey(row.document), row]),
  );
  const exhibits = createEvidenceExhibits(
    getEvidenceDocumentsFromSupportingRows(params.rows),
    params.witnessName || "Witness",
  );

  const content = exhibits
    .map((exhibit) => {
      const lines = exhibit.documents.flatMap((document) => {
        const row = rowsByDocumentKey.get(getDocumentKey(document));
        if (!row) {
          return [];
        }

        const details = getDocumentDetails(row);
        return [
          `- ${row.title || row.document.name}: ${getDocumentSummary(row)}`,
          ...details.map((detail) => `  ${detail}`),
        ];
      });

      return [`Exhibit ${exhibit.exhibit}: ${exhibit.description}`, ...lines]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return {
    sectionId: section.id,
    content,
  };
}

export function applyProgrammaticEvidenceSection(
  sections: Record<string, unknown>,
  params: {
    config: Pick<StatementConfig, "sections">;
    rows: StatementSupportingDocument[];
    witnessName: string;
  },
) {
  const evidenceSection = buildProgrammaticEvidenceSection(params);
  if (!evidenceSection) {
    return sections;
  }

  return {
    ...sections,
    [evidenceSection.sectionId]: evidenceSection.content,
  };
}
