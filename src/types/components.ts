import type { UploadedDocument } from "./common";

export type StatementSubmission = {
  signedDocument: UploadedDocument;
  sections?: Record<string, unknown>;
};

export type PlainRecord = Record<string, unknown>;
