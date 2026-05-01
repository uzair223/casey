import PizZip from "pizzip";
import { extractText as unpdfExtractText } from "unpdf";

import type { UploadedDocument } from "@/types";

import {
  getFileExtension,
  isImageFile,
  isPdfFile,
  isPlainTextLikeFile,
  toBase64,
  toDataUrl,
  truncateText,
} from "./core";

export type ExtractedDocumentContent =
  | { type: "text"; text: string }
  | { type: "image_url"; url: string }
  | { type: "metadata_only"; warning?: string };

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripXmlTags(value: string) {
  return decodeXmlEntities(
    value
      .replace(/<w:p\b[^>]*>/g, "\n")
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocxText(buffer: ArrayBuffer) {
  const zip = new PizZip(Buffer.from(buffer));
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";

  if (!documentXml.trim()) {
    return "";
  }

  return truncateText(stripXmlTags(documentXml));
}

export async function extractPdfText(buffer: ArrayBuffer) {
  const uint8Array = new Uint8Array(buffer);
  const result = await unpdfExtractText(uint8Array, { mergePages: true });
  return truncateText(result.text.trim());
}

export async function extractDocumentContent(
  blob: Blob,
  document: UploadedDocument,
): Promise<ExtractedDocumentContent> {
  const extension = getFileExtension(document.name);
  const buffer = await blob.arrayBuffer();

  if (isPdfFile(document)) {
    const text = await extractPdfText(buffer);
    return text
      ? { type: "text", text }
      : { type: "metadata_only", warning: "PDF text extraction failed" };
  }

  if (extension === "docx") {
    try {
      const text = await extractDocxText(buffer);
      return text
        ? { type: "text", text }
        : { type: "metadata_only", warning: "DOCX extraction returned empty" };
    } catch {
      return {
        type: "metadata_only",
        warning: "DOCX could not be parsed",
      };
    }
  }

  if (isPlainTextLikeFile(document)) {
    const text = truncateText(await blob.text());
    return { type: "text", text };
  }

  if (isImageFile(document)) {
    const base64 = toBase64(buffer);
    const url = toDataUrl(document.type || "image/png", base64);
    return { type: "image_url", url };
  }

  return {
    type: "metadata_only",
    warning: "Unsupported file type for inline model input",
  };
}

export async function extractDocumentText(
  blob: Blob,
  document: UploadedDocument,
) {
  const extracted = await extractDocumentContent(blob, document);

  if (extracted.type === "text") {
    return {
      handledAs: "text" as const,
      text: extracted.text,
    };
  }

  if (extracted.type === "image_url") {
    return {
      handledAs: "image_url" as const,
      imageUrl: extracted.url,
    };
  }

  return {
    handledAs: "metadata_only" as const,
    text: null,
    warning: extracted.warning,
  };
}

export function getDocumentsFromField(value: unknown): UploadedDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) =>
      entry &&
      typeof entry === "object" &&
      "document" in entry &&
      (entry as { document?: unknown }).document
        ? (entry as { document: unknown }).document
        : entry,
    )
    .filter((document): document is UploadedDocument => {
      if (!document || typeof document !== "object") {
        return false;
      }

      const candidate = document as Partial<UploadedDocument>;
      return (
        typeof candidate.name === "string" &&
        typeof candidate.path === "string" &&
        typeof candidate.type === "string" &&
        typeof candidate.uploadedAt === "string"
      );
    });
}
