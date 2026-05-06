import {
  CaseAnalysisSchema,
  CaseAnalysisSourceVersionSchema,
} from "@/lib/schema";
import type { CaseAnalysis, CaseAnalysisSourceVersion } from "@/lib/schema";
import { normalizeCaseAnalysis } from "@/lib/case-analysis/normalize";
import { getSupabaseClient } from "../client";

export type CaseAnalysisSnapshot = {
  id: string;
  case_id: string;
  tenant_id: string;
  created_by_user_id: string | null;
  model: string;
  analysis: CaseAnalysis;
  source_statement_ids: string[];
  source_statement_versions: CaseAnalysisSourceVersion[];
  created_at: string;
};

export async function getLatestCaseAnalysis(
  caseId: string,
): Promise<CaseAnalysisSnapshot | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("case_analysis_snapshots")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    analysis: normalizeCaseAnalysis(CaseAnalysisSchema.parse(data.analysis)),
    source_statement_versions: zodSourceVersions(
      data.source_statement_versions,
    ),
  };
}

function zodSourceVersions(value: unknown): CaseAnalysisSourceVersion[] {
  return CaseAnalysisSourceVersionSchema.array().parse(value ?? []);
}
