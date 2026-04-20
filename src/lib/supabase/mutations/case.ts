import { getSupabaseClient } from "../client";
import { createCaseConfigSnapshot } from "./case-template";

const DEFAULT_CASE_TITLE_TEMPLATE = "Case {caseIndex}";

function normalizeCaseMetadataValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function resolveCaseTitleFromTemplate(params: {
  titleTemplate: string;
  caseIndex: number;
  caseMetadata?: Record<string, string | number | null | undefined>;
}): string {
  return params.titleTemplate
    .replace(/\{([^{}]+)\}/g, (_match, token) => {
      const key = String(token).trim();
      if (!key) {
        return "";
      }

      if (key === "caseIndex") {
        return String(params.caseIndex);
      }

      return normalizeCaseMetadataValue(params.caseMetadata?.[key]);
    })
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveCaseTitle(params: {
  supabase: ReturnType<typeof getSupabaseClient>;
  tenantId: string;
  caseTemplateId?: string | null;
  caseMetadata?: Record<string, string | number | null | undefined>;
  explicitTitle?: string;
}): Promise<string> {
  const explicit = params.explicitTitle?.trim();

  if (!params.caseTemplateId) {
    return explicit || "Case";
  }

  const { count, error: countError } = await params.supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.tenantId)
    .eq("case_template_id", params.caseTemplateId);

  if (countError) {
    throw countError;
  }

  const caseIndex = (count ?? 0) + 1;

  const { data: template, error: templateError } = await params.supabase
    .from("case_templates")
    .select("title_template")
    .eq("id", params.caseTemplateId)
    .maybeSingle();

  if (templateError) {
    throw templateError;
  }

  const titleTemplate =
    (template?.title_template as string | null | undefined)?.trim() ||
    DEFAULT_CASE_TITLE_TEMPLATE;

  // If a custom literal title is provided (no template tokens), keep it.
  if (explicit && !/[{}]/.test(explicit)) {
    return explicit;
  }

  const templateSource = explicit || titleTemplate;
  const resolved = resolveCaseTitleFromTemplate({
    titleTemplate: templateSource,
    caseIndex,
    caseMetadata: params.caseMetadata,
  });

  return resolved || explicit || "Case";
}

const deriveCaseStatusFromWitnessStatuses = (
  statuses: Array<
    | "draft"
    | "in_progress"
    | "submitted"
    | "finalized"
    | "completed"
    | "locked"
    | "demo"
    | "demo_published"
  >,
): "draft" | "in_progress" | "submitted" | "locked" => {
  if (!statuses.length) {
    return "draft";
  }

  if (
    statuses.every(
      (status) =>
        status === "submitted" ||
        status === "finalized" ||
        status === "completed" ||
        status === "demo_published",
    )
  ) {
    return "submitted";
  }

  if (statuses.every((status) => status === "locked")) {
    return "locked";
  }

  if (
    statuses.some(
      (status) =>
        status === "demo" ||
        status === "demo_published" ||
        status === "in_progress" ||
        status === "submitted" ||
        status === "finalized" ||
        status === "completed" ||
        status === "locked",
    )
  ) {
    return "in_progress";
  }

  return "draft";
};

const isStatementStatus = (
  status: string,
): status is
  | "draft"
  | "in_progress"
  | "submitted"
  | "finalized"
  | "completed"
  | "locked"
  | "demo"
  | "demo_published" =>
  status === "draft" ||
  status === "demo" ||
  status === "demo_published" ||
  status === "in_progress" ||
  status === "submitted" ||
  status === "finalized" ||
  status === "completed" ||
  status === "locked";

export const syncCaseStatusFromWitnesses = async (
  caseId: string,
  supabase: ReturnType<typeof getSupabaseClient>,
) => {
  const { data: caseWitnesses, error: caseWitnessesError } = await supabase
    .from("statements")
    .select("status")
    .eq("case_id", caseId);

  if (caseWitnessesError) {
    throw caseWitnessesError;
  }

  const nextCaseStatus = deriveCaseStatusFromWitnessStatuses(
    (caseWitnesses ?? [])
      .map((witness) => witness.status)
      .filter(isStatementStatus),
  );

  const { error: caseStatusError } = await supabase
    .from("cases")
    .update({ status: nextCaseStatus })
    .eq("id", caseId);

  if (caseStatusError) {
    throw caseStatusError;
  }
};

export async function createCase(payload: {
  tenant_id: string;
  title?: string;
  assigned_to_ids?: string[];
  status?: string;
  case_template_id?: string | null;
  case_metadata?: Record<string, string | number | null | undefined>;
}) {
  const supabase = getSupabaseClient();
  const resolvedTitle = await resolveCaseTitle({
    supabase,
    tenantId: payload.tenant_id,
    caseTemplateId: payload.case_template_id,
    caseMetadata: payload.case_metadata,
    explicitTitle: payload.title,
  });

  const { data: createdCase, error } = await supabase
    .from("cases")
    .insert({
      tenant_id: payload.tenant_id,
      title: resolvedTitle,
      assigned_to: payload.assigned_to_ids?.[0] ?? null,
      assigned_to_ids: payload.assigned_to_ids ?? [],
      status: payload.status ?? "draft",
      case_template_id: payload.case_template_id ?? null,
      case_metadata: payload.case_metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  try {
    const configSnapshotId = await createCaseConfigSnapshot({
      tenantId: payload.tenant_id,
      templateId: payload.case_template_id,
      createdForCaseId: createdCase.id,
    });

    const { error: updateError } = await supabase
      .from("cases")
      .update({ config_snapshot_id: configSnapshotId })
      .eq("id", createdCase.id);

    if (updateError) {
      throw updateError;
    }
  } catch (snapshotError) {
    await supabase.from("cases").delete().eq("id", createdCase.id);
    throw snapshotError;
  }
}

export async function updateCase(
  id: string,
  payload: {
    title?: string;
    assigned_to_ids?: string[];
    status?: string;
    case_template_id?: string | null;
    case_metadata?: Record<string, string | number | null | undefined>;
  },
) {
  const supabase = getSupabaseClient();
  const updatePayload = {
    ...payload,
    ...(payload.assigned_to_ids
      ? { assigned_to: payload.assigned_to_ids[0] ?? null }
      : {}),
  };

  const { error } = await supabase
    .from("cases")
    .update(updatePayload)
    .eq("id", id);
  if (error) {
    throw error;
  }
}

export async function deleteCase(id: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("cases").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
