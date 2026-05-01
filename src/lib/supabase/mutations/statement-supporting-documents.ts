import type {
  Json,
  StatementDocumentDescriptors,
  UploadedDocument,
} from "@/types";
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
}

export async function replaceStatementSupportingDocument(input: {
  documentId: string;
  document: UploadedDocument;
}) {
  const supabase = getSupabaseClient();

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
}

export async function deleteStatementSupportingDocument(input: {
  documentId: string;
  document: UploadedDocument;
  fallbackBucketId?: string;
  statementId: string;
}) {
  const supabase = getSupabaseClient();
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
}

export async function SERVERONLY_deleteWitnessSupportingDocument(input: {
  statementId: string;
  documentPath: string;
  tenantId: string;
}) {
  const supabase = getServiceClient("SERVERONLY_deleteWitnessSupportingDocument");

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
