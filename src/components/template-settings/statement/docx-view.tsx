"use client";

import { Badge } from "@/components/ui/badge";
import { FileInput, FileInputTrigger } from "@/components/ui/file-input";
import { AsyncButton } from "@/components/ui/async-button";
import { PreviewDocx } from "@/components/ui/preview-docx";
import { useStatementTemplateSettings } from "./context";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function StatementTemplateDocxView() {
  const {
    canEditActiveTemplate,
    activeTemplateId,
    activeTemplate,
    isMainTemplateValid,
    pendingTemplateDocx,
    isUploadingTemplateDocx,
    previewDocxSource,
    previewDocxLabel,
    docxErrors,
    downloadStarterDocx,
    downloadUploadedDocx,
    stageTemplateDocx,
  } = useStatementTemplateSettings();

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Template DOCX</p>
            <p className="text-xs text-muted-foreground">
              Generate a starter DOCX from this config, customize it, then stage
              it here and save.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingTemplateDocx ? (
              <Badge variant="outline">Staged</Badge>
            ) : null}
            {activeTemplate?.docx_template_document ? (
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

          <AsyncButton
            variant="outline"
            size="sm"
            onClick={downloadUploadedDocx}
            pendingText="Generating..."
            disabled={!canEditActiveTemplate || !isMainTemplateValid}
          >
            Download uploaded DOCX
          </AsyncButton>

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
                The template includes placeholders that are not provided by this
                statement template. These values may render blank:
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
                These configured fields are not referenced by the DOCX template.
                They will not render unless you add matching placeholders:
              </p>
              <ul className="text-sm mt-1 list-disc pl-5">
                {docxErrors?.unused.map((unusedField) => (
                  <li key={unusedField}>{`{${unusedField}}`}</li>
                ))}
              </ul>
            </CardHeader>
          </Card>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            {previewDocxLabel ? (
              <Badge variant="secondary">{previewDocxLabel}</Badge>
            ) : null}
          </div>
          <PreviewDocx
            source={previewDocxSource}
            emptyMessage="No preview available."
          />
        </div>
      </div>
    </div>
  );
}
