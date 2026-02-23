import { User as SupabaseUser } from "@supabase/supabase-js";
import { Tables } from "./supabase/types.generated";

export type ProgressData = {
  currentPhase: number;
  completedPhases: number[];
  phaseCompleteness: Record<string, number>;
  structuredData: {
    currentPhase: number;
    overallCompletion: number;
  };
  readyToPrepare: boolean;
  ignoredMissingDetails?: string[];
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  id: string;
  progress?: ProgressData | null;
  meta?: {
    requiresEvidenceUpload?: boolean;
    allowedTypes?: string[];
    stopIntake?: boolean;
    flaggedDeviation?: boolean;
    deviationReason?: string;
  } | null;
};

export type UserRole =
  | "app_admin"
  | "tenant_admin"
  | "solicitor"
  | "paralegal"
  | "user";
export type CaseStatus = "draft" | "collecting" | "review" | "locked";
export type StatementStatus = "draft" | "in_progress" | "submitted" | "locked";
export type Case = {
  id: string;
  tenant_id: string;
  title: string;
  reference: string;
  incident_date: string | null;
  assigned_to: string | null;
  created_at: string;
};
export type Profile = Tables<"profiles">;
export type User = SupabaseUser & {
  tenant_id: string | null;
  role: UserRole;
  display_name?: string | null;
};
export type Statement = Tables<"statements">;
export type ConversationMessage = Tables<"conversation_messages">;
export type Invite = Tables<"invites">;
export type Tenant = Tables<"tenants">;
export type MagicLink = Tables<"magic_links">;

export type UploadedDocument = {
  bucketId?: string;
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
