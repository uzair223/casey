import type { SupabaseClient } from "@supabase/supabase-js";

import { CaseConfigSchema } from "@/lib/schema/case-config";
import type { CaseConfig, Database } from "@/types";

export type CaseFact = {
  id: string;
  label: string;
  value: string | null;
  description: string | null;
  type?: "text" | "number" | "date";
  required?: boolean;
};

export type CaseModelContext = {
  caseConfig: CaseConfig | null;
  caseMetadata: Record<string, unknown>;
  matterBrief: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function displayValue(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const text = String(value).trim();
    return text || null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function parseCaseConfig(value: unknown): CaseConfig | null {
  const parsed = CaseConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildKnownCaseFacts(params: {
  caseConfig: CaseConfig | null;
  caseMetadata: Record<string, unknown> | null;
  dependencyIds?: readonly string[];
}): CaseFact[] {
  const fields = params.caseConfig?.dynamicFields ?? [];
  const selected =
    params.dependencyIds === undefined
      ? fields
      : params.dependencyIds.flatMap((id) => {
          const field = fields.find((item) => item.id === id);
          return field ? [field] : [];
        });

  return selected.map((field) => ({
    id: field.id,
    label: field.label,
    value: displayValue(params.caseMetadata?.[field.id]),
    description: field.description?.trim() || null,
    type: field.type,
    required: field.required,
  }));
}

export function formatCaseFacts(facts: CaseFact[]): string {
  if (facts.length === 0) {
    return "Case facts: none.";
  }

  return [
    "Case facts:",
    ...facts.map((fact) => {
      const line = `- ${fact.label} (${fact.id}): ${fact.value ?? "unknown"}`;
      return fact.description ? `${line}\n  ${fact.description}` : line;
    }),
  ].join("\n");
}

export function formatCaseFieldsForAnalysis(params: {
  caseConfig: CaseConfig | null;
  caseMetadata: Record<string, unknown> | null;
}): string {
  const facts = buildKnownCaseFacts({
    caseConfig: params.caseConfig,
    caseMetadata: params.caseMetadata,
  });
  const knownIds = new Set(facts.map((fact) => fact.id));
  const lines = facts.map((fact) => {
    const details = [
      `${fact.label} (${fact.id})`,
      fact.type ? `type ${fact.type}` : null,
      fact.required ? "required" : null,
      `value: ${fact.value ?? "not recorded"}`,
    ].filter((item): item is string => Boolean(item));
    const line = `- ${details.join("; ")}`;
    return fact.description ? `${line}\n  ${fact.description}` : line;
  });

  for (const [key, value] of Object.entries(params.caseMetadata ?? {})) {
    if (knownIds.has(key)) {
      continue;
    }
    const shown = displayValue(value);
    if (!shown) {
      continue;
    }
    lines.push(`- ${key}: ${shown}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No case fields recorded.";
}

function snapshotConfig(relation: unknown): unknown {
  if (!relation) {
    return null;
  }
  const snapshot = Array.isArray(relation) ? relation[0] : relation;
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  return (snapshot as { config_json?: unknown }).config_json ?? null;
}

export async function loadCaseModelContext(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<CaseModelContext> {
  const { data, error } = await supabase
    .from("cases")
    .select(
      "case_metadata, case_config_snapshots!cases_config_snapshot_id_fkey(config_json)",
    )
    .eq("id", caseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const caseConfig = parseCaseConfig(
    snapshotConfig(data?.case_config_snapshots),
  );
  const caseMetadata = isRecord(data?.case_metadata) ? data.case_metadata : {};

  return {
    caseConfig,
    caseMetadata,
    matterBrief: caseConfig?.matterBrief?.trim() || null,
  };
}
