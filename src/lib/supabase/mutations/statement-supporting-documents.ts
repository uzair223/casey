import type {
  Json,
  StatementConfig,
  StatementDocumentDescriptors,
  UploadedDocument,
} from "@/types";
import { applyProgrammaticEvidenceSection } from "@/lib/statement-utils";
import { getSupabaseClient } from "../client";
import { getServiceClient } from "../server";
import {
  getStatementSupportingDocumentsWithClient,
  getSupportingDocumentIds,
} from "../queries/statement-supporting-documents";

type QueryClient =
  | ReturnType<typeof getSupabaseClient>
  | ReturnType<typeof getServiceClient>;

async function syncStatementSupportingDocumentIds(
  supabase: QueryClient,
  statementId: string,
) {
  const rows = await getStatementSupportingDocumentsWithClient(
    supabase,
    statementId,
  );

  const { error } = await supabase
    .from("statements")
    .update({ supporting_documents: rows.map((row) => row.id) as Json })
    .eq("id", statementId);

  if (error) {
    throw error;
  }
}

function normalizeSnapshotSections(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, sectionValue]) => [
      key,
      typeof sectionValue === "string"
        ? sectionValue
        : sectionValue == null
          ? ""
          : String(sectionValue),
    ]),
  );
}

async function refreshProgrammaticEvidenceSection(
  supabase: QueryClient,
  statementId: string,
) {
  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select(
      "id, tenant_id, witness_name, config_snapshot_id, formalization_snapshot_id",
    )
    .eq("id", statementId)
    .maybeSingle();

  if (statementError) {
    throw statementError;
  }

  if (!statement?.config_snapshot_id) {
    return;
  }

  const { data: configSnapshot, error: configError } = await supabase
    .from("statement_config_snapshots")
    .select("config_json")
    .eq("id", statement.config_snapshot_id)
    .maybeSingle();

  if (configError) {
    throw configError;
  }

  const config = configSnapshot?.config_json as StatementConfig | null;
  if (!config?.sections?.length) {
    return;
  }

  const rows = await getStatementSupportingDocumentsWithClient(
    supabase,
    statementId,
  );

  let existingSections: Record<string, string> = {};
  if (statement.formalization_snapshot_id) {
    const { data: snapshot, error: snapshotError } = await supabase
      .from("statement_formalization_snapshots")
      .select("sections")
      .eq("id", statement.formalization_snapshot_id)
      .maybeSingle();

    if (snapshotError) {
      throw snapshotError;
    }

    existingSections = normalizeSnapshotSections(snapshot?.sections);
  }

  const nextSections = applyProgrammaticEvidenceSection(existingSections, {
    config,
    rows,
    witnessName: statement.witness_name || "Witness",
  });

  if (nextSections === existingSections) {
    return;
  }

  const { data: nextSnapshot, error: insertError } = await supabase
    .from("statement_formalization_snapshots")
    .insert({
      statement_id: statement.id,
      tenant_id: statement.tenant_id,
      created_by_user_id: null,
      model: "programmatic_evidence",
      sections: nextSections as Json,
      source_message_ids: [],
      source_message_versions: [],
      evidence_documents: rows.map((row) => row.document) as Json,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  const { error: updateError } = await supabase
    .from("statements")
    .update({ formalization_snapshot_id: nextSnapshot.id })
    .eq("id", statement.id);

  if (updateError) {
    throw updateError;
  }
}

async function assertStatementDocumentsEditable(
  supabase: QueryClient,
  statementId: string,
) {
  const { data, error } = await supabase
    .from("statements")
    .select("status")
    .eq("id", statementId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.status === "finalized" || data?.status === "completed") {
    throw new Error(
      "Supporting documents cannot be edited during final review or after completion.",
    );
  }
}

export async function createStatementSupportingDocumentWithClient(
  supabase: QueryClient,
  input: {
    tenantId: string;
    caseId: string;
    statementId: string;
    uploadedByType: "witness" | "internal_user" | string;
    uploadedByUserId?: string | null;
    uploadedByWitnessName?: string | null;
    uploadedByWitnessEmail?: string | null;
    document: UploadedDocument;
    descriptorStatus?: string;
    descriptors?: StatementDocumentDescriptors;
  },
) {
  await assertStatementDocumentsEditable(supabase, input.statementId);

  const { data, error } = await supabase
    .from("statement_supporting_documents")
    .insert({
      tenant_id: input.tenantId,
      case_id: input.caseId,
      statement_id: input.statementId,
      uploaded_by_type: input.uploadedByType,
      uploaded_by_user_id: input.uploadedByUserId ?? null,
      uploaded_by_witness_name: input.uploadedByWitnessName ?? null,
      uploaded_by_witness_email: input.uploadedByWitnessEmail ?? null,
      title: input.document.name || "Supporting document",
      group_name: input.document.group ?? null,
      document: input.document,
      descriptor_status: input.descriptorStatus ?? "pending",
      descriptors: (input.descriptors ?? {}) as Json,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await syncStatementSupportingDocumentIds(supabase, input.statementId);
  await refreshProgrammaticEvidenceSection(supabase, input.statementId);
  return data.id as string;
}

export async function createStatementSupportingDocument(input: {
  tenantId: string;
  caseId: string;
  statementId: string;
  uploadedByUserId: string;
  document: UploadedDocument;
}) {
  return createStatementSupportingDocumentWithClient(getSupabaseClient(), {
    tenantId: input.tenantId,
    caseId: input.caseId,
    statementId: input.statementId,
    uploadedByType: "internal_user",
    uploadedByUserId: input.uploadedByUserId,
    document: input.document,
  });
}

export async function SERVERONLY_createWitnessSupportingDocuments(input: {
  tenantId: string;
  caseId: string;
  statementId: string;
  witnessName: string;
  witnessEmail: string;
  documents: UploadedDocument[];
}) {
  const supabase = getServiceClient(
    "SERVERONLY_createWitnessSupportingDocuments",
  );

  const ids: string[] = [];
  for (const document of input.documents) {
    ids.push(
      await createStatementSupportingDocumentWithClient(supabase, {
        tenantId: input.tenantId,
        caseId: input.caseId,
        statementId: input.statementId,
        uploadedByType: "witness",
        uploadedByWitnessName: input.witnessName,
        uploadedByWitnessEmail: input.witnessEmail,
        document,
      }),
    );
  }

  return ids;
}

export async function renameStatementSupportingDocument(input: {
  documentId: string;
  document: UploadedDocument;
  name: string;
}) {
  const supabase = getSupabaseClient();
  const nextName = input.name.trim();

  if (!nextName) {
    throw new Error("Document name cannot be empty");
  }

  const { data: existing, error: existingError } = await supabase
    .from("statement_supporting_documents")
    .select("statement_id")
    .eq("id", input.documentId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.statement_id) {
    await assertStatementDocumentsEditable(supabase, existing.statement_id);
  }

  const nextDocument: UploadedDocument = {
    ...input.document,
    name: nextName,
  };

  const { error } = await supabase
    .from("statement_supporting_documents")
    .update({ document: nextDocument, title: nextName })
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }

  if (existing?.statement_id) {
    await refreshProgrammaticEvidenceSection(supabase, existing.statement_id);
  }
}

export async function replaceStatementSupportingDocument(input: {
  documentId: string;
  document: UploadedDocument;
}) {
  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("statement_supporting_documents")
    .select("statement_id")
    .eq("id", input.documentId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.statement_id) {
    await assertStatementDocumentsEditable(supabase, existing.statement_id);
  }

  const { error } = await supabase
    .from("statement_supporting_documents")
    .update({
      document: input.document,
      title: input.document.name,
      group_name: input.document.group ?? null,
      descriptor_status: "pending",
      descriptors: {},
      descriptor_model: null,
      descriptor_generated_at: null,
    })
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }

  if (existing?.statement_id) {
    await refreshProgrammaticEvidenceSection(supabase, existing.statement_id);
  }
}

export async function deleteStatementSupportingDocument(input: {
  documentId: string;
  document: UploadedDocument;
  fallbackBucketId?: string;
  statementId: string;
}) {
  const supabase = getSupabaseClient();
  await assertStatementDocumentsEditable(supabase, input.statementId);
  const bucketId = input.document.bucketId || input.fallbackBucketId;

  if (bucketId && input.document.path) {
    const { error: storageError } = await supabase.storage
      .from(bucketId)
      .remove([input.document.path]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase
    .from("statement_supporting_documents")
    .delete()
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }

  await syncStatementSupportingDocumentIds(supabase, input.statementId);
  await refreshProgrammaticEvidenceSection(supabase, input.statementId);
}

export async function SERVERONLY_deleteWitnessSupportingDocument(input: {
  statementId: string;
  documentPath: string;
  tenantId: string;
}) {
  const supabase = getServiceClient("SERVERONLY_deleteWitnessSupportingDocument");
  await assertStatementDocumentsEditable(supabase, input.statementId);

  const rows = await getStatementSupportingDocumentsWithClient(
    supabase,
    input.statementId,
  );
  const target = rows.find(
    (row) =>
      row.uploaded_by_type === "witness" &&
      row.document.path === input.documentPath,
  );

  if (!target) {
    return false;
  }

  await supabase.storage.from(input.tenantId).remove([input.documentPath]);

  const { error } = await supabase
    .from("statement_supporting_documents")
    .delete()
    .eq("id", target.id);

  if (error) {
    throw error;
  }

  await syncStatementSupportingDocumentIds(supabase, input.statementId);
  await refreshProgrammaticEvidenceSection(supabase, input.statementId);
  return true;
}

export async function SERVERONLY_updateStatementSupportingDocumentDescriptors(
  input: {
    documentId: string;
    status: string;
    descriptors?: StatementDocumentDescriptors;
    model?: string | null;
  },
) {
  const supabase = getServiceClient(
    "SERVERONLY_updateStatementSupportingDocumentDescriptors",
  );
  const { error } = await supabase
    .from("statement_supporting_documents")
    .update({
      descriptor_status: input.status,
      descriptors: (input.descriptors ?? {}) as Json,
      descriptor_model: input.model ?? null,
      descriptor_generated_at:
        input.status === "generated" ? new Date().toISOString() : null,
    })
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }

  const { data: row, error: rowError } = await supabase
    .from("statement_supporting_documents")
    .select("statement_id")
    .eq("id", input.documentId)
    .maybeSingle();

  if (rowError) {
    throw rowError;
  }

  if (row?.statement_id) {
    await refreshProgrammaticEvidenceSection(supabase, row.statement_id);
  }
}

export async function SERVERONLY_syncStatementSupportingDocumentIdsFromRows(
  statementId: string,
) {
  await syncStatementSupportingDocumentIds(
    getServiceClient("SERVERONLY_syncStatementSupportingDocumentIdsFromRows"),
    statementId,
  );
}

export { getSupportingDocumentIds };
