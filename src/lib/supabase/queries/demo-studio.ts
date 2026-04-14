import { getServiceClient } from "../server";

const TEMPLATE_FIELDS =
  "id, tenant_id, name, status, template_scope, draft_config, published_config, docx_template_document";
const CASE_TEMPLATE_FIELDS =
  "id, tenant_id, name, status, template_scope, draft_config, published_config";

type DemoCaseField = {
  id: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "date";
  placeholder?: string;
};

type DemoWitnessField = {
  id: string;
  label: string;
  required: boolean;
  requiredOnCreate: boolean;
  description?: string;
};

function toDemoCaseFields(config: unknown): DemoCaseField[] {
  if (!config || typeof config !== "object") return [];
  const fields = (config as { dynamicFields?: unknown }).dynamicFields;
  if (!Array.isArray(fields)) return [];

  return fields
    .filter(
      (field): field is Record<string, unknown> =>
        !!field && typeof field === "object",
    )
    .map((field) => ({
      id: String(field.id ?? "").trim(),
      label: String(field.label ?? "").trim(),
      required: Boolean(field.required),
      type: (field.type === "number" || field.type === "date"
        ? field.type
        : "text") as "text" | "number" | "date",
      placeholder:
        typeof field.placeholder === "string" && field.placeholder.trim()
          ? field.placeholder.trim()
          : undefined,
    }))
    .filter((field) => field.id && field.label);
}

function toDemoWitnessFields(config: unknown): DemoWitnessField[] {
  if (!config || typeof config !== "object") return [];
  const fields = (config as { witness_metadata_fields?: unknown })
    .witness_metadata_fields;
  if (!Array.isArray(fields)) return [];

  return fields
    .filter(
      (field): field is Record<string, unknown> =>
        !!field && typeof field === "object",
    )
    .map((field) => ({
      id: String(field.id ?? "").trim(),
      label: String(field.label ?? "").trim(),
      required: Boolean(field.required),
      requiredOnCreate: Boolean(field.requiredOnCreate),
      description:
        typeof field.description === "string" && field.description.trim()
          ? field.description.trim()
          : undefined,
    }))
    .filter((field) => field.id && field.label);
}

export async function SERVERONLY_getDemoStudioBootstrapOptions() {
  const supabase = getServiceClient("SERVERONLY_getDemoStudioBootstrapOptions");

  const [
    { data: tenants, error: tenantsError },
    { data: caseTemplates, error: caseTemplatesError },
    { data: statementTemplates, error: statementTemplatesError },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("case_templates")
      .select(CASE_TEMPLATE_FIELDS)
      .eq("status", "published")
      .order("updated_at", { ascending: false }),
    supabase
      .from("statement_config_templates")
      .select(TEMPLATE_FIELDS)
      .eq("status", "published")
      .order("updated_at", { ascending: false }),
  ]);

  if (tenantsError) throw tenantsError;
  if (caseTemplatesError) throw caseTemplatesError;
  if (statementTemplatesError) throw statementTemplatesError;

  return {
    tenants: tenants ?? [],
    caseTemplates: (caseTemplates ?? []).map((template) => ({
      id: template.id,
      tenant_id: template.tenant_id,
      name: template.name,
      fields: toDemoCaseFields(
        template.published_config ?? template.draft_config,
      ),
    })),
    statementTemplates: (statementTemplates ?? []).map((template) => ({
      id: template.id,
      tenant_id: template.tenant_id,
      name: template.name,
      witness_fields: toDemoWitnessFields(
        template.published_config ?? template.draft_config,
      ),
    })),
  };
}

export async function SERVERONLY_listConversationMessages(statementId: string) {
  const supabase = getServiceClient("SERVERONLY_listConversationMessages");

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, statement_id, role, content, meta, created_at")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export type DemoStudioStatementRow = {
  id: string;
  title: string;
  status: string;
  witness_name: string;
  witness_email: string;
  created_at: string;
  tenant_name: string;
  case_title: string;
  intake_url: string;
  magic_link_token: string;
  magic_link_expires_at: string;
};

export async function SERVERONLY_listDemoStudioStatements() {
  const supabase = getServiceClient("SERVERONLY_listDemoStudioStatements");

  const { data, error } = await supabase
    .from("statements")
    .select(
      "id, title, status, witness_name, witness_email, created_at, cases(title), tenants(name), magic_links(token, expires_at)",
    )
    .in("status", ["demo", "demo_published"])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((statement) => ({
    id: statement.id,
    title: statement.title ?? "Untitled statement",
    status: statement.status,
    witness_name: statement.witness_name ?? "",
    witness_email: statement.witness_email ?? "",
    created_at: statement.created_at,
    tenant_name: statement.tenants?.name ?? "",
    case_title: statement.cases?.title ?? "",
    intake_url: "",
    magic_link_token: statement.magic_links?.[0]?.token ?? "",
    magic_link_expires_at: statement.magic_links?.[0]?.expires_at ?? "",
  })) satisfies DemoStudioStatementRow[];
}
