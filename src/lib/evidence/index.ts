import type { StatementSupportingDocument, UploadedDocument } from "@/types";

import { isAudioFile, isImageFile, isVideoFile } from "@/lib/files";

export type EvidenceDocument = UploadedDocument & {
  group?: string;
};

export type EvidenceGroup = {
  group: string;
  documents: EvidenceDocument[];
};

export type EvidenceExhibit = {
  exhibit: string;
  description: string;
  documents: EvidenceDocument[];
};

export function normalizeEvidenceGroup(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized || "other";
}

export function inferEvidenceGroupFromFiles(
  files: Array<Pick<File, "type" | "name">>,
) {
  if (files.length === 0) {
    return "supporting evidence";
  }

  const joinedNames = files.map((file) => file.name.toLowerCase()).join(" ");

  if (
    joinedNames.includes("quote") ||
    joinedNames.includes("estimate") ||
    joinedNames.includes("repair")
  ) {
    return "repair estimate or quote";
  }

  if (
    joinedNames.includes("invoice") ||
    joinedNames.includes("receipt") ||
    joinedNames.includes("bill")
  ) {
    return "receipts or invoices";
  }

  if (
    joinedNames.includes("medical") ||
    joinedNames.includes("gp") ||
    joinedNames.includes("hospital") ||
    joinedNames.includes("physio")
  ) {
    return "medical records";
  }

  if (files.every(isImageFile)) {
    return "photos of the accident damage";
  }

  if (files.every(isVideoFile)) {
    return "video footage";
  }

  if (files.every(isAudioFile)) {
    return "audio recordings";
  }

  return "supporting evidence";
}

export function sanitizeEvidenceGroupForPath(value: string) {
  return (
    normalizeEvidenceGroup(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "other"
  );
}

export function getWitnessInitials(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join("");

  return initials || "W";
}

export function getEvidenceDocuments(
  documents: UploadedDocument[] | undefined | null,
) {
  return (documents ?? []).filter(
    (document): document is EvidenceDocument =>
      typeof document === "object" && document !== null,
  );
}

export function groupEvidenceDocuments(
  documents: EvidenceDocument[] | undefined | null,
): EvidenceGroup[] {
  const groups = new Map<string, EvidenceDocument[]>();

  for (const document of documents ?? []) {
    const group = normalizeEvidenceGroup(document.group);
    groups.set(group, [...(groups.get(group) ?? []), document]);
  }

  return Array.from(groups.entries()).map(([group, groupedDocuments]) => ({
    group,
    documents: groupedDocuments,
  }));
}

function getDescriptorGroupFromText(value: string) {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("photo") ||
    normalized.includes("image") ||
    normalized.includes("photograph")
  ) {
    return "photographs";
  }

  if (
    normalized.includes("repair") ||
    normalized.includes("estimate") ||
    normalized.includes("quote")
  ) {
    return "repair estimates";
  }

  if (
    normalized.includes("medical") ||
    normalized.includes("gp") ||
    normalized.includes("hospital") ||
    normalized.includes("clinical")
  ) {
    return "medical records";
  }

  if (
    normalized.includes("invoice") ||
    normalized.includes("receipt") ||
    normalized.includes("bill")
  ) {
    return "receipts and invoices";
  }

  if (
    normalized.includes("video") ||
    normalized.includes("dashcam") ||
    normalized.includes("cctv")
  ) {
    return "video footage";
  }

  if (normalized.includes("audio") || normalized.includes("recording")) {
    return "audio recordings";
  }

  if (
    normalized.includes("letter") ||
    normalized.includes("email") ||
    normalized.includes("correspondence") ||
    normalized.includes("insurer")
  ) {
    return "correspondence";
  }

  return "";
}

export function inferEvidenceGroupFromDescriptor(
  row: StatementSupportingDocument,
) {
  const descriptorInputs = [
    row.descriptors.documentType,
    row.descriptors.summary,
    ...(row.descriptors.keyDetails ?? []),
    row.title,
    row.document.name,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const input of descriptorInputs) {
    const group = getDescriptorGroupFromText(input);
    if (group) {
      return group;
    }
  }

  const descriptorType = row.descriptors.documentType?.trim();
  if (descriptorType) {
    return descriptorType;
  }

  return normalizeEvidenceGroup(row.group_name || row.document.group);
}

export function getEvidenceDocumentsFromSupportingRows(
  rows: StatementSupportingDocument[] | undefined | null,
) {
  return (rows ?? []).map((row) => ({
    ...row.document,
    description: row.descriptors.summary || row.document.description,
    group: inferEvidenceGroupFromDescriptor(row),
  }));
}

export function createEvidenceExhibits(
  documents: EvidenceDocument[] | undefined | null,
  witnessName: string,
): EvidenceExhibit[] {
  return groupEvidenceDocuments(documents).map((group, index) => ({
    exhibit: `${getWitnessInitials(witnessName)}${index + 1}`,
    description: group.group,
    documents: group.documents,
  }));
}

export type TempUploadedDocument = EvidenceDocument;
export const getTempSupportingDocuments = getEvidenceDocuments;
