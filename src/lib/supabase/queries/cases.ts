import { getSupabaseClient } from "@/lib/supabase/client";
import { getServiceClient } from "@/lib/supabase/server";
import { assertServerOnly } from "@/lib/utils";
import {
  Case,
  ProgressData,
  StatementStatus,
  UploadedDocument,
} from "@/lib/types";
import { generateSecureToken } from "@/lib/security";

const ALLOWED_STATEMENT_STATUSES = new Set<StatementStatus>([
  "draft",
  "in_progress",
  "submitted",
  "locked",
]);

export interface CaseCreatePayload {
  title: string;
  reference: string;
  claimNumber?: string | null;
  witnessName: string;
  witnessAddress?: string | null;
  witnessOccupation?: string | null;
  witnessEmail: string;
  incidentDate?: string | null;
  assignedTo?: string | null;
}

export interface CaseUpdatePayload {
  title?: string;
  reference?: string;
  claimNumber?: string | null;
  witnessName?: string;
  witnessAddress?: string | null;
  witnessOccupation?: string | null;
  witnessEmail?: string;
  incidentDate?: string | null;
  status?: StatementStatus;
  assignedTo?: string | null;
}

interface TeamMember {
  user_id: string;
  role: string;
  email: string | null;
}

export type CaseWithWitness = Case & {
  statement_id?: string;
  statement_status?: StatementStatus | null;
  claim_number?: string | null;
  witness_name?: string;
  witness_address?: string | null;
  witness_occupation?: string | null;
  witness_email?: string;
  magic_link_token?: string;
  magic_link_expires_at?: string;
  magic_link_used_at?: string | null;
  signed_document?: UploadedDocument | null;
  supporting_documents?: UploadedDocument[];
  progress?: ProgressData | null;
  flaggedDeviation?: boolean;
  deviationReason?: string | null;
};

export async function getCases(
  tenant_id: string,
  user_id: string,
  userRole: string,
): Promise<CaseWithWitness[]> {
  const supabase = getSupabaseClient();

  if (!["tenant_admin", "solicitor", "paralegal"].includes(userRole)) {
    throw new Error("Insufficient permissions");
  }

  let query = supabase
    .from("statements")
    .select("*, magic_links(token, expires_at, used_at)")
    .eq("tenant_id", tenant_id)
    .order("created_at", { ascending: false });

  if (userRole === "paralegal") {
    query = query.eq("assigned_to", user_id);
  }

  const { data: statements, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const statementIds = (statements || [])
    .map((s: any) => s.id as string | undefined)
    .filter((id): id is string => Boolean(id));

  const latestByStatementId = new Map<
    string,
    {
      progress: ProgressData | null;
      flaggedDeviation: boolean;
      deviationReason: string | null;
    }
  >();

  if (statementIds.length > 0) {
    const { data: latestMessages, error: latestError } = await supabase
      .from("conversation_messages")
      .select("statement_id, progress, meta, created_at")
      .in("statement_id", statementIds)
      .eq("role", "assistant")
      .order("created_at", { ascending: false });

    if (!latestError && latestMessages) {
      for (const message of latestMessages) {
        if (!latestByStatementId.has(message.statement_id)) {
          const meta = (message.meta || {}) as Record<string, unknown>;
          latestByStatementId.set(message.statement_id, {
            progress: message.progress
              ? (message.progress as unknown as ProgressData)
              : null,
            flaggedDeviation: Boolean(meta.flaggedDeviation),
            deviationReason:
              typeof meta.deviationReason === "string"
                ? meta.deviationReason
                : null,
          });
        }
      }
    }
  }

  return (statements || []).map((statement: any) => {
    const latest = latestByStatementId.get(statement.id);
    const magicLinks = statement.magic_links;
    const firstLink = Array.isArray(magicLinks) ? magicLinks[0] : magicLinks;
    const signedDocumentRaw = statement.signed_document;
    const signedDocument =
      signedDocumentRaw &&
      typeof signedDocumentRaw === "object" &&
      "path" in signedDocumentRaw
        ? (signedDocumentRaw as UploadedDocument)
        : null;
    const supportingDocumentsRaw = statement.supporting_documents;
    const supportingDocuments = Array.isArray(supportingDocumentsRaw)
      ? (supportingDocumentsRaw.filter(
          (doc: unknown) =>
            doc && typeof doc === "object" && "path" in (doc as object),
        ) as UploadedDocument[])
      : [];

    return {
      id: statement.id,
      tenant_id: statement.tenant_id,
      title: statement.title,
      reference: statement.reference,
      incident_date: statement.incident_date,
      assigned_to: statement.assigned_to,
      created_at: statement.created_at,
      statement_id: statement.id,
      statement_status: (statement.status as StatementStatus) || null,
      claim_number: statement.claim_number,
      witness_name: statement.witness_name,
      witness_address: statement.witness_address,
      witness_occupation: statement.witness_occupation,
      witness_email: statement.witness_email,
      magic_link_token: firstLink?.token,
      magic_link_expires_at: firstLink?.expires_at,
      magic_link_used_at: firstLink?.used_at,
      signed_document: signedDocument,
      supporting_documents: supportingDocuments,
      progress: latest?.progress || null,
      flaggedDeviation: latest?.flaggedDeviation || false,
      deviationReason: latest?.deviationReason || null,
    };
  });
}

export async function createCase(
  payload: CaseCreatePayload,
  user_id: string,
  tenant_id: string,
  userRole: string,
): Promise<Case> {
  const supabase = getSupabaseClient();

  if (!["tenant_admin", "solicitor", "paralegal"].includes(userRole)) {
    throw new Error("Insufficient permissions");
  }
  if (!payload.title?.trim()) {
    throw new Error("Title is required");
  }
  if (!payload.reference?.trim()) {
    throw new Error("Reference is required");
  }
  if (!payload.witnessName?.trim()) {
    throw new Error("Witness name is required");
  }
  if (!payload.witnessEmail?.trim()) {
    throw new Error("Witness email is required");
  }

  const magicLinkToken = await generateSecureToken();

  const { data: newStatement, error: statementError } = await supabase
    .from("statements")
    .insert({
      tenant_id: tenant_id,
      title: payload.title.trim(),
      reference: payload.reference.trim(),
      claim_number: payload.claimNumber ? payload.claimNumber.trim() : null,
      incident_date: payload.incidentDate || null,
      assigned_to:
        userRole === "paralegal" ? user_id : payload.assignedTo || null,
      witness_name: payload.witnessName.trim(),
      witness_address: payload.witnessAddress
        ? payload.witnessAddress.trim()
        : null,
      witness_occupation: payload.witnessOccupation
        ? payload.witnessOccupation.trim()
        : null,
      witness_email: payload.witnessEmail.trim(),
      status: "draft",
    } as any)
    .select("*")
    .single();

  if (statementError || !newStatement) {
    throw new Error(statementError?.message || "Failed to create statement");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error: linkError } = await supabase.from("magic_links").insert({
    token: magicLinkToken,
    statement_id: newStatement.id,
    tenant_id: tenant_id,
    expires_at: expiresAt.toISOString(),
  });

  if (linkError) {
    await supabase.from("statements").delete().eq("id", newStatement.id);
    throw new Error("Failed to create magic link: " + linkError.message);
  }

  return {
    id: newStatement.id,
    tenant_id: newStatement.tenant_id,
    title: (newStatement as any).title,
    reference: (newStatement as any).reference,
    incident_date: newStatement.incident_date,
    assigned_to: (newStatement as any).assigned_to,
    created_at: newStatement.created_at,
  };
}

export async function updateCase(
  caseId: string,
  updates: CaseUpdatePayload,
  user_id: string,
  tenant_id: string,
  userRole: string,
  teamMembers?: TeamMember[],
) {
  const supabase = getSupabaseClient();

  if (!["tenant_admin", "solicitor", "paralegal"].includes(userRole)) {
    throw new Error("Insufficient permissions");
  }

  const { data: statementAccess, error: accessError } = await supabase
    .from("statements")
    .select("*")
    .eq("id", caseId)
    .eq("tenant_id", tenant_id)
    .maybeSingle();

  if (accessError || !statementAccess) {
    throw new Error("Case not found");
  }

  if (
    userRole === "paralegal" &&
    (statementAccess as any).assigned_to !== user_id
  ) {
    throw new Error("Paralegals can only update assigned cases");
  }

  const updatePayload: Record<string, any> = {};

  if (updates.title !== undefined) {
    updatePayload.title = String(updates.title).trim();
  }
  if (updates.reference !== undefined) {
    updatePayload.reference = String(updates.reference).trim();
  }
  if (updates.claimNumber !== undefined) {
    const claimNumber = String(updates.claimNumber || "").trim();
    updatePayload.claim_number = claimNumber || null;
  }
  if (updates.witnessName !== undefined) {
    updatePayload.witness_name = String(updates.witnessName).trim();
  }
  if (updates.witnessAddress !== undefined) {
    const witnessAddress = String(updates.witnessAddress || "").trim();
    updatePayload.witness_address = witnessAddress || null;
  }
  if (updates.witnessOccupation !== undefined) {
    const witnessOccupation = String(updates.witnessOccupation || "").trim();
    updatePayload.witness_occupation = witnessOccupation || null;
  }
  if (updates.witnessEmail !== undefined) {
    updatePayload.witness_email = String(updates.witnessEmail).trim();
  }
  if (updates.incidentDate !== undefined) {
    updatePayload.incident_date = updates.incidentDate
      ? String(updates.incidentDate)
      : null;
  }
  if (updates.status !== undefined) {
    const status = String(updates.status).trim() as StatementStatus;
    if (!ALLOWED_STATEMENT_STATUSES.has(status)) {
      throw new Error("Invalid status");
    }
    updatePayload.status = status;
  }

  if (updates.assignedTo !== undefined) {
    if (userRole === "paralegal") {
      throw new Error("Paralegals cannot reassign cases");
    }

    const assignedTo = updates.assignedTo ? String(updates.assignedTo) : null;
    if (assignedTo) {
      const assigneeExists = teamMembers?.some(
        (member) => member.user_id === assignedTo,
      );

      if (!assigneeExists) {
        throw new Error("Invalid assignee");
      }
    }

    updatePayload.assigned_to = assignedTo;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No fields provided for update");
  }

  const { error: updateError } = await supabase
    .from("statements")
    .update(updatePayload as any)
    .eq("id", caseId)
    .eq("tenant_id", tenant_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return statementAccess;
}

export async function deleteCase(
  caseId: string,
  user_id: string,
  tenant_id: string,
  userRole: string,
) {
  const supabase = getSupabaseClient();

  if (!["tenant_admin", "solicitor", "paralegal"].includes(userRole)) {
    throw new Error("Insufficient permissions");
  }

  let query = supabase
    .from("statements")
    .delete()
    .eq("id", caseId)
    .eq("tenant_id", tenant_id);

  if (userRole === "paralegal") {
    query = query.eq("assigned_to", user_id);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCaseForSendLink(
  caseId: string,
  tenant_id: string,
): Promise<{
  case: Case;
  statement: {
    id: string;
    witness_name: string | null;
    witness_email: string | null;
  };
  magicLinkToken: string;
} | null> {
  assertServerOnly("getCaseForSendLink");
  const supabase = getServiceClient();

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("*")
    .eq("id", caseId)
    .eq("tenant_id", tenant_id)
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
    case: {
      id: statement.id,
      tenant_id: statement.tenant_id,
      title: (statement as any).title,
      reference: (statement as any).reference,
      incident_date: statement.incident_date,
      assigned_to: (statement as any).assigned_to,
      created_at: statement.created_at,
    },
    statement: {
      id: statement.id,
      witness_name: statement.witness_name,
      witness_email: statement.witness_email,
    },
    magicLinkToken: magicLink.token,
  };
}

export async function regenerateMagicLink(
  caseId: string,
  tenant_id: string,
): Promise<string> {
  const supabase = getSupabaseClient();

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id")
    .eq("id", caseId)
    .eq("tenant_id", tenant_id)
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
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error: insertError } = await supabase.from("magic_links").insert({
    token: newToken,
    statement_id: statement.id,
    tenant_id: tenant_id,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    throw new Error("Failed to create new magic link: " + insertError.message);
  }

  return newToken;
}
