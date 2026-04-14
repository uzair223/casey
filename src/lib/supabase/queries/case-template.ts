import type {
  CaseConfig,
  CaseTemplate,
  CaseTemplateStatementTemplateRelation,
  StatementConfig,
  StatementConfigTemplate,
  TemplateScope,
  TemplateStatus,
  TenantCaseTemplatePreferences,
} from "@/types";
import { CaseConfigSchema } from "@/lib/schema";
import { getSupabaseClient } from "../client";

type CaseTemplateStatementTemplateLink = Pick<
  CaseTemplateStatementTemplateRelation,
  "statement_template_id" | "is_default"
>;

const CASE_TEMPLATE_SELECT =
  "id, tenant_id, name, template_scope, status, draft_config, published_config, source_template_id, published_at, created_at, updated_at";

const TENANT_CASE_TEMPLATE_PREFERENCES_SELECT =
  "tenant_id, default_case_template_id, favourite_case_template_ids";

const STATEMENT_TEMPLATE_FOR_CASE_SELECT =
  "id, tenant_id, name, template_scope, status, draft_config, published_config, docx_template_document, source_template_id, published_at, created_at, updated_at";

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

function toStatementConfigTemplate(
  row: Record<string, unknown>,
): StatementConfigTemplate {
  return {
    id: row.id as string,
    tenant_id: (row.tenant_id as string | null) ?? null,
    name: row.name as string,
    template_scope: row.template_scope as TemplateScope,
    status: row.status as TemplateStatus,
    draft_config: row.draft_config as StatementConfig,
    published_config: (row.published_config as StatementConfig | null) ?? null,
    docx_template_document:
      (row.docx_template_document as StatementConfigTemplate["docx_template_document"]) ??
      null,
    source_template_id: (row.source_template_id as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    created_by: (row.created_by as string | null | undefined) ?? null,
  };
}

function withDefaultFirst<T extends { id: string }>(
  items: T[],
  defaultId: string | null,
): T[] {
  if (!defaultId) {
    return items;
  }

  return [...items].sort((a, b) => {
    if (a.id === defaultId) return -1;
    if (b.id === defaultId) return 1;
    return 0;
  });
}

export async function getCaseTemplateById(
  id: string,
): Promise<CaseTemplate | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("case_templates")
    .select(CASE_TEMPLATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data
    ? toCaseTemplate(
        data as Record<string, unknown>,
        `getCaseTemplateById:${id}`,
      )
    : null;
}

export async function listCaseTemplates(): Promise<CaseTemplate[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("case_templates")
    .select(CASE_TEMPLATE_SELECT)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) =>
    toCaseTemplate(row, "listCaseTemplates"),
  );
}

export async function getTenantCaseTemplatePreferences(
  tenantId: string,
): Promise<TenantCaseTemplatePreferences> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("case_template_tenant_preferences")
    .select(TENANT_CASE_TEMPLATE_PREFERENCES_SELECT)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return normalizePreferences(
    tenantId,
    data as TenantCaseTemplatePreferences | null,
  );
}

export async function listFavouriteCaseTemplatesForCaseCreation(params: {
  tenantId: string;
}): Promise<CaseTemplate[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("case_templates")
    .select(CASE_TEMPLATE_SELECT)
    .eq("status", "published")
    .or(`tenant_id.eq.${params.tenantId},tenant_id.is.null`)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const templates = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    toCaseTemplate(row, "listFavouriteCaseTemplatesForCaseCreation"),
  );

  const preferences = await getTenantCaseTemplatePreferences(params.tenantId);
  const favouriteSet = new Set(preferences.favourite_case_template_ids);
  const favourites = templates.filter((template) =>
    favouriteSet.has(template.id),
  );

  return withDefaultFirst(favourites, preferences.default_case_template_id);
}

export async function getCaseTemplateStatementTemplateLinks(
  caseTemplateId: string,
): Promise<CaseTemplateStatementTemplateLink[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("case_template_statement_templates")
    .select("statement_template_id, is_default")
    .eq("case_template_id", caseTemplateId);

  if (error) throw error;

  return (data ?? []) as CaseTemplateStatementTemplateLink[];
}

export async function listAllowedStatementTemplatesForCaseTemplate(params: {
  tenantId: string;
  caseTemplateId: string;
}): Promise<StatementConfigTemplate[]> {
  const supabase = getSupabaseClient();

  const [links, { data: templatesData, error: templateError }] =
    await Promise.all([
      getCaseTemplateStatementTemplateLinks(params.caseTemplateId),
      supabase
        .from("statement_config_templates")
        .select(STATEMENT_TEMPLATE_FOR_CASE_SELECT)
        .eq("status", "published")
        .or(`tenant_id.eq.${params.tenantId},tenant_id.is.null`),
    ]);

  if (templateError) throw templateError;

  const linkSet = new Set(links.map((link) => link.statement_template_id));
  const defaultLink = links.find((link) => link.is_default);

  const allowedTemplates = ((templatesData ?? []) as Record<string, unknown>[])
    .filter((template) => linkSet.has(template.id as string))
    .map(toStatementConfigTemplate);

  return withDefaultFirst(
    allowedTemplates,
    defaultLink?.statement_template_id ?? null,
  );
}
