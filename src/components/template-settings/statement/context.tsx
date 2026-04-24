"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { saveAs } from "file-saver";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { useUserProtected } from "@/contexts/user-context";
import { useAsync } from "@/hooks/useAsync";
import {
  getDocxTemplateFieldWarnings,
  generateStarterDoc,
  validateDocxTemplateDocument,
} from "@/lib/doc-gen";
import { getDefaultPromptTemplates } from "@/lib/statement-utils/prompts";
import {
  StatementConfigPublishSchema,
  StatementConfigSchema,
} from "@/lib/schema";
import {
  downloadUploadedDocument,
  listStatementTemplates,
} from "@/lib/supabase/queries";
import {
  createStatementTemplate,
  deleteStatementTemplate,
  publishStatementTemplate,
  restoreStatementTemplateDraftFromPublished,
  updateStatementTemplate,
  uploadFile,
} from "@/lib/supabase/mutations";
import { slugify, uniqueSlug } from "@/lib/utils";
import {
  deletePathFromObject,
  getValueAtPath,
  materializePendingPatch,
  mergeDeep,
  resolvePatchDiffs,
  resolvePatchPaths,
  setValueAtPath,
} from "@/lib/diff-utils";
import type {
  StatementConfig,
  StatementConfigTemplate,
  TemplateStatus,
  UploadedDocument,
} from "@/types";

const GLOBAL_TEMPLATE_BUCKET_ID = "global-templates";

type DocxErrors = Awaited<ReturnType<typeof getDocxTemplateFieldWarnings>> & {
  errors: string[];
};

type StatementEditorTab = "simple" | "json" | "docx";

type StatementTemplateSettingsContextValue = {
  userTenantName: string | null;
  templates: StatementConfigTemplate[];
  activeTemplateId: string | null;
  activeTemplate: StatementConfigTemplate | null;
  isLoading: boolean;
  setIsGenerating: (value: boolean) => void;
  isGenerating: boolean;
  message: string | null;
  editorTab: StatementEditorTab;
  setEditorTab: (tab: StatementEditorTab) => void;
  canForkGlobalTemplate: boolean;
  canEditActiveTemplate: boolean;
  isBusy: boolean;
  hasPublishedVersion: boolean;
  draftName: string;
  setDraftName: (value: string) => void;
  draftNameValidationError: string | null;
  currentStatus: TemplateStatus;
  setCurrentStatus: (value: TemplateStatus) => void;
  draftConfig: StatementConfig;
  setDraftConfig: (
    value: StatementConfig | ((prev: StatementConfig) => StatementConfig),
  ) => void;
  advancedJson: string;
  pendingTemplateDocx: File | null;
  isUploadingTemplateDocx: boolean;
  previewDocxSource: Blob | null;
  previewDocxLabel: string | null;
  docxErrors: DocxErrors;
  mainTemplateValidationErrors: string[];
  isMainTemplateValid: boolean;
  canPublishTemplate: boolean;
  selectTemplate: (template: StatementConfigTemplate) => Promise<void>;
  createNewTemplate: () => Promise<void>;
  saveTemplate: () => Promise<void>;
  saveTemplateWithDocx: (file: File) => Promise<void>;
  saveTemplateWithStatus: (status: TemplateStatus) => Promise<void>;
  deleteTemplate: () => Promise<void>;
  duplicateTemplate: () => Promise<void>;
  forkTemplate: () => Promise<void>;
  restorePreviousVersion: () => Promise<void>;
  resetConfig: () => void;
  applyAdvancedJson: (value: string) => Promise<void>;
  patchConfig: (patch: Partial<StatementConfig>) => void;
  pendingAiPatch: Partial<StatementConfig> | null;
  pendingAiPatchPaths: string[];
  pendingAiPatchDiffs: Array<{
    path: string;
    current: unknown;
    proposed: unknown;
    status: "added" | "removed" | "modified";
  }>;
  stageAiPatch: (patch: Partial<StatementConfig>) => void;
  applyPendingAiPatch: () => void;
  discardPendingAiPatch: () => void;
  applyPendingAiPatchPath: (
    path: string,
    status?: "added" | "removed" | "modified",
  ) => void;
  discardPendingAiPatchPath: (path: string) => void;
  downloadStarterDocx: () => Promise<void>;
  downloadUploadedDocx: () => Promise<void>;
  deleteUploadedDocx: () => Promise<void>;
  stageTemplateDocx: (file: File | null) => Promise<void>;
};

const StatementTemplateSettingsContext =
  createContext<StatementTemplateSettingsContextValue | null>(null);

function createEmptyConfig(): StatementConfig {
  return StatementConfigSchema.parse({
    agents: {
      chat: "You are an intake assistant helping collect facts, dates, names, and events from an interview.",
      formalize:
        "You are a drafting assistant turning interview transcript into structured witness statement sections.",
    },
    phases: [],
    sections: [],
    witness_metadata_fields: [
      {
        id: "address",
        label: "Address",
        description: "The witness's residential address",
        requiredOnIntake: true,
        requiredOnCreate: false,
      },
    ],
    case_metadata_deps: ["court", "claimNumber", "claimant", "defendant"],
    prompts: {
      chat_system_template: null,
      formalize_system_template: null,
    },
  });
}

function createNullPromptTemplates(): NonNullable<StatementConfig["prompts"]> {
  return {
    chat_system_template: null,
    formalize_system_template: null,
  };
}

function normalizePromptsForStorage(config: StatementConfig): StatementConfig {
  const defaults = getDefaultPromptTemplates();
  const prompts = config.prompts ?? createNullPromptTemplates();

  return {
    ...config,
    prompts: {
      chat_system_template:
        prompts.chat_system_template === defaults.chat_system_template
          ? null
          : prompts.chat_system_template,
      formalize_system_template:
        prompts.formalize_system_template === defaults.formalize_system_template
          ? null
          : prompts.formalize_system_template,
    },
  };
}

function withGeneratedPhaseIds(config: StatementConfig) {
  const used = new Set<string>();
  return {
    ...config,
    phases: (config.phases ?? []).map((phase) => {
      const existingId = phase.id?.trim();
      const baseId = existingId || slugify(phase.title || "", "phase");
      return {
        ...phase,
        id: uniqueSlug(baseId, used),
      };
    }),
  };
}

function withGeneratedSectionFields(config: StatementConfig) {
  const used = new Set<string>();
  return {
    ...config,
    sections: (config.sections ?? []).map((section) => {
      const existingId = section.id?.trim();
      const baseId = existingId || slugify(section.title || "", "section");
      return {
        id: uniqueSlug(baseId, used),
        title: section.title,
        description: section.description,
      };
    }),
  };
}

function withGeneratedConfigIds(config: StatementConfig) {
  return withGeneratedSectionFields(withGeneratedPhaseIds(config));
}

function normalizeConfig(input: unknown): StatementConfig {
  const parsed = StatementConfigSchema.safeParse(input);
  if (!parsed.success) {
    return createEmptyConfig();
  }

  const withPromptObject = parsed.data.prompts
    ? parsed.data
    : {
        ...parsed.data,
        prompts: createNullPromptTemplates(),
      };

  return normalizePromptsForStorage(withPromptObject);
}

function validateMainTemplateConfig(config: StatementConfig): string[] {
  const result = StatementConfigPublishSchema.safeParse(config);

  if (result.success) {
    return [];
  }

  return Array.from(
    new Set(
      result.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    ),
  );
}

export function StatementTemplateSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const selectedTemplateId = searchParams.get("templateId");
  const { user } = useUserProtected(["app_admin", "tenant_admin", "solicitor"]);

  const [isGenerating, setIsGenerating] = useState(false);

  const [templates, setTemplates] = useState<StatementConfigTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<StatementEditorTab>("simple");

  const [draftName, setDraftName] = useState("");
  const [currentStatus, setCurrentStatus] = useState<TemplateStatus>("draft");
  const [advancedJson, setAdvancedJson] = useState(
    JSON.stringify(createEmptyConfig(), null, 2),
  );
  const [pendingAiPatch, setPendingAiPatch] =
    useState<Partial<StatementConfig> | null>(null);

  const formMethods = useForm<StatementConfig>({
    defaultValues: createEmptyConfig(),
    resolver: zodResolver(
      StatementConfigPublishSchema,
    ) as Resolver<StatementConfig>,
    mode: "onChange",
  });

  const draftConfig = (useWatch({ control: formMethods.control }) ??
    createEmptyConfig()) as StatementConfig;

  const [pendingTemplateDocx, setPendingTemplateDocx] = useState<File | null>(
    null,
  );
  const [isUploadingTemplateDocx, setIsUploadingTemplateDocx] = useState(false);
  const [previewDocxSource, setPreviewDocxSource] = useState<Blob | null>(null);
  const [previewDocxLabel, setPreviewDocxLabel] = useState<string | null>(null);
  const [docxErrors, setDocxErrors] = useState<DocxErrors>({
    errors: [],
    unknown: [],
    unused: [],
  });

  const activeTemplate = useMemo(
    () =>
      templates.find((template) => template.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  const isAppAdmin = user?.role === "app_admin";
  const canForkGlobalTemplate =
    !!activeTemplate &&
    !isAppAdmin &&
    activeTemplate.template_scope === "global";
  const canEditActiveTemplate =
    !activeTemplate || isAppAdmin || activeTemplate.template_scope === "tenant";

  const isBusy = !canEditActiveTemplate || isGenerating;

  const hasPublishedVersion = !!activeTemplate?.published_config;

  const mainTemplateValidationErrors = useMemo(
    () => validateMainTemplateConfig(draftConfig),
    [draftConfig],
  );
  const draftNameValidationError = draftName.trim()
    ? null
    : "Template name is required.";
  const isMainTemplateValid = mainTemplateValidationErrors.length === 0;
  const canPublishTemplate =
    isMainTemplateValid &&
    docxErrors.errors.length === 0 &&
    !draftNameValidationError;
  const pendingAiPatchPaths = useMemo(
    () =>
      pendingAiPatch
        ? resolvePatchPaths(
            formMethods.getValues(),
            materializePendingPatch(formMethods.getValues(), pendingAiPatch),
          )
        : [],
    [formMethods, pendingAiPatch],
  );
  const pendingAiPatchDiffs = useMemo(
    () =>
      pendingAiPatch
        ? resolvePatchDiffs(
            formMethods.getValues(),
            materializePendingPatch(formMethods.getValues(), pendingAiPatch),
          )
        : [],
    [formMethods, pendingAiPatch],
  );

  const setDraftConfig = (
    value: StatementConfig | ((prev: StatementConfig) => StatementConfig),
  ) => {
    const next =
      typeof value === "function" ? value(formMethods.getValues()) : value;
    formMethods.reset(next);
  };

  useEffect(() => {
    setAdvancedJson(JSON.stringify(draftConfig, null, 2));
  }, [draftConfig]);

  const setPreviewState = (blob: Blob | null, label: string | null) => {
    setPreviewDocxSource(blob);
    setPreviewDocxLabel(label);
  };

  const setDocxErrorsFromDocument = async (
    templateDocument: Blob | ArrayBuffer | Uint8Array,
    config: StatementConfig,
  ) => {
    try {
      const errors = await validateDocxTemplateDocument({
        config,
        templateDocument,
      });
      const warnings =
        errors.length > 0
          ? {
              unknown: [],
              unused: [],
            }
          : await getDocxTemplateFieldWarnings({
              config,
              templateDocument,
            });
      setDocxErrors({ ...warnings, errors });
    } catch (error) {
      setDocxErrors({
        errors: [String(error)],
        unknown: [],
        unused: [],
      });
    }
  };

  const prepareStarterPreview = useCallback(async (
    config: StatementConfig,
    name?: string,
  ) => {
    try {
      const blob = await generateStarterDoc({
        templateName: name?.trim() || "Witness Statement Template",
        config,
      });
      await setDocxErrorsFromDocument(blob, config);
      setPreviewState(blob, "Starter DOCX preview");
    } catch (error) {
      setDocxErrors({
        errors: [String(error)],
        unknown: [],
        unused: [],
      });
      setPreviewDocxSource(null);
      setPreviewDocxLabel("Starter DOCX preview");
    }
  }, []);

  const preparePreviewFromUploadedDocument = async (
    document: UploadedDocument,
    config: StatementConfig,
  ) => {
    const blob = await downloadUploadedDocument(document);
    await setDocxErrorsFromDocument(blob, config);
    setPreviewState(blob, "Uploaded DOCX preview");
  };

  const syncEditorFromTemplate = (template: StatementConfigTemplate | null) => {
    if (!template) {
      const empty = createEmptyConfig();
      setDraftName("");
      setCurrentStatus("draft");
      formMethods.reset(empty);
      setPendingTemplateDocx(null);
      setDocxErrors({
        errors: [],
        unknown: [],
        unused: [],
      });
      setPendingAiPatch(null);
      return;
    }

    const config = normalizeConfig(template.draft_config);
    setDraftName(template.name);
    setCurrentStatus(template.status);
    formMethods.reset(config);
    setPendingTemplateDocx(null);
    setPendingAiPatch(null);
  };

  const refreshData = async () => {
    const data = await listStatementTemplates();

    const visibleTemplates = isAppAdmin
      ? data
      : data.filter(
          (template) =>
            template.tenant_id === user?.tenant_id ||
            template.tenant_id === null,
        );

    setTemplates(visibleTemplates);
    return visibleTemplates;
  };

  const { isLoading } = useAsync(
    async () => {
      const list = await refreshData();
      if (list.length > 0) {
        const initialTemplate =
          (selectedTemplateId
            ? list.find((template) => template.id === selectedTemplateId)
            : null) ?? list[0];
        const config = normalizeConfig(initialTemplate.draft_config);
        setActiveTemplateId(initialTemplate.id);
        syncEditorFromTemplate(initialTemplate);

        if (initialTemplate.draft_docx_template_document) {
          await preparePreviewFromUploadedDocument(
            initialTemplate.draft_docx_template_document,
            config,
          );
        } else {
          await prepareStarterPreview(config, initialTemplate.name);
        }
      } else {
        setActiveTemplateId(null);
        syncEditorFromTemplate(null);
        await prepareStarterPreview(
          createEmptyConfig(),
          "Witness Statement Template",
        );
      }
      return list;
    },
    [user?.id, user?.tenant_id, isAppAdmin, selectedTemplateId],
    {
      enabled: !!user,
      withUseEffect: true,
      onError: (error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to load statement templates",
        );
      },
    },
  );

  useEffect(() => {
    if (isLoading) return;
    if (isUploadingTemplateDocx) return;
    if (pendingTemplateDocx) return;
    if (activeTemplate?.draft_docx_template_document) return;

    const timeoutId = setTimeout(() => {
      void prepareStarterPreview(
        withGeneratedConfigIds(normalizeConfig(draftConfig)),
        draftName.trim() ||
          activeTemplate?.name ||
          "Witness Statement Template",
      );
    }, 400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    isLoading,
    isUploadingTemplateDocx,
    draftConfig,
    draftName,
    activeTemplate?.id,
    activeTemplate?.name,
    activeTemplate?.draft_docx_template_document,
    pendingTemplateDocx,
    prepareStarterPreview,
  ]);

  const selectTemplate = async (template: StatementConfigTemplate) => {
    const config = normalizeConfig(template.draft_config);
    setActiveTemplateId(template.id);
    syncEditorFromTemplate(template);

    if (template.draft_docx_template_document) {
      await preparePreviewFromUploadedDocument(
        template.draft_docx_template_document,
        config,
      );
    } else {
      await prepareStarterPreview(config, template.name);
    }

    setMessage(null);
  };

  const createNewTemplate = async () => {
    setActiveTemplateId(null);
    syncEditorFromTemplate(null);
    await prepareStarterPreview(
      createEmptyConfig(),
      "Witness Statement Template",
    );
    setMessage("Creating a new template draft");
  };

  const persistTemplate = async (
    nextStatus?: TemplateStatus,
    docxFileOverride?: File | null,
  ) => {
    if (!draftName.trim()) {
      throw new Error("Template name is required");
    }

    if (!canEditActiveTemplate) {
      throw new Error("This template is read-only for your role.");
    }

    const targetStatus = nextStatus ?? currentStatus;
    if (targetStatus === "published") {
      if (!isMainTemplateValid) {
        throw new Error(
          "Template is not fully validated. Fix validation errors before publishing.",
        );
      }

      if (docxErrors.errors.length > 0) {
        throw new Error(
          "DOCX template validation failed. Fix DOCX errors before publishing.",
        );
      }
    }

    const scope: "global" | "tenant" = isAppAdmin ? "global" : "tenant";
    const normalizedConfig = normalizeConfig(draftConfig);
    const persistedConfig = normalizePromptsForStorage(normalizedConfig);

    let docxTemplateDocument =
      activeTemplate?.draft_docx_template_document ?? null;

    const docxFileForUpload = docxFileOverride ?? pendingTemplateDocx;

    if (docxFileForUpload) {
      setIsUploadingTemplateDocx(true);
      try {
        await validateDocxTemplateDocument({
          config: normalizedConfig,
          templateDocument: docxFileForUpload,
          throw: true,
        });

        const uploadPath = [
          "statement-templates",
          user?.tenant_id ?? "global",
          `${Date.now()}-${docxFileForUpload.name}`,
        ].join("/");

        docxTemplateDocument = await uploadFile({
          bucketId: GLOBAL_TEMPLATE_BUCKET_ID,
          name: docxFileForUpload.name,
          path: uploadPath,
          file: docxFileForUpload,
          contentType:
            docxFileForUpload.type ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });
      } finally {
        setIsUploadingTemplateDocx(false);
      }
    }

    const payload = {
      tenantId: scope === "tenant" ? user?.tenant_id : null,
      name: draftName,
      templateScope: scope,
      status: targetStatus,
      draftConfig: persistedConfig,
      docxTemplateDocument,
    };

    let savedId = activeTemplateId;

    if (activeTemplateId) {
      if ((nextStatus ?? currentStatus) === "published") {
        await updateStatementTemplate(activeTemplateId, {
          ...payload,
          status: "draft",
        });
        await publishStatementTemplate(activeTemplateId);
      } else {
        await updateStatementTemplate(activeTemplateId, payload);
      }
      setMessage("Template updated");
    } else {
      const created = await createStatementTemplate(payload);
      if ((nextStatus ?? currentStatus) === "published") {
        await publishStatementTemplate(created.id);
      }
      savedId = created.id;
      setActiveTemplateId(created.id);
      setMessage("Template created");
    }

    const refreshed = await refreshData();
    const updated =
      refreshed.find((template) => template.id === savedId) ?? null;

    if (updated) {
      syncEditorFromTemplate(updated);
      if (updated.draft_docx_template_document) {
        await preparePreviewFromUploadedDocument(
          updated.draft_docx_template_document,
          normalizeConfig(updated.draft_config),
        );
      } else {
        await prepareStarterPreview(normalizedConfig, updated.name);
      }
      setPendingTemplateDocx(null);
      setCurrentStatus(updated.status);
    }
  };

  const saveTemplate = async () => {
    await persistTemplate();
  };

  const saveTemplateWithDocx = async (file: File) => {
    await persistTemplate(undefined, file);
  };

  const saveTemplateWithStatus = async (status: TemplateStatus) => {
    await persistTemplate(status);
  };

  const deleteTemplate = async () => {
    if (!activeTemplateId) return;
    if (!confirm("Delete this template? This cannot be undone.")) {
      return;
    }

    await deleteStatementTemplate(activeTemplateId);

    const refreshed = await refreshData();
    if (refreshed.length > 0) {
      const first = refreshed[0];
      setActiveTemplateId(first.id);
      syncEditorFromTemplate(first);
      if (first.draft_docx_template_document) {
        await preparePreviewFromUploadedDocument(
          first.draft_docx_template_document,
          normalizeConfig(first.draft_config),
        );
      } else {
        await prepareStarterPreview(
          normalizeConfig(first.draft_config),
          first.name,
        );
      }
    } else {
      setActiveTemplateId(null);
      syncEditorFromTemplate(null);
      await prepareStarterPreview(
        createEmptyConfig(),
        "Witness Statement Template",
      );
    }

    setMessage("Template deleted");
  };

  const duplicateTemplate = async () => {
    if (!activeTemplate || !canEditActiveTemplate) {
      return;
    }

    const config = normalizeConfig(activeTemplate.draft_config);
    const scope: "global" | "tenant" = isAppAdmin ? "global" : "tenant";

    const created = await createStatementTemplate({
      tenantId: scope === "tenant" ? user?.tenant_id : null,
      name: `${activeTemplate.name} (Copy)`,
      templateScope: scope,
      status: "draft",
      draftConfig: config,
      docxTemplateDocument: activeTemplate.draft_docx_template_document,
      sourceTemplateId: activeTemplate.id,
    });

    const refreshed = await refreshData();
    const copy =
      refreshed.find((template) => template.id === created.id) ?? created;

    setActiveTemplateId(copy.id);
    syncEditorFromTemplate(copy);

    if (copy.draft_docx_template_document) {
      await preparePreviewFromUploadedDocument(
        copy.draft_docx_template_document,
        normalizeConfig(copy.draft_config),
      );
    } else {
      await prepareStarterPreview(config, copy.name);
    }

    setMessage("Template duplicated");
  };

  const forkTemplate = async () => {
    if (!activeTemplate || !canForkGlobalTemplate || !user?.tenant_id) {
      return;
    }

    const config = normalizeConfig(activeTemplate.draft_config);

    const created = await createStatementTemplate({
      tenantId: user.tenant_id,
      name: `${activeTemplate.name} (Tenant)`,
      templateScope: "tenant",
      status: "draft",
      draftConfig: config,
      docxTemplateDocument: activeTemplate.draft_docx_template_document,
      sourceTemplateId: activeTemplate.id,
    });

    const refreshed = await refreshData();
    const tenantCopy =
      refreshed.find((template) => template.id === created.id) ?? created;

    setActiveTemplateId(tenantCopy.id);
    syncEditorFromTemplate(tenantCopy);

    if (tenantCopy.draft_docx_template_document) {
      await preparePreviewFromUploadedDocument(
        tenantCopy.draft_docx_template_document,
        normalizeConfig(tenantCopy.draft_config),
      );
    } else {
      await prepareStarterPreview(config, tenantCopy.name);
    }

    setMessage("Template forked to tenant scope");
  };

  const restorePreviousVersion = async () => {
    if (!activeTemplateId || !activeTemplate?.published_config) {
      return;
    }

    await restoreStatementTemplateDraftFromPublished(activeTemplateId);
    const refreshed = await refreshData();
    const updated =
      refreshed.find((template) => template.id === activeTemplateId) ?? null;

    if (updated) {
      syncEditorFromTemplate(updated);

      if (updated.draft_docx_template_document) {
        await preparePreviewFromUploadedDocument(
          updated.draft_docx_template_document,
          normalizeConfig(updated.draft_config),
        );
      } else {
        await prepareStarterPreview(
          normalizeConfig(updated.draft_config),
          updated.name,
        );
      }
    }

    setMessage("Restored the published version into draft.");
  };

  const resetConfig = () => {
    formMethods.reset(withGeneratedConfigIds(createEmptyConfig()));
    setPendingAiPatch(null);
    setMessage("Template config reset");
  };

  const applyAdvancedJson = async (value: string) => {
    try {
      const parsed = normalizeConfig(JSON.parse(value));
      formMethods.reset(parsed);
      setPendingAiPatch(null);
      setMessage("Applied JSON changes to editor");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON");
      throw error;
    }
  };

  const patchConfig = (patch: Partial<StatementConfig>) => {
    const current = formMethods.getValues();
    const next = withGeneratedConfigIds(mergeDeep(current, patch));
    formMethods.reset(next);
  };

  const stageAiPatch = (patch: Partial<StatementConfig>) => {
    setPendingAiPatch((prev) => mergeDeep(prev ?? {}, patch));
  };

  const applyPendingAiPatch = () => {
    if (!pendingAiPatch) {
      return;
    }

    patchConfig(pendingAiPatch);
    setPendingAiPatch(null);
    setMessage("Applied AI draft changes to template config");
  };

  const discardPendingAiPatch = () => {
    setPendingAiPatch(null);
    setMessage("Discarded AI draft changes");
  };

  const applyPendingAiPatchPath = (
    path: string,
    status?: "added" | "removed" | "modified",
  ) => {
    if (!pendingAiPatch) {
      return;
    }

    const currentConfig = formMethods.getValues();
    const pendingConfig = materializePendingPatch(
      currentConfig,
      pendingAiPatch,
    );

    const nextConfig =
      status === "removed"
        ? withGeneratedConfigIds(
            deletePathFromObject(currentConfig, path) ?? currentConfig,
          )
        : (() => {
            const patchValue = getValueAtPath(pendingConfig, path);
            if (patchValue === undefined) {
              return null;
            }

            return withGeneratedConfigIds(
              setValueAtPath(currentConfig, path, patchValue),
            );
          })();

    if (!nextConfig) {
      return;
    }

    formMethods.reset(nextConfig);
    setPendingAiPatch((prev) => deletePathFromObject(prev, path));
    setMessage(`Applied AI change for ${path}`);
  };

  const discardPendingAiPatchPath = (path: string) => {
    setPendingAiPatch((prev) => deletePathFromObject(prev, path));
    setMessage(`Discarded AI change for ${path}`);
  };

  const downloadStarterDocx = async () => {
    const config = withGeneratedConfigIds(
      normalizeConfig(formMethods.getValues()),
    );
    const templateName = draftName.trim() || "Witness Statement Template";
    const blob = await generateStarterDoc({
      templateName,
      config,
    });

    saveAs(blob, `${slugify(templateName, "statementTemplate")}.docx`);
  };

  const downloadUploadedDocx = async () => {
    if (!activeTemplate?.draft_docx_template_document) {
      setMessage("No uploaded DOCX to download");
      return;
    }
    const blob = await downloadUploadedDocument(
      activeTemplate.draft_docx_template_document,
    );
    saveAs(blob, activeTemplate.draft_docx_template_document.name);
  };

  const deleteUploadedDocx = async () => {
    if (!activeTemplateId || !activeTemplate?.draft_docx_template_document) {
      return;
    }

    if (
      !confirm(
        "Delete the uploaded DOCX? This will revert to using the generated starter template.",
      )
    ) {
      return;
    }

    await updateStatementTemplate(activeTemplateId, {
      tenantId:
        activeTemplate.template_scope === "tenant"
          ? activeTemplate.tenant_id
          : null,
      name: activeTemplate.name,
      templateScope: activeTemplate.template_scope,
      status: activeTemplate.status,
      draftConfig: normalizeConfig(activeTemplate.draft_config),
      docxTemplateDocument: null,
    });

    const refreshed = await refreshData();
    const updated =
      refreshed.find((template) => template.id === activeTemplateId) ?? null;

    if (updated) {
      syncEditorFromTemplate(updated);
      await prepareStarterPreview(
        normalizeConfig(updated.draft_config),
        updated.name,
      );
    }

    setMessage("Uploaded DOCX deleted");
  };

  const stageTemplateDocx = async (file: File | null) => {
    if (!file) {
      setPendingTemplateDocx(null);

      const config = withGeneratedConfigIds(
        normalizeConfig(formMethods.getValues()),
      );

      if (activeTemplate?.draft_docx_template_document) {
        await preparePreviewFromUploadedDocument(
          activeTemplate.draft_docx_template_document,
          config,
        );
      } else {
        await prepareStarterPreview(config, draftName);
      }

      setMessage("Staged DOCX removed.");
      return;
    }

    if (!canEditActiveTemplate) {
      throw new Error("This template is read-only for your role.");
    }

    const config = withGeneratedConfigIds(
      normalizeConfig(formMethods.getValues()),
    );

    setIsUploadingTemplateDocx(true);
    try {
      await setDocxErrorsFromDocument(file, config);

      setPendingTemplateDocx(file);
      setPreviewState(file, `Staged: ${file.name}`);
      setMessage("DOCX staged. Save the template to persist it.");
    } finally {
      setIsUploadingTemplateDocx(false);
    }
  };

  const value: StatementTemplateSettingsContextValue = {
    userTenantName: user?.tenant_name ?? null,
    templates,
    activeTemplateId,
    activeTemplate,
    isLoading,
    setIsGenerating,
    isGenerating,
    message,
    editorTab,
    setEditorTab,
    canForkGlobalTemplate,
    canEditActiveTemplate,
    isBusy,
    hasPublishedVersion,
    draftName,
    setDraftName,
    draftNameValidationError,
    currentStatus,
    setCurrentStatus: setCurrentStatus,
    draftConfig,
    setDraftConfig,
    advancedJson,
    pendingTemplateDocx,
    isUploadingTemplateDocx,
    previewDocxSource,
    previewDocxLabel,
    docxErrors,
    mainTemplateValidationErrors,
    isMainTemplateValid,
    canPublishTemplate,
    selectTemplate,
    createNewTemplate,
    saveTemplate,
    saveTemplateWithDocx,
    saveTemplateWithStatus,
    deleteTemplate,
    duplicateTemplate,
    forkTemplate,
    restorePreviousVersion,
    resetConfig,
    applyAdvancedJson,
    patchConfig,
    pendingAiPatch,
    pendingAiPatchPaths,
    pendingAiPatchDiffs,
    stageAiPatch,
    applyPendingAiPatch,
    discardPendingAiPatch,
    applyPendingAiPatchPath,
    discardPendingAiPatchPath,
    downloadStarterDocx,
    downloadUploadedDocx,
    deleteUploadedDocx,
    stageTemplateDocx,
  };

  return (
    <FormProvider {...formMethods}>
      <StatementTemplateSettingsContext.Provider value={value}>
        {children}
      </StatementTemplateSettingsContext.Provider>
    </FormProvider>
  );
}

export function useStatementTemplateSettings() {
  const context = useContext(StatementTemplateSettingsContext);
  if (!context) {
    throw new Error(
      "useStatementTemplateSettings must be used within StatementTemplateSettingsProvider",
    );
  }

  return context;
}
