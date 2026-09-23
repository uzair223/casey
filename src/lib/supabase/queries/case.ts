import { getSupabaseClient } from "../client";
import { CaseStatementJoin as CaseExpanded, Tables } from "@/types";

const CASE_EXPANDED_SELECT =
  "*, statements(id,witness_name,witness_email,status,updated_at,participant_kind,role_key,lead_stage,contact_email,contact_phone,outreach_confirmed_at,parent_statement_id), case_templates(name)";

type CaseStatementCaseTemplateJoin = Tables<"cases"> & {
  statements: Pick<
    Tables<"statements">,
    | "id"
    | "witness_name"
    | "witness_email"
    | "status"
    | "updated_at"
    | "participant_kind"
    | "role_key"
    | "lead_stage"
    | "contact_email"
    | "contact_phone"
    | "outreach_confirmed_at"
    | "parent_statement_id"
  >[];
  case_templates: { name: string } | null;
};
function toCaseExpanded(x: CaseStatementCaseTemplateJoin): CaseExpanded {
  const { case_templates, ...data } = x;
  return {
    case_template_name: case_templates?.name ?? "",
    ...data,
  } as CaseExpanded;
}

export async function getCases(): Promise<CaseExpanded[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("cases")
    .select(CASE_EXPANDED_SELECT)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CaseStatementCaseTemplateJoin[]).map(toCaseExpanded);
}

export async function getCaseById(caseId: string): Promise<CaseExpanded> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("cases")
    .select(CASE_EXPANDED_SELECT)
    .eq("id", caseId)
    .single();

  if (error) {
    throw error;
  }

  return toCaseExpanded(data);
}
