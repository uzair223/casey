import { redactCaseForFirm } from "@/lib/leads/privacy";
import { getSupabaseClient } from "../client";
import { CaseStatementJoin as CaseExpanded, Tables } from "@/types";

const CASE_ROW_SELECT =
  "id, tenant_id, title, status, assigned_to, assigned_to_ids, case_metadata, case_template_id, config_snapshot_id, created_at, updated_at";

const PERSON_SELECT =
  "id, witness_name, witness_email, status, updated_at, participant_kind, role_key, lead_stage, contact_email, contact_phone, outreach_confirmed_at, parent_statement_id, case_id";

type CaseRow = Tables<"cases">;
type PersonRow = Pick<
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
  | "case_id"
>;

async function withPeople(rows: CaseRow[]): Promise<CaseExpanded[]> {
  if (!rows.length) return [];
  const supabase = getSupabaseClient();
  const ids = rows.map((row) => row.id);
  const templateIds = rows.flatMap((row) =>
    row.case_template_id ? [row.case_template_id] : [],
  );
  const [{ data: people, error: peopleError }, { data: templates, error: templateError }] =
    await Promise.all([
      supabase.from("statements").select(PERSON_SELECT).in("case_id", ids),
      templateIds.length
        ? supabase
            .from("statement_config_templates")
            .select("id, name")
            .in("id", templateIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (peopleError) throw new Error(peopleError.message);
  if (templateError) throw new Error(templateError.message);

  const names = new Map((templates ?? []).map((template) => [template.id, template.name]));
  const grouped = new Map<string, PersonRow[]>();
  for (const person of (people ?? []) as PersonRow[]) {
    const key = person.case_id;
    const current = grouped.get(key) ?? [];
    current.push(person);
    grouped.set(key, current);
  }

  return rows.map((row) =>
    redactCaseForFirm({
      ...row,
      case_metadata:
        row.case_metadata &&
        typeof row.case_metadata === "object" &&
        !Array.isArray(row.case_metadata)
          ? Object.fromEntries(
              Object.entries(row.case_metadata).flatMap(([key, value]) =>
                typeof value === "string" ? [[key, value]] : [],
              ),
            )
          : {},
      case_template_name: row.case_template_id
        ? (names.get(row.case_template_id) ?? "")
        : "",
      statements: (grouped.get(row.id) ?? []).map(({ case_id: _caseId, ...person }) => person),
    } as CaseExpanded),
  );
}

export async function getCases(): Promise<CaseExpanded[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cases")
    .select(CASE_ROW_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withPeople((data ?? []) as CaseRow[]);
}

export async function getCaseById(caseId: string): Promise<CaseExpanded> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("cases")
    .select(CASE_ROW_SELECT)
    .eq("id", caseId)
    .single();
  if (error) throw error;
  const [expanded] = await withPeople([data as CaseRow]);
  if (!expanded) throw new Error("Case not found");
  return expanded;
}
