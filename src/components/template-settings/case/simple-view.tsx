"use client";

import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { PencilIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { slugify, uniqueSlug } from "@/lib/utils";
import { DynamicFieldsEditor } from "../shared/dynamic-fields-editor";
import { useCaseTemplateSettings } from "./context";
import {
  LEAD_TYPE_SECTIONS,
  useTemplateRoute,
} from "../shared/template-route";
import type { CaseConfig } from "@/types";

const EMPTY_CASE_CONFIG: CaseConfig = {
  dynamicFields: [],
};

function otherFieldIds(fields: CaseConfig["dynamicFields"], index: number) {
  return (fields ?? [])
    .filter((_, itemIndex) => itemIndex !== index)
    .map((item) => item.id);
}

function generatedFieldId(label: string, otherIds: string[]) {
  return uniqueSlug(slugify(label || "", "field"), new Set(otherIds));
}

function normalizeFieldId(value: string, otherIds: string[], finalize = false) {
  if (!finalize && /[\s_-]$/.test(value)) return value;

  const trimmed = value.trim();
  if (!trimmed) return "";

  const safe = /^[A-Za-z][A-Za-z0-9]*$/.test(trimmed)
    ? trimmed
    : slugify(trimmed, "field");

  return uniqueSlug(safe, new Set(otherIds));
}

export function CaseTemplateSimpleView() {
  const [templateSearch, setTemplateSearch] = useState("");
  const route = useTemplateRoute(LEAD_TYPE_SECTIONS, "basics");
  const section = route.section;

  const {
    canEditActiveTemplate,
    draftName,
    setDraftName,
    draftTitleTemplate,
    setDraftTitleTemplate,
    statementTemplates,
    linkedStatementTemplateIds,
    defaultStatementTemplateId,
    depsWarningsByTemplateId,
    selectedDepsWarnings,
    setLinkedStatementTemplateIds,
    setDefaultStatementTemplateId,
    addDynamicField,
  } = useCaseTemplateSettings();
  const { control, setValue } = useFormContext<CaseConfig>();

  const draftConfig =
    (useWatch({ control }) as CaseConfig | undefined) ?? EMPTY_CASE_CONFIG;

  const dynamicFields = draftConfig.dynamicFields ?? [];

  const sortedStatementTemplates = useMemo(() => {
    const scopeOrder = { tenant: 0, global: 1 } as const;

    return [...statementTemplates].sort((a, b) => {
      const scopeDiff =
        scopeOrder[a.template_scope] - scopeOrder[b.template_scope];
      if (scopeDiff !== 0) {
        return scopeDiff;
      }

      return a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });
    });
  }, [statementTemplates]);

  const filteredStatementTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();

    return sortedStatementTemplates.filter((template) =>
      query.length === 0 ? true : template.name.toLowerCase().includes(query),
    );
  }, [sortedStatementTemplates, templateSearch]);

  const updateDynamicFields = (next: CaseConfig["dynamicFields"]) => {
    setValue("dynamicFields", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={section}
        onValueChange={(value) =>
          route.setSection(value as typeof section)
        }
      >
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="basics" className="space-y-4 pt-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Template Name</p>
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              disabled={!canEditActiveTemplate}
              placeholder="Lead type name"
            />
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Lead title template</p>
            <Input
              value={draftTitleTemplate}
              onChange={(event) => setDraftTitleTemplate(event.target.value)}
              disabled={!canEditActiveTemplate}
              placeholder="Case {caseIndex}"
            />
            <p className="text-xs text-muted-foreground">
              Supports placeholders like {"{caseIndex}"} and case field ids (for
              example {"{claimant}"}, {"{defendant}"}).
            </p>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-medium">Matter brief</p>
            <Textarea
              rows={4}
              value={draftConfig.matterBrief ?? ""}
              disabled={!canEditActiveTemplate}
              placeholder="What kind of matter this is, and the facts a reviewer should keep in mind."
              onChange={(event) => {
                const next = event.target.value;
                setValue("matterBrief", next.trim() ? next : null, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Shared background for facts and gaps, and for accounts on this
              lead type. It does not replace the account template&apos;s model
              identity.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="fields" className="pt-4">
          <DynamicFieldsEditor
            title="Lead type fields"
            description="Define fields, labels, and types. The description is shown to the models beside the saved value."
            fields={dynamicFields}
            disabled={!canEditActiveTemplate}
            addLabel="Add field"
            onAdd={addDynamicField}
            renderSummary={(field, index) => {
              return (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {field.label || `Field ${index + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {field.type || "text"}
                    </p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {field.id}
                  </p>
                </div>
              );
            }}
            renderDropdown={(field, index) => {
              return (
                <div className="space-y-2">
                  <div className="grid gap-1">
                    <p className="text-xs font-medium">Label</p>
                    <Input
                      value={field.label}
                      placeholder="Field title"
                      aria-label="Field label"
                      disabled={!canEditActiveTemplate}
                      onChange={(event) => {
                        const next = [...dynamicFields];
                        const current = next[index];
                        const others = otherFieldIds(next, index);
                        const followsLabel =
                          current.id ===
                          generatedFieldId(current.label, others);
                        next[index] = {
                          ...current,
                          label: event.target.value,
                          id: followsLabel
                            ? generatedFieldId(event.target.value, others)
                            : current.id,
                        };
                        updateDynamicFields(next);
                      }}
                    />
                  </div>

                  <div className="grid gap-1">
                    <p className="text-xs font-medium">Id</p>
                    <Input
                      value={field.id}
                      placeholder="fieldId"
                      disabled={!canEditActiveTemplate}
                      aria-label="Field id"
                      onChange={(event) => {
                        const next = [...dynamicFields];
                        next[index] = {
                          ...next[index],
                          id: normalizeFieldId(
                            event.target.value,
                            otherFieldIds(next, index),
                          ),
                        };
                        updateDynamicFields(next);
                      }}
                      onBlur={(event) => {
                        const next = [...dynamicFields];
                        const id = normalizeFieldId(
                          event.target.value,
                          otherFieldIds(next, index),
                          true,
                        );
                        if (id === next[index]?.id) return;
                        next[index] = { ...next[index], id };
                        updateDynamicFields(next);
                      }}
                    />
                  </div>

                  <Select
                    value={field.type ?? "text"}
                    disabled={!canEditActiveTemplate}
                    onValueChange={(value) => {
                      const next = [...dynamicFields];
                      next[index] = {
                        ...next[index],
                        type: value as "text" | "number" | "date",
                      };
                      updateDynamicFields(next);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                    </SelectContent>
                  </Select>

                  <label className="ml-1 inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!field.required}
                      disabled={!canEditActiveTemplate}
                      onChange={(event) => {
                        const next = [...dynamicFields];
                        next[index] = {
                          ...next[index],
                          required: event.target.checked,
                        };
                        updateDynamicFields(next);
                      }}
                    />
                    Required
                  </label>

                  <Input
                    value={field.placeholder ?? ""}
                    placeholder="Placeholder"
                    disabled={!canEditActiveTemplate}
                    onChange={(event) => {
                      const next = [...dynamicFields];
                      next[index] = {
                        ...next[index],
                        placeholder: event.target.value,
                      };
                      updateDynamicFields(next);
                    }}
                  />

                  <Textarea
                    rows={2}
                    value={field.description ?? ""}
                    placeholder="What this fact is and why it matters"
                    disabled={!canEditActiveTemplate}
                    onChange={(event) => {
                      const next = [...dynamicFields];
                      const description = event.target.value.trim();
                      next[index] = {
                        ...next[index],
                        description: description || undefined,
                      };
                      updateDynamicFields(next);
                    }}
                  />
                </div>
              );
            }}
            onChange={(next) => {
              updateDynamicFields(next);
            }}
          />
        </TabsContent>
        <TabsContent value="accounts" className="pt-4">
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Allowed statement templates</p>
            <p className="text-xs text-muted-foreground">
              Select account templates available for this lead type and choose
              one default.
            </p>
            <Input
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Search statement templates..."
              className="h-8"
            />

            <div className="grid gap-2">
              {filteredStatementTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {statementTemplates.length === 0
                    ? "No published statement templates available."
                    : "No statement templates match your search."}
                </p>
              ) : (
                filteredStatementTemplates.map((template) => {
                  const isChecked = linkedStatementTemplateIds.includes(
                    template.id,
                  );
                  const missingDeps =
                    depsWarningsByTemplateId.get(template.id) ?? [];
                  return (
                    <div key={template.id} className="space-y-1">
                      <div className="flex items-center gap-1">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!canEditActiveTemplate}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...linkedStatementTemplateIds, template.id]
                                : linkedStatementTemplateIds.filter(
                                    (id) => id !== template.id,
                                  );

                              const unique = Array.from(new Set(next));
                              setLinkedStatementTemplateIds(unique);
                              if (
                                defaultStatementTemplateId === template.id &&
                                !event.target.checked
                              ) {
                                setDefaultStatementTemplateId(null);
                              }
                            }}
                          />
                          <span>{template.name}</span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                        >
                          <a
                            href={`/settings/statements?templateId=${encodeURIComponent(template.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Edit statement template ${template.name}`}
                            title="Open statement template settings"
                          >
                            <PencilIcon className="size-3.5" />
                          </a>
                        </Button>
                      </div>
                      {isChecked && missingDeps.length > 0 ? (
                        <p className="text-xs text-warning-foreground">
                          Warning: missing case fields for this template:{" "}
                          {missingDeps.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            {selectedDepsWarnings.length > 0 ? (
              <div className="rounded-md border border-warning bg-warning/10 p-3 text-sm text-warning-foreground">
                <p className="font-medium">
                  Some selected statement templates reference case fields that
                  are not defined.
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {selectedDepsWarnings.map((warning) => (
                    <li key={warning.templateName}>
                      {warning.templateName}: {warning.missing.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-1">
              <p className="text-sm font-medium">Default statement template</p>
              <Select
                value={defaultStatementTemplateId ?? "none"}
                disabled={
                  !canEditActiveTemplate ||
                  linkedStatementTemplateIds.length === 0
                }
                onValueChange={(value) => {
                  setDefaultStatementTemplateId(
                    value === "none" ? null : value,
                  );
                }}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sortedStatementTemplates
                    .filter((template) =>
                      linkedStatementTemplateIds.includes(template.id),
                    )
                    .map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <Button
        type="button"
        variant="outline"
        onClick={() => route.setView("json")}
      >
        JSON editor
      </Button>
    </div>
  );
}
