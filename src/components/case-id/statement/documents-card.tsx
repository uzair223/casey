"use client";

import { useRef, useState } from "react";

import { useAsync } from "@/hooks/useAsync";
import { useUser } from "@/contexts/user-context";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DocumentViewer } from "@/components/ui/document-viewer";

import { getStatementInternalDocuments } from "@/lib/supabase/queries";
import {
  createStatementInternalDocument,
  deleteStatementInternalDocument,
  renameStatementInternalDocument,
  uploadFile,
} from "@/lib/supabase/mutations";

type StatementInternalDocumentsCardProps = {
  tenantId: string;
  caseId: string;
  statementId: string;
};

export function StatementInternalDocumentsCard({
  tenantId,
  caseId,
  statementId,
}: StatementInternalDocumentsCardProps) {
  const { user } = useUser();
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(
    null,
  );
  const [editingDocumentName, setEditingDocumentName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: documents,
    isLoading,
    handler: refreshDocuments,
  } = useAsync(
    () => getStatementInternalDocuments(statementId),
    [statementId],
    { initialState: [], withUseEffect: true },
  );

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) {
      return;
    }

    const path = `cases/${caseId}/statements/${statementId}/internal/${Date.now()}-${file.name}`;
    const uploaded = await uploadFile({
      bucketId: tenantId,
      name: file.name,
      path,
      file,
      contentType: file.type || "application/octet-stream",
    });

    await createStatementInternalDocument({
      tenantId,
      statementId,
      uploadedByUserId: user.id,
      document: uploaded,
    });

    event.target.value = "";
    await refreshDocuments();
  };

  const startRename = (documentId: string, name: string) => {
    setEditingDocumentId(documentId);
    setEditingDocumentName(name);
  };

  const cancelRename = () => {
    setEditingDocumentId(null);
    setEditingDocumentName("");
  };

  const handleRename = async (entry: {
    id: string;
    document: {
      name: string;
      path: string;
      type: string;
      uploadedAt: string;
      bucketId?: string;
      description?: string;
    };
  }) => {
    await renameStatementInternalDocument({
      documentId: entry.id,
      document: entry.document,
      name: editingDocumentName,
    });

    cancelRename();
    await refreshDocuments();
  };

  const handleDelete = async (entry: {
    id: string;
    document: {
      name: string;
      path: string;
      type: string;
      uploadedAt: string;
      bucketId?: string;
      description?: string;
    };
  }) => {
    if (
      !confirm("Delete this internal document? This action cannot be undone.")
    ) {
      return;
    }

    await deleteStatementInternalDocument({
      documentId: entry.id,
      document: entry.document,
      fallbackBucketId: tenantId,
    });
    if (editingDocumentId === entry.id) {
      cancelRename();
    }
    await refreshDocuments();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Internal statement evidence</CardTitle>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button type="button" variant="outline" onClick={handleChooseFile}>
            Upload file
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : documents.length ? (
          <div className="space-y-2">
            {documents.map((entry) => (
              <div key={entry.id} className="rounded-md border p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {editingDocumentId === entry.id ? (
                      <Input
                        value={editingDocumentName}
                        onChange={(event) =>
                          setEditingDocumentName(event.target.value)
                        }
                        placeholder="Document name"
                        className="h-8"
                      />
                    ) : (
                      <p className="text-sm font-medium truncate">
                        {entry.document.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <DocumentViewer
                    document={entry.document}
                    bucketId={tenantId}
                    triggerLabel="View"
                    triggerVariant="outline"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {editingDocumentId === entry.id ? (
                    <>
                      <AsyncButton
                        size="sm"
                        onClick={() => handleRename(entry)}
                        pendingText="Saving..."
                        disabled={!editingDocumentName.trim()}
                      >
                        Save name
                      </AsyncButton>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelRename}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startRename(entry.id, entry.document.name)}
                    >
                      Rename
                    </Button>
                  )}

                  <AsyncButton
                    size="sm"
                    variant="outline-destructive"
                    onClick={() => handleDelete(entry)}
                    pendingText="Deleting..."
                  >
                    Delete
                  </AsyncButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No internal documents yet.
          </p>
        )}
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refreshDocuments()}
          >
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
