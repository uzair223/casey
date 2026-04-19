"use client";

import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { PencilIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import type { CaseConfig } from "@/types";

const EMPTY_CASE_CONFIG: CaseConfig = {
  dynamicFields: [],
};

export function CaseTemplateSimpleView() {
  const [templateSearch, setTemplateSearch] = useState("");

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

  const sortedStatementTemplates = useMemo(
    () =>
      [...statementTemplates].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [statementTemplates],
  );

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
      <div className="grid gap-2">
        <p className="text-sm font-medium">Template Name</p>
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          disabled={!canEditActiveTemplate}
          placeholder="Case template name"
        />
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Case Title Template</p>
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

      <DynamicFieldsEditor
        title="Case fields"
        description="Define fields, labels, and types for the case template."
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
              <Input
                value={field.label}
                placeholder="Field title"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...dynamicFields];
                  const used = new Set(
                    next.filter((_, i) => i !== index).map((item) => item.id),
                  );
                  next[index] = {
                    ...next[index],
                    label: event.target.value,
                    id: uniqueSlug(
                      slugify(event.target.value || "", "field"),
                      used,
                    ),
                  };
                  updateDynamicFields(next);
                }}
              />

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
            </div>
          );
        }}
        onChange={(next) => {
          updateDynamicFields(next);
        }}
      />

      <div className="space-y-3 rounded-md border p-3">
        <p className="text-sm font-medium">Allowed statement templates</p>
        <p className="text-xs text-muted-foreground">
          Select witness templates available for this case template and choose
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
              Some selected statement templates reference case fields that are
              not defined.
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
              !canEditActiveTemplate || linkedStatementTemplateIds.length === 0
            }
            onValueChange={(value) => {
              setDefaultStatementTemplateId(value === "none" ? null : value);
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
    </div>
  );
}
