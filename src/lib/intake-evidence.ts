import type { UploadedDocument } from "@/types";

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

function looksLikeImage(file: Pick<File, "type" | "name">) {
  return (
    file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name)
  );
}

function looksLikeVideo(file: Pick<File, "type" | "name">) {
  return (
    file.type.startsWith("video/") || /\.(mp4|mov|avi|m4v|webm)$/i.test(file.name)
  );
}

function looksLikeAudio(file: Pick<File, "type" | "name">) {
  return (
    file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)
  );
}

export function inferEvidenceGroupFromFiles(
  files: Array<Pick<File, "type" | "name">>,
) {
  if (files.length === 0) {
    return "supporting evidence";
  }

  const joinedNames = files.map((file) => file.name.toLowerCase()).join(" ");

  if (joinedNames.includes("quote") || joinedNames.includes("estimate") || joinedNames.includes("repair")) {
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

  if (files.every(looksLikeImage)) {
    return "photos of the accident damage";
  }

  if (files.every(looksLikeVideo)) {
    return "video footage";
  }

  if (files.every(looksLikeAudio)) {
    return "audio recordings";
  }

  return "supporting evidence";
}

export function sanitizeEvidenceGroupForPath(value: string) {
  return normalizeEvidenceGroup(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "other";
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
