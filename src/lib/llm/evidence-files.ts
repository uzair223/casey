import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  extractDocumentContent,
  getFileExtension,
  isAudioFile,
  isImageFile,
  isPdfFile,
  isVideoFile,
  toBase64,
  toDataUrl,
} from "@/lib/files";
import type { UploadedDocument } from "@/types";

import { selectModel } from "./model-config";
import { parseStructuredJson } from "./responses";

const MAX_INLINE_FILE_BYTES = 12 * 1024 * 1024;

const mediaReadingSchema = z.object({
  reading: z.string().trim().min(1),
});

export type EvidenceFileKind =
  | "text"
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "metadata_only";

export type ModelContentPart =
  OpenAI.Chat.Completions.ChatCompletionContentPart;

export type LoadedEvidenceFile = {
  name: string;
  type: string;
  handledAs: EvidenceFileKind;
  text: string | null;
  warning?: string;
  part?: ModelContentPart;
};

type NamedFile = Pick<UploadedDocument, "name" | "type">;

function filePart(
  filename: string,
  mimeType: string,
  base64: string,
): ModelContentPart {
  return {
    type: "file",
    file: {
      filename,
      file_data: toDataUrl(mimeType, base64),
    },
  };
}

export function isMediaEvidenceKind(kind: EvidenceFileKind) {
  return (
    kind === "image" || kind === "pdf" || kind === "audio" || kind === "video"
  );
}

export async function loadEvidenceFile(
  blob: Blob,
  document: NamedFile,
): Promise<LoadedEvidenceFile> {
  const mime = document.type || "application/octet-stream";

  if (
    isImageFile(document) ||
    isPdfFile(document) ||
    isAudioFile(document) ||
    isVideoFile(document)
  ) {
    if (blob.size > MAX_INLINE_FILE_BYTES) {
      return {
        name: document.name,
        type: mime,
        handledAs: "metadata_only",
        text: null,
        warning: "File is too large to send to the model.",
      };
    }

    const base64 = toBase64(await blob.arrayBuffer());
    if (isImageFile(document)) {
      const imageMime = mime.startsWith("image/") ? mime : "image/png";
      return {
        name: document.name,
        type: imageMime,
        handledAs: "image",
        text: null,
        part: {
          type: "image_url",
          image_url: { url: toDataUrl(imageMime, base64) },
        },
      };
    }

    if (isPdfFile(document)) {
      return {
        name: document.name,
        type: "application/pdf",
        handledAs: "pdf",
        text: null,
        part: filePart(document.name, "application/pdf", base64),
      };
    }

    const kind = isAudioFile(document) ? "audio" : "video";
    const extension = getFileExtension(document.name);
    const fileMime =
      mime.includes("/") && mime !== "application/octet-stream"
        ? mime
        : kind === "audio"
          ? `audio/${extension || "mpeg"}`
          : `video/${extension || "mp4"}`;

    return {
      name: document.name,
      type: fileMime,
      handledAs: kind,
      text: null,
      part: filePart(document.name, fileMime, base64),
    };
  }

  const extracted = await extractDocumentContent(blob, {
    name: document.name,
    type: document.type,
    path: "",
    uploadedAt: "",
  });

  if (extracted.type === "text") {
    return {
      name: document.name,
      type: mime,
      handledAs: "text",
      text: extracted.text,
    };
  }

  if (extracted.type === "image_url") {
    return {
      name: document.name,
      type: mime,
      handledAs: "image",
      text: null,
      part: {
        type: "image_url",
        image_url: { url: extracted.url },
      },
    };
  }

  return {
    name: document.name,
    type: mime,
    handledAs: "metadata_only",
    text: null,
    warning: extracted.warning ?? "Unsupported file type for model input.",
  };
}

export async function readEvidenceMedia(params: {
  client: OpenAI;
  file: LoadedEvidenceFile;
  signal?: AbortSignal;
}) {
  if (!params.file.part) {
    throw new Error(`No file contents to read for ${params.file.name}.`);
  }

  const model = selectModel("case-analysis");
  const response = await params.client.chat.completions.parse(
    {
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Read the attached witness evidence for a solicitor drafting a first-person statement. Report only what is visible or audible. Quote legible text. Do not infer missing facts.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `File name: ${params.file.name}\nMIME type: ${params.file.type}`,
            },
            params.file.part,
          ],
        },
      ],
      response_format: zodResponseFormat(mediaReadingSchema, "evidence_reading"),
    },
    { signal: params.signal },
  );

  return mediaReadingSchema.parse(
    parseStructuredJson(response, "evidence_reading"),
  ).reading;
}
