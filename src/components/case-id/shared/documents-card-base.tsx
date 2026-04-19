"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { useAsync } from "@/hooks/useAsync";
import { useUser } from "@/contexts/user-context";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DocumentViewer,
  DocumentViewerTrigger,
} from "@/components/ui/document-viewer";
import { uploadFile } from "@/lib/supabase/mutations";
import type { UploadedDocument } from "@/types";
import { UploadIcon } from "lucide-react";

type Document = {
  id: string;
  created_at: string;
  document: UploadedDocument;
};

type DocumentsCardBaseProps = {
  tenantId: string;
  title: string;
  loadDocuments: () => Promise<Document[]>;
  refreshDeps: unknown[];
  buildUploadPath: (fileName: string) => string;
  createDocumentRecord: (args: {
    uploadedByUserId: string;
    document: UploadedDocument;
  }) => Promise<unknown>;
  renameDocumentRecord: (args: {
    entry: Document;
    name: string;
  }) => Promise<void>;
  deleteDocumentRecord: (args: {
    entry: Document;
    fallbackBucketId: string;
  }) => Promise<void>;
  replaceDocumentRecord?: (args: {
    entry: Document;
    file: File;
  }) => Promise<void>;
  variant?: "card" | "inline";
  cardProps?: React.ComponentProps<typeof Card>;
};

export function DocumentsCardBase({
  tenantId,
  title,
  loadDocuments,
  refreshDeps,
  buildUploadPath,
  createDocumentRecord,
  renameDocumentRecord,
  deleteDocumentRecord,
  replaceDocumentRecord,
  variant = "card",
  cardProps,
}: DocumentsCardBaseProps) {
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
  } = useAsync(loadDocuments, refreshDeps, {
    initialState: [],
    withUseEffect: true,
  });

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) {
      return;
    }

    const uploaded = await uploadFile({
      bucketId: tenantId,
      name: file.name,
      path: buildUploadPath(file.name),
      file,
      contentType: file.type || "application/octet-stream",
    });

    await createDocumentRecord({
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

  const handleRename = async (entry: Document) => {
    await renameDocumentRecord({
      entry,
      name: editingDocumentName,
    });

    cancelRename();
    await refreshDocuments();
  };

  const handleDelete = async (entry: Document) => {
    if (
      !confirm("Delete this internal document? This action cannot be undone.")
    ) {
      return;
    }

    await deleteDocumentRecord({
      entry,
      fallbackBucketId: tenantId,
    });

    if (editingDocumentId === entry.id) {
      cancelRename();
    }

    await refreshDocuments();
  };

  const renderRow = (entry: Document) => {
    const content = (
      <>
        <div className="min-w-0 flex-1">
          {editingDocumentId === entry.id ? (
            <Input
              value={editingDocumentName}
              onChange={(event) => setEditingDocumentName(event.target.value)}
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
          editable={!!replaceDocumentRecord}
          onReplace={
            replaceDocumentRecord
              ? async (file) => {
                  await replaceDocumentRecord({ entry, file });
                  await refreshDocuments();
                }
              : undefined
          }
        >
          <div className="flex flex-wrap justify-end gap-2">
            <DocumentViewerTrigger asChild>
              <Button size="sm" variant="outline">
                View
              </Button>
            </DocumentViewerTrigger>

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
                <Button size="sm" variant="outline" onClick={cancelRename}>
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
        </DocumentViewer>
      </>
    );

    if (variant === "inline") {
      return (
        <div
          key={entry.id}
          className="flex items-center gap-2 rounded-md border p-2 pl-3"
        >
          {content}
        </div>
      );
    }

    return (
      <Card key={entry.id} size="sm">
        <CardHeader className="flex-row items-center">{content}</CardHeader>
      </Card>
    );
  };

  return (
    <Card {...cardProps}>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
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
            onClick={handleChooseFile}
          >
            <UploadIcon />
            Upload file
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : documents.length ? (
          <div className="space-y-2">{documents.map(renderRow)}</div>
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
