import type {
  Case,
  MagicLink,
  IntakeChatMessage,
  Statement,
  StatementConfig,
  StatementDataResponse,
  UploadedDocument,
} from "@/types";
import { EMPTY_STATEMENT_CONFIG, normalizeConfig } from "@/lib/statement-utils";
import { getSupabaseClient } from "../client";
import { getServiceClient } from "../server";
import { SupabaseClient } from "@supabase/supabase-js";

type StatementFlat = Statement & {
  statement_config: StatementConfig;
  template_document_snapshot?: UploadedDocument | null;
  link?: Pick<MagicLink, "token" | "expires_at"> | null;
};

type FullStatementRecord = StatementFlat & {
  tenant_name: string;
  case: Omit<Case, "tenant_id">;
  statement: StatementFlat;
};

type QueryClient =
  | ReturnType<typeof getSupabaseClient>
  | ReturnType<typeof getServiceClient>;

type SnapshotRelation = {
  config_json: unknown;
  template_document?: unknown;
};

type StatementWithRelations = Statement & {
  cases?: Case | null;
  tenants?: { name: string } | null;
  magic_links?: Array<Pick<MagicLink, "token" | "expires_at">> | null;
  statement_config_snapshots?: SnapshotRelation | SnapshotRelation[] | null;
};

type StatementWithSnapshot = Statement & {
  statement_config_snapshots?: SnapshotRelation | SnapshotRelation[] | null;
};

function getSnapshotRelation(
  relation: StatementWithRelations["statement_config_snapshots"],
): SnapshotRelation | null {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

function getRelatedSnapshotConfig(
  relation: StatementWithRelations["statement_config_snapshots"],
): StatementConfig | null {
  const snapshot = getSnapshotRelation(relation);
  if (!snapshot) {
    return null;
  }

  return normalizeConfig(snapshot.config_json);
}

function getRelatedSnapshotTemplateDocument(
  relation: StatementWithRelations["statement_config_snapshots"],
) {
  const snapshot = getSnapshotRelation(relation);
  if (!snapshot) {
    return null;
  }

  return (snapshot.template_document as UploadedDocument | null) ?? null;
}

function getStatementLink(
  statement: StatementWithRelations,
): Pick<MagicLink, "token" | "expires_at"> | null {
  const link = statement.magic_links?.[0];
  return link ? { token: link.token, expires_at: link.expires_at } : null;
}

function toStatementFlat(statement: StatementWithRelations): StatementFlat {
  const statementRow = Object.fromEntries(
    Object.entries(statement).filter(
      ([key]) =>
        key !== "cases" &&
        key !== "tenants" &&
        key !== "magic_links" &&
        key !== "statement_config_snapshots",
    ),
  ) as StatementFlat;

  return {
    ...statementRow,
    statement_config:
      getRelatedSnapshotConfig(statement.statement_config_snapshots) ??
      EMPTY_STATEMENT_CONFIG,
    template_document_snapshot: getRelatedSnapshotTemplateDocument(
      statement.statement_config_snapshots,
    ),
    link: getStatementLink(statement),
  };
}

function toFullStatementRecord(
  statement: StatementWithRelations,
): FullStatementRecord {
  const flat = toStatementFlat(statement);
  const caseRecord = statement.cases;

  if (!caseRecord) {
    throw new Error("Case not found");
  }

  const caseWithoutTenantId = Object.fromEntries(
    Object.entries(caseRecord).filter(([key]) => key !== "tenant_id"),
  ) as FullStatementRecord["case"];

  return {
    ...flat,
    tenant_name: statement.tenants?.name ?? "",
    case: caseWithoutTenantId,
    statement: { ...flat },
  };
}

async function loadStatementWithRelations(
  supabase: QueryClient,
  statementId: string,
): Promise<StatementWithRelations> {
  const { data, error } = await supabase
    .from("statements")
    .select(
      "*, cases(*), tenants(name), magic_links(token, expires_at), statement_config_snapshots!statements_config_snapshot_id_fkey(config_json, template_document)",
    )
    .eq("id", statementId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Statement not found");
  }

  return data as StatementWithRelations;
}

async function loadStatementWithSnapshot(
  supabase: QueryClient,
  statementId: string,
): Promise<StatementWithSnapshot> {
  const { data, error } = await supabase
    .from("statements")
    .select(
      "*, statement_config_snapshots!statements_config_snapshot_id_fkey(config_json, template_document)",
    )
    .eq("id", statementId)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Statement not found");
  }

  return data as StatementWithSnapshot;
}

const _getStatementWithConfigFromToken = async (
  supabase: SupabaseClient,
  token: string,
): Promise<StatementFlat> => {
  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("statement_id, token, expires_at")
    .eq("token", token)
    .single();

  if (linkError) {
    throw linkError;
  }

  if (new Date(link.expires_at) < new Date()) {
    throw new Error("Link expired");
  }

  const statement = await loadStatementWithSnapshot(
    supabase,
    link.statement_id,
  );

  return {
    ...statement,
    statement_config:
      getRelatedSnapshotConfig(statement.statement_config_snapshots) ??
      EMPTY_STATEMENT_CONFIG,
    template_document_snapshot: getRelatedSnapshotTemplateDocument(
      statement.statement_config_snapshots,
    ),
    link: {
      token: link.token,
      expires_at: link.expires_at,
    },
  };
};

export const SERVERONLY_getStatementWithConfigFromToken = (token: string) =>
  _getStatementWithConfigFromToken(
    getServiceClient("SERVERONLY_getStatementWithConfigFromToken"),
    token,
  );

export const getStatementWithConfigFromToken = (token: string) =>
  _getStatementWithConfigFromToken(getSupabaseClient(), token);

export const getConversationHistory = async (statementId: string) => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, role, content, meta, created_at")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

export const getConversationLatest = async (statementId: string) => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("meta")
    .eq("statement_id", statementId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

async function getLatestConversationMessage(
  statementId: string,
  supabase: ReturnType<typeof getSupabaseClient>,
) {
  const { data: latestAssistantWithMeta, error: latestWithMetaError } =
    await supabase
      .from("conversation_messages")
      .select("id, role, content, meta, created_at")
      .eq("statement_id", statementId)
      .eq("role", "assistant")
      .not("meta", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (latestWithMetaError) {
    throw latestWithMetaError;
  }

  if (latestAssistantWithMeta) {
    return latestAssistantWithMeta as unknown as IntakeChatMessage;
  }

  const { data: latestAssistant, error: latestAssistantError } = await supabase
    .from("conversation_messages")
    .select("id, role, content, meta, created_at")
    .eq("statement_id", statementId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestAssistantError) {
    throw latestAssistantError;
  }

  if (latestAssistant) {
    return latestAssistant as unknown as IntakeChatMessage;
  }

  const { data: latestAny, error: latestAnyError } = await supabase
    .from("conversation_messages")
    .select("id, role, content, meta, created_at")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestAnyError) {
    throw latestAnyError;
  }

  return (latestAny as unknown as IntakeChatMessage | null) ?? null;
}

async function loadFullStatementById(
  statementId: string,
  includeFullHistory: boolean,
  supabase = getSupabaseClient(),
) {
  const statement = await loadStatementWithRelations(supabase, statementId);
  if (!statement.cases) {
    throw new Error("Case not found");
  }
  if (!statement.tenants?.name) {
    throw new Error("Tenant not found");
  }

  const base = toFullStatementRecord(statement);

  const q = supabase
    .from("conversation_messages")
    .select("id, role, content, meta, created_at")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: includeFullHistory });

  if (includeFullHistory) {
    const { data: messagesData, error: messagesError } = await q;
    if (messagesError) {
      throw messagesError;
    }

    const messages = (messagesData as unknown as IntakeChatMessage[]) ?? [];
    return {
      ...base,
      messages,
      has_history: messages.length > 0,
    };
  }

  const latest = await getLatestConversationMessage(statementId, supabase);

  return {
    ...base,
    latest,
  };
}

export async function SERVERONLY_getFullStatementFromToken(
  token: string,
  includeFullHistory: true,
): Promise<StatementDataResponse<true> | null>;
export async function SERVERONLY_getFullStatementFromToken(
  token: string,
  includeFullHistory: false,
): Promise<StatementDataResponse<false> | null>;
export async function SERVERONLY_getFullStatementFromToken(
  token: string,
  includeFullHistory: boolean,
): Promise<unknown> {
  const supabase = getServiceClient("SERVERONLY_getFullStatementFromToken");

  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("statement_id, token, expires_at")
    .eq("token", token)
    .single();

  if (linkError) {
    throw linkError;
  }

  if (new Date(link.expires_at) < new Date()) {
    throw new Error("Link expired");
  }

  const response = await loadFullStatementById(
    link.statement_id,
    includeFullHistory,
    supabase,
  );

  return {
    ...(response as Record<string, unknown>),
    link: {
      token: link.token,
      expires_at: link.expires_at,
    },
  };
}

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
  return loadFullStatementById(id, includeFullHistory, supabase);
}

export async function SERVERONLY_getStatementSubmissionNotificationRecipients(
  statementId: string,
): Promise<{
  tenantName: string;
  statementTitle: string;
  witnessName: string;
  recipientEmails: string[];
}> {
  const supabase = getServiceClient(
    "SERVERONLY_getStatementSubmissionNotificationRecipients",
  );

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select(
      "id, case_id, tenant_id, witness_name, cases(title, status, assigned_to, assigned_to_ids), tenants(name)",
    )
    .eq("id", statementId)
    .maybeSingle();

  if (statementError || !statement) {
    throw new Error("Statement not found");
  }

  const tenantName = (
    statement as { tenants?: { name?: string | null } | null }
  ).tenants?.name;

  if (!tenantName) {
    throw new Error("Tenant not found");
  }

  const assigneeIds =
    (
      statement as {
        cases?: { assigned_to_ids?: string[] | null } | null;
      }
    ).cases?.assigned_to_ids ?? [];

  let recipientUserIds: string[] = [];

  if (assigneeIds.length > 0) {
    const { data: assigneeProfiles, error: assigneeError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("tenant_id", statement.tenant_id)
      .in("user_id", assigneeIds);

    if (assigneeError) {
      throw assigneeError;
    }

    recipientUserIds = (assigneeProfiles ?? []).map(
      (profile) => profile.user_id,
    );
  } else {
    const { data: fallbackProfiles, error: fallbackError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("tenant_id", statement.tenant_id)
      .in("role", ["solicitor", "tenant_admin"]);

    if (fallbackError) {
      throw fallbackError;
    }

    recipientUserIds = (fallbackProfiles ?? []).map(
      (profile) => profile.user_id,
    );
  }

  const emails = await Promise.all(
    recipientUserIds.map(async (userId) => {
      const { data } = await supabase.auth.admin.getUserById(userId);
      return data.user?.email?.toLowerCase() ?? null;
    }),
  );

  const recipientEmails = Array.from(
    new Set(emails.filter((email): email is string => !!email)),
  );

  return {
    tenantName,
    statementTitle:
      (statement as { cases?: { title?: string | null } | null }).cases
        ?.title ?? "",
    witnessName: statement.witness_name,
    recipientEmails,
  };
}

export async function SERVERONLY_getStatementForSendLink(
  id: string,
  tenantId: string,
): Promise<{
  title: string;
  witness_name: string;
  witness_email: string;
  token: string;
} | null> {
  const supabase = getServiceClient("SERVERONLY_getStatementForSendLink");

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id, title, witness_name, witness_email, magic_links(token)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (statementError || !statement) {
    return null;
  }

  const token = (statement as { magic_links?: Array<{ token: string }> | null })
    .magic_links?.[0]?.token;

  if (!token) {
    return null;
  }

  return {
    title: statement.title,
    witness_name: statement.witness_name,
    witness_email: statement.witness_email,
    token,
  };
}
