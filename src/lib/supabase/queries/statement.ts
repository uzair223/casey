import { Json } from "@/lib/supabase/types.generated";
import { getSupabaseClient } from "../client";
import { getServiceClient } from "../server";
import { assertServerOnly } from "@/lib/utils";
import { Message, ProgressData, UploadedDocument } from "@/lib/types";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";

export type StatementSubmission = {
  signedDocument: UploadedDocument;
  sections?: Record<string, unknown>;
  supportingDocuments?: UploadedDocument[];
};

/**
 * Get statement context (magic link and case data) for witness
 * Client-callable: token-based access control
 */
export const getStatementContext = async (token: string) => {
  const supabase = getSupabaseClient();

  // First: Validate magic link (anon can read valid links via RLS)
  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("token, statement_id, tenant_id, expires_at")
    .eq("token", token)
    .single();

  if (linkError || !link || new Date(link.expires_at) < new Date()) {
    return null;
  }

  // Second: Get statement using statement_id (anon can read via magic link RLS policy)
  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("*")
    .eq("id", link.statement_id)
    .single();

  if (statementError || !statement) {
    return null;
  }

  const caseRecord = {
    id: statement.id,
    tenant_id: link.tenant_id,
    title: (statement as any).title,
    reference: (statement as any).reference,
    incident_date: (statement as any).incident_date || null,
    assigned_to: (statement as any).assigned_to || null,
    created_at: (statement as any).created_at,
  };

  return {
    link,
    statement,
    caseRecord,
  };
};

/**
 * Get statement context (SERVER-SIDE) - Uses SECURITY DEFINER function
 * SERVER ONLY - Avoids RLS recursion by using validate_magic_link function
 */
export const getStatementContextServer = async (token: string) => {
  assertServerOnly("getStatementContextServer");
  const supabase = getServiceClient();

  try {
    // Call SECURITY DEFINER function to validate magic link
    const { data: linkValidation, error: validationError } = await supabase.rpc(
      "validate_magic_link",
      { token_param: token },
    );

    if (validationError || !linkValidation || linkValidation.length === 0) {
      console.error("Magic link validation failed:", validationError);
      return null;
    }

    const validation = linkValidation[0];
    if (!validation.is_valid) {
      return null;
    }

    // Now fetch statement data using service client (bypasses RLS)
    const { data: statement, error: stmtError } = await supabase
      .from("statements")
      .select("*")
      .eq("id", validation.statement_id)
      .single();

    if (stmtError || !statement) {
      console.error("Statement fetch failed:", stmtError);
      return null;
    }

    const caseRecord = {
      id: statement.id,
      tenant_id: statement.tenant_id,
      title: (statement as any).title,
      reference: (statement as any).reference,
      incident_date: statement.incident_date,
      assigned_to: (statement as any).assigned_to || null,
      created_at: statement.created_at,
    };

    // Fetch the magic link in full
    const { data: link, error: linkError } = await supabase
      .from("magic_links")
      .select("*")
      .eq("token", token)
      .single();

    if (linkError || !link) {
      return null;
    }

    return {
      link,
      statement,
      caseRecord,
    };
  } catch (error) {
    console.error("getStatementContextServer error:", error);
    return null;
  }
};

/**
 * Submit a witness statement
 * Client-callable: token-based access control
 */
export const submitStatement = async (
  token: string,
  submission: StatementSubmission,
) => {
  const supabase = getSupabaseClient();

  const context = await getStatementContext(token);

  if (!context) {
    throw new Error("Invalid or expired link.");
  }

  const { statement } = context;
  if (statement.status === "locked") {
    throw new Error(
      "This intake has been stopped and cannot be submitted. Please contact the law firm.",
    );
  }

  const updatePayload: {
    signed_document: Json;
    sections?: Json;
    supporting_documents?: Json;
  } = {
    signed_document: submission.signedDocument,
  };

  if (submission.sections) {
    updatePayload.sections = submission.sections as Json;
  }

  if (submission.supportingDocuments) {
    updatePayload.supporting_documents = submission.supportingDocuments as Json;
  }

  const { error: updateError } = await supabase
    .from("statements")
    .update({ ...updatePayload, status: "submitted" })
    .eq("id", statement.id);

  if (updateError) {
    throw updateError;
  }
};

/**
 * Save a conversation message (SERVER-SIDE)
 * SERVER ONLY - Uses service client for API routes
 */
export const saveConversationMessageServer = async (
  statementId: string,
  role: "user" | "assistant" | "system",
  content: string,
  progress?: Record<string, unknown> | null,
  meta?: Record<string, unknown> | null,
) => {
  assertServerOnly("saveConversationMessageServer");
  const supabase = getServiceClient();

  const { error } = await supabase.from("conversation_messages").insert({
    statement_id: statementId,
    role,
    content,
    progress: progress as Json,
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
 * Submit a witness statement (SERVER-SIDE)
 * SERVER ONLY - Uses service client for API routes
 */
export const submitStatementServer = async (
  token: string,
  submission: StatementSubmission,
) => {
  assertServerOnly("submitStatementServer");
  const supabase = getServiceClient();

  const context = await getStatementContextServer(token);
  if (!context) {
    throw new Error("Invalid or expired link.");
  }

  const { link, statement } = context;

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
export const getStatementLatestProgress = async (statementId: string) => {
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

  return {
    progress: data.progress ? (data.progress as unknown as ProgressData) : null,
    meta: data.meta ? (data.meta as unknown as Record<string, unknown>) : null,
    flaggedDeviation: (data.meta as any)?.flaggedDeviation || false,
    deviationReason: (data.meta as any)?.deviationReason || null,
  };
};

export type StatementDataResponse = {
  link_token: string;
  tenant_id: string;
  statement_id: string;
  case_id: string;
  tenant_name: string;
  title: string;
  reference: string;
  claim_number: string | null;
  incident_date: string | null;
  witness_name: string;
  witness_address: string | null;
  witness_occupation: string | null;
  witness_email: string;
  statement_status?: string;
  messages?: Message[];
  has_history?: boolean;
};

/**
 * Process conversation history and calculate cumulative progress
 * Shared logic between client and server versions
 */
const processConversationHistory = (
  history: Array<{
    id: unknown;
    role: string;
    content: string;
    progress: unknown;
    meta: unknown;
  }> | null,
): Message[] => {
  // Build phaseCompleteness dynamically from config
  const phaseCompletenessInit: Record<string, number> = {};
  PERSONAL_INJURY_CONFIG.phases.forEach((phase) => {
    phaseCompletenessInit[`phase${phase.order}`] = 0;
  });

  let cumulativeProgress: ProgressData = {
    currentPhase: 1,
    completedPhases: [],
    phaseCompleteness: phaseCompletenessInit,
    structuredData: {
      currentPhase: 1,
      overallCompletion: 0,
    },
    readyToPrepare: false,
    ignoredMissingDetails: [],
  };

  const processedMessages: Message[] = [];

  if (history && history.length > 0) {
    for (const item of history) {
      const msgProgress = item.progress
        ? (item.progress as unknown as ProgressData)
        : null;

      if (msgProgress) {
        cumulativeProgress = msgProgress;
      }

      const role =
        item.role === "system"
          ? "assistant"
          : (item.role as "user" | "assistant");

      const msg: Message = {
        id: String(item.id),
        role,
        content: item.content,
      };

      if (msgProgress) {
        msg.progress = { ...cumulativeProgress };
      }

      if (item.meta) {
        msg.meta = item.meta as Record<string, unknown>;
      }

      processedMessages.push(msg);
    }
  }

  return processedMessages;
};

/**
 * Get full statement data including context, conversation history, and tenant info
 * Client-callable: token-based access control
 */
export const getFullStatementData = async (
  token: string,
): Promise<StatementDataResponse | null> => {
  const supabase = getSupabaseClient();

  // Get statement context
  const context = await getStatementContext(token);
  if (!context) {
    return null;
  }

  const { data: history } = await supabase
    .from("conversation_messages")
    .select("id, role, content, progress, meta, created_at")
    .eq("statement_id", context.statement.id)
    .order("created_at", { ascending: true });

  // Fetch tenant name
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", context.caseRecord.tenant_id)
    .single();

  if (!tenant) {
    throw new Error();
  }

  // Process messages and calculate cumulative progress
  const processedMessages = processConversationHistory(history);

  return {
    link_token: context.link.token,
    tenant_id: context.caseRecord.tenant_id,
    statement_id: context.statement.id,
    case_id: context.caseRecord.id,
    tenant_name: tenant.name,
    title: context.caseRecord.title,
    reference: context.caseRecord.reference,
    claim_number: context.statement.claim_number,
    incident_date: context.caseRecord.incident_date,
    witness_name: context.statement.witness_name,
    witness_address: context.statement.witness_address,
    witness_occupation: context.statement.witness_occupation,
    witness_email: context.statement.witness_email,
    statement_status: context.statement.status,
    messages: processedMessages,
    has_history: processedMessages.length > 0,
  };
};
