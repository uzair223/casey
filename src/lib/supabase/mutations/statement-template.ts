import type { Database } from "@/types";
import type {
  StatementConfigTemplate,
  TemplateScope,
  TemplateStatus,
  UploadedDocument,
} from "@/types/common";
import type { StatementConfig } from "@/types/schema";
import type { Json } from "@/types";
import { getSupabaseClient } from "../client";
import { downloadUploadedDocument } from "../queries/upload";
import { uploadFile } from "./upload";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";

type UpsertTemplateInput = {
  tenantId?: string | null;
  name: string;
  templateScope: TemplateScope;
  status?: TemplateStatus;
  draftConfig: StatementConfig;
  docxTemplateDocument?: unknown;
  sourceTemplateId?: string | null;
};

const TEMPLATE_SELECT =
  "id, tenant_id, name, template_scope, status, draft_config, published_config, source_template_id, published_at, created_at, updated_at, created_by";

async function getTemplateDocumentColumns(templateId: string): Promise<{
  draftDoc: UploadedDocument | null;
  publishedDoc: UploadedDocument | null;
}> {
  const supabase = getSupabaseClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          single: () => Promise<{
            data: Record<string, unknown> | null;
            error: unknown;
          }>;
        };
      };
    };
  };

  try {
    const { data, error } = await supabase
      .from("statement_config_templates")
      .select("draft_docx_template_document, published_docx_template_document")
      .eq("id", templateId)
      .single();

    if (error || !data) {
      return { draftDoc: null, publishedDoc: null };
    }

    const draftDoc =
      (data.draft_docx_template_document as UploadedDocument | null) ?? null;
    const publishedDoc =
      (data.published_docx_template_document as UploadedDocument | null) ??
      null;

    return { draftDoc, publishedDoc };
  } catch {
    // Column may not exist yet in environments where migrations have not run.
    return { draftDoc: null, publishedDoc: null };
  }
}

async function setDraftTemplateDocumentColumn(params: {
  templateId: string;
  document: Json | null;
}) {
  const supabase = getSupabaseClient() as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<unknown>;
      };
    };
  };

  try {
    await supabase
      .from("statement_config_templates")
      .update({ draft_docx_template_document: params.document })
      .eq("id", params.templateId);
  } catch {
    // Ignore until migration is applied.
  }
}

async function setPublishedTemplateDocumentColumn(params: {
  templateId: string;
  document: Json | null;
}) {
  const supabase = getSupabaseClient() as unknown as {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<unknown>;
      };
    };
  };

  try {
    await supabase
      .from("statement_config_templates")
      .update({ published_docx_template_document: params.document })
      .eq("id", params.templateId);
  } catch {
    // Ignore until migration is applied.
  }
}

function normalizeTemplateRow(
  row: Record<string, unknown>,
): StatementConfigTemplate {
  const draftDoc =
    (row.draft_docx_template_document as
      | StatementConfigTemplate["draft_docx_template_document"]
      | null
      | undefined) ?? null;

  const publishedDoc =
    (row.published_docx_template_document as
      | StatementConfigTemplate["published_docx_template_document"]
      | null
      | undefined) ?? null;

  return {
    ...(row as StatementConfigTemplate),
    draft_docx_template_document: draftDoc,
    published_docx_template_document: publishedDoc,
  };
}

function createDefaultConfig(): StatementConfig {
  return {
    ...EMPTY_STATEMENT_CONFIG,
    agents: {
      chat: "Template-defined chat behavior",
      formalize: "Template-defined formalization behavior",
    },
  };
}

async function getTemplateById(
  templateId: string,
): Promise<StatementConfigTemplate> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("statement_config_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .single();

  if (error) {
    throw error;
  }

  const docColumns = await getTemplateDocumentColumns(templateId);
  return normalizeTemplateRow({
    ...(data as Record<string, unknown>),
    draft_docx_template_document: docColumns.draftDoc,
    published_docx_template_document: docColumns.publishedDoc,
  });
}

export async function createStatementTemplate(
  payload: UpsertTemplateInput,
): Promise<StatementConfigTemplate> {
  const supabase = getSupabaseClient();

  const insertPayload: Database["public"]["Tables"]["statement_config_templates"]["Insert"] =
    {
      tenant_id: payload.templateScope === "global" ? null : payload.tenantId,
      name: payload.name,
      template_scope: payload.templateScope,
      status: payload.status ?? "draft",
      draft_config: payload.draftConfig as unknown as Json,
      source_template_id: payload.sourceTemplateId ?? null,
    };

  const { data, error } = await supabase
    .from("statement_config_templates")
    .insert(insertPayload)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (payload.docxTemplateDocument !== undefined && data?.id) {
    await setDraftTemplateDocumentColumn({
      templateId: data.id,
      document: payload.docxTemplateDocument as Json | null,
    });
  }

  const latest = await getTemplateById(data.id);
  return latest;
}

export async function updateStatementTemplate(
  templateId: string,
  payload: Partial<UpsertTemplateInput>,
): Promise<StatementConfigTemplate> {
  const supabase = getSupabaseClient();
  const updatePayload: Record<string, unknown> = {};

  if (payload.templateScope !== undefined) {
    updatePayload.template_scope = payload.templateScope;
    updatePayload.tenant_id =
      payload.templateScope === "global" ? null : payload.tenantId;
  } else if (payload.tenantId !== undefined) {
    updatePayload.tenant_id = payload.tenantId;
  }

  if (payload.name !== undefined) updatePayload.name = payload.name;
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (payload.draftConfig !== undefined)
    updatePayload.draft_config = payload.draftConfig as unknown as Json;
  if (payload.sourceTemplateId !== undefined)
    updatePayload.source_template_id = payload.sourceTemplateId;

  const { data, error } = await supabase
    .from("statement_config_templates")
    .update(updatePayload)
    .eq("id", templateId)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (payload.docxTemplateDocument !== undefined) {
    await setDraftTemplateDocumentColumn({
      templateId,
      document: payload.docxTemplateDocument as Json | null,
    });
  }

  const latest = await getTemplateById(templateId);
  return latest;
}

export async function publishStatementTemplate(
  templateId: string,
): Promise<StatementConfigTemplate> {
  const supabase = getSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("statement_config_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .single();

  if (currentError) {
    throw currentError;
  }

  const docColumns = await getTemplateDocumentColumns(templateId);
  const draftDoc = docColumns.draftDoc ?? null;

  const { data, error } = await supabase
    .from("statement_config_templates")
    .update({
      status: "published",
      published_config: (current as StatementConfigTemplate)
        .draft_config as Json,
      published_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  await setPublishedTemplateDocumentColumn({
    templateId,
    document: draftDoc as Json | null,
  });

  return getTemplateById(templateId);
}

export async function restoreStatementTemplateDraftFromPublished(
  templateId: string,
): Promise<StatementConfigTemplate> {
  const supabase = getSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("statement_config_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .single();

  if (currentError) {
    throw currentError;
  }

  if (!current.published_config) {
    throw new Error("No published version is available to restore.");
  }

  const docColumns = await getTemplateDocumentColumns(templateId);
  const publishedDoc = docColumns.publishedDoc ?? null;

  const { data, error } = await supabase
    .from("statement_config_templates")
    .update({
      draft_config: (current as StatementConfigTemplate)
        .published_config as Json,
    })
    .eq("id", templateId)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  await setDraftTemplateDocumentColumn({
    templateId,
    document: publishedDoc as Json | null,
  });

  return getTemplateById(templateId);
}

export async function deleteStatementTemplate(
  templateId: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("statement_config_templates")
    .delete()
    .eq("id", templateId);

  if (error) {
    throw error;
  }
}

export async function createStatementConfigSnapshot(params: {
  tenantId: string;
  templateId?: string | null;
  createdForStatementId?: string | null;
}): Promise<string> {
  const supabase = getSupabaseClient();

  let configName = "Default statement config";
  let templateScope: TemplateScope = "global";
  let configJson: StatementConfig = createDefaultConfig();
  let templateDocument: UploadedDocument | null = null;

  if (params.templateId) {
    const template = await getTemplateById(params.templateId);
    configName = template.name;
    templateScope = template.template_scope as TemplateScope;

    // Prefer published snapshot artifacts when available; fall back to draft.
    configJson = template.published_config ?? template.draft_config;

    const sourceDoc =
      template.published_docx_template_document ??
      template.draft_docx_template_document;

    if (sourceDoc) {
      const source = sourceDoc;
      const blob = await downloadUploadedDocument(source);
      const copiedName = source.name || `${template.name}.docx`;
      const extension = copiedName.toLowerCase().endsWith(".docx")
        ? ""
        : ".docx";

      const copiedPath = [
        "statement-snapshots",
        params.tenantId,
        `${Date.now()}-${template.id}-${copiedName}${extension}`,
      ].join("/");

      templateDocument = await uploadFile({
        bucketId: params.tenantId,
        name: copiedName,
        path: copiedPath,
        file: blob,
        contentType:
          source.type ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    }
  }

  const { data, error } = await supabase
    .from("statement_config_snapshots")
    .insert({
      template_id: params.templateId ?? null,
      tenant_id: params.tenantId,
      created_for_statement_id: params.createdForStatementId ?? null,
      template_scope: templateScope,
      config_name: configName,
      config_json: configJson as unknown as Json,
      template_document: templateDocument as unknown as Json,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}
