import type { UploadedDocument } from "./common";
import type { StatementConfig as StatementConfig } from "./schema";

export type DocGeneratorStatementData = {
  caseTitle: string;
  caseMetadata?: Record<string, string | number | null | undefined>;
  witnessName: string;
  witnessEmail: string;
  witnessMetadata?: Record<string, string | number | null | undefined>;

  sections: Record<string, string>;
  signatureImage?: string;

  config: StatementConfig;
};

export type StatementSubmission = {
  signedDocument: UploadedDocument;
  sections?: Record<string, unknown>;
  supportingDocuments?: UploadedDocument[];
};

export type PlainRecord = Record<string, unknown>;
