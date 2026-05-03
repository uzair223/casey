import type {
  StatementSupportingDocument,
  UploadedDocument,
} from "@/types";
import { getEvidenceDocumentsFromSupportingRows } from "@/lib/evidence";
import { getSupabaseClient } from "../client";
import { getServiceClient } from "../server";

type QueryClient =
  | ReturnType<typeof getSupabaseClient>
  | ReturnType<typeof getServiceClient>;

type RawSupportingDocumentRow = Omit<
  StatementSupportingDocument,
  "document" | "descriptors"
> & {
  document: unknown;
  descriptors: unknown;
};

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function toSupportingDocument(
  row: RawSupportingDocumentRow,
): StatementSupportingDocument {
  return {
    ...row,
    document: row.document as UploadedDocument,
    descriptors:
      row.descriptors && typeof row.descriptors === "object"
        ? (row.descriptors as StatementSupportingDocument["descriptors"])
        : {},
  };
}

export function getSupportingDocumentIds(value: unknown): string[] {
  return isIdList(value) ? value : [];
}

export function getUploadedDocumentsFromSupportingRows(
  rows: StatementSupportingDocument[] | undefined | null,
): UploadedDocument[] {
  return getEvidenceDocumentsFromSupportingRows(rows);
}

export async function getStatementSupportingDocumentsWithClient(
  supabase: QueryClient,
  statementId: string,
): Promise<StatementSupportingDocument[]> {
  const { data, error } = await supabase
    .from("statement_supporting_documents")
    .select("*")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawSupportingDocumentRow[]).map(
    toSupportingDocument,
  );
}

export async function getStatementSupportingDocuments(
  statementId: string,
): Promise<StatementSupportingDocument[]> {
  return getStatementSupportingDocumentsWithClient(
    getSupabaseClient(),
    statementId,
  );
}

export async function SERVERONLY_getStatementSupportingDocuments(
  statementId: string,
): Promise<StatementSupportingDocument[]> {
  return getStatementSupportingDocumentsWithClient(
    getServiceClient("SERVERONLY_getStatementSupportingDocuments"),
    statementId,
  );
}

export async function resolveStatementSupportingDocuments(
  supabase: QueryClient,
  statementId: string,
  idsOrRows: unknown,
): Promise<StatementSupportingDocument[]> {
  if (Array.isArray(idsOrRows) && idsOrRows.length > 0) {
    const first = idsOrRows[0];
    if (first && typeof first === "object" && "document" in first) {
      return (idsOrRows as RawSupportingDocumentRow[]).map(
        toSupportingDocument,
      );
    }
  }

  const ids = getSupportingDocumentIds(idsOrRows);
  let query = supabase
    .from("statement_supporting_documents")
    .select("*")
    .eq("statement_id", statementId);

  if (ids.length) {
    query = query.in("id", ids);
  } else {
    query = query.order("created_at", { ascending: true });
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as RawSupportingDocumentRow[]).map(
    toSupportingDocument,
  );

  if (!ids.length) {
    return rows;
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean) as StatementSupportingDocument[];
}
