import { getServiceClient } from "../server";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import type { Json, TemplateScope } from "@/types";

const TEMPLATE_FIELDS =
  "id, tenant_id, name, status, template_scope, published_config, published_docx_template_document";
const CASE_TEMPLATE_FIELDS =
  "id, tenant_id, name, status, template_scope, published_config";

type CreateDemoStudioStatementInput = {
  actorUserId: string;
  tenantId?: string;
  tenantName?: string;
  caseTemplateId?: string | null;
  statementTemplateId?: string | null;
  caseTitle?: string;
  witnessName?: string;
  witnessEmail?: string;
  caseMetadata?: Record<string, string>;
  witnessMetadata?: Record<string, string>;
};

type CreateConversationMessageInput = {
  statementId: string;
  role: "user" | "assistant" | "system";
  content: string;
  meta?: Record<string, unknown> | null;
};

type UpdateConversationMessageInput = {
  content?: string;
  meta?: Record<string, unknown> | null;
};

function ensureEmail(value?: string) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalized) ? normalized : null;
}

export async function SERVERONLY_createDemoStudioStatement(
  input: CreateDemoStudioStatementInput,
) {
  const supabase = getServiceClient("SERVERONLY_createDemoStudioStatement");

  const normalizedTenantName = input.tenantName?.trim();
  let tenant: { id: string; name: string } | null = null;

  if (input.tenantId) {
    const { data: tenantById, error: tenantByIdError } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", input.tenantId)
      .maybeSingle();

    if (tenantByIdError) throw tenantByIdError;
    tenant = tenantById;
  }

  if (!tenant && normalizedTenantName) {
    const { data: tenantByName, error: tenantByNameError } = await supabase
      .from("tenants")
      .select("id, name")
      .ilike("name", normalizedTenantName)
      .maybeSingle();

    if (tenantByNameError) throw tenantByNameError;
    tenant = tenantByName;
  }

  if (!tenant) {
    if (!normalizedTenantName) {
      throw new Error("tenantId or tenantName is required");
    }

    const { data: createdTenant, error: createdTenantError } = await supabase
      .from("tenants")
      .insert({ name: normalizedTenantName })
      .select("id, name")
      .single();

    if (createdTenantError || !createdTenant) {
      throw createdTenantError ?? new Error("Failed to create demo tenant");
    }

    tenant = createdTenant;
  }

  const resolvedTenantId = tenant.id;

  let selectedStatementTemplate: {
    id: string;
    name: string;
    template_scope: "global" | "tenant";
    published_config: Json | null;
    published_docx_template_document: Json | null;
  } | null = null;

  if (input.statementTemplateId) {
    const { data: template, error: templateError } = await supabase
      .from("statement_config_templates")
      .select(TEMPLATE_FIELDS)
      .eq("id", input.statementTemplateId)
      .eq("status", "published")
      .or(`tenant_id.eq.${resolvedTenantId},tenant_id.is.null`)
      .maybeSingle();

    if (templateError) throw templateError;
    if (!template) {
      throw new Error("Published statement template not found for tenant");
    }

    selectedStatementTemplate = {
      id: template.id,
      name: template.name,
      template_scope: template.template_scope as TemplateScope,
      published_config: template.published_config,
      published_docx_template_document:
        template.published_docx_template_document,
    };
  }

  let selectedCaseTemplateId: string | null = null;
  let allowedStatementTemplateIds: string[] = [];
  if (input.caseTemplateId) {
    const { data: caseTemplate, error: caseTemplateError } = await supabase
      .from("case_templates")
      .select(CASE_TEMPLATE_FIELDS)
      .eq("id", input.caseTemplateId)
      .eq("status", "published")
      .or(`tenant_id.eq.${resolvedTenantId},tenant_id.is.null`)
      .maybeSingle();

    if (caseTemplateError) throw caseTemplateError;
    if (!caseTemplate) {
      throw new Error("Published case template not found for tenant");
    }

    selectedCaseTemplateId = caseTemplate.id;

    const { data: links, error: linksError } = await supabase
      .from("case_template_statement_templates")
      .select("statement_template_id")
      .eq("case_template_id", selectedCaseTemplateId);

    if (linksError) throw linksError;
    allowedStatementTemplateIds = (links ?? []).map(
      (link) => link.statement_template_id,
    );
  }

  if (
    selectedCaseTemplateId &&
    selectedStatementTemplate &&
    !allowedStatementTemplateIds.includes(selectedStatementTemplate.id)
  ) {
    throw new Error(
      "Selected witness template is not allowed for the selected case template",
    );
  }

  const snapshotName =
    selectedStatementTemplate?.name ?? "Demo statement config";

  const { data: snapshot, error: snapshotError } = await supabase
    .from("statement_config_snapshots")
    .insert({
      template_id: selectedStatementTemplate?.id ?? null,
      tenant_id: resolvedTenantId,
      template_scope: selectedStatementTemplate?.template_scope ?? "global",
      config_name: snapshotName,
      config_json:
        (selectedStatementTemplate?.published_config as Json | null) ??
        (EMPTY_STATEMENT_CONFIG as unknown as Json),
      template_document:
        (selectedStatementTemplate?.published_docx_template_document as Json | null) ??
        null,
    })
    .select("id")
    .single();

  if (snapshotError || !snapshot) {
    throw snapshotError ?? new Error("Failed to create config snapshot");
  }

  const caseTitle =
    input.caseTitle?.trim() ||
    `Demo Intake ${new Date().toISOString().slice(0, 10)}`;

  const normalizedCaseMetadata = Object.fromEntries(
    Object.entries(input.caseMetadata ?? {}).map(([key, value]) => [
      key,
      String(value ?? "").trim(),
    ]),
  );

  const { data: createdCase, error: caseError } = await supabase
    .from("cases")
    .insert({
      tenant_id: resolvedTenantId,
      title: caseTitle,
      case_template_id: selectedCaseTemplateId,
      case_metadata: {
        demo: true,
        created_by: input.actorUserId,
        ...normalizedCaseMetadata,
      } as Json,
      status: "in_progress",
    })
    .select("id, title")
    .single();

  if (caseError || !createdCase) {
    await supabase
      .from("statement_config_snapshots")
      .delete()
      .eq("id", snapshot.id);
    throw caseError ?? new Error("Failed to create demo case");
  }

  const witnessName = input.witnessName?.trim() || "Demo Witness";
  const witnessEmail =
    ensureEmail(input.witnessEmail) ?? "demo.witness@example.com";
  const normalizedWitnessMetadata = Object.fromEntries(
    Object.entries(input.witnessMetadata ?? {}).map(([key, value]) => [
      key,
      String(value ?? "").trim(),
    ]),
  );

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .insert({
      case_id: createdCase.id,
      tenant_id: resolvedTenantId,
      template_id: selectedStatementTemplate?.id ?? null,
      config_snapshot_id: snapshot.id,
      title: `Statement for ${witnessName}`,
      witness_name: witnessName,
      witness_email: witnessEmail,
      witness_metadata: normalizedWitnessMetadata as Json,
      status: "demo",
    })
    .select("id, title")
    .single();

  if (statementError || !statement) {
    await supabase.from("cases").delete().eq("id", createdCase.id);
    await supabase
      .from("statement_config_snapshots")
      .delete()
      .eq("id", snapshot.id);
    throw statementError ?? new Error("Failed to create demo statement");
  }

  const token = `demo-${statement.id}`;
  const expiresAt = "9999-12-31T23:59:59.999Z";

  const { error: linkError } = await supabase.from("magic_links").insert({
    token,
    statement_id: statement.id,
    tenant_id: resolvedTenantId,
    expires_at: expiresAt,
  });

  if (linkError) {
    await supabase.from("statements").delete().eq("id", statement.id);
    await supabase.from("cases").delete().eq("id", createdCase.id);
    await supabase
      .from("statement_config_snapshots")
      .delete()
      .eq("id", snapshot.id);
    throw linkError;
  }

  return {
    tenant,
    case: createdCase,
    statement,
    magicLink: {
      token,
      expiresAt,
    },
  };
}

export async function SERVERONLY_createConversationMessage(
  input: CreateConversationMessageInput,
) {
  const supabase = getServiceClient("SERVERONLY_createConversationMessage");

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id")
    .eq("id", input.statementId)
    .maybeSingle();

  if (statementError) throw statementError;
  if (!statement) {
    throw new Error("Statement not found");
  }

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({
      statement_id: input.statementId,
      role: input.role,
      content: input.content,
      meta: (input.meta ?? null) as Json,
    })
    .select("id, statement_id, role, content, meta, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function SERVERONLY_updateConversationMessage(
  messageId: string,
  input: UpdateConversationMessageInput,
) {
  const supabase = getServiceClient("SERVERONLY_updateConversationMessage");

  const updatePayload: {
    content?: string;
    meta?: Json | null;
  } = {};

  if (input.content !== undefined) {
    updatePayload.content = input.content;
  }

  if (input.meta !== undefined) {
    updatePayload.meta = (input.meta ?? null) as Json | null;
  }

  const { data, error } = await supabase
    .from("conversation_messages")
    .update(updatePayload)
    .eq("id", messageId)
    .select("id, statement_id, role, content, meta, created_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Message not found");
  }

  return data;
}

export async function SERVERONLY_deleteConversationMessage(messageId: string) {
  const supabase = getServiceClient("SERVERONLY_deleteConversationMessage");

  const { data, error } = await supabase
    .from("conversation_messages")
    .delete()
    .eq("id", messageId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Message not found");
  }
}
