import PizZip from "pizzip";
import { extractText as unpdfExtractText } from "unpdf";

import { logServerEvent } from "./observability/logger";

const MAX_TEXT_CHARS_PER_FILE = 20_000;

export type IntakeChatAttachmentSummary = {
  name: string;
  type: string;
  size: number;
  handledAs: "image" | "pdf" | "audio" | "video" | "text" | "metadata_only";
  warning?: string;
  inlineText?: string;
};

export type IntakeChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "video_url"; video_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type BuiltIntakeChatFileParts = {
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "input_audio"; input_audio: { data: string; format: string } }
        | { type: "video_url"; video_url: { url: string } }
        | { type: "file"; file: { filename: string; file_data: string } }
      >;
  attachmentSummaries: IntakeChatAttachmentSummary[];
  requiresPdfPlugin: boolean;
};

export type IntakeAttachedFile = IntakeChatAttachmentSummary;

function getFileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

function toDataUrl(mimeType: string, base64: string) {
  return `data:${mimeType};base64,${base64}`;
}

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

function truncateText(value: string) {
  if (value.length <= MAX_TEXT_CHARS_PER_FILE) {
    return value;
  }

  return `${value.slice(0, MAX_TEXT_CHARS_PER_FILE)}\n\n[Truncated due to length]`;
}

async function extractDocxText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = new PizZip(Buffer.from(arrayBuffer));
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";

  if (!documentXml.trim()) {
    return "";
  }

  return truncateText(stripXmlTags(documentXml));
}

async function extractPdfText(file: File) {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const result = await unpdfExtractText(buffer, { mergePages: true });
  return truncateText(result.text.trim());
}

function getAudioFormat(file: File) {
  const mimeType = (file.type || "").toLowerCase();
  const extension = getFileExtension(file.name);

  if (mimeType.includes("mpeg") || extension === "mp3") {
    return "mp3";
  }
  if (mimeType.includes("wav") || extension === "wav") {
    return "wav";
  }

  return null;
}

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" || getFileExtension(file.name) === "pdf"
  );
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isAudioFile(file: File) {
  return file.type.startsWith("audio/");
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

function isPlainTextLikeFile(file: File) {
  const mimeType = (file.type || "").toLowerCase();
  const extension = getFileExtension(file.name);

  return (
    mimeType.startsWith("text/") ||
    ["txt", "md", "csv", "json", "xml", "html", "htm", "yaml", "yml"].includes(
      extension,
    )
  );
}

export async function buildIntakeChatUserContent(args: {
  userMessage: string;
  files: File[];
}) {
  const { userMessage, files } = args;

  if (files.length === 0) {
    return {
      content: userMessage,
      attachmentSummaries: [] satisfies IntakeChatAttachmentSummary[],
      requiresPdfPlugin: false,
    };
  }

  const attachmentSummaries: IntakeChatAttachmentSummary[] = [];
  const contentParts: IntakeChatContentPart[] = [];
  const baseUserText =
    userMessage ||
    "I have attached supporting evidence files for review. Please use the attached evidence as factual context for this turn and only ask about genuinely missing details.";

  const requiresPdfPlugin = false;

  for (const file of files) {
    if (isImageFile(file)) {
      const base64 = toBase64(await file.arrayBuffer());
      contentParts.push({
        type: "image_url",
        image_url: {
          url: toDataUrl(file.type || "image/png", base64),
        },
      });
      attachmentSummaries.push({
        name: file.name,
        type: file.type || "image/*",
        size: file.size,
        handledAs: "image",
      });
      continue;
    }

    if (isPdfFile(file)) {
      try {
        const extractedText = await extractPdfText(file);
        if (extractedText) {
          contentParts.push({
            type: "text",
            text: `[File: ${file.name}]\n${extractedText}`,
          });
          attachmentSummaries.push({
            name: file.name,
            type: "application/pdf",
            size: file.size,
            handledAs: "text",
            inlineText: extractedText,
          });
          continue;
        }
      } catch (error) {
        logServerEvent("error", "extract.pdf", { error });
        // Fall through to metadata-only handling below.
      }

      contentParts.push({
        type: "text",
        text: `[File: ${file.name}]\nPDF uploaded, but readable text could not be extracted locally. Treat this as supporting evidence with unavailable inline text.`,
      });
      attachmentSummaries.push({
        name: file.name,
        type: "application/pdf",
        size: file.size,
        handledAs: "metadata_only",
        warning:
          "PDF text extraction failed locally; uploaded as evidence without inline text.",
      });
      continue;
    }

    if (isAudioFile(file)) {
      const format = getAudioFormat(file);
      if (format) {
        const base64 = toBase64(await file.arrayBuffer());
        contentParts.push({
          type: "input_audio",
          input_audio: {
            data: base64,
            format,
          },
        });
        attachmentSummaries.push({
          name: file.name,
          type: file.type || "audio/*",
          size: file.size,
          handledAs: "audio",
        });
      } else {
        attachmentSummaries.push({
          name: file.name,
          type: file.type || "audio/*",
          size: file.size,
          handledAs: "metadata_only",
          warning: "Unsupported audio format for inline model input.",
        });
      }
      continue;
    }

    if (isVideoFile(file)) {
      const base64 = toBase64(await file.arrayBuffer());
      contentParts.push({
        type: "video_url",
        video_url: {
          url: toDataUrl(file.type || "video/mp4", base64),
        },
      });
      attachmentSummaries.push({
        name: file.name,
        type: file.type || "video/*",
        size: file.size,
        handledAs: "video",
      });
      continue;
    }

    if (isPlainTextLikeFile(file)) {
      const extractedText = truncateText(await file.text());
      contentParts.push({
        type: "text",
        text: `[File: ${file.name}]\n${extractedText}`,
      });
      attachmentSummaries.push({
        name: file.name,
        type: file.type || "text/plain",
        size: file.size,
        handledAs: "text",
        inlineText: extractedText,
      });
      continue;
    }

    if (getFileExtension(file.name) === "docx") {
      try {
        const extractedText = await extractDocxText(file);
        if (extractedText) {
          contentParts.push({
            type: "text",
            text: `[File: ${file.name}]\n${extractedText}`,
          });
          attachmentSummaries.push({
            name: file.name,
            type:
              file.type ||
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: file.size,
            handledAs: "text",
            inlineText: extractedText,
          });
        } else {
          attachmentSummaries.push({
            name: file.name,
            type:
              file.type ||
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: file.size,
            handledAs: "metadata_only",
            warning: "DOCX text extraction returned no readable content.",
          });
        }
      } catch (error) {
        logServerEvent("error", "extract.docx", { error });
        attachmentSummaries.push({
          name: file.name,
          type:
            file.type ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: file.size,
          handledAs: "metadata_only",
          warning: "DOCX could not be parsed for inline model input.",
        });
      }
      continue;
    }

    attachmentSummaries.push({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      handledAs: "metadata_only",
      warning: "Unsupported file type for inline model input.",
    });
  }

  const attachmentOverview = attachmentSummaries
    .map((file, index) => {
      const warning = file.warning ? ` - ${file.warning}` : "";
      return `${index + 1}. ${file.name} (${file.type || "unknown"}, ${file.size} bytes, ${file.handledAs})${warning}`;
    })
    .join("\n");

  return {
    content: [
      {
        type: "text",
        text: `${baseUserText}\n\n[Attached files]\n${attachmentOverview}`,
      },
      ...contentParts,
    ] satisfies IntakeChatContentPart[],
    attachmentSummaries,
    requiresPdfPlugin,
  };
}

export async function buildIntakeChatFileParts(args: {
  userMessage: string;
  files: File[];
}) {
  const result = await buildIntakeChatUserContent(args);

  return {
    content: result.content,
    attachedFiles: result.attachmentSummaries,
    requiresPdfPlugin: result.requiresPdfPlugin,
  };
}
