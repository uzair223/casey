import { logServerEvent } from "@/lib/observability/logger";

import {
  getAudioFormat,
  getFileExtension,
  isAudioFile,
  isImageFile,
  isPdfFile,
  isPlainTextLikeFile,
  isVideoFile,
  toBase64,
  toDataUrl,
  truncateText,
} from "./core";
import { extractDocxText, extractPdfText } from "./extraction";

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
  content: string | IntakeChatContentPart[];
  attachmentSummaries: IntakeChatAttachmentSummary[];
  requiresPdfPlugin: boolean;
};

export type IntakeAttachedFile = IntakeChatAttachmentSummary;

export async function buildIntakeChatUserContent(args: {
  userMessage: string;
  files: File[];
}): Promise<BuiltIntakeChatFileParts> {
  const { userMessage, files } = args;

  if (files.length === 0) {
    return {
      content: userMessage,
      attachmentSummaries: [],
      requiresPdfPlugin: false,
    };
  }

  const attachmentSummaries: IntakeChatAttachmentSummary[] = [];
  const contentParts: IntakeChatContentPart[] = [];
  const baseUserText =
    userMessage ||
    "I have attached supporting evidence files for review. Please use the attached evidence as factual context for this turn and only ask about genuinely missing details.";

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
        const extractedText = await extractPdfText(await file.arrayBuffer());
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
        const extractedText = await extractDocxText(await file.arrayBuffer());
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
    ],
    attachmentSummaries,
    requiresPdfPlugin: false,
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
