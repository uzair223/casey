"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/page-title";
import Loading from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarWrapper,
} from "@/components/ui/sidebar";
import {
  templateStatusLabel,
  templateStatusVariant,
} from "@/lib/status-styles";
import type { StatementConfig, StatementConfigTemplate } from "@/types";
import { useStatementTemplateSettings } from "./context";
import {
  ACCOUNT_TEMPLATE_SECTIONS,
  useTemplateRoute,
} from "../shared/template-route";
import { StatementTemplateSimpleView } from "./simple-view";
import { StatementTemplateJsonView } from "./json-view";
import { AsyncButton } from "@/components/ui/async-button";
import {
  GenerateWithAI,
  GenerateWithAITrigger,
} from "../../with-ai/template-generate";
import { StatementConfigSchema } from "@/lib/schema";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import {
  Sparkles,
  CalendarArrowDown,
  CalendarArrowUp,
  ArrowDownAZ,
  ArrowDownZA,
  ChevronDown,
  ChevronLeft,
} from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectScrollDownButton,
  SelectScrollUpButton,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useUser } from "@/contexts/user-context";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SelectTrigger, SelectValue } from "@radix-ui/react-select";

const StatementTemplateGenerationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .describe("Short, clear template name shown in the template list."),
    config: StatementConfigSchema.omit({
      schemaVersion: true,
    }).describe(
      'Account template. modelIdentity is one or two sentences beginning "You are taking an account of a ...". The firm prepares the written draft during review. Phase intent belongs only in objective. Do not write system prompt text.',
    ),
  })
  .strict();

function toTemplateGenerationPatch(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : undefined;
  const config =
    record.config && typeof record.config === "object"
      ? (record.config as Partial<StatementConfig>)
      : undefined;

  if (!name && !config) {
    return null;
  }

  return { name, config };
}

type EditorAction = {
  key: string;
  label: string;
  pendingText: string;
  onClick: () => Promise<void>;
  disabled?: boolean;
};

function EditorActionsMenu({ items }: { items: EditorAction[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
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
          className="absolute right-0 z-20 mt-1 flex min-w-44 flex-col rounded-md border bg-card p-1 shadow"
        >
          {items.map((item) => (
            <AsyncButton
              key={item.key}
              role="menuitem"
              variant="ghost"
              size="sm"
              className="justify-start"
              pendingText={item.pendingText}
              disabled={item.disabled}
              onClick={async () => {
                try {
                  await item.onClick();
                } finally {
                  setOpen(false);
                }
              }}
            >
              {item.label}
            </AsyncButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StatementTemplateSettingsScreen() {
  const { user } = useUser();
  const [templateSearch, setTemplateSearch] = useState("");
  const route = useTemplateRoute(ACCOUNT_TEMPLATE_SECTIONS, "basics");
  const docxSectionOpen = route.section === "docx" && route.view === "simple";
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "az" | "za"
  >("newest");

  const {
    canForkGlobalTemplate,
    canEditActiveTemplate,
    canPublishTemplate,
    hasPublishedVersion,
    docxErrors,
    templates,
    activeTemplateId,
    activeTemplate,
    currentStatus,
    draftName,
    draftNameValidationError,
    mainTemplateValidationErrors,
    isLoading,
    setIsGenerating,
    stageAiTemplatePatch,
    saveTemplate,
    deleteTemplate,
    duplicateTemplate,
    saveTemplateWithStatus,
    forkTemplate,
    restorePreviousVersion,
  } = useStatementTemplateSettings();
  const { control } = useFormContext<StatementConfig>();
  const { isDirty } = useFormState({ control });
  const draftConfig = (useWatch({ control }) ??
    EMPTY_STATEMENT_CONFIG) as StatementConfig;

  const templateValidationErrors = [
    ...(draftNameValidationError ? [draftNameValidationError] : []),
    ...mainTemplateValidationErrors,
  ];
  const showTemplateValidationIssues =
    isDirty && templateValidationErrors.length > 0;

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    const scopeOrder = { tenant: 0, global: 1 } as const;
    return [...templates]
      .sort((a, b) => {
        const scopeDiff =
          scopeOrder[a.template_scope] - scopeOrder[b.template_scope];
        if (scopeDiff !== 0) {
          return scopeDiff;
        }

        switch (sortOption) {
          case "az":
            return a.name.localeCompare(b.name);
          case "za":
            return b.name.localeCompare(a.name);
          case "oldest":
            return Date.parse(a.updated_at) - Date.parse(b.updated_at);
          case "newest":
          default:
            return Date.parse(b.updated_at) - Date.parse(a.updated_at);
        }
      })
      .filter((template) =>
        query.length === 0 ? true : template.name.toLowerCase().includes(query),
      );
  }, [templates, templateSearch, sortOption]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
        return;
      }

      // The DOCX subtab has its own save handler in docx-view.
      if (docxSectionOpen) {
        return;
      }

      event.preventDefault();

      if (!canEditActiveTemplate) {
        return;
      }

      void saveTemplate();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canEditActiveTemplate, docxSectionOpen, saveTemplate]);

  if (isLoading) {
    return <Loading />;
  }

  const badges = (template: StatementConfigTemplate) => (
    <>
      {(user?.role === "tenant_admin"
        ? template.template_scope === "tenant"
        : template.template_scope === "global") && (
        <Badge variant={templateStatusVariant[template.status]}>
          {templateStatusLabel[template.status]}
        </Badge>
      )}
      <Badge className="capitalize">{template.template_scope}</Badge>
    </>
  );

  return (
    <section className="space-y-4">
      <PageTitle
        title="Account templates"
        description="Manage the questions and document sections used after a lead is accepted, plus template DOCX files."
        actions={[
          {
            label: "Lead types",
            href: "/settings/cases",
            variant: "outline",
          },
        ]}
      />

      <SidebarWrapper>
        <Sidebar<StatementConfigTemplate>
          className={route.isEditor ? "hidden lg:block" : undefined}
          scrollAreaHeightClassName="h-[calc(100dvh-16rem)] lg:h-[calc(100vh-10rem)]"
          title="Account templates"
          actions={[
            <div
              key="statement-template-filters"
              className="w-full flex gap-1.5"
            >
              <Input
                key="statement-template-search"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder="Search templates..."
                className="h-8 flex-1"
              />
              <Select
                key="template-sort"
                value={sortOption}
                onValueChange={(value) =>
                  setSortOption(value as typeof sortOption)
                }
              >
                <SelectTrigger asChild>
                  <Button variant="outline" size="icon-sm">
                    {
                      {
                        az: <ArrowDownAZ />,
                        za: <ArrowDownZA />,
                        newest: <CalendarArrowDown />,
                        oldest: <CalendarArrowUp />,
                      }[sortOption]
                    }
                    <span className="sr-only">
                      <SelectValue />
                    </span>
                  </Button>
                </SelectTrigger>

                <SelectContent>
                  <SelectScrollUpButton />
                  <SelectItem value="az">Alphabetic (asc)</SelectItem>
                  <SelectItem value="za">Alphabetic (desc)</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectScrollDownButton />
                </SelectContent>
              </Select>
            </div>,
            {
              label: "New",
              onClick: () => {
                route.openNew();
              },
            },
          ]}
          items={filteredTemplates}
          activeItemId={activeTemplate?.id}
          getItemId={(template) => template.id}
          onSelectItem={(template) => {
            route.openTemplate(template.id);
          }}
          renderItem={(template) => (
            <div className="flex w-full flex-col gap-2">
              <span className="font-medium text-sm">{template.name}</span>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {badges(template)}
              </div>
            </div>
          )}
          emptyMessage="No templates yet."
        />

        <SidebarContent
          className={route.isEditor ? undefined : "hidden lg:block"}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-3 lg:hidden"
            onClick={() => route.closeEditor()}
          >
            <ChevronLeft className="size-4" />
            Account templates
          </Button>
          <Card>
            <CardHeader>
              <GenerateWithAI
                textareaProps={{
                  placeholder:
                    "Generate a statement template for a workplace injury claim...",
                }}
                resetTrigger={activeTemplateId}
                seedData={{
                  name: draftName || activeTemplate?.name || "",
                  config: draftConfig,
                }}
                schema={StatementTemplateGenerationSchema}
                onRequestSent={() => {
                  setIsGenerating(true);
                }}
                onPartial={({ kind, data }) => {
                  if (kind !== "patch" || !data) return;
                  const patch = toTemplateGenerationPatch(data);
                  if (patch) {
                    stageAiTemplatePatch(patch);
                  }
                }}
                onComplete={({ kind, data }) => {
                  if (kind === "patch" && data) {
                    const patch = toTemplateGenerationPatch(data);
                    if (patch) {
                      stageAiTemplatePatch(patch);
                    }
                  }
                  setIsGenerating(false);
                }}
                onError={() => {
                  setIsGenerating(false);
                }}
              >
                {!docxSectionOpen ? (
                  <div className="fixed bottom-6 right-6">
                    <GenerateWithAITrigger
                      className="rounded-full"
                      disabled={!canEditActiveTemplate}
                    >
                      <Sparkles /> AI Assistant
                    </GenerateWithAITrigger>
                  </div>
                ) : null}
              </GenerateWithAI>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Editor</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {activeTemplate ? badges(activeTemplate) : null}
                  <EditorActionsMenu
                    items={[
                      ...(canForkGlobalTemplate
                        ? [
                            {
                              key: "fork",
                              label: "Fork to firm",
                              pendingText: "Forking...",
                              onClick: forkTemplate,
                            },
                          ]
                        : []),
                      ...(canEditActiveTemplate && activeTemplate
                        ? [
                            ...(currentStatus !== "draft"
                              ? [
                                  {
                                    key: "draft",
                                    label: "Move to draft",
                                    pendingText: "Saving...",
                                    onClick: () =>
                                      saveTemplateWithStatus("draft"),
                                  },
                                ]
                              : []),
                            ...(currentStatus !== "published"
                              ? [
                                  {
                                    key: "publish",
                                    label: "Publish",
                                    pendingText: "Saving...",
                                    onClick: () =>
                                      saveTemplateWithStatus("published"),
                                    disabled: !canPublishTemplate,
                                  },
                                ]
                              : []),
                            ...(currentStatus !== "archived"
                              ? [
                                  {
                                    key: "archive",
                                    label: "Archive",
                                    pendingText: "Saving...",
                                    onClick: () =>
                                      saveTemplateWithStatus("archived"),
                                  },
                                ]
                              : []),
                            {
                              key: "duplicate",
                              label: "Duplicate",
                              pendingText: "Duplicating...",
                              onClick: duplicateTemplate,
                            },
                            {
                              key: "delete",
                              label: "Delete",
                              pendingText: "Deleting...",
                              onClick: deleteTemplate,
                            },
                            ...(hasPublishedVersion
                              ? [
                                  {
                                    key: "restore",
                                    label: "Restore",
                                    pendingText: "Restoring...",
                                    onClick: restorePreviousVersion,
                                  },
                                ]
                              : []),
                          ]
                        : []),
                    ]}
                  />
                  {canEditActiveTemplate ? (
                    <AsyncButton
                      size="sm"
                      onClick={saveTemplate}
                      pendingText="Saving..."
                    >
                      Save
                    </AsyncButton>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showTemplateValidationIssues ? (
                <Card variant="destructive">
                  <CardHeader>
                    <CardTitle className="text-sm">Validation issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {templateValidationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {docxErrors.errors.length > 0 ? (
                <Card variant="destructive">
                  <CardHeader>
                    <CardTitle className="text-sm">
                      DOCX validation issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {docxErrors.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {route.view === "json" ? (
                <StatementTemplateJsonView />
              ) : (
                <StatementTemplateSimpleView />
              )}
            </CardContent>
          </Card>
        </SidebarContent>
      </SidebarWrapper>
    </section>
  );
}
