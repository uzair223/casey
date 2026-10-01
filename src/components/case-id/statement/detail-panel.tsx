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
  Info,
  PenIcon,
  RotateCwIcon,
  SaveIcon,
  SendHorizonalIcon,
  Trash2Icon,
} from "@/components/icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { StatementStatusBadge } from "@/components/ui/statement-status-badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RhfField } from "@/components/ui/rhf-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/contexts/user-context";
import { useAsync } from "@/hooks/useAsync";

import { apiFetch } from "@/lib/api-utils";
import { sendWitnessLink } from "@/lib/billing/client";
import { cn } from "@/lib/utils";
import {
  getFullStatementFromId,
  downloadUploadedDocument,
} from "@/lib/supabase/queries";
import {
  deleteStatement,
  regenerateMagicLink,
  updateStatement,
} from "@/lib/supabase/mutations";
import {
  buildUpdateWitnessDetailsSchema,
  type UpdateWitnessDetailsFormData,
} from "@/lib/schema/witness-statement";
import { type UpdateStatementSchemaType } from "@/lib/schema/statement";
import {
  EMPTY_STATEMENT_CONFIG,
  getMessageResponseMeta,
} from "@/lib/statement-utils";
import type { FullStatementDataResponse } from "@/types";
import { WitnessChat } from "@/components/witness-chat/witness-chat";
import { StatementSupportingDocumentsCard } from "./documents-card";
import { SignatureCertificateCard } from "./signature-certificate-card";
import { StatementReminderSettingsCard } from "./settings-card";
import { TranscriptDialog } from "./transcript-dialog";
import {
  showIntakeWorkspace,
  statementStatusLabel,
} from "@/lib/status-styles";
import { toast } from "@/lib/toast";
import { DocxEditor, DocxEditorPanel } from "@/components/ui/docx-editor";
import { generateDoc } from "@/lib/doc-gen";
import { leadContactHidden } from "@/lib/leads/privacy";
import {
  documentDraftingEnabled,
  retainSignedStatement,
} from "@/lib/statements/document-flow";

type StatementDetailPanelProps = {
  statementId: string;
  statements: Array<{
    id: string;
    witness_name: string;
    title?: string | null;
  }>;
  refreshCase: () => Promise<unknown>;
};

const DEMO_ONLY_STATUSES = new Set<UpdateWitnessDetailsFormData["status"]>([
  "demo",
  "demo_published",
]);
const MAGIC_LINK_REGENERATION_BLOCKED_STATUSES = new Set<
  UpdateWitnessDetailsFormData["status"]
>(["demo_published", "completed"]);
const STATEMENT_CONTENT_LOCKED_STATUSES = new Set<
  UpdateWitnessDetailsFormData["status"]
>(["finalized", "completed"]);
const RETURN_TO_REVIEW_STATUSES = new Set<
  UpdateWitnessDetailsFormData["status"]
>(["draft", "in_progress", "submitted"]);

function isDemoOnlyStatus(status: UpdateWitnessDetailsFormData["status"]) {
  return DEMO_ONLY_STATUSES.has(status);
}

function isStatementContentLocked(
  status: UpdateWitnessDetailsFormData["status"],
) {
  return STATEMENT_CONTENT_LOCKED_STATUSES.has(status);
}

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

function formatLinkExpiryCountdown(
  expiresAt: string | null | undefined,
  now = Date.now(),
) {
  if (!expiresAt) {
    return "No active link";
  }

  const remainingMs = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

function useLinkExpiryCountdown(expiresAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return formatLinkExpiryCountdown(expiresAt, now);
}

function toFormValues(
  data: FullStatementDataResponse<false>,
  sections: Record<string, string>,
): UpdateWitnessDetailsFormData {
  const config = data.statement.statement_config;
  const metadataFields = config.witnessMetadataFields ?? [];
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

export function StatementDetailPanel({
  statementId,
  statements,
  refreshCase,
}: StatementDetailPanelProps) {
  const role = useUserRole();
  const canSetDemoStatuses = role === "app_admin";
  const canModify = ["tenant_admin", "solicitor"].includes(role);
  const canMessageWitness = ["tenant_admin", "solicitor", "paralegal"].includes(
    role,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const linkExpiryCountdown = useLinkExpiryCountdown(
    data?.statement.link?.expires_at,
  );

  useEffect(() => {
    configForFormResolverRef.current =
      data?.statement.statement_config ?? EMPTY_STATEMENT_CONFIG;
  }, [data?.statement.statement_config]);

  const [statementDocument, setStatementDocument] = useState<
    | {
        blob: Blob;
        templateBlob: null;
        type: "signed";
      }
    | {
        blob: Blob | null;
        templateBlob: Blob | null;
        type: "generated";
      }
    | null
  >(null);

  useEffect(() => {
    if (!data?.statement) return;
    if (statementDocument) return;
    const keepFile =
      documentDraftingEnabled() || retainSignedStatement(data.statement.status);
    if (!keepFile) return;

    void (async () => {
      if (data.statement.signed_document) {
        try {
          const signedBlob = await downloadUploadedDocument(
            data.statement.signed_document,
          );
          setStatementDocument({
            blob: signedBlob,
            templateBlob: null,
            type: "signed",
          });
          return;
        } catch (error) {
          console.error("Error downloading signed document:", error);
        }
      }

      if (!data.statement.template_document_snapshot) {
        setStatementDocument({
          blob: null,
          templateBlob: null,
          type: "generated",
        });
        return;
      }
      try {
        const templateBlob = await downloadUploadedDocument(
          data.statement.template_document_snapshot,
        );
        setStatementDocument({
          blob: null,
          templateBlob,
          type: "generated",
        });
      } catch (error) {
        console.error("Error generating statement document:", error);
        setStatementDocument({
          blob: null,
          templateBlob: null,
          type: "generated",
        });
      }
    })();
  }, [data?.statement, statementDocument]);

  useEffect(() => {
    if (statementDocument?.type !== "generated" || !data?.statement || !data.case) {
      return;
    }
    const statement = data.statement;
    const caseMetadata = data.case.case_metadata;
    void (async () => {
      try {
        const generatedBlob = await generateDoc(
          {
            caseMetadata:
              caseMetadata &&
              typeof caseMetadata === "object" &&
              !Array.isArray(caseMetadata)
                ? (caseMetadata as Record<
                    string,
                    string | number | null | undefined
                  >)
                : {},
            witnessEmail: statement.witness_email,
            witnessName: statement.witness_name,
            witnessMetadata: statement.witness_metadata,
            sections: statement.sections,
            config: statement.statement_config,
          },
          statementDocument.templateBlob,
        );
        setStatementDocument((current) =>
          current?.type === "generated"
            ? { ...current, blob: generatedBlob }
            : current,
        );
      } catch (error) {
        console.error("Error generating statement document:", error);
      }
    })();
  }, [
    data?.case,
    data?.statement,
    statementDocument?.type,
    statementDocument?.templateBlob,
  ]);

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
  const latestMeta = getMessageResponseMeta(
    data.latest ?? null,
    statementConfig,
  );
  const hideContact = leadContactHidden(data.statement.lead_stage);
  const intakeStarted = showIntakeWorkspace(
    data.statement.status,
    Boolean(data.latest),
  );
  const witnessMetadataFields = statementConfig.witnessMetadataFields ?? [];
  const witnessMetadataValues = data.statement.witness_metadata;
  const progress = latestMeta?.progress;
  const isContentLocked = isStatementContentLocked(data.statement.status);

  const isLinkExpired = data.statement.link?.expires_at
    ? new Date(data.statement.link.expires_at) < new Date()
    : false;
  const isMagicLinkRegenerationBlocked =
    MAGIC_LINK_REGENERATION_BLOCKED_STATUSES.has(data.statement.status);
  const canUseCurrentLink = Boolean(data.statement.link) && !isLinkExpired;
  const magicLinkStatusDescription = data.statement.link
    ? `Expires ${new Date(data.statement.link.expires_at).toLocaleString()} (${linkExpiryCountdown})`
    : "No active intake link.";

  const persistStatement = async (payload: UpdateStatementSchemaType) => {
    if (!data) return;

    await updateStatement(data.statement.id, payload);
    await Promise.all([refreshCase(), fetchStatement()]);
  };

  const onSave = async (formData: UpdateWitnessDetailsFormData) => {
    setIsSaving(true);
    try {
      const currentStatus = data.statement
        .status as UpdateWitnessDetailsFormData["status"];
      if (
        !canSetDemoStatuses &&
        isDemoOnlyStatus(formData.status) &&
        formData.status !== currentStatus
      ) {
        formMethods.setError("status", {
          type: "validate",
          message: "Only app admins can set Demo statuses.",
        });
        return;
      }

      const metadataPatch = Object.fromEntries(
        witnessMetadataFields.map((field) => {
          const raw = formData.witness_metadata?.[field.id];
          const value = typeof raw === "string" ? raw.trim() : "";
          return [field.id, value === "" ? null : value];
        }),
      );

      const movesBackFromFinalReview =
        isStatementContentLocked(currentStatus) &&
        RETURN_TO_REVIEW_STATUSES.has(formData.status) &&
        formData.status !== currentStatus;

      if (movesBackFromFinalReview) {
        const notifyWitness = await toast.confirm(
          "Return statement to review?",
          {
            variant: "warning",
            description: "The signed submission will be deleted",
            confirmLabel: "Yes, return to review",
            cancelLabel: "Cancel",
          },
        );
        if (!notifyWitness) {
          return;
        }

        const notify = await toast.prompt("Notify them?", {
          action: { label: "Notify" },
          cancel: { label: "Don't notify" },
          placeholder: "Optional message...",
          required: true,
        });

        await apiFetch(
          `/api/tenant/statement/${data.statement.id}/return-to-review`,
          {
            method: "POST",
            body: JSON.stringify({
              status: formData.status,
              notifyWitness: notify.message?.length,
              message: notify.message,
            }),
          },
        );

        await updateStatement(data.statement.id, {
          ...(leadContactHidden(data.statement.lead_stage)
            ? {}
            : {
                witness_name: formData.witness_name,
                witness_email: formData.witness_email,
              }),
          witness_metadata: metadataPatch,
        });
        await Promise.all([refreshCase(), fetchStatement()]);
      } else {
        await persistStatement({
          status: formData.status,
          ...(leadContactHidden(data.statement.lead_stage)
            ? {}
            : {
                witness_name: formData.witness_name,
                witness_email: formData.witness_email,
              }),
          witness_metadata: metadataPatch,
        });
      }
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!data) return;

    const confirmed = await toast.confirm("Delete this person?", {
      description: "This action cannot be undone.",
      confirmLabel: "Delete person",
    });
    if (!confirmed) {
      return;
    }

    await deleteStatement(data.statement.id);
    reset();
    await refreshCase();
    toast.success("Statement deleted");
  };

  const onSendStatementLink = async () => {
    if (!data) return;

    const message =
      (
        await toast.prompt("Send intake link", {
          action: { label: "Send link" },
          cancel: { label: "Send without message" },
          placeholder: "Optional message...",
          required: true,
        })
      ).message ?? "";

    await sendWitnessLink({
      statementId: data.statement.id,
      message: message.trim(),
      canAcceptDpa: role === "tenant_admin",
    });
    toast.success("Account link sent");
  };

  const onRegenerateLink = async () => {
    if (!data) return;
    if (MAGIC_LINK_REGENERATION_BLOCKED_STATUSES.has(data.statement.status)) {
      toast.warning("Magic link regeneration is unavailable", {
        description:
          "Demo-published and completed statements cannot receive regenerated intake links.",
      });
      return;
    }

    const link = await regenerateMagicLink(data.statement.id);
    setData((prev) => (prev ? { ...prev, link } : prev));

    const shouldEmail = await toast.confirm("Magic link regenerated", {
      variant: "success",
      description: "Do you want to email it to them?",
      confirmLabel: "Email them",
    });
    if (shouldEmail) {
      await onSendStatementLink();
    } else {
      toast.success("Magic link regenerated");
    }
  };

  const onDraftAccount = async () => {
    if (!data) return;

    await apiFetch(`/api/tenant/statement/${data.statement.id}/formalize`, {
      method: "POST",
    });
    toast.success("Draft started");
    await Promise.all([refreshCase(), fetchStatement()]);
  };

  const onSendFinalReviewRequest = async () => {
    if (!data) return;

    const message =
      (
        await toast.prompt("Finalize and request signature", {
          action: {
            label: "Send request",
          },
          cancel: {
            label: "Send without message",
          },
          placeholder: "Optional message...",
          required: true,
        })
      ).message ?? "";

    await apiFetch(
      `/api/tenant/statement/${data.statement.id}/send-final-review`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      },
    );

    toast.success("Final review request sent");
    await Promise.all([refreshCase(), fetchStatement()]);
  };

  return (
    <div className="min-w-0 space-y-4">
      <Tabs defaultValue="manage" className="space-y-4">
        {intakeStarted ? (
          <TabsList>
            <TabsTrigger value="manage">Details</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="collaboration">Follow-up</TabsTrigger>
          </TabsList>
        ) : null}

        <TabsContent value="manage" className="space-y-4">
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

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Statement information</CardTitle>
              <div className="flex flex-wrap gap-2">
                {documentDraftingEnabled() &&
                data.statement.status === "submitted" ? (
                  <AsyncButton
                    variant="outline"
                    size="sm"
                    onClick={onDraftAccount}
                    pendingText="Drafting..."
                  >
                    Draft account
                  </AsyncButton>
                ) : null}
                {documentDraftingEnabled() &&
                canModify &&
                data.statement.status === "submitted" ? (
                  <AsyncButton
                    variant="outline"
                    size="sm"
                    onClick={onSendFinalReviewRequest}
                    pendingText="Sending final review..."
                  >
                    <SendHorizonalIcon className="h-4 w-4" />
                    Finalize and request signature
                  </AsyncButton>
                ) : null}
                {canModify ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing((prev) => !prev)}
                  >
                    <PenIcon className="h-4 w-4" />
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                ) : null}
                {canModify ? (
                  <AsyncButton
                    variant="outline-destructive"
                    size="sm"
                    onClick={onDelete}
                    pendingText="Deleting..."
                  >
                    <Trash2Icon className="h-4 w-4" />
                    Delete
                  </AsyncButton>
                ) : null}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      Link
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="space-y-2">
                    <div className="flex flex-col gap-2">
                      <AsyncButton
                        variant="outline"
                        size="sm"
                        onClick={onSendStatementLink}
                        disabled={!canUseCurrentLink}
                        pendingText="Sending..."
                      >
                        <SendHorizonalIcon className="h-4 w-4" />
                        Send
                      </AsyncButton>
                      <AsyncButton
                        variant="outline"
                        size="sm"
                        onClick={onRegenerateLink}
                        disabled={isMagicLinkRegenerationBlocked}
                        pendingText="Regenerating..."
                      >
                        <RotateCwIcon className="h-4 w-4" />
                        Regenerate
                      </AsyncButton>
                      {data.statement.link ? (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/intake/${data.statement.link.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLinkIcon className="h-4 w-4" />
                            Open
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <Badge variant={isLinkExpired ? "warning" : "secondary"}>
                        {linkExpiryCountdown}
                      </Badge>
                      <p>{magicLinkStatusDescription}</p>
                      {isMagicLinkRegenerationBlocked ? (
                        <p>
                          Regeneration is disabled for{" "}
                          {statementStatusLabel[data.statement.status]}{" "}
                          statements.
                        </p>
                      ) : null}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            {isEditing ? (
              <FormProvider {...formMethods}>
                <form onSubmit={formMethods.handleSubmit(onSave)}>
                  <CardContent className="grid grid-cols-2 gap-3 [&_label]:text-muted-foreground">
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
                            aria-hidden
                            name={registration.name}
                            value={
                              typeof registration.value === "string" ||
                              typeof registration.value === "number"
                                ? registration.value
                                : ""
                            }
                            onBlur={registration.onBlur}
                            onChange={registration.onChange}
                            ref={registration.ref}
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
                            <SelectTrigger
                              id="statement-status"
                              aria-required={required}
                              aria-invalid={registration["aria-invalid"]}
                              aria-describedby={registration["aria-describedby"]}
                            >
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statementStatusLabel)
                                .filter(([key]) => {
                                  const status =
                                    key as UpdateWitnessDetailsFormData["status"];
                                  if (
                                    canSetDemoStatuses ||
                                    !isDemoOnlyStatus(status)
                                  ) {
                                    return true;
                                  }

                                  return status === data.statement.status;
                                })
                                .map(([key, label]) => {
                                  const status =
                                    key as UpdateWitnessDetailsFormData["status"];

                                  return (
                                    <SelectItem
                                      key={key}
                                      value={key}
                                      disabled={
                                        !canSetDemoStatuses &&
                                        isDemoOnlyStatus(status)
                                      }
                                    >
                                      {label}
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    />

                    {hideContact ? (
                      <>
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            Name
                          </p>
                          <p className="text-sm">
                            {data.statement.witness_name || "—"}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground md:col-span-2">
                          Email and phone stay hidden until this lead is accepted.
                        </p>
                      </>
                    ) : (
                      <>
                    <RhfField
                      form={formMethods}
                      name="witness_name"
                      controlId="statement-witness-name"
                      label="Name"
                      renderControl={(registration, required) => (
                        <Input
                          id="statement-witness-name"
                          autoComplete="off"
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
                          autoComplete="off"
                          required={required}
                          {...registration}
                        />
                      )}
                    />
                      </>
                    )}

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
                      Status
                    </p>
                    <StatementStatusBadge
                      status={data.statement.status}
                      witnessMetadata={data.statement.witness_metadata}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Name
                    </p>
                    <p className="text-sm">
                      {data.statement.witness_name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Email
                    </p>
                    {data.statement.witness_email?.includes("@") ? (
                      <Link
                        className="text-sm hover:underline"
                        href={`mailto:${data.statement.witness_email}`}
                      >
                        {data.statement.witness_email}
                      </Link>
                    ) : (
                      <p className="text-sm">
                        {data.statement.witness_email || "—"}
                      </p>
                    )}
                  </div>
                  {hideContact ? (
                    <p className="col-span-2 text-sm text-muted-foreground">
                      Email and phone stay hidden until this lead is accepted.
                    </p>
                  ) : null}

                  {witnessMetadataFields
                    .filter((field) => {
                      const value = witnessMetadataValues[field.id];
                      return typeof value === "string" && value.trim() !== "";
                    })
                    .map((field) => {
                      const value = witnessMetadataValues[field.id];
                      return (
                        <div key={field.id}>
                          <p className="text-sm font-medium text-muted-foreground">
                            {field.label}
                          </p>
                          <p className="text-sm">{value}</p>
                        </div>
                      );
                    })}
                </CardContent>
              </>
            )}
          </Card>
          {intakeStarted ? (
          <>
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Intake progress</CardTitle>
                <TranscriptDialog statementId={data.statement.id} />
              </div>
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
                    {statementConfig.phases.map((phase) => {
                      const completion =
                        progress.phaseCompleteness[phase.id] ?? 0;

                      return (
                        <div
                          key={phase.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <p className="text-xs">{phase.title || phase.id}</p>
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
                    })}
                  </div>
                </div>
              </CardContent>
            ) : null}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statement</CardTitle>
            </CardHeader>
            <CardContent>
              {data.statement.account_summary?.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {data.statement.account_summary.trim()}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  The summary of this account will appear here.
                </p>
              )}
            </CardContent>
          </Card>
          </>
          ) : null}
        </TabsContent>

        {intakeStarted ? (
        <>
        <TabsContent value="documents" className="space-y-4">
          {statementDocument ? (
            <Card className="w-full min-w-0">
              <CardHeader>
                <CardTitle className="text-base">
                  {statementDocument.type === "generated"
                    ? "Generated"
                    : "Signed"}{" "}
                  Statement
                </CardTitle>
              </CardHeader>
              <CardContent className="w-full min-w-0 overflow-hidden">
                <DocxEditor
                  source={statementDocument.blob}
                  documentName={data.statement.witness_name}
                >
                  <DocxEditorPanel
                    mode="bare"
                    className="h-[50vh] max-h-[50vh] w-full"
                    initialZoom={0.8}
                  />
                </DocxEditor>
              </CardContent>
            </Card>
          ) : null}

          <StatementSupportingDocumentsCard
            tenantId={data.tenant_id}
            caseId={data.case.id}
            statementId={data.statement.id}
            readOnly={isContentLocked}
          />
          <SignatureCertificateCard statementId={data.statement.id} />
        </TabsContent>

        <TabsContent value="collaboration" className="space-y-4">
          <WitnessChat
            mode="firm"
            statementId={data.statement.id}
            canSend={canMessageWitness}
          />

          <StatementReminderSettingsCard
            tenantId={data.tenant_id}
            statementId={data.statement.id}
            statementStatus={data.statement.status}
          />
        </TabsContent>
        </>
        ) : null}
      </Tabs>
    </div>
  );
}
