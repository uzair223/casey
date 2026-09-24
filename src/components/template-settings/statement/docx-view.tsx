"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AsyncButton } from "@/components/ui/async-button";
import { useStatementTemplateSettings } from "./context";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DocxEditor,
  DocxEditorPanel,
  type DocxEditorRef,
} from "@/components/ui/docx-editor";
import { ReviewWithAI, ReviewWithAITrigger } from "@/components/with-ai";
import { ChevronDown, ZapIcon } from "@/components/icons";

function DocxFileActionsMenu({
  canEdit,
  hasUploadedDocument,
  canDownloadStarter,
  canUpload,
  isUploading,
  hasStagedFile,
  onDownloadStarter,
  onDownloadUploaded,
  onDeleteUploaded,
  onUpload,
  onUnstage,
}: {
  canEdit: boolean;
  hasUploadedDocument: boolean;
  canDownloadStarter: boolean;
  canUpload: boolean;
  isUploading: boolean;
  hasStagedFile: boolean;
  onDownloadStarter: () => Promise<void>;
  onDownloadUploaded: () => Promise<void>;
  onDeleteUploaded: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onUnstage: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void onUpload(file);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        Actions
        <ChevronDown className="size-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 flex min-w-56 flex-col rounded-md border bg-card p-1 shadow"
        >
          <AsyncButton
            role="menuitem"
            variant="ghost"
            size="sm"
            className="justify-start"
            pendingText="Generating..."
            disabled={!canDownloadStarter}
            onClick={async () => {
              try {
                await onDownloadStarter();
              } finally {
                setOpen(false);
              }
            }}
          >
            Download starter DOCX
          </AsyncButton>
          {hasUploadedDocument ? (
            <AsyncButton
              role="menuitem"
              variant="ghost"
              size="sm"
              className="justify-start"
              pendingText="Generating..."
              onClick={async () => {
                try {
                  await onDownloadUploaded();
                } finally {
                  setOpen(false);
                }
              }}
            >
              Download uploaded DOCX
            </AsyncButton>
          ) : null}
          {hasUploadedDocument ? (
            <AsyncButton
              role="menuitem"
              variant="ghost"
              size="sm"
              className="justify-start"
              pendingText="Deleting..."
              disabled={!canEdit}
              onClick={async () => {
                try {
                  await onDeleteUploaded();
                } finally {
                  setOpen(false);
                }
              }}
            >
              Delete uploaded DOCX
            </AsyncButton>
          ) : null}
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            size="sm"
            className="justify-start"
            disabled={!canUpload || isUploading}
            onClick={() => {
              setOpen(false);
              fileInputRef.current?.click();
            }}
          >
            {isUploading ? "Uploading..." : "Upload customized DOCX"}
          </Button>
          {hasStagedFile ? (
            <AsyncButton
              role="menuitem"
              variant="ghost"
              size="sm"
              className="justify-start"
              pendingText="Unstaging..."
              onClick={async () => {
                try {
                  await onUnstage();
                } finally {
                  setOpen(false);
                }
              }}
            >
              Unstage
            </AsyncButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function StatementTemplateDocxView() {
  const {
    canEditActiveTemplate,
    activeTemplateId,
    activeTemplate,
    draftName,
    isMainTemplateValid,
    pendingTemplateDocx,
    isUploadingTemplateDocx,
    previewDocxSource,
    docxErrors,
    downloadStarterDocx,
    downloadUploadedDocx,
    deleteUploadedDocx,
    stageTemplateDocx,
    saveTemplateWithDocx,
  } = useStatementTemplateSettings();

  const inlineEditorRef = useRef<DocxEditorRef>(null);
  const fullscreenEditorRef = useRef<DocxEditorRef>(null);
  const [isFullscreenEditorOpen, setIsFullscreenEditorOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();

      if (!canEditActiveTemplate || isUploadingTemplateDocx) {
        return;
      }

      if (isFullscreenEditorOpen) {
        void fullscreenEditorRef.current?.save();
        return;
      }

      void inlineEditorRef.current?.save();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canEditActiveTemplate, isUploadingTemplateDocx, isFullscreenEditorOpen]);

  const handleEditorSave = async (buffer: ArrayBuffer) => {
    const templateName =
      activeTemplate?.name || draftName || "Account template";
    const file = new File([buffer], `${templateName}.docx`, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await saveTemplateWithDocx(file);
  };

  const getCurrentEditorBuffer = async () => {
    if (isFullscreenEditorOpen) {
      return fullscreenEditorRef.current?.getBuffer() ?? null;
    }

    return inlineEditorRef.current?.getBuffer() ?? null;
  };

  const handleReviewComplete = async (reviewedBuffer: ArrayBuffer) => {
    const templateName =
      activeTemplate?.name || draftName || "Account template";
    const file = new File([reviewedBuffer], `${templateName}.docx`, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await saveTemplateWithDocx(file);
  };

  return (
    <DocxEditor
      source={previewDocxSource}
      documentName={
        activeTemplate?.draft_docx_template_document?.name ||
        draftName ||
        activeTemplate?.name ||
        "Account template"
      }
      canEdit={canEditActiveTemplate}
      isSaving={isUploadingTemplateDocx}
      onSave={handleEditorSave}
      onFullscreenChange={setIsFullscreenEditorOpen}
      className="z-100"
    >
      <ReviewWithAI
        getBuffer={getCurrentEditorBuffer}
        documentName={
          activeTemplate?.published_docx_template_document?.name ||
          activeTemplate?.draft_docx_template_document?.name ||
          draftName ||
          activeTemplate?.name ||
          "Account template"
        }
        onReviewComplete={handleReviewComplete}
        className="z-150"
      >
        <div className="space-y-3">
            <DocxEditorPanel
              ref={inlineEditorRef}
              mode="minimal"
              showFullscreenToggle
              className="max-h-120 h-120 gap-3"
              heading={
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Template DOCX</p>
                    <p className="text-xs text-muted-foreground">
                      Edit and save the DOCX template for this statement.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingTemplateDocx ? (
                      <Badge variant="outline">Staged</Badge>
                    ) : null}
                    {activeTemplate?.draft_docx_template_document ? (
                      <Badge variant="secondary">Uploaded</Badge>
                    ) : (
                      <Badge variant="outline">Not uploaded</Badge>
                    )}
                  </div>
                </div>
              }
            >
              <DocxFileActionsMenu
                canEdit={canEditActiveTemplate}
                hasUploadedDocument={Boolean(
                  activeTemplate?.draft_docx_template_document,
                )}
                canDownloadStarter={
                  canEditActiveTemplate && isMainTemplateValid
                }
                canUpload={
                  canEditActiveTemplate &&
                  Boolean(activeTemplateId) &&
                  isMainTemplateValid &&
                  !isUploadingTemplateDocx
                }
                isUploading={isUploadingTemplateDocx}
                hasStagedFile={Boolean(pendingTemplateDocx)}
                onDownloadStarter={downloadStarterDocx}
                onDownloadUploaded={downloadUploadedDocx}
                onDeleteUploaded={deleteUploadedDocx}
                onUpload={stageTemplateDocx}
                onUnstage={() => stageTemplateDocx(null)}
              />
            </DocxEditorPanel>

            {(docxErrors?.errors.length ?? 0) > 0 && (
              <Card size="sm" variant="destructive">
                <CardHeader>
                  <CardTitle className="text-sm">
                    Error: Template DOCX has validation errors
                  </CardTitle>
                  <CardDescription>
                    <ul className="mt-1 list-disc pl-5">
                      {docxErrors?.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {(docxErrors?.unknown.length ?? 0) > 0 && (
              <Card size="sm" variant="warning">
                <CardHeader>
                  <CardTitle className="text-sm">
                    Warning: Template DOCX has unknown fields
                  </CardTitle>
                  <p className="text-sm">
                    The template includes placeholders that are not provided by
                    this statement template. These values may render blank:
                  </p>
                  <ul className="text-sm mt-1 list-disc pl-5">
                    {docxErrors?.unknown.map((warningField) => (
                      <li key={warningField}>{`{${warningField}}`}</li>
                    ))}
                  </ul>
                </CardHeader>
              </Card>
            )}

            {(docxErrors?.unused.length ?? 0) > 0 && (
              <Card size="sm" variant="warning">
                <CardHeader>
                  <CardTitle className="text-sm">
                    Warning: Template DOCX has unused fields
                  </CardTitle>
                  <p className="text-sm">
                    These configured fields are not referenced by the DOCX
                    template. They will not render unless you add matching
                    placeholders:
                  </p>
                  <ul className="text-sm mt-1 list-disc pl-5">
                    {docxErrors?.unused.map((unusedField) => (
                      <li key={unusedField}>{`{${unusedField}}`}</li>
                    ))}
                  </ul>
                </CardHeader>
              </Card>
            )}
        </div>

        <div
          data-docx-review-trigger="true"
          className="fixed bottom-6 right-6 z-120 pointer-events-auto"
        >
          <ReviewWithAITrigger
            className="rounded-full"
            disabled={!canEditActiveTemplate}
          >
            <ZapIcon /> AI Doc Editor
          </ReviewWithAITrigger>
        </div>
      </ReviewWithAI>
    </DocxEditor>
  );
}
