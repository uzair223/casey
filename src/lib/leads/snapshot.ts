import type { SupabaseClient } from "@supabase/supabase-js";

import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import type { Database, Json } from "@/types";
import { parseLeadTypeConfig } from "./schema";

type Client = SupabaseClient<Database>;

export async function statementTemplateIdForRole(
  supabase: Client,
  leadTypeId: string | null | undefined,
  roleKey: string | null | undefined,
) {
  if (!leadTypeId) return null;
  const { data, error } = await supabase
    .from("case_templates")
    .select("participant_roles")
    .eq("id", leadTypeId)
    .maybeSingle();
  if (error) throw error;
  const config = parseLeadTypeConfig({
    participant_roles: data?.participant_roles,
  });
  const role =
    config.participant_roles.find((item) => item.key === roleKey) ??
    config.participant_roles.find((item) => item.kind === "primary");
  return role?.statement_template_id ?? null;
}

export async function freezeStatementConfig(
  supabase: Client,
  params: {
    statementId: string;
    tenantId: string;
    templateId?: string | null;
  },
) {
  const { data: statement, error } = await supabase
    .from("statements")
    .select("config_snapshot_id")
    .eq("id", params.statementId)
    .maybeSingle();
  if (error) throw error;
  if (statement?.config_snapshot_id) return statement.config_snapshot_id;

  let configName = "Default statement config";
  let templateScope = "global";
  let configJson: Json = EMPTY_STATEMENT_CONFIG as unknown as Json;
  const templateId = params.templateId ?? null;
  if (templateId) {
    const { data: template, error: templateError } = await supabase
      .from("statement_config_templates")
      .select("name, template_scope, published_config, draft_config")
      .eq("id", templateId)
      .maybeSingle();
    if (templateError) throw templateError;
    if (template) {
      configName = template.name;
      templateScope = template.template_scope;
      const published = template.published_config ?? template.draft_config;
      if (published) configJson = published;
    }
  }

  const { data, error: insertError } = await supabase
    .from("statement_config_snapshots")
    .insert({
      template_id: templateId,
      tenant_id: params.tenantId,
      created_for_statement_id: params.statementId,
      template_scope: templateScope,
      config_name: configName,
      config_json: configJson,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  const { error: linkError } = await supabase
    .from("statements")
    .update({
      config_snapshot_id: data.id,
      ...(templateId ? { template_id: templateId } : {}),
    })
    .eq("id", params.statementId);
  if (linkError) throw linkError;
  return data.id;
}
