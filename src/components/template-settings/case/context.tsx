"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { useUserProtected } from "@/contexts/user-context";
import { useAsync } from "@/hooks/useAsync";
import { CaseConfigSchema } from "@/lib/schema";
import {
  getCaseTemplateStatementTemplateLinks,
  getTenantCaseTemplatePreferences,
  listCaseTemplates,
  listStatementTemplates,
} from "@/lib/supabase/queries";
import {
  createCaseTemplate,
  deleteCaseTemplate,
  setCaseTemplateStatementTemplates,
  upsertTenantCaseTemplatePreferences,
  updateCaseTemplate,
} from "@/lib/supabase/mutations";
import { slugify, uniqueSlug } from "@/lib/utils";
import type {
  CaseConfig,
  CaseTemplate,
  StatementConfigTemplate,
  TemplateStatus,
} from "@/types";

type CaseEditorTab = "simple" | "json";

type CaseTemplateSettingsContextValue = {
  userTenantName: string | null;
  isLoading: boolean;
  message: string | null;
  caseTemplates: CaseTemplate[];
  statementTemplates: StatementConfigTemplate[];
  activeTemplateId: string | null;
  activeTemplate: CaseTemplate | null;
  defaultTemplateId: string | null;
  favouriteTemplateIds: string[];
  linkedStatementTemplateIds: string[];
  defaultStatementTemplateId: string | null;
  depsWarningsByTemplateId: Map<string, string[]>;
  selectedDepsWarnings: Array<{ templateName: string; missing: string[] }>;
  canForkGlobalTemplate: boolean;
  canEditActiveTemplate: boolean;
  isTenantAdmin: boolean;
  editorTab: CaseEditorTab;
  setEditorTab: (tab: CaseEditorTab) => void;
  draftName: string;
  setDraftName: (value: string) => void;
  currentStatus: TemplateStatus;
  draftConfig: CaseConfig;
  setDraftConfig: (
    value: CaseConfig | ((prev: CaseConfig) => CaseConfig),
  ) => void;
  advancedJson: string;
  setLinkedStatementTemplateIds: (ids: string[]) => void;
  setDefaultStatementTemplateId: (id: string | null) => void;
  selectTemplate: (template: CaseTemplate) => Promise<void>;
  createNewTemplate: () => void;
  saveTemplate: () => Promise<void>;
  saveTemplateWithStatus: (status: TemplateStatus) => Promise<void>;
  forkTemplate: () => Promise<void>;
  deleteTemplate: () => Promise<void>;
  toggleFavourite: () => Promise<void>;
  toggleDefault: () => Promise<void>;
  addDynamicField: () => void;
  applyAdvancedJson: (value: string) => Promise<void>;
};

const CaseTemplateSettingsContext =
  createContext<CaseTemplateSettingsContextValue | null>(null);

function createEmptyConfig(): CaseConfig {
  return CaseConfigSchema.parse({
    dynamicFields: [],
  });
}

function normalizeConfig(input: unknown): CaseConfig {
  const parsed = CaseConfigSchema.safeParse(input);
  return parsed.success ? parsed.data : createEmptyConfig();
}

function withGeneratedDynamicFieldKeys(config: CaseConfig) {
  const used = new Set<string>();

  return {
    ...config,
    dynamicFields: (config.dynamicFields ?? []).map((field) => ({
      id: uniqueSlug(slugify(field.label || "", "field"), used),
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder,
    })),
  };
}

function getStatementTemplateCaseMetadataDeps(
  template: StatementConfigTemplate,
): string[] {
  const config = template.published_config ?? template.draft_config;
  const deps =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as { case_metadata_deps?: unknown }).case_metadata_deps
      : [];

  if (!Array.isArray(deps)) {
    return [];
  }

  return deps
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CaseTemplateSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useUserProtected(["app_admin", "tenant_admin", "solicitor"]);

  const [caseTemplates, setCaseTemplates] = useState<CaseTemplate[]>([]);
  const [statementTemplates, setStatementTemplates] = useState<
    StatementConfigTemplate[]
  >([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(
    null,
  );
  const [favouriteTemplateIds, setFavouriteTemplateIds] = useState<string[]>(
    [],
  );
  const [linkedStatementTemplateIds, setLinkedStatementTemplateIdsState] =
    useState<string[]>([]);
  const [defaultStatementTemplateId, setDefaultStatementTemplateIdState] =
    useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<CaseEditorTab>("simple");

  const [draftName, setDraftName] = useState("");

  const formMethods = useForm<CaseConfig>({
    defaultValues: createEmptyConfig(),
    resolver: zodResolver(CaseConfigSchema) as Resolver<CaseConfig>,
    mode: "onChange",
  });

  const draftConfig =
    (useWatch({ control: formMethods.control }) as CaseConfig | undefined) ??
    createEmptyConfig();

  const [advancedJson, setAdvancedJson] = useState(
    JSON.stringify(createEmptyConfig(), null, 2),
  );

  const activeTemplate = useMemo(
    () =>
      caseTemplates.find((template) => template.id === activeTemplateId) ??
      null,
    [caseTemplates, activeTemplateId],
  );
  const currentStatus = activeTemplate?.status ?? "draft";

  const caseFieldKeySet = useMemo(
    () =>
      new Set(
        (draftConfig.dynamicFields ?? [])
          .map((field) => field.id?.trim())
          .filter((id): id is string => !!id),
      ),
    [draftConfig.dynamicFields],
  );

  const depsWarningsByTemplateId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const template of statementTemplates) {
      const deps = getStatementTemplateCaseMetadataDeps(template);
      const missing = deps.filter((dep) => !caseFieldKeySet.has(dep));
      map.set(template.id, missing);
    }
    return map;
  }, [statementTemplates, caseFieldKeySet]);

  const selectedDepsWarnings = useMemo(
    () =>
      linkedStatementTemplateIds
        .map((templateId) => {
          const template = statementTemplates.find(
            (item) => item.id === templateId,
          );
          const missing = depsWarningsByTemplateId.get(templateId) ?? [];
          return template && missing.length
            ? { templateName: template.name, missing }
            : null;
        })
        .filter(
          (
            item,
          ): item is {
            templateName: string;
            missing: string[];
          } => item !== null,
        ),
    [linkedStatementTemplateIds, statementTemplates, depsWarningsByTemplateId],
  );

  const isAppAdmin = user?.role === "app_admin";
  const canForkGlobalTemplate =
    !!activeTemplate &&
    !isAppAdmin &&
    activeTemplate.template_scope === "global";
  const isTenantAdmin = user?.role === "tenant_admin";
  const canEditActiveTemplate =
    !activeTemplate || isAppAdmin || activeTemplate.template_scope === "tenant";

  useEffect(() => {
    setAdvancedJson(JSON.stringify(draftConfig, null, 2));
  }, [draftConfig]);

  const setDraftConfig = (
    value: CaseConfig | ((prev: CaseConfig) => CaseConfig),
  ) => {
    const next =
      typeof value === "function" ? value(formMethods.getValues()) : value;
    formMethods.reset(next);
  };

  const setLinkedStatementTemplateIds = (ids: string[]) => {
    setLinkedStatementTemplateIdsState(
      Array.from(new Set(ids.filter(Boolean))),
    );
  };

  const setDefaultStatementTemplateId = (id: string | null) => {
    setDefaultStatementTemplateIdState(id);
  };

  const syncEditorFromTemplate = (template: CaseTemplate | null) => {
    if (!template) {
      const empty = createEmptyConfig();
      setDraftName("");
      formMethods.reset(empty);
      setLinkedStatementTemplateIdsState([]);
      setDefaultStatementTemplateIdState(null);
      setEditorTab("simple");
      return;
    }

    const config = withGeneratedDynamicFieldKeys(
      normalizeConfig(template.draft_config),
    );
    setDraftName(template.name);
    formMethods.reset(config);
    setEditorTab("simple");
  };

  const refreshData = async () => {
    const [caseTemplateData, statementTemplateData] = await Promise.all([
      listCaseTemplates(),
      listStatementTemplates(),
    ]);

    setCaseTemplates(caseTemplateData);
    setStatementTemplates(
      statementTemplateData.filter(
        (template) =>
          template.status === "published" &&
          (template.tenant_id === user?.tenant_id ||
            template.tenant_id === null),
      ),
    );

    if (user?.tenant_id) {
      const preferences = await getTenantCaseTemplatePreferences(
        user.tenant_id,
      );
      setDefaultTemplateId(preferences.default_case_template_id);
      setFavouriteTemplateIds(preferences.favourite_case_template_ids);
    } else {
      setDefaultTemplateId(null);
      setFavouriteTemplateIds([]);
    }

    return caseTemplateData;
  };

  const loadTemplateStatementLinks = async (templateId: string) => {
    const links = await getCaseTemplateStatementTemplateLinks(templateId);
    setLinkedStatementTemplateIdsState(
      links.map((link) => link.statement_template_id),
    );

    const defaultLink = links.find((link) => link.is_default);
    setDefaultStatementTemplateIdState(
      defaultLink?.statement_template_id ?? null,
    );
  };

  const { isLoading } = useAsync(
    async () => {
      const templates = await refreshData();
      if (templates.length > 0) {
        const first = templates[0];
        setActiveTemplateId(first.id);
        syncEditorFromTemplate(first);
        await loadTemplateStatementLinks(first.id);
      } else {
        setActiveTemplateId(null);
        syncEditorFromTemplate(null);
      }
      return templates;
    },
    [user?.id, user?.tenant_id],
    {
      enabled: !!user,
      withUseEffect: true,
      onError: (error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to load case templates",
        );
      },
    },
  );

  const selectTemplate = async (template: CaseTemplate) => {
    setActiveTemplateId(template.id);
    syncEditorFromTemplate(template);
    await loadTemplateStatementLinks(template.id);
    setMessage(null);
  };

  const createNewTemplate = () => {
    setActiveTemplateId(null);
    syncEditorFromTemplate(null);
    setMessage("Creating a new case template draft");
  };

  const persistTemplate = async (nextStatus?: TemplateStatus) => {
    if (!draftName.trim()) {
      throw new Error("Template name is required");
    }

    if (!canEditActiveTemplate) {
      throw new Error("This template is read-only for your role.");
    }

    const scope: "global" | "tenant" = isAppAdmin ? "global" : "tenant";
    const normalizedConfig = withGeneratedDynamicFieldKeys(
      normalizeConfig(draftConfig),
    );

    const payload = {
      tenantId: scope === "tenant" ? user?.tenant_id : null,
      name: draftName,
      templateScope: scope,
      status: nextStatus ?? currentStatus,
      draftConfig: normalizedConfig,
    };

    let savedId = activeTemplateId;

    if (activeTemplateId) {
      await updateCaseTemplate(activeTemplateId, payload);
      setMessage("Case template updated");
    } else {
      const created = await createCaseTemplate(payload);
      savedId = created.id;
      setActiveTemplateId(created.id);
      setMessage("Case template created");
    }

    const refreshed = await refreshData();
    const updated =
      refreshed.find((template) => template.id === savedId) ?? null;

    if (updated) {
      syncEditorFromTemplate(updated);
      await setCaseTemplateStatementTemplates({
        caseTemplateId: updated.id,
        statementTemplateIds: linkedStatementTemplateIds,
        defaultStatementTemplateId,
      });
      await loadTemplateStatementLinks(updated.id);
    }
  };

  const saveTemplate = async () => {
    await persistTemplate();
  };

  const saveTemplateWithStatus = async (status: TemplateStatus) => {
    await persistTemplate(status);
  };

  const forkTemplate = async () => {
    if (!activeTemplate || !canForkGlobalTemplate || !user?.tenant_id) {
      return;
    }

    const config = withGeneratedDynamicFieldKeys(
      normalizeConfig(activeTemplate.draft_config),
    );

    const created = await createCaseTemplate({
      tenantId: user.tenant_id,
      name: `${activeTemplate.name} (Tenant)`,
      templateScope: "tenant",
      status: "draft",
      draftConfig: config,
      sourceTemplateId: activeTemplate.id,
    });

    await setCaseTemplateStatementTemplates({
      caseTemplateId: created.id,
      statementTemplateIds: linkedStatementTemplateIds,
      defaultStatementTemplateId,
    });

    const refreshed = await refreshData();
    const tenantCopy =
      refreshed.find((template) => template.id === created.id) ?? created;

    setActiveTemplateId(tenantCopy.id);
    syncEditorFromTemplate(tenantCopy);
    await loadTemplateStatementLinks(tenantCopy.id);
    setMessage("Case template forked to tenant scope");
  };

  const deleteTemplate = async () => {
    if (!activeTemplateId) return;
    if (!confirm("Delete this case template? This cannot be undone.")) {
      return;
    }

    await deleteCaseTemplate(activeTemplateId);
    const templates = await refreshData();
    if (templates.length > 0) {
      const first = templates[0];
      setActiveTemplateId(first.id);
      syncEditorFromTemplate(first);
      await loadTemplateStatementLinks(first.id);
    } else {
      setActiveTemplateId(null);
      syncEditorFromTemplate(null);
    }

    setMessage("Case template deleted");
  };

  const toggleFavourite = async () => {
    if (!isTenantAdmin || !user?.tenant_id || !activeTemplateId) return;

    const nextFavourites = favouriteTemplateIds.includes(activeTemplateId)
      ? favouriteTemplateIds.filter((id) => id !== activeTemplateId)
      : [...favouriteTemplateIds, activeTemplateId];

    const nextDefault =
      defaultTemplateId && !nextFavourites.includes(defaultTemplateId)
        ? null
        : defaultTemplateId;

    const updated = await upsertTenantCaseTemplatePreferences({
      tenantId: user.tenant_id,
      favouriteCaseTemplateIds: nextFavourites,
      defaultCaseTemplateId: nextDefault,
    });

    setFavouriteTemplateIds(updated.favourite_case_template_ids);
    setDefaultTemplateId(updated.default_case_template_id);
  };

  const toggleDefault = async () => {
    if (!isTenantAdmin || !user?.tenant_id || !activeTemplateId) return;
    if (defaultTemplateId === activeTemplateId) {
      setDefaultTemplateId(null);
      await upsertTenantCaseTemplatePreferences({
        tenantId: user.tenant_id,
        defaultCaseTemplateId: null,
      });
      setMessage("Unpinned case template from default");
      return;
    }

    const nextFavourites = favouriteTemplateIds.includes(activeTemplateId)
      ? favouriteTemplateIds
      : [...favouriteTemplateIds, activeTemplateId];

    const updated = await upsertTenantCaseTemplatePreferences({
      tenantId: user.tenant_id,
      favouriteCaseTemplateIds: nextFavourites,
      defaultCaseTemplateId: activeTemplateId,
    });

    setFavouriteTemplateIds(updated.favourite_case_template_ids);
    setDefaultTemplateId(updated.default_case_template_id);
    setMessage("Pinned case template as default");
  };

  const addDynamicField = () => {
    if (!canEditActiveTemplate) return;

    setDraftConfig((prev) =>
      withGeneratedDynamicFieldKeys({
        ...prev,
        dynamicFields: [
          ...(prev.dynamicFields ?? []),
          {
            id: uniqueSlug("newField", new Set()),
            label: "New field",
            type: "text",
            required: false,
            placeholder: "",
          },
        ],
      }),
    );
  };

  const applyAdvancedJson = async (value: string) => {
    try {
      const parsed = normalizeConfig(JSON.parse(value));
      setDraftConfig(withGeneratedDynamicFieldKeys(parsed));
      setMessage("Applied JSON changes to editor");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON");
      throw error;
    }
  };

  const value: CaseTemplateSettingsContextValue = {
    userTenantName: user?.tenant_name ?? null,
    isLoading,
    message,
    caseTemplates,
    statementTemplates,
    activeTemplateId,
    activeTemplate,
    defaultTemplateId,
    favouriteTemplateIds,
    linkedStatementTemplateIds,
    defaultStatementTemplateId,
    depsWarningsByTemplateId,
    selectedDepsWarnings,
    canForkGlobalTemplate,
    canEditActiveTemplate,
    isTenantAdmin,
    editorTab,
    setEditorTab,
    draftName,
    setDraftName,
    currentStatus,
    draftConfig,
    setDraftConfig,
    advancedJson,
    setLinkedStatementTemplateIds,
    setDefaultStatementTemplateId,
    selectTemplate,
    createNewTemplate,
    saveTemplate,
    saveTemplateWithStatus,
    forkTemplate,
    deleteTemplate,
    toggleFavourite,
    toggleDefault,
    addDynamicField,
    applyAdvancedJson,
  };

  return (
    <FormProvider {...formMethods}>
      <CaseTemplateSettingsContext.Provider value={value}>
        {children}
      </CaseTemplateSettingsContext.Provider>
    </FormProvider>
  );
}

export function useCaseTemplateSettings() {
  const context = useContext(CaseTemplateSettingsContext);
  if (!context) {
    throw new Error(
      "useCaseTemplateSettings must be used within CaseTemplateSettingsProvider",
    );
  }

  return context;
}
