import { Json } from "@/lib/supabase/types.generated";
import { getSupabaseClient } from "../client";
import { getServiceClient } from "../server";
import { assertServerOnly } from "@/lib/utils";
import { generateSecureToken } from "@/lib/security";
import { MagicLink, Message, Statement, UploadedDocument } from "@/lib/types";
import {
  StatementSchemaType,
  UpdateStatementSchemaType,
} from "@/lib/schema/statement";

export type StatementSubmission = {
  signedDocument: UploadedDocument;
  sections?: Record<string, unknown>;
  supportingDocuments?: UploadedDocument[];
};

/**
 * Get statement context (magic link and case data) for witness
 * Client-callable: token-based access control
 */
export const getStatementFromToken = async (token: string) => {
  const supabase = getSupabaseClient();

  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("token, statement_id, tenant_id, expires_at")
    .eq("token", token)
    .single();

  if (linkError) {
    throw linkError;
  }

  if (new Date(link.expires_at) < new Date()) {
    throw new Error("Link expired");
  }

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("*")
    .eq("id", link.statement_id)
    .single();

  if (statementError) {
    throw statementError;
  }

  return {
    ...(statement as Statement),
    link: {
      token: link.token,
      expires_at: link.expires_at,
    },
  };
};

/**
 * Submit a witness statement
 */
export const submitStatement = async (
  token: string,
  submission: StatementSubmission,
) => {
  const supabase = getSupabaseClient();

  const statement = await getStatementFromToken(token);
  if (!statement) {
    throw new Error("Invalid or expired link.");
  }

  if (statement.status === "locked") {
    throw new Error(
      "This intake has been stopped and cannot be submitted. Please contact the law firm.",
    );
  }

  const updatePayload: {
    signed_document: Json;
    sections?: Json;
    supporting_documents?: Json;
    status: "submitted";
  } = {
    signed_document: submission.signedDocument,
    status: "submitted",
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
};

/**
 * Save a conversation message
 */
export const saveConversationMessageServer = async (
  statementId: string,
  role: "user" | "assistant" | "system",
  content: string,
  meta?: Record<string, unknown> | null,
) => {
  assertServerOnly("saveConversationMessageServer");
  const supabase = getServiceClient();
  const { error } = await supabase.from("conversation_messages").insert({
    statement_id: statementId,
    role,
    content,
    meta: meta as Json,
  });
  if (error) {
    throw error;
  }
};

/**
 * Update statement status (SERVER-SIDE)
 * SERVER ONLY - Uses service client for API routes
 */
export const updateStatementStatusServer = async (
  statementId: string,
  status: "draft" | "in_progress" | "submitted" | "locked",
) => {
  assertServerOnly("updateStatementStatusServer");
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("statements")
    .update({ status })
    .eq("id", statementId);

  if (error) {
    throw error;
  }
};

/**
 * Get conversation history for a statement
 * Client-callable: token-based access control
 */
export const getConversationHistory = async (statementId: string) => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

/**
 * Get the latest statement progress and metadata from the last message
 * Used to display statement status on the case list/detail view
 */
export const getConversationLatest = async (statementId: string) => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("progress, meta, role")
    .eq("statement_id", statementId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return;
};

type Base = Statement & {
  tenant_name: string;
  link: Pick<MagicLink, "token" | "expires_at"> | null;
};

export type StatementDataResponse<T extends boolean = boolean> = T extends true
  ? Base & {
      messages: Message[];
      has_history: boolean;
    }
  : T extends false
    ? Base & { latest: Message }
    : Base;

/**
 * Get full statement data including context, conversation history, and tenant info
 * Client-callable: token-based access control
 */
export async function getFullStatementFromToken(
  token: string,
  includeFullHistory: true,
): Promise<StatementDataResponse<true> | null>;
export async function getFullStatementFromToken(
  token: string,
  includeFullHistory: false,
): Promise<StatementDataResponse<false> | null>;
export async function getFullStatementFromToken(
  token: string,
  includeFullHistory: boolean,
): Promise<unknown> {
  const supabase = getSupabaseClient();
  const statement = await getStatementFromToken(token);

  // Fetch tenant name
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", statement.tenant_id)
    .single();

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const payload = {
    ...statement,
    tenant_name: tenant.name,
  };

  const q = supabase
    .from("conversation_messages")
    .select("id, role, content, meta, created_at")
    .eq("statement_id", statement.id)
    .order("created_at", { ascending: includeFullHistory });

  if (includeFullHistory) {
    const { data: messagesData } = await q;
    const messages = (messagesData as unknown as Message[]) ?? [];
    return {
      ...payload,
      messages,
      has_history: messages.length > 0,
    };
  }
  const { data: latest } = await q.limit(1).maybeSingle();
  return {
    ...payload,
    latest: latest as unknown as Message | null,
  };
}

/**
 * Get full statement data including context, conversation history, and tenant info
 */
export async function getFullStatementFromId(
  id: string,
  includeFullHistory: true,
): Promise<StatementDataResponse<true> | null>;
export async function getFullStatementFromId(
  id: string,
  includeFullHistory: false,
): Promise<StatementDataResponse<false> | null>;
export async function getFullStatementFromId(
  id: string,
  includeFullHistory: boolean,
): Promise<unknown> {
  const supabase = getSupabaseClient();

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("*")
    .eq("id", id)
    .single();

  if (statementError) {
    throw statementError;
  }

  // Fetch tenant name
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", statement.tenant_id)
    .single();

  const { data: link } = await supabase
    .from("magic_links")
    .select("token, expires_at")
    .eq("statement_id", id)
    .maybeSingle();

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const payload = {
    ...statement,
    link,
    tenant_name: tenant.name,
  };

  const q = supabase
    .from("conversation_messages")
    .select("id, role, content, meta, created_at")
    .eq("statement_id", statement.id)
    .order("created_at", { ascending: includeFullHistory });

  if (includeFullHistory) {
    const { data: messagesData } = await q;
    const messages = (messagesData as unknown as Message[]) ?? [];
    return {
      ...payload,
      messages,
      has_history: messages.length > 0,
    };
  }
  const { data: latest } = await q.limit(1).maybeSingle();
  return {
    ...payload,
    latest: latest as unknown as Message | null,
  };
}

export async function getStatements(): Promise<Statement[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("statements")
    .select("*")
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data as Statement[];
}

export async function createStatement(
  payload: StatementSchemaType,
): Promise<Statement> {
  const supabase = getSupabaseClient();
  const magicLinkToken = generateSecureToken();

  const { data: newStatement, error: statementError } = await supabase
    .from("statements")
    .insert(payload)
    .select("*")
    .single();

  if (statementError) {
    throw statementError;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error: linkError } = await supabase.from("magic_links").insert({
    token: magicLinkToken,
    statement_id: newStatement.id,
    tenant_id: payload.tenant_id,
    expires_at: expiresAt.toISOString(),
  });

  if (linkError) {
    await supabase.from("statements").delete().eq("id", newStatement.id);
    throw new Error("Failed to create magic link: " + linkError.message);
  }

  return newStatement as unknown as Statement;
}

export async function updateStatement(
  id: string,
  payload: UpdateStatementSchemaType,
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("statements")
    .update(payload)
    .eq("id", id);
  if (error) {
    throw error;
  }
}

export async function updateStatementByTokenServer(
  token: string,
  payload: UpdateStatementSchemaType,
) {
  const supabase = getServiceClient();
  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("statement_id")
    .eq("token", token)
    .single();

  if (linkError) throw linkError;

  const { error } = await supabase
    .from("statements")
    .update(payload)
    .eq("id", link.statement_id);
  if (error) {
    throw error;
  }
}

export async function deleteStatement(id: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("statements").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function getStatementForSendLink(id: string): Promise<{
  title: string;
  witness_name: string;
  witness_email: string;
  token: string;
} | null> {
  assertServerOnly("getStatementForSendLink");
  const supabase = getServiceClient();

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id, title, witness_name, witness_email")
    .eq("id", id)
    .maybeSingle();

  if (statementError || !statement) {
    return null;
  }

  const { data: magicLink, error: linkError } = await supabase
    .from("magic_links")
    .select("token")
    .eq("statement_id", statement.id)
    .maybeSingle();

  if (linkError || !magicLink) {
    return null;
  }

  return {
    ...statement,
    token: magicLink.token,
  };
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
