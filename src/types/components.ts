import type { UploadedDocument } from "./common";

export type StatementSubmission = {
  signedDocument: UploadedDocument;
  sections?: Record<string, unknown>;
  supportingDocuments?: UploadedDocument[];
};

export type PlainRecord = Record<string, unknown>;
