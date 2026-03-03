import { User as SupabaseUser } from "@supabase/supabase-js";
import { Tables } from "./supabase/types.generated";

import { ResponseMetadataSchemaType } from "./schema";

export type MetadataProgress = ResponseMetadataSchemaType["progress"];
export type MetadataMissingDetails =
  ResponseMetadataSchemaType["ignoredMissingDetails"];
export type MetadataEvidence = ResponseMetadataSchemaType["evidence"];
export type MetadataDeviation = ResponseMetadataSchemaType["deviation"];

export type Message = {
  role: "user" | "assistant";
  content: string;
  id?: string;
  meta?: ResponseMetadataSchemaType;
};

export type UserRole =
  | "app_admin"
  | "tenant_admin"
  | "solicitor"
  | "paralegal"
  | "user";
export type StatementStatus = "draft" | "in_progress" | "submitted" | "locked";

export type Profile = Tables<"profiles">;
export type User = SupabaseUser & {
  tenant_id: string | null;
  tenant_name?: string | null;
  role: UserRole;
  display_name?: string | null;
};
export type Statement = Omit<
  Tables<"statements">,
  "status" | "signed_document" | "supporting_documents"
> & {
  status: StatementStatus;
  signed_document: UploadedDocument | null;
  supporting_documents: UploadedDocument[];
};
export type ConversationMessage = Tables<"conversation_messages">;
export type Invite = Tables<"invites">;
export type Tenant = Tables<"tenants">;
export type MagicLink = Tables<"magic_links">;

export type UploadedDocument = {
  bucketId?: string;
  name: string;
  path: string;
  type: string;
  uploadedAt: string;
};

export type SupportingDocument = {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
};
