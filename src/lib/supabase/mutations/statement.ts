import type {
  Json,
  Statement,
  StatementSubmission,
  UploadedDocument,
} from "@/types";
import type { UpdateStatementSchemaType } from "@/lib/schema/statement";
import { type ResponseMetadata } from "@/lib/schema";
import { generateSecureToken } from "@/lib/security";
import { EMPTY_STATEMENT_CONFIG, normalizeConfig } from "@/lib/statement-utils";
import { getServiceClient } from "../server";
import { getSupabaseClient } from "../client";
import { syncCaseStatusFromWitnesses } from "./case";
import { getPublishedTemplate } from "../queries/statement-template";
import {
  getStatementWithConfigFromToken,
  SERVERONLY_getStatementWithConfigFromToken,
} from "../queries/statement";
import { createStatementConfigSnapshot } from "./statement-template";

type WitnessMetadataRecord = Record<string, string | null>;

type QueryClient =
  | ReturnType<typeof getSupabaseClient>
  | ReturnType<typeof getServiceClient>;

type StorageTarget = {
  bucketId: string;
  path: string;
};

function toStorageTarget(
  value: unknown,
  fallbackBucketId?: string | null,
): StorageTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const document = value as UploadedDocument;
  const bucketId =
    typeof document.bucketId === "string" && document.bucketId.length > 0
      ? document.bucketId
      : (fallbackBucketId ?? null);
  const path = typeof document.path === "string" ? document.path : null;

  if (!bucketId || !path) {
    return null;
  }

  return { bucketId, path };
}

async function removeStorageTargets(
  supabase: QueryClient,
  targets: StorageTarget[],
): Promise<void> {
  if (targets.length === 0) {
    return;
  }

  const bucketToPaths = new Map<string, Set<string>>();
  for (const target of targets) {
    const paths = bucketToPaths.get(target.bucketId) ?? new Set<string>();
    paths.add(target.path);
    bucketToPaths.set(target.bucketId, paths);
  }

  for (const [bucketId, paths] of bucketToPaths.entries()) {
    const { error } = await supabase.storage
      .from(bucketId)
      .remove(Array.from(paths));

    if (error) {
      // Best-effort cleanup: record deletion should still proceed.
      continue;
    }
  }
}

async function cleanupStatementStorageDocuments(
  supabase: QueryClient,
  statementId: string,
): Promise<void> {
  const { data: statement, error } = await supabase
    .from("statements")
    .select(
      "tenant_id, signed_document, supporting_documents, config_snapshot_id",
    )
    .eq("id", statementId)
    .maybeSingle();

  if (error || !statement) {
    return;
  }

  const fallbackBucketId = statement.tenant_id;
  const targets: StorageTarget[] = [];

  const signedTarget = toStorageTarget(
    statement.signed_document,
    fallbackBucketId,
  );
  if (signedTarget) {
    targets.push(signedTarget);
  }

  const supportingDocuments = Array.isArray(statement.supporting_documents)
    ? statement.supporting_documents
    : [];
  for (const supportingDocument of supportingDocuments) {
    const target = toStorageTarget(supportingDocument, fallbackBucketId);
    if (target) {
      targets.push(target);
    }
  }

  if (statement.config_snapshot_id) {
    const { data: snapshot } = await supabase
      .from("statement_config_snapshots")
      .select("template_document")
      .eq("id", statement.config_snapshot_id)
      .maybeSingle();

    const templateTarget = toStorageTarget(
      snapshot?.template_document,
      fallbackBucketId,
    );
    if (templateTarget) {
      targets.push(templateTarget);
    }
  }

  await removeStorageTargets(supabase, targets);
}

function toWitnessMetadataRecord(value: unknown): WitnessMetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const next: WitnessMetadataRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || entry === null) {
      next[key] = entry;
    }
  }

  return next;
}

function toWitnessMetadataPatch(
  patch: unknown,
): Record<string, string | null | undefined> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return {};
  }

  const next: Record<string, string | null | undefined> = {};
  for (const [key, entry] of Object.entries(patch)) {
    if (typeof entry === "string" || entry === null || entry === undefined) {
      next[key] = entry;
    }
  }

  return next;
}

async function getSnapshotConfigById(
  supabase: QueryClient,
  snapshotId?: string | null,
) {
  if (!snapshotId) {
    return null;
  }

  const { data, error } = await supabase
    .from("statement_config_snapshots")
    .select("config_json")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeConfig(data.config_json) : null;
}

async function resolveWitnessMetadataPatch(
  supabase: QueryClient,
  statementId: string,
  patch: unknown,
): Promise<WitnessMetadataRecord> {
  const metadataPatch = toWitnessMetadataPatch(patch);

  const { data: statement, error } = await supabase
    .from("statements")
    .select("witness_metadata, config_snapshot_id")
    .eq("id", statementId)
    .single();

  if (error) {
    throw error;
  }

  const existing = toWitnessMetadataRecord(
    (statement as Statement | null)?.witness_metadata,
  );
  const config = await getSnapshotConfigById(
    supabase,
    (statement as Statement | null)?.config_snapshot_id ?? null,
  );

  const witnessFields = (config ?? EMPTY_STATEMENT_CONFIG)
    .witness_metadata_fields as Array<{
    id: string;
    requiredOnIntake?: boolean;
  }>;

  const requiredKeys = new Set(
    witnessFields
      .filter((field) => field.requiredOnIntake)
      .map((field) => field.id),
  );

  const resolved: WitnessMetadataRecord = { ...existing };

  for (const [key, value] of Object.entries(metadataPatch)) {
    if (value === undefined) {
      continue;
    }

    if (value === null) {
      if (!requiredKeys.has(key)) {
        delete resolved[key];
      }
      continue;
    }

    resolved[key] = value;
  }

  return resolved;
}

export const SERVERONLY_submitStatement = async (
  token: string,
  submission: StatementSubmission,
): Promise<string> => {
  const supabase = getServiceClient("SERVERONLY_submitStatement");
  const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

  if (statement.status === "locked" || statement.status === "demo_published") {
    throw new Error(
      "This intake has been stopped and cannot be submitted. Please contact the law firm.",
    );
  }

  const updatePayload: {
    signed_document: Json;
    sections?: Json;
    supporting_documents?: Json;
    status: "submitted" | "demo_published";
  } = {
    signed_document: submission.signedDocument,
    status: statement.status === "demo" ? "demo_published" : "submitted",
  };

  if (submission.sections) {
    updatePayload.sections = submission.sections as Json;
  }

  if (submission.supportingDocuments) {
    updatePayload.supporting_documents = submission.supportingDocuments as Json;
  }

  const { error: statementUpdateError } = await supabase
    .from("statements")
    .update(updatePayload)
    .eq("id", statement.id);

  if (statementUpdateError) {
    throw statementUpdateError;
  }

  await syncCaseStatusFromWitnesses(statement.case_id, supabase);
  return statement.id;
};

export const SERVERONLY_saveConversationMessage = async (
  statementId: string,
  role: "user" | "assistant" | "system",
  content: string,
  meta?: Record<string, unknown> | null,
) => {
  const supabase = getServiceClient("SERVERONLY_saveConversationMessage");
  const { error } = await supabase.from("conversation_messages").insert({
    statement_id: statementId,
    role,
    content,
    meta: (meta ?? null) as Json,
  });

  if (error) {
    throw error;
  }
};

export const SERVERONLY_updateLatestAssistantConversationMeta = async (
  statementId: string,
  meta: ResponseMetadata,
) => {
  const supabase = getServiceClient(
    "SERVERONLY_updateLatestAssistantConversationMeta",
  );

  const { data: latestMessage, error: latestError } = await supabase
    .from("conversation_messages")
    .select("id")
    .eq("statement_id", statementId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  if (!latestMessage) {
    throw new Error("Latest assistant message not found");
  }

  const { error } = await supabase
    .from("conversation_messages")
    .update({ meta: meta as Json })
    .eq("id", latestMessage.id);

  if (error) {
    throw error;
  }

  return latestMessage.id;
};

export const SERVERONLY_updateStatementStatus = async (
  statementId: string,
  status:
    | "draft"
    | "in_progress"
    | "submitted"
    | "locked"
    | "demo"
    | "demo_published",
) => {
  const supabase = getServiceClient("SERVERONLY_updateStatementStatus");

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("case_id")
    .eq("id", statementId)
    .maybeSingle();

  if (statementError || !statement) {
    throw statementError ?? new Error("Statement not found");
  }

  const { error } = await supabase
    .from("statements")
    .update({ status })
    .eq("id", statementId);

  if (error) {
    throw error;
  }

  await syncCaseStatusFromWitnesses(statement.case_id, supabase);
};

export async function createStatement(payload: {
  case_id: string;
  tenant_id: string;
  title: string;
  witness_name: string;
  witness_email: string;
  witness_metadata?: Record<string, string | null>;
  template_id?: string | null;
}) {
  const supabase = getSupabaseClient();
  const magicLinkToken = generateSecureToken();

  const effectiveTemplateId = payload.template_id ?? null;

  if (effectiveTemplateId) {
    const publishedTemplate = await getPublishedTemplate({
      tenantId: payload.tenant_id,
      templateId: effectiveTemplateId,
    });

    if (!publishedTemplate?.published_config) {
      throw new Error(
        "Only templates with published_config can be used to create statements.",
      );
    }
  }

  const { data, error } = await supabase
    .from("statements")
    .insert({
      case_id: payload.case_id,
      tenant_id: payload.tenant_id,
      title: payload.title,
      witness_name: payload.witness_name,
      witness_email: payload.witness_email,
      witness_metadata: payload.witness_metadata ?? {},
      template_id: effectiveTemplateId,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  try {
    const configSnapshotId = await createStatementConfigSnapshot({
      tenantId: payload.tenant_id,
      templateId: effectiveTemplateId,
      createdForStatementId: data.id,
    });

    const { error: snapshotLinkError } = await supabase
      .from("statements")
      .update({ config_snapshot_id: configSnapshotId })
      .eq("id", data.id);

    if (snapshotLinkError) {
      throw snapshotLinkError;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: linkError } = await supabase.from("magic_links").insert({
      token: magicLinkToken,
      statement_id: data.id,
      tenant_id: payload.tenant_id,
      expires_at: expiresAt.toISOString(),
    });

    if (linkError) {
      throw linkError;
    }
  } catch (creationError) {
    await supabase.from("statements").delete().eq("id", data.id);
    throw creationError;
  }

  return getStatementWithConfigFromToken(magicLinkToken);
}

export async function updateStatement(
  id: string,
  payload: UpdateStatementSchemaType,
) {
  const supabase = getSupabaseClient();
  const updatePayload: Record<string, unknown> = {};

  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.witness_name !== undefined)
    updatePayload.witness_name = payload.witness_name;
  if (payload.witness_email !== undefined)
    updatePayload.witness_email = payload.witness_email;
  if (payload.witness_metadata !== undefined) {
    const resolvedMetadata = await resolveWitnessMetadataPatch(
      supabase,
      id,
      payload.witness_metadata,
    );
    updatePayload.witness_metadata = resolvedMetadata as Json;
  }
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (payload.sections !== undefined)
    updatePayload.sections = payload.sections as Json;
  if (payload.signed_document !== undefined) {
    updatePayload.signed_document = payload.signed_document as Json;
  }
  if (payload.supporting_documents !== undefined) {
    updatePayload.supporting_documents = payload.supporting_documents as Json;
  }

  const { error } = await supabase
    .from("statements")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function SERVERONLY_updateStatementByToken(
  token: string,
  payload: UpdateStatementSchemaType,
) {
  const supabase = getServiceClient("SERVERONLY_updateStatementByToken");
  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("statement_id")
    .eq("token", token)
    .single();

  if (linkError) throw linkError;

  const resolvedMetadata =
    payload.witness_metadata !== undefined
      ? await resolveWitnessMetadataPatch(
          supabase,
          link.statement_id,
          payload.witness_metadata,
        )
      : undefined;

  const updatePayload: Record<string, unknown> = {
    ...(payload.witness_name !== undefined
      ? { witness_name: payload.witness_name }
      : {}),
    ...(payload.witness_email !== undefined
      ? { witness_email: payload.witness_email }
      : {}),
    ...(resolvedMetadata !== undefined
      ? { witness_metadata: resolvedMetadata as Json }
      : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.sections !== undefined
      ? { sections: payload.sections as Json }
      : {}),
    ...(payload.signed_document !== undefined
      ? { signed_document: payload.signed_document as Json }
      : {}),
    ...(payload.supporting_documents !== undefined
      ? { supporting_documents: payload.supporting_documents as Json }
      : {}),
  };

  const { error } = await supabase
    .from("statements")
    .update(updatePayload)
    .eq("id", link.statement_id);

  if (error) {
    throw error;
  }
}

export async function SERVERONLY_acknowledgeStatementNoticeByToken(
  token: string,
  payload: {
    ip_address: string | null;
    user_agent: string | null;
    notice_version?: string;
  },
): Promise<{
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  notice_version: string;
}> {
  const supabase = getServiceClient(
    "SERVERONLY_acknowledgeStatementNoticeByToken",
  );
  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("statement_id")
    .eq("token", token)
    .single();

  if (linkError || !link?.statement_id) {
    throw linkError ?? new Error("Invalid or expired link");
  }

  const notice = {
    accepted_at: new Date().toISOString(),
    ip_address: payload.ip_address,
    user_agent: payload.user_agent,
    notice_version: payload.notice_version ?? "uk_gdpr_privacy_notice_v1",
  };

  const { error } = await supabase
    .from("statements")
    .update({ gdpr_notice_acknowledgement: notice as Json })
    .eq("id", link.statement_id);

  if (error) {
    throw error;
  }

  return notice;
}

export async function deleteStatement(id: string) {
  const supabase = getSupabaseClient();

  await cleanupStatementStorageDocuments(supabase, id);

  const { error } = await supabase.from("statements").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function SERVERONLY_deleteStatement(id: string) {
  const supabase = getServiceClient("SERVERONLY_deleteStatement");

  await cleanupStatementStorageDocuments(supabase, id);

  const { error } = await supabase.from("statements").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function regenerateMagicLink(statementId: string) {
  const supabase = getSupabaseClient();

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id, tenant_id")
    .eq("id", statementId)
    .maybeSingle();

  if (statementError || !statement) {
    throw new Error("Statement not found");
  }

  const { error: deleteError } = await supabase
    .from("magic_links")
    .delete()
    .eq("statement_id", statement.id);

  if (deleteError) {
    throw new Error("Failed to delete old link: " + deleteError.message);
  }

  const newToken = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: insertError } = await supabase.from("magic_links").insert({
    token: newToken,
    statement_id: statement.id,
    tenant_id: statement.tenant_id,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    throw new Error("Failed to create new magic link: " + insertError.message);
  }

  return { token: newToken, expires_at: expiresAt.toISOString() };
}
