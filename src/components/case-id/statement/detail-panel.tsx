"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  useForm,
  useWatch,
  FormProvider,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ExternalLinkIcon,
  FileTextIcon,
  Info,
  PenIcon,
  RotateCwIcon,
  SaveIcon,
  SendHorizonalIcon,
  Trash2Icon,
} from "lucide-react";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RhfField } from "@/components/ui/rhf-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserRole } from "@/contexts/user-context";
import { useAsync } from "@/hooks/useAsync";

import { apiFetch } from "@/lib/api-utils";
import { cn } from "@/lib/utils";
import {
  getFullStatementFromId,
  downloadUploadedDocument,
} from "@/lib/supabase/queries";
import {
  deleteStatement,
  regenerateMagicLink,
  updateStatement,
  uploadFile,
} from "@/lib/supabase/mutations";
import {
  buildUpdateWitnessDetailsSchema,
  type UpdateWitnessDetailsFormData,
} from "@/lib/schema/witness-statement";
import { type UpdateStatementSchemaType } from "@/lib/schema/statement";
import { generateDoc } from "@/lib/doc-gen";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import type { FullStatementDataResponse, UploadedDocument } from "@/types";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { StatementFollowUpCard } from "./follow-up-card";
import { StatementInternalDocumentsCard } from "./documents-card";
import { StatementNotesCard } from "./notes-card";
import { StatementReminderSettingsCard } from "./settings-card";
import {
  statementStatusVariant,
  statementStatusLabel,
} from "@/lib/status-styles";

type StatementDetailPanelProps = {
  statementId: string;
  refreshCase: () => Promise<unknown>;
};

function normalizeSectionValues(value: unknown, sectionFields: string[]) {
  const next: Record<string, string> = {};

  for (const field of sectionFields) {
    next[field] = "";
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return next;
  }

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    next[key] = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  }

  return next;
}

function toFormValues(
  data: FullStatementDataResponse<false>,
  sections: Record<string, string>,
): UpdateWitnessDetailsFormData {
  const config = data.statement.statement_config;
  const metadataFields = config.witness_metadata_fields ?? [];
  const metadata =
    (data.statement.witness_metadata as
      | Record<string, unknown>
      | null
      | undefined) ?? {};

  const witnessMetadata = Object.fromEntries(
    metadataFields.map((field) => {
      const value = metadata[field.id];
      return [field.id, typeof value === "string" ? value : ""];
    }),
  );

  void sections;

  return {
    status: data.statement.status as UpdateWitnessDetailsFormData["status"],
    witness_name: data.statement.witness_name,
    witness_email: data.statement.witness_email,
    witness_metadata: witnessMetadata,
  };
}

function DocumentRow({
  document,
  bucketId,
}: {
  document: UploadedDocument;
  bucketId: string;
}) {
  return (
    <DocumentViewer
      document={document}
      bucketId={bucketId}
      triggerLabel={document.name}
      triggerVariant="outline"
    />
  );
}

export function StatementDetailPanel({
  statementId,
  refreshCase,
}: StatementDetailPanelProps) {
  const role = useUserRole();
  const canModify = ["tenant_admin", "solicitor"].includes(role);
  const canPinNotes = ["tenant_admin", "solicitor"].includes(role);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSections, setIsEditingSections] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>(
    {},
  );

  const configForFormResolverRef = useRef<
    Parameters<typeof buildUpdateWitnessDetailsSchema>[0]
  >(EMPTY_STATEMENT_CONFIG);
  const dynamicResolver = useCallback<Resolver<UpdateWitnessDetailsFormData>>(
    async (values, context, options) => {
      const schema = buildUpdateWitnessDetailsSchema(
        configForFormResolverRef.current,
      );
      return zodResolver(schema)(values, context, options);
    },
    [],
  );

  const formMethods = useForm<UpdateWitnessDetailsFormData>({
    resolver: dynamicResolver,
  });

  const selectedStatus = useWatch({
    control: formMethods.control,
    name: "status",
  });

  const {
    data,
    setData,
    isLoading,
    handler: fetchStatement,
    reset,
  } = useAsync<FullStatementDataResponse<false> | null>(
    async () => {
      const data = await getFullStatementFromId(statementId, false);

      if (!data) {
        throw new Error("Statement not found");
      }

      const config = data.statement.statement_config;

      const nextSections = normalizeSectionValues(
        (data as { sections?: Record<string, unknown> | null }).sections,
        config.sections.map((section) => section.id),
      );
      formMethods.reset(toFormValues(data, nextSections));
      setSectionDrafts(nextSections);
      return data;
    },
    [statementId],
    { withUseEffect: true, initialLoading: true },
  );

  useEffect(() => {
    configForFormResolverRef.current =
      data?.statement.statement_config ?? EMPTY_STATEMENT_CONFIG;
  }, [data?.statement.statement_config]);

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Loading statement details...
        </CardContent>
      </Card>
    );
  }

  const statementConfig = data.statement.statement_config;
  const latestMeta = data.latest?.meta;

  const witnessMetadataFields = statementConfig.witness_metadata_fields ?? [];
  const witnessMetadataValues = data.statement.witness_metadata;
  const progress = latestMeta?.progress;

  const isLinkExpired = data.statement.link?.expires_at
    ? new Date(data.statement.link.expires_at) < new Date()
    : false;

  const persistStatement = async (payload: UpdateStatementSchemaType) => {
    if (!data) return;

    await updateStatement(data.statement.id, payload);
    await Promise.all([refreshCase(), fetchStatement()]);
  };

  const onSave = async (data: UpdateWitnessDetailsFormData) => {
    setIsSaving(true);
    try {
      const metadataPatch = Object.fromEntries(
        witnessMetadataFields.map((field) => {
          const raw = data.witness_metadata?.[field.id];
          const value = typeof raw === "string" ? raw.trim() : "";
          return [field.id, value === "" ? null : value];
        }),
      );

      await persistStatement({
        status: data.status,
        witness_name: data.witness_name,
        witness_email: data.witness_email,
        witness_metadata: metadataPatch,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!data) return;

    if (
      !confirm(
        "Are you sure you want to delete this statement? This action cannot be undone.",
      )
    ) {
      return;
    }

    await deleteStatement(data.statement.id);
    reset();
    await refreshCase();
  };

  const onSendStatementLink = async () => {
    if (!data) return;

    await apiFetch(`/api/tenant/statement/${data.statement.id}/send-link`, {
      method: "POST",
    });
    alert("Statement link sent to witness email");
  };

  const onRegenerateLink = async () => {
    if (!data) return;

    const link = await regenerateMagicLink(data.statement.id);
    setData((prev) => (prev ? { ...prev, link } : prev));

    if (
      confirm(
        "Magic link has been regenerated. Do you want to email it to the witness?",
      )
    ) {
      await onSendStatementLink();
    }
  };

  const regenerateDocx = async (skipSectionPersist = false) => {
    if (!data) return;

    setIsRegenerating(true);
    try {
      if (!skipSectionPersist) {
        await updateStatement(data.statement.id, {
          sections: sectionDrafts,
        });
      }

      const templateDocument = data.statement.template_document_snapshot
        ? await downloadUploadedDocument(
            data.statement.template_document_snapshot,
          )
        : null;

      const blob = await generateDoc(
        {
          caseTitle: data.case.title,
          caseMetadata:
            (data.case.case_metadata as Record<
              string,
              string | number | null | undefined
            >) ?? {},
          witnessName: data.statement.witness_name,
          witnessEmail: data.statement.witness_email,
          witnessMetadata:
            (data.statement.witness_metadata as Record<
              string,
              string | number | null | undefined
            >) ?? {},
          sections: sectionDrafts,
          config: statementConfig,
        },
        templateDocument,
      );

      const name = `${data.case.title || "case"} ${data.statement.witness_name} Witness Statement.docx`;
      const path = `statements/${data.case.id}/${data.statement.id}/${new Date().toISOString()} ${name}`;
      const uploaded = await uploadFile({
        bucketId: data.tenant_id,
        name,
        path,
        file: new File([blob], name, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

      await updateStatement(data.statement.id, {
        signed_document: uploaded,
      });

      await Promise.all([refreshCase(), fetchStatement()]);
      alert("DOCX regenerated and saved");
    } finally {
      setIsRegenerating(false);
    }
  };

  const onSaveSections = async () => {
    if (!data) return;

    setIsSavingSections(true);
    try {
      await updateStatement(data.statement.id, {
        sections: sectionDrafts,
      });
      await Promise.all([refreshCase(), fetchStatement()]);
      setIsEditingSections(false);

      if (confirm("Sections saved. Do you want to regenerate the DOCX now?")) {
        await regenerateDocx(true);
      }
    } finally {
      setIsSavingSections(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canModify ? (
            <>
              <AsyncButton
                variant="outline-destructive"
                size="sm"
                onClick={onDelete}
                pendingText="Deleting..."
              >
                <Trash2Icon className="h-4 w-4" />
                Delete statement
              </AsyncButton>
            </>
          ) : null}
          <AsyncButton
            variant="outline"
            size="sm"
            onClick={onRegenerateLink}
            pendingText={
              <>
                <RotateCwIcon className="h-4 w-4" />
                Regenerating...
              </>
            }
          >
            <RotateCwIcon className="h-4 w-4" />
            Regenerate link
          </AsyncButton>
          <AsyncButton
            variant="outline"
            size="sm"
            onClick={onSendStatementLink}
            disabled={isLinkExpired}
            pendingText={
              <>
                <SendHorizonalIcon className="h-4 w-4" />
                Sending...
              </>
            }
          >
            <SendHorizonalIcon className="h-4 w-4" />
            Send link
          </AsyncButton>
          {data.statement.link ? (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/intake/${data.statement.link.token}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                View intake link
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Statement information</CardTitle>
          {canModify ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing((prev) => !prev)}
            >
              <PenIcon className="h-4 w-4" />
              {isEditing ? "Cancel editing" : "Edit details"}
            </Button>
          ) : null}
        </CardHeader>
        {isEditing ? (
          <FormProvider {...formMethods}>
            <form onSubmit={formMethods.handleSubmit(onSave)}>
              <CardContent className="grid grid-cols-2 gap-3 [&_label]:text-muted-foreground">
                <div className="col-span-2 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Case information</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Case-level fields are read-only here.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Case name:</span>{" "}
                      {data.case.title}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Incident date:
                      </span>{" "}
                      {data.case.incident_date || "TBD"}
                    </p>
                  </div>
                </div>

                <RhfField
                  form={formMethods}
                  name="status"
                  controlId="statement-status"
                  label="Statement status"
                  registerOptions={{ required: true }}
                  renderControl={(registration, required) => (
                    <>
                      <input
                        type="hidden"
                        id="statement-status"
                        required={required}
                        {...registration}
                      />
                      <Select
                        value={selectedStatus ?? ""}
                        onValueChange={(value) =>
                          formMethods.setValue(
                            "status",
                            value as UpdateWitnessDetailsFormData["status"],
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            },
                          )
                        }
                      >
                        <SelectTrigger aria-required={required}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statementStatusLabel).map(
                            ([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                />

                <RhfField
                  form={formMethods}
                  name="witness_name"
                  controlId="statement-witness-name"
                  label="Name"
                  renderControl={(registration, required) => (
                    <Input
                      id="statement-witness-name"
                      required={required}
                      {...registration}
                    />
                  )}
                />

                <RhfField
                  form={formMethods}
                  name="witness_email"
                  controlId="statement-witness-email"
                  label="Email"
                  renderControl={(registration, required) => (
                    <Input
                      id="statement-witness-email"
                      type="email"
                      required={required}
                      {...registration}
                    />
                  )}
                />

                {witnessMetadataFields.map((field) => {
                  const fieldName = `witness_metadata.${field.id}` as const;

                  return (
                    <RhfField
                      key={field.id}
                      form={formMethods}
                      name={fieldName}
                      controlId={`statement-witness-metadata-${field.id}`}
                      label={field.label}
                      renderControl={(registration, required) => (
                        <Input
                          id={`statement-witness-metadata-${field.id}`}
                          required={required}
                          {...registration}
                        />
                      )}
                    />
                  );
                })}
              </CardContent>

              <CardFooter>
                <AsyncButton
                  pendingText="Saving..."
                  type="submit"
                  disabled={isSaving}
                >
                  <SaveIcon className="h-4 w-4" />
                  Save changes
                </AsyncButton>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    formMethods.reset(toFormValues(data, sectionDrafts));
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </form>
          </FormProvider>
        ) : (
          <>
            <CardContent className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Case name
                </p>
                <p className="text-sm">{data.case.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Incident date
                </p>
                <p className="text-sm">{data.case.incident_date || "TBD"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <Badge
                  variant={statementStatusVariant[data.statement.status]}
                  className="capitalize"
                >
                  {statementStatusLabel[data.statement.status]}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Name
                </p>
                <p className="text-sm">{data.statement.witness_name || "—"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
                <Link
                  className="text-sm hover:underline"
                  href={`mailto:${data.statement.witness_email}`}
                >
                  {data.statement.witness_email}
                </Link>
              </div>

              {witnessMetadataFields.map((field) => {
                const value = witnessMetadataValues[field.id];
                return (
                  <div key={field.id}>
                    <p className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </p>
                    <p className="text-sm">
                      {typeof value === "string" && value.trim() !== ""
                        ? value
                        : "-"}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statement progress</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-sky-600 transition-all"
                style={{ width: `${progress?.overallCompletion ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-semibold">
              {Math.round(progress?.overallCompletion ?? 0)}%
            </span>
          </div>
        </CardHeader>
        {progress ? (
          <CardContent className="space-y-4 pt-0">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Phase breakdown
              </p>
              <div className="space-y-2">
                {Object.entries(progress.phaseCompleteness).map(
                  ([phaseId, completion]) => {
                    const phase = statementConfig.phases.find(
                      (item) => item.id === phaseId,
                    );
                    return (
                      <div
                        key={phaseId}
                        className="flex items-center justify-between gap-3"
                      >
                        <p className="text-xs">{phase?.title || phaseId}</p>
                        <div className="flex w-36 items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-secondary">
                            <div
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                completion >= 80
                                  ? "bg-green-500"
                                  : "bg-warning",
                              )}
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <p className="w-10 text-right text-xs font-medium">
                            {Math.round(completion)}%
                          </p>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Statement sections</CardTitle>
          {canModify ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingSections((prev) => !prev)}
                disabled={isSavingSections || isRegenerating}
              >
                <PenIcon className="h-4 w-4" />
                {isEditingSections ? "Cancel section edits" : "Edit sections"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void regenerateDocx()}
                disabled={isRegenerating}
              >
                <FileTextIcon className="h-4 w-4" />
                {isRegenerating ? "Regenerating DOCX..." : "Regenerate DOCX"}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {statementConfig.sections.map((section) => (
            <div key={section.id} className="space-y-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{section.title}</p>
                <p className="text-xs text-muted-foreground">
                  {section.description}
                </p>
              </div>
              {isEditingSections ? (
                <Textarea
                  value={sectionDrafts[section.id] || ""}
                  onChange={(event) =>
                    setSectionDrafts((prev) => ({
                      ...prev,
                      [section.id]: event.target.value,
                    }))
                  }
                  rows={6}
                />
              ) : (
                <p className="min-h-14 whitespace-pre-wrap rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  {sectionDrafts[section.id] || "—"}
                </p>
              )}
            </div>
          ))}
        </CardContent>
        {isEditingSections ? (
          <CardFooter>
            <AsyncButton
              type="button"
              onClick={onSaveSections}
              pendingText="Saving sections..."
              disabled={isSavingSections}
            >
              <SaveIcon className="h-4 w-4" />
              Save sections
            </AsyncButton>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSectionDrafts(
                  normalizeSectionValues(
                    (data as { sections?: Record<string, unknown> | null })
                      .sections,
                    statementConfig.sections.map((section) => section.id),
                  ),
                );
                setIsEditingSections(false);
              }}
            >
              Cancel
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      {data.statement.signed_document?.name ||
      data.statement.supporting_documents?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.statement.signed_document?.name ? (
              <DocumentRow
                document={data.statement.signed_document}
                bucketId={data.tenant_id}
              />
            ) : null}

            {data.statement.supporting_documents?.length ? (
              <div className="space-y-2">
                {data.statement.supporting_documents.map((document, index) => (
                  <DocumentRow
                    key={`${document.path}-${index}`}
                    document={document}
                    bucketId={data.tenant_id}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <StatementNotesCard
        statementId={data.statement.id}
        tenantId={data.tenant_id}
        canPinNotes={canPinNotes}
      />

      <StatementFollowUpCard
        statementId={data.statement.id}
        canRequestFollowUp={["tenant_admin", "solicitor"].includes(role)}
      />

      <StatementInternalDocumentsCard
        tenantId={data.tenant_id}
        caseId={data.case.id}
        statementId={data.statement.id}
      />

      <StatementReminderSettingsCard
        tenantId={data.tenant_id}
        statementId={data.statement.id}
        statementStatus={data.statement.status}
      />

      {latestMeta?.deviation &&
      (latestMeta.deviation.flaggedDeviation ||
        latestMeta.deviation.stopIntake) ? (
        <Card variant="destructive">
          <CardHeader className="flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <CardTitle className="text-sm">
              Intake{" "}
              {latestMeta.deviation.stopIntake
                ? "Stopped"
                : "Deviation Flagged"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {latestMeta.deviation.deviationReason || "Unspecified reason"}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {latestMeta?.ignoredMissingDetails?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Info className="h-4 w-4" />
              Missing details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {latestMeta.ignoredMissingDetails.map((detail, index) => (
                <li key={`${detail}-${index}`} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
