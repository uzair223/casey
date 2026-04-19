"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FileInput, FileInputTrigger } from "@/components/ui/file-input";
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
import { ZapIcon } from "lucide-react";

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
      activeTemplate?.name || draftName || "Witness Statement Template";
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
      activeTemplate?.name || draftName || "Witness Statement Template";
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
        "Witness Statement Template"
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
          "Witness Statement Template"
        }
        onReviewComplete={handleReviewComplete}
        className="z-150"
      >
        <div className="space-y-3">
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
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

            <div className="flex flex-wrap gap-2">
              <AsyncButton
                variant="outline"
                size="sm"
                onClick={downloadStarterDocx}
                pendingText="Generating..."
                disabled={!canEditActiveTemplate || !isMainTemplateValid}
              >
                Download starter DOCX
              </AsyncButton>

              {activeTemplate?.draft_docx_template_document && (
                <>
                  <AsyncButton
                    variant="outline"
                    size="sm"
                    onClick={downloadUploadedDocx}
                    pendingText="Generating..."
                  >
                    Download uploaded DOCX
                  </AsyncButton>

                  <AsyncButton
                    variant="outline"
                    size="sm"
                    onClick={deleteUploadedDocx}
                    pendingText="Deleting..."
                    disabled={!canEditActiveTemplate}
                  >
                    Delete uploaded DOCX
                  </AsyncButton>
                </>
              )}

              <FileInput
                accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={
                  !canEditActiveTemplate ||
                  !activeTemplateId ||
                  !isMainTemplateValid ||
                  isUploadingTemplateDocx
                }
                value={pendingTemplateDocx ? [pendingTemplateDocx] : []}
                onChange={(files) => {
                  void stageTemplateDocx(files[0] ?? null);
                }}
              >
                <FileInputTrigger
                  size="sm"
                  disabled={
                    !canEditActiveTemplate ||
                    !isMainTemplateValid ||
                    isUploadingTemplateDocx
                  }
                >
                  {isUploadingTemplateDocx
                    ? "Uploading..."
                    : "Upload customized DOCX"}
                </FileInputTrigger>
              </FileInput>

              {pendingTemplateDocx && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => stageTemplateDocx(null)}
                >
                  Unstage
                </Button>
              )}
            </div>

            <DocxEditorPanel
              ref={inlineEditorRef}
              mode="minimal"
              showFullscreenToggle
              className="max-h-120 h-120"
            />

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
