import type {
  CaseConfig,
  CaseTemplate,
  Database,
  Json,
  TemplateScope,
  TemplateStatus,
  TenantCaseTemplatePreferences,
} from "@/types";
import { CaseConfigSchema } from "@/lib/schema";
import { getSupabaseClient } from "../client";

type UpsertCaseTemplateInput = {
  tenantId?: string | null;
  name: string;
  titleTemplate?: string;
  templateScope: TemplateScope;
  status?: TemplateStatus;
  draftConfig: CaseConfig;
  sourceTemplateId?: string | null;
};

type UpsertCaseTemplatePreferencesInput = {
  tenantId: string;
  defaultCaseTemplateId?: string | null;
  favouriteCaseTemplateIds?: string[];
};

const CASE_TEMPLATE_SELECT =
  "id, tenant_id, name, title_template, template_scope, status, draft_config, published_config, source_template_id, published_at, created_at, updated_at";

const TENANT_CASE_TEMPLATE_PREFERENCES_SELECT =
  "tenant_id, default_case_template_id, favourite_case_template_ids";

function parseCaseConfigOrThrow(input: unknown, context: string): CaseConfig {
  const parsed = CaseConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid case template config in ${context}`);
  }

  return parsed.data;
}

function toCaseTemplate(
  row: Record<string, unknown>,
  context: string,
): CaseTemplate {
  return {
    ...(row as Omit<CaseTemplate, "draft_config" | "published_config">),
    title_template:
      (row.title_template as string | null | undefined)?.trim() ||
      "Case {caseIndex}",
    draft_config: parseCaseConfigOrThrow(row.draft_config, `${context}:draft`),
    published_config: row.published_config
      ? parseCaseConfigOrThrow(row.published_config, `${context}:published`)
      : null,
  };
}

function normalizePreferences(
  tenantId: string,
  row: TenantCaseTemplatePreferences | null,
): TenantCaseTemplatePreferences {
  return {
    tenant_id: tenantId,
    default_case_template_id: row?.default_case_template_id ?? null,
    favourite_case_template_ids: row?.favourite_case_template_ids ?? [],
  };
}

export async function createCaseTemplate(
  payload: UpsertCaseTemplateInput,
): Promise<CaseTemplate> {
  const supabase = getSupabaseClient();
  const normalizedDraftConfig = parseCaseConfigOrThrow(
    payload.draftConfig,
    "createCaseTemplate",
  );
  const insertPayload: Database["public"]["Tables"]["case_templates"]["Insert"] =
    {
      tenant_id: payload.templateScope === "global" ? null : payload.tenantId,
      name: payload.name,
      title_template: (payload.titleTemplate ?? "Case {caseIndex}").trim(),
      template_scope: payload.templateScope,
      status: payload.status ?? "draft",
      draft_config: normalizedDraftConfig as unknown as Json,
      source_template_id: payload.sourceTemplateId ?? null,
    };

  const { data, error } = await supabase
    .from("case_templates")
    .insert(insertPayload)
    .select(CASE_TEMPLATE_SELECT)
    .single();

  if (error) throw error;
  return toCaseTemplate(
    data as Record<string, unknown>,
    "createCaseTemplate:result",
  );
}

export async function updateCaseTemplate(
  templateId: string,
  payload: Partial<UpsertCaseTemplateInput>,
): Promise<CaseTemplate> {
  const supabase = getSupabaseClient();
  const updatePayload: Database["public"]["Tables"]["case_templates"]["Update"] =
    {};

  if (payload.templateScope !== undefined) {
    updatePayload.template_scope = payload.templateScope;
    updatePayload.tenant_id =
      payload.templateScope === "global" ? null : payload.tenantId;
  } else if (payload.tenantId !== undefined) {
    updatePayload.tenant_id = payload.tenantId;
  }

  if (payload.name !== undefined) updatePayload.name = payload.name;
  if (payload.titleTemplate !== undefined)
    updatePayload.title_template =
      payload.titleTemplate.trim() || "Case {caseIndex}";
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (payload.draftConfig !== undefined) {
    updatePayload.draft_config = parseCaseConfigOrThrow(
      payload.draftConfig,
      "updateCaseTemplate",
    ) as unknown as Json;
  }
  if (payload.sourceTemplateId !== undefined) {
    updatePayload.source_template_id = payload.sourceTemplateId;
  }

  const { data, error } = await supabase
    .from("case_templates")
    .update(updatePayload)
    .eq("id", templateId)
    .select(CASE_TEMPLATE_SELECT)
    .single();

  if (error) throw error;
  return toCaseTemplate(
    data as Record<string, unknown>,
    `updateCaseTemplate:${templateId}`,
  );
}

export async function publishCaseTemplate(
  templateId: string,
): Promise<CaseTemplate> {
  const supabase = getSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("case_templates")
    .select("draft_config")
    .eq("id", templateId)
    .single();

  if (currentError) throw currentError;

  const normalizedDraftConfig = parseCaseConfigOrThrow(
    current.draft_config,
    `publishCaseTemplate:${templateId}`,
  );

  const { data, error } = await supabase
    .from("case_templates")
    .update({
      status: "published",
      published_config: normalizedDraftConfig as Json,
      published_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .select(CASE_TEMPLATE_SELECT)
    .single();

  if (error) throw error;
  return toCaseTemplate(
    data as Record<string, unknown>,
    `publishCaseTemplate:${templateId}`,
  );
}

export async function deleteCaseTemplate(templateId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("case_templates")
    .delete()
    .eq("id", templateId);

  if (error) throw error;
}

export async function upsertTenantCaseTemplatePreferences(
  payload: UpsertCaseTemplatePreferencesInput,
): Promise<TenantCaseTemplatePreferences> {
  const supabase = getSupabaseClient();
  const uniqueFavourites = Array.from(
    new Set((payload.favouriteCaseTemplateIds ?? []).filter(Boolean)),
  );
  const defaultId = payload.defaultCaseTemplateId ?? null;
  const favouriteCaseTemplateIds =
    defaultId && !uniqueFavourites.includes(defaultId)
      ? [...uniqueFavourites, defaultId]
      : uniqueFavourites;

  const { data, error } = await supabase
    .from("case_template_tenant_preferences")
    .upsert(
      {
        tenant_id: payload.tenantId,
        default_case_template_id: defaultId,
        favourite_case_template_ids: favouriteCaseTemplateIds,
      },
      { onConflict: "tenant_id" },
    )
    .select(TENANT_CASE_TEMPLATE_PREFERENCES_SELECT)
    .single();

  if (error) throw error;
  return normalizePreferences(
    payload.tenantId,
    data as TenantCaseTemplatePreferences,
  );
}

export async function setCaseTemplateStatementTemplates(params: {
  caseTemplateId: string;
  statementTemplateIds: string[];
  defaultStatementTemplateId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const uniqueIds = Array.from(
    new Set(params.statementTemplateIds.filter(Boolean)),
  );
  const defaultId = params.defaultStatementTemplateId ?? null;

  const { error: deleteError } = await supabase
    .from("case_template_statement_templates")
    .delete()
    .eq("case_template_id", params.caseTemplateId);

  if (deleteError) throw deleteError;

  if (!uniqueIds.length) {
    return;
  }

  const rows = uniqueIds.map((statementTemplateId) => ({
    case_template_id: params.caseTemplateId,
    statement_template_id: statementTemplateId,
    is_default: defaultId === statementTemplateId,
  }));

  const { error: insertError } = await supabase
    .from("case_template_statement_templates")
    .insert(rows);

  if (insertError) throw insertError;
}

export async function createCaseConfigSnapshot(params: {
  tenantId: string;
  templateId?: string | null;
  createdForCaseId?: string | null;
}): Promise<string> {
  const supabase = getSupabaseClient();

  let configName = "Default case config";
  let templateScope: TemplateScope = "global";
  let configJson: CaseConfig = { dynamicFields: [] };

  if (params.templateId) {
    const { data: template, error: templateError } = await supabase
      .from("case_templates")
      .select(CASE_TEMPLATE_SELECT)
      .eq("id", params.templateId)
      .single();

    if (templateError) throw templateError;

    const caseTemplate = toCaseTemplate(template, "createCaseConfigSnapshot");
    configName = caseTemplate.name;
    templateScope = caseTemplate.template_scope;

    if (caseTemplate.status === "published") {
      // Legacy rows may be marked published with null published_config.
      // Fall back to draft_config so snapshotting never blocks case creation.
      configJson = caseTemplate.published_config ?? caseTemplate.draft_config;
    } else {
      configJson = caseTemplate.draft_config;
    }
  }

  const { data, error } = await supabase
    .from("case_config_snapshots")
    .insert({
      template_id: params.templateId ?? null,
      tenant_id: params.tenantId,
      created_for_case_id: params.createdForCaseId ?? null,
      template_scope: templateScope,
      config_name: configName,
      config_json: configJson as unknown as Json,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
