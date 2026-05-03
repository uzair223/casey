"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileTextIcon, RefreshCwIcon, Trash2Icon, UploadIcon } from "lucide-react";

import { AttachmentPreviewCard } from "@/components/ui/attachment-preview-card";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUser } from "@/contexts/user-context";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import {
  createStatementSupportingDocument,
  deleteStatementSupportingDocument,
  replaceStatementSupportingDocument,
  renameStatementSupportingDocument,
  uploadFile,
} from "@/lib/supabase/mutations";
import { getStatementSupportingDocuments } from "@/lib/supabase/queries";
import { toast } from "@/lib/toast";
import type { StatementSupportingDocument } from "@/types";

type StatementSupportingDocumentsCardProps = {
  tenantId: string;
  caseId: string;
  statementId: string;
  readOnly?: boolean;
};

function getDescriptorSummary(entry: StatementSupportingDocument) {
  return (
    entry.descriptors.summary ||
    entry.document.description ||
    (entry.descriptor_status === "pending"
      ? "Descriptor will be generated shortly."
      : "No descriptor available.")
  );
}

export function StatementSupportingDocumentsCard({
  tenantId,
  caseId,
  statementId,
  readOnly = false,
}: StatementSupportingDocumentsCardProps) {
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(
    null,
  );
  const [editingDocumentName, setEditingDocumentName] = useState("");

  const {
    data: documents,
    isLoading,
    handler: refreshDocuments,
  } = useAsync(() => getStatementSupportingDocuments(statementId), [statementId], {
    initialState: [],
    withUseEffect: true,
  });

  const describeDocument = async (entry: StatementSupportingDocument) => {
    await apiFetch(
      `/api/tenant/statement/${statementId}/supporting-documents/${entry.id}/describe`,
      { method: "POST" },
    );
    await refreshDocuments();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) {
      return;
    }

    const uploaded = await uploadFile({
      bucketId: tenantId,
      name: file.name,
      path: `cases/${caseId}/${statementId}/supporting/${Date.now()}-${file.name}`,
      file,
      contentType: file.type || "application/octet-stream",
    });

    const documentId = await createStatementSupportingDocument({
      tenantId,
      caseId,
      statementId,
      uploadedByUserId: user.id,
      document: uploaded,
    });

    event.target.value = "";
    await refreshDocuments();

    void apiFetch(
      `/api/tenant/statement/${statementId}/supporting-documents/${documentId}/describe`,
      { method: "POST" },
    )
      .then(refreshDocuments)
      .catch(() => refreshDocuments());
  };

  const handleRename = async (entry: StatementSupportingDocument) => {
    await renameStatementSupportingDocument({
      documentId: entry.id,
      document: entry.document,
      name: editingDocumentName,
    });
    setEditingDocumentId(null);
    setEditingDocumentName("");
    await refreshDocuments();
  };

  const handleDelete = async (entry: StatementSupportingDocument) => {
    const confirmed = await toast.confirm("Delete this supporting document?", {
      description: "This action cannot be undone.",
      confirmLabel: "Delete document",
    });
    if (!confirmed) {
      return;
    }

    await deleteStatementSupportingDocument({
      documentId: entry.id,
      statementId,
      document: entry.document,
      fallbackBucketId: tenantId,
    });
    await refreshDocuments();
  };

  const handleReplace = async (
    entry: StatementSupportingDocument,
    file: File,
  ) => {
    const uploaded = await uploadFile({
      bucketId: tenantId,
      name: file.name,
      path: entry.document.path,
      file,
      contentType: file.type || entry.document.type,
      upsert: true,
    });

    await replaceStatementSupportingDocument({
      documentId: entry.id,
      document: uploaded,
    });
    await refreshDocuments();
    await describeDocument({ ...entry, document: uploaded });
  };

  const renderDocument = (entry: StatementSupportingDocument) => (
    <div
      key={entry.id}
      className="flex gap-3 rounded-md border bg-card/40 p-3"
    >
      <AttachmentPreviewCard
        document={entry.document}
        hideLabel="all"
        thumbnailSize="lg"
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {editingDocumentId === entry.id ? (
              <Input
                value={editingDocumentName}
                onChange={(event) => setEditingDocumentName(event.target.value)}
                className="h-8"
              />
            ) : (
              <p className="truncate text-sm font-semibold">
                {entry.title || entry.document.name}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="capitalize">
                {entry.uploaded_by_type === "witness" ? "Witness" : "Internal"}
              </Badge>
              {entry.group_name ? (
                <Badge variant="outline">{entry.group_name}</Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap justify-end gap-1.5">
            {editingDocumentId === entry.id ? (
              <>
                <AsyncButton
                  size="sm"
                  onClick={() => handleRename(entry)}
                  disabled={!editingDocumentName.trim()}
                  pendingText="Saving..."
                >
                  Save
                </AsyncButton>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingDocumentId(null)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingDocumentId(entry.id);
                  setEditingDocumentName(entry.title || entry.document.name);
                }}
              >
                Rename
              </Button>
            )}

            <AsyncButton
              size="sm"
              variant="outline"
              onClick={() => describeDocument(entry)}
              pendingText="Describing..."
            >
              <RefreshCwIcon className="h-4 w-4" />
              Describe
            </AsyncButton>

            <input
              id={`replace-${entry.id}`}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void handleReplace(entry, file);
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                document.getElementById(`replace-${entry.id}`)?.click()
              }
            >
              Replace
            </Button>

            <AsyncButton
              size="sm"
              variant="outline-destructive"
              onClick={() => handleDelete(entry)}
              pendingText="Deleting..."
            >
              <Trash2Icon className="h-4 w-4" />
            </AsyncButton>
            </div>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {getDescriptorSummary(entry)}
        </p>

        {entry.descriptors.keyDetails?.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {entry.descriptors.keyDetails.slice(0, 3).map((detail) => (
              <li key={detail} className="flex gap-2">
                <span>•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="inline-flex items-center gap-2 text-base">
          <FileTextIcon className="h-4 w-4" />
          Supporting documents
        </CardTitle>
        {!readOnly ? (
          <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            className="pl-3"
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="h-4 w-4" />
            Upload
          </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : documents.length ? (
          <div className="space-y-2">{documents.map(renderDocument)}</div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No supporting documents yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
