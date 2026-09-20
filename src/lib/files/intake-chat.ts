import { logServerEvent } from "@/lib/observability/logger";
import { attachedMediaPlaceholder } from "@/lib/llm/inline-media";

import {
  getFileExtension,
  isAudioFile,
  isImageFile,
  isPdfFile,
  isPlainTextLikeFile,
  isVideoFile,
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

export type IntakeChatContentPart = { type: "text"; text: string };

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
      contentParts.push({
        type: "text",
        text: attachedMediaPlaceholder({
          kind: "image",
          name: file.name,
          type: file.type,
        }),
      });
      attachmentSummaries.push({
        name: file.name,
        type: file.type || "image/*",
        size: file.size,
        handledAs: "image",
        warning: "Image contents were not sent to the model.",
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
      contentParts.push({
        type: "text",
        text: attachedMediaPlaceholder({
          kind: "audio",
          name: file.name,
          type: file.type,
        }),
      });
      attachmentSummaries.push({
        name: file.name,
        type: file.type || "audio/*",
        size: file.size,
        handledAs: "audio",
        warning: "Audio contents were not sent to the model.",
      });
      continue;
    }

    if (isVideoFile(file)) {
      contentParts.push({
        type: "text",
        text: attachedMediaPlaceholder({
          kind: "video",
          name: file.name,
          type: file.type,
        }),
      });
      attachmentSummaries.push({
        name: file.name,
        type: file.type || "video/*",
        size: file.size,
        handledAs: "video",
        warning: "Video contents were not sent to the model.",
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
