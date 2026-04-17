"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
} from "react-hook-form";

import Loading from "@/components/loading";
import { PageTitle } from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarkdownMessage } from "@/components/ui/message";
import { RhfField } from "@/components/ui/rhf-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUserProtected } from "@/contexts/user-context";
import { apiFetch } from "@/lib/api-utils";
import { CHAT_METADATA_MARKER } from "@/lib/statement-utils";
import {
  statementStatusLabel,
  statementStatusVariant,
} from "@/lib/status-styles";

type TemplateOption = {
  id: string;
  name: string;
  tenant_id: string | null;
};

type CaseTemplateField = {
  id: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "date";
  placeholder?: string;
};

type WitnessTemplateField = {
  id: string;
  label: string;
  required: boolean;
  requiredOnCreate: boolean;
  description?: string;
};

type CaseTemplateOption = TemplateOption & {
  fields: CaseTemplateField[];
};

type StatementTemplateOption = TemplateOption & {
  witness_fields: WitnessTemplateField[];
};

type TenantOption = {
  id: string;
  name: string;
};

type DemoBootstrapOptions = {
  tenants: TenantOption[];
  caseTemplates: CaseTemplateOption[];
  statementTemplates: StatementTemplateOption[];
};

type DemoBootstrapResponse = {
  tenant: {
    id: string;
    name: string;
  };
  case: {
    id: string;
    title: string;
  };
  statement: {
    id: string;
    title?: string;
  };
  magicLink: {
    token: string;
    expiresAt: string;
    intakeUrl: string;
  };
};

type DemoStatementsResponse = {
  statements: DemoStatementRow[];
};

type DemoStatementRow = {
  id: string;
  title: string;
  status: string;
  witness_name: string;
  witness_email: string;
  created_at: string;
  tenant_name: string;
  case_title: string;
  intake_url: string;
  magic_link_token: string;
  magic_link_expires_at: string;
};

type DemoConversationMessage = {
  id: string;
  statement_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

type BootstrapFormValues = {
  demoTenantName: string;
  caseTemplateId: string;
  statementTemplateId: string;
  caseTitle: string;
  witnessName: string;
  witnessEmail: string;
  caseMetadata: Record<string, string>;
  witnessMetadata: Record<string, string>;
};

const DEFAULT_BOOTSTRAP_VALUES: BootstrapFormValues = {
  demoTenantName: "",
  caseTemplateId: "",
  statementTemplateId: "",
  caseTitle: "",
  witnessName: "",
  witnessEmail: "",
  caseMetadata: {},
  witnessMetadata: {},
};

function parseResponseError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }
  return fallback;
}

export default function DemoStudioPage() {
  const { isLoading: isUserLoading } = useUserProtected("app_admin");

  const bootstrapForm = useForm<BootstrapFormValues>({
    defaultValues: DEFAULT_BOOTSTRAP_VALUES,
  });

  const demoTenantNameInput =
    useWatch({ control: bootstrapForm.control, name: "demoTenantName" }) ?? "";
  const caseTemplateId =
    useWatch({ control: bootstrapForm.control, name: "caseTemplateId" }) ?? "";
  const statementTemplateId =
    useWatch({ control: bootstrapForm.control, name: "statementTemplateId" }) ??
    "";

  const [options, setOptions] = useState<DemoBootstrapOptions | null>(null);
  const [statements, setStatements] = useState<DemoStatementRow[]>([]);
  const [messages, setMessages] = useState<DemoConversationMessage[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(
    null,
  );
  const [selectedMagicLinkToken, setSelectedMagicLinkToken] = useState("");
  const [selectedIntakeUrl, setSelectedIntakeUrl] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingStatements, setIsLoadingStatements] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isDeletingStatementId, setIsDeletingStatementId] = useState<
    string | null
  >(null);
  const [chatInput, setChatInput] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resolveTenantIdByName = useCallback(
    (name: string) => {
      if (!options) return "";
      const normalized = name.trim().toLowerCase();
      if (!normalized) return "";

      return (
        options.tenants.find(
          (tenant) => tenant.name.trim().toLowerCase() === normalized,
        )?.id ?? ""
      );
    },
    [options],
  );

  const tenantId = useMemo(
    () => resolveTenantIdByName(demoTenantNameInput),
    [demoTenantNameInput, resolveTenantIdByName],
  );

  const tenantCaseTemplates = useMemo(() => {
    if (!options) return [];

    if (tenantId) {
      return options.caseTemplates.filter(
        (template) => !template.tenant_id || template.tenant_id === tenantId,
      );
    }

    const globalTemplates = options.caseTemplates.filter(
      (template) => !template.tenant_id,
    );
    return globalTemplates.length > 0 ? globalTemplates : options.caseTemplates;
  }, [options, tenantId]);

  const tenantStatementTemplates = useMemo(() => {
    if (!options) return [];

    if (tenantId) {
      return options.statementTemplates.filter(
        (template) => !template.tenant_id || template.tenant_id === tenantId,
      );
    }

    const globalTemplates = options.statementTemplates.filter(
      (template) => !template.tenant_id,
    );
    return globalTemplates.length > 0
      ? globalTemplates
      : options.statementTemplates;
  }, [options, tenantId]);

  const activeStatement =
    statements.find((statement) => statement.id === selectedStatementId) ??
    null;

  const selectedCaseTemplate = useMemo(
    () =>
      tenantCaseTemplates.find((template) => template.id === caseTemplateId) ??
      null,
    [tenantCaseTemplates, caseTemplateId],
  );

  const selectedStatementTemplate = useMemo(
    () =>
      tenantStatementTemplates.find(
        (template) => template.id === statementTemplateId,
      ) ?? null,
    [tenantStatementTemplates, statementTemplateId],
  );

  const caseTemplateFields = useMemo(
    () => selectedCaseTemplate?.fields ?? [],
    [selectedCaseTemplate],
  );
  const witnessTemplateFields = useMemo(
    () => selectedStatementTemplate?.witness_fields ?? [],
    [selectedStatementTemplate],
  );

  const requiredCaseFields = caseTemplateFields.filter(
    (field) => field.required,
  );
  const requiredWitnessFields = witnessTemplateFields.filter(
    (field) => field.requiredOnCreate,
  );

  const normalizeRecord = (value: Record<string, string> | undefined) =>
    Object.fromEntries(
      Object.entries(value ?? {})
        .map(([key, entryValue]) => [key, String(entryValue ?? "").trim()])
        .filter(([, entryValue]) => entryValue.length > 0),
    ) as Record<string, string>;

  const loadStatements = async (nextSelectedId?: string | null) => {
    setIsLoadingStatements(true);
    try {
      const data = await apiFetch<DemoStatementsResponse>(
        "/api/admin/demo-studio/statements",
        { method: "GET" },
      );
      const nextStatements = data.statements ?? [];
      setStatements(nextStatements);

      const preferredId =
        nextSelectedId ?? selectedStatementId ?? nextStatements[0]?.id ?? null;
      const preferred =
        (preferredId
          ? nextStatements.find((statement) => statement.id === preferredId)
          : null) ?? nextStatements[0];

      if (preferred) {
        setSelectedStatementId(preferred.id);
        setSelectedMagicLinkToken(preferred.magic_link_token);
        setSelectedIntakeUrl(preferred.intake_url);
        await loadMessages(preferred.id);
      } else {
        setSelectedStatementId(null);
        setSelectedMagicLinkToken("");
        setSelectedIntakeUrl("");
        setMessages([]);
      }
    } finally {
      setIsLoadingStatements(false);
    }
  };

  const loadMessages = async (statementId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await apiFetch<{ messages: DemoConversationMessage[] }>(
        `/api/admin/demo-studio/messages?statementId=${encodeURIComponent(statementId)}`,
        { method: "GET" },
      );
      setMessages(data.messages ?? []);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setIsLoadingOptions(true);
        const data = await apiFetch<DemoBootstrapOptions>(
          "/api/admin/demo-studio/bootstrap",
          { method: "GET" },
        );

        setOptions(data);

        if (data.tenants.length > 0) {
          const demoTenant =
            data.tenants.find((tenant) =>
              tenant.name.toLowerCase().includes("demo"),
            ) ?? data.tenants[0];
          bootstrapForm.setValue("demoTenantName", demoTenant.name, {
            shouldDirty: false,
            shouldValidate: true,
          });
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load Demo Studio options",
        );
      } finally {
        setIsLoadingOptions(false);
      }
    })();
  }, [bootstrapForm]);

  useEffect(() => {
    void loadStatements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tenantCaseTemplates.length) {
      bootstrapForm.setValue("caseTemplateId", "", {
        shouldDirty: false,
        shouldValidate: true,
      });
      return;
    }

    if (
      !tenantCaseTemplates.some((template) => template.id === caseTemplateId)
    ) {
      bootstrapForm.setValue("caseTemplateId", tenantCaseTemplates[0].id, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [tenantCaseTemplates, caseTemplateId, bootstrapForm]);

  useEffect(() => {
    if (!tenantStatementTemplates.length) {
      bootstrapForm.setValue("statementTemplateId", "", {
        shouldDirty: false,
        shouldValidate: true,
      });
      return;
    }

    if (
      !tenantStatementTemplates.some(
        (template) => template.id === statementTemplateId,
      )
    ) {
      bootstrapForm.setValue(
        "statementTemplateId",
        tenantStatementTemplates[0].id,
        {
          shouldDirty: false,
          shouldValidate: true,
        },
      );
    }
  }, [tenantStatementTemplates, statementTemplateId, bootstrapForm]);

  useEffect(() => {
    const current = bootstrapForm.getValues("caseMetadata") ?? {};
    const next = { ...current };
    let changed = false;

    for (const field of caseTemplateFields) {
      if (!(field.id in next)) {
        next[field.id] = "";
        changed = true;
      }
    }

    if (changed) {
      bootstrapForm.setValue("caseMetadata", next, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [caseTemplateFields, bootstrapForm]);

  useEffect(() => {
    const current = bootstrapForm.getValues("witnessMetadata") ?? {};
    const next = { ...current };
    let changed = false;

    for (const field of witnessTemplateFields) {
      if (!(field.id in next)) {
        next[field.id] = "";
        changed = true;
      }
    }

    if (changed) {
      bootstrapForm.setValue("witnessMetadata", next, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [witnessTemplateFields, bootstrapForm]);

  const handleBootstrap: SubmitHandler<BootstrapFormValues> = async (
    values,
  ) => {
    const tenantName = values.demoTenantName.trim();
    if (!tenantName) {
      setError("Demo tenant name is required.");
      return;
    }

    if (!values.caseTemplateId || !values.statementTemplateId) {
      setError("Case template and statement template are required.");
      return;
    }

    const missingCaseRequired = requiredCaseFields.filter(
      (field) => !values.caseMetadata?.[field.id]?.trim(),
    );
    if (missingCaseRequired.length > 0) {
      setError(
        `Please complete required case fields: ${missingCaseRequired
          .map((field) => field.label)
          .join(", ")}`,
      );
      return;
    }

    const missingWitnessRequired = requiredWitnessFields.filter(
      (field) => !values.witnessMetadata?.[field.id]?.trim(),
    );
    if (missingWitnessRequired.length > 0) {
      setError(
        `Please complete required witness fields: ${missingWitnessRequired
          .map((field) => field.label)
          .join(", ")}`,
      );
      return;
    }

    setError(null);
    setIsBootstrapping(true);

    try {
      const created = await apiFetch<DemoBootstrapResponse>(
        "/api/admin/demo-studio/bootstrap",
        {
          method: "POST",
          body: JSON.stringify({
            tenantId: tenantId || undefined,
            tenantName,
            caseTemplateId: values.caseTemplateId,
            statementTemplateId: values.statementTemplateId,
            caseTitle: values.caseTitle.trim() || undefined,
            witnessName: values.witnessName.trim() || undefined,
            witnessEmail: values.witnessEmail.trim() || undefined,
            caseMetadata: normalizeRecord(values.caseMetadata),
            witnessMetadata: normalizeRecord(values.witnessMetadata),
          }),
        },
      );

      setSelectedStatementId(created.statement.id);
      setSelectedMagicLinkToken(created.magicLink.token);
      setSelectedIntakeUrl(created.magicLink.intakeUrl);
      setChatInput("");
      await loadStatements(created.statement.id);
    } catch (bootstrapError) {
      setError(
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Failed to create demo intake",
      );
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleSelectStatement = async (statement: DemoStatementRow) => {
    setSelectedStatementId(statement.id);
    setSelectedMagicLinkToken(statement.magic_link_token);
    setSelectedIntakeUrl(statement.intake_url);
    await loadMessages(statement.id);
  };

  const handleDeleteStatement = async (statementId: string) => {
    setError(null);
    setIsDeletingStatementId(statementId);

    try {
      await apiFetch<{ success: boolean }>(
        `/api/admin/demo-studio/statements/${statementId}`,
        { method: "DELETE" },
      );

      if (selectedStatementId === statementId) {
        setSelectedStatementId(null);
        setSelectedMagicLinkToken("");
        setSelectedIntakeUrl("");
        setMessages([]);
      }

      await loadStatements(
        selectedStatementId === statementId ? null : selectedStatementId,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete statement",
      );
    } finally {
      setIsDeletingStatementId(null);
    }
  };

  const handleSendChat = async () => {
    if (!selectedMagicLinkToken) return;
    const userMessage = chatInput.trim();
    if (!userMessage) return;

    setError(null);
    setIsSendingChat(true);
    setStreamingAssistant("");

    try {
      const conversationHistory = messages
        .filter(
          (message) => message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
          meta: message.meta ?? undefined,
        }));

      const response = await fetch(
        `/api/intake/${selectedMagicLinkToken}/interview/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationHistory, userMessage }),
        },
      );

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ error: "Failed to send chat message" }));
        throw new Error(
          parseResponseError(payload, "Failed to send chat message"),
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let raw = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          raw += decoder.decode(value, { stream: true });
          const metadataMarkerIndex = raw.indexOf(CHAT_METADATA_MARKER);
          setStreamingAssistant(
            metadataMarkerIndex >= 0 ? raw.slice(0, metadataMarkerIndex) : raw,
          );
        }

        if (done) {
          break;
        }
      }

      const flushChunk = decoder.decode();
      if (flushChunk) {
        raw += flushChunk;
      }
      const metadataMarkerIndex = raw.indexOf(CHAT_METADATA_MARKER);
      if (metadataMarkerIndex >= 0) {
        setStreamingAssistant(raw.slice(0, metadataMarkerIndex).trimEnd());
      }

      setChatInput("");
      setStreamingAssistant("");
      await loadMessages(selectedStatementId ?? statements[0]?.id ?? "");
    } catch (chatError) {
      setError(
        chatError instanceof Error ? chatError.message : "Failed to send chat",
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  if (isUserLoading || isLoadingOptions) {
    return <Loading />;
  }

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle="App Admin"
        title="Demo Conversation Studio"
        description="Create demo intake sessions, review them in a table, and inspect the live chat transcript."
        actions={[
          {
            label: "Back to Admin Dashboard",
            href: "/dashboard/app-admin",
            variant: "outline",
          },
        ]}
      />

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Create Demo Intake Session</CardTitle>
        </CardHeader>
        <FormProvider {...bootstrapForm}>
          <form
            noValidate
            onSubmit={bootstrapForm.handleSubmit(handleBootstrap, () => {
              setError("Please fix the highlighted form fields.");
            })}
          >
            <CardContent className="grid gap-3 md:grid-cols-2">
              <RhfField
                form={bootstrapForm}
                name="demoTenantName"
                controlId="demo-tenant-name"
                label="Demo Tenant"
                registerOptions={{ required: "Demo tenant is required" }}
                renderControl={(registration, required) => (
                  <Input
                    id="demo-tenant-name"
                    required={required}
                    placeholder="Type demo tenant name"
                    {...registration}
                  />
                )}
              />

              <RhfField
                form={bootstrapForm}
                name="caseTemplateId"
                controlId="demo-case-template"
                label="Case Template"
                registerOptions={{ required: "Case template is required" }}
                renderControl={() => (
                  <Select
                    value={caseTemplateId}
                    onValueChange={(value) =>
                      bootstrapForm.setValue("caseTemplateId", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id="demo-case-template">
                      <SelectValue placeholder="Choose case template" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantCaseTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              <RhfField
                form={bootstrapForm}
                name="statementTemplateId"
                controlId="demo-statement-template"
                label="Statement Template"
                registerOptions={{ required: "Statement template is required" }}
                renderControl={() => (
                  <Select
                    value={statementTemplateId}
                    onValueChange={(value) =>
                      bootstrapForm.setValue("statementTemplateId", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id="demo-statement-template">
                      <SelectValue placeholder="Choose statement template" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantStatementTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              <RhfField
                form={bootstrapForm}
                name="caseTitle"
                controlId="demo-case-title"
                label="Case Title"
                renderControl={(registration) => (
                  <Input
                    id="demo-case-title"
                    placeholder="Demo Intake 2026-04-13"
                    {...registration}
                  />
                )}
              />

              <RhfField
                form={bootstrapForm}
                name="witnessName"
                controlId="demo-witness-name"
                label="Witness Name"
                renderControl={(registration) => (
                  <Input
                    id="demo-witness-name"
                    placeholder="Jane Doe"
                    {...registration}
                  />
                )}
              />

              <RhfField
                form={bootstrapForm}
                name="witnessEmail"
                controlId="demo-witness-email"
                label="Witness Email"
                renderControl={(registration) => (
                  <Input
                    id="demo-witness-email"
                    placeholder="witness@example.com"
                    {...registration}
                  />
                )}
              />

              {caseTemplateFields.length > 0 && (
                <div className="md:col-span-2 pt-2">
                  <p className="text-sm font-medium">Case Metadata Fields</p>
                </div>
              )}

              {caseTemplateFields.map((field) => (
                <RhfField
                  key={`case-metadata-${field.id}`}
                  form={bootstrapForm}
                  name={`caseMetadata.${field.id}` as const}
                  controlId={`case-metadata-${field.id}`}
                  label={field.label}
                  registerOptions={
                    field.required
                      ? { required: `${field.label} is required` }
                      : undefined
                  }
                  renderControl={(registration, required) => (
                    <Input
                      id={`case-metadata-${field.id}`}
                      type={
                        field.type === "number"
                          ? "number"
                          : field.type === "date"
                            ? "date"
                            : "text"
                      }
                      placeholder={field.placeholder || field.label}
                      required={required}
                      {...registration}
                    />
                  )}
                />
              ))}

              {witnessTemplateFields.length > 0 && (
                <div className="md:col-span-2 pt-2">
                  <p className="text-sm font-medium">Witness Metadata Fields</p>
                </div>
              )}

              {witnessTemplateFields.map((field) => {
                return (
                  <RhfField
                    key={`witness-metadata-${field.id}`}
                    form={bootstrapForm}
                    name={`witnessMetadata.${field.id}` as const}
                    controlId={`witness-metadata-${field.id}`}
                    label={field.label}
                    registerOptions={
                      field.requiredOnCreate
                        ? { required: `${field.label} is required` }
                        : undefined
                    }
                    renderControl={(registration, required) => (
                      <Input
                        id={`witness-metadata-${field.id}`}
                        placeholder={field.description || field.label}
                        required={required}
                        {...registration}
                      />
                    )}
                  />
                );
              })}

              <div className="md:col-span-2 flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={
                    !caseTemplateId || !statementTemplateId || isBootstrapping
                  }
                >
                  {isBootstrapping ? "Creating..." : "Create Demo Session"}
                </Button>
                {selectedIntakeUrl && (
                  <a
                    href={selectedIntakeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Open selected intake link
                  </a>
                )}
              </div>
            </CardContent>
          </form>
        </FormProvider>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>2. Existing Demo Statements</CardTitle>
          {isLoadingStatements && (
            <span className="text-sm text-muted-foreground">Refreshing...</span>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Witness</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {statements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No demo statements yet.
                    </td>
                  </tr>
                ) : (
                  statements.map((statement) => {
                    const isSelected = statement.id === selectedStatementId;
                    return (
                      <tr
                        key={statement.id}
                        className={isSelected ? "bg-primary/5" : undefined}
                      >
                        <td className="px-3 py-2 align-top">
                          <Badge
                            variant={
                              statementStatusVariant[
                                statement.status as keyof typeof statementStatusVariant
                              ] ?? "secondary"
                            }
                          >
                            {statementStatusLabel[
                              statement.status as keyof typeof statementStatusLabel
                            ] ?? statement.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">
                            {statement.case_title || statement.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {statement.tenant_name}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div>{statement.witness_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {statement.witness_email}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-muted-foreground">
                          {new Date(statement.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleSelectStatement(statement)
                              }
                            >
                              View
                            </Button>
                            {statement.intake_url && (
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={statement.intake_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open link
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                void handleDeleteStatement(statement.id)
                              }
                              disabled={isDeletingStatementId === statement.id}
                            >
                              {isDeletingStatementId === statement.id
                                ? "Deleting..."
                                : "Delete"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Live Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeStatement ? (
            <div className="space-y-1 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{activeStatement.status}</Badge>
                <span>
                  {activeStatement.case_title || activeStatement.title}
                </span>
                <span>•</span>
                <span>{activeStatement.witness_name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedIntakeUrl ? (
                  <a
                    className="underline-offset-4 hover:underline"
                    href={selectedIntakeUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selectedIntakeUrl}
                  </a>
                ) : (
                  selectedMagicLinkToken || "No intake link available"
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a demo statement to view its transcript.
            </p>
          )}

          <div className="max-h-112 space-y-3 overflow-auto rounded-md border p-3">
            {isLoadingMessages && (
              <p className="text-sm text-muted-foreground">
                Loading messages...
              </p>
            )}
            {!isLoadingMessages && messages.length === 0 && (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
            {messages.map((message) => (
              <div key={message.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{message.role}</Badge>
                  <span>{new Date(message.created_at).toLocaleString()}</span>
                </div>
                {message.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none">
                    <MarkdownMessage content={message.content} />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </p>
                )}
                {message.meta && (
                  <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(message.meta, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {isSendingChat && streamingAssistant && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">assistant (streaming)</Badge>
                </div>
                <div className="prose prose-sm max-w-none">
                  <MarkdownMessage content={streamingAssistant} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Send a witness message through the intake chat endpoint..."
              disabled={!selectedMagicLinkToken}
            />
            <Button
              onClick={() => void handleSendChat()}
              disabled={
                isSendingChat || !chatInput.trim() || !selectedMagicLinkToken
              }
            >
              {isSendingChat ? "Sending..." : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
