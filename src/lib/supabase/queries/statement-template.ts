import type {
  StatementConfigTemplate,
  PublishedStatementConfigTemplate,
} from "@/types/common";
import { getSupabaseClient } from "../client";

const TEMPLATE_SELECT =
  "id, tenant_id, name, template_scope, status, draft_config, published_config, docx_template_document, source_template_id, published_at, created_at, updated_at, created_by";

const PUBLISHED_TEMPLATE_SELECT =
  "id, name, template_scope, published_config, docx_template_document";

async function getPublishedTemplateByScope(params: {
  templateId: string;
  tenantId?: string;
}): Promise<PublishedStatementConfigTemplate | null> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("statement_config_templates")
    .select(PUBLISHED_TEMPLATE_SELECT)
    .eq("id", params.templateId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (params.tenantId) {
    query = query.eq("tenant_id", params.tenantId);
  } else {
    query = query.is("tenant_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PublishedStatementConfigTemplate | null) ?? null;
}

export async function getPublishedTemplate(params: {
  tenantId: string;
  templateId: string;
}): Promise<PublishedStatementConfigTemplate | null> {
  const tenantTemplate = await getPublishedTemplateByScope({
    templateId: params.templateId,
    tenantId: params.tenantId,
  });

  if (tenantTemplate) {
    return tenantTemplate;
  }

  return getPublishedTemplateByScope({ templateId: params.templateId });
}

export async function listStatementTemplates(): Promise<
  StatementConfigTemplate[]
> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("statement_config_templates")
    .select(TEMPLATE_SELECT)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as StatementConfigTemplate[];
}
