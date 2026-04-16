"use client";

import {
  Controller,
  get,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  StatementConfig,
  StatementMetadataFieldConfig,
  StatementPhaseConfig,
  StatementSectionConfig,
} from "@/types";
import { slugify, uniqueSlug } from "@/lib/utils";
import { DynamicFieldsEditor } from "../shared/dynamic-fields-editor";
import { useStatementTemplateSettings } from "./context";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";

export function StatementTemplateSimpleView() {
  const {
    canEditActiveTemplate,
    draftName,
    draftNameValidationError,
    setDraftName,
    resetConfig,
    setEditorTab,
  } = useStatementTemplateSettings();
  const { control, setValue } = useFormContext<StatementConfig>();

  const draftConfig = (useWatch({ control }) ??
    EMPTY_STATEMENT_CONFIG) as StatementConfig;
  const { errors } = useFormState({ control });

  const phaseCount = draftConfig.phases.length;
  const witnessFields: StatementMetadataFieldConfig[] =
    draftConfig.witness_metadata_fields;
  const phaseFields: StatementPhaseConfig[] = draftConfig.phases;
  const sectionFields: StatementSectionConfig[] = draftConfig.sections;

  const updatePhases = (next: StatementPhaseConfig[]) => {
    setValue("phases", next, { shouldDirty: true, shouldValidate: true });
  };

  const updateSections = (next: StatementSectionConfig[]) => {
    setValue("sections", next, { shouldDirty: true, shouldValidate: true });
  };

  const updateWitnessMetadataFields = (
    next: StatementConfig["witness_metadata_fields"],
  ) => {
    setValue("witness_metadata_fields", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const updateCaseMetadataDeps = (
    next: StatementConfig["case_metadata_deps"],
  ) => {
    setValue("case_metadata_deps", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const errorMessage = (path: string) => {
    const error = get(errors, path);
    return typeof error?.message === "string" ? error.message : null;
  };

  const isSectionIdAutoManaged = (title: string, currentId: string) => {
    const expectedId = slugify(title || "", "section");
    return !currentId || currentId === expectedId;
  };

  const isWitnessFieldIdAutoManaged = (title: string, currentId: string) => {
    const expectedId = slugify(title || "", "witnessField");
    return !currentId || currentId === expectedId;
  };

  const isPhaseIdAutoManaged = (title: string, currentId: string) => {
    const expectedId = slugify(title || "", "phase");
    return !currentId || currentId === expectedId;
  };

  const parseListValue = (
    value: string,
    separator: "newline" | "comma" = "newline",
  ): string[] | undefined => {
    const next = value
      .split(separator === "comma" ? "," : "\n")
      .map((item) => item.trim())
      .filter(Boolean);

    return next.length > 0 ? next : undefined;
  };

  const formatListValue = (
    value?: string[],
    separator: "newline" | "comma" = "newline",
  ): string => {
    if (!value || value.length === 0) {
      return "";
    }

    return value.join(separator === "comma" ? ", " : "\n");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <p className="text-sm font-medium">Template Name</p>
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          disabled={!canEditActiveTemplate}
          placeholder="Template name"
        />
        {draftNameValidationError ? (
          <p className="text-xs text-destructive">{draftNameValidationError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Agent chat prompt</p>
          <Controller
            control={control}
            name="agents.chat"
            render={({ field }) => (
              <div className="space-y-1">
                <Textarea
                  {...field}
                  rows={5}
                  disabled={!canEditActiveTemplate}
                />
                {errorMessage("agents.chat") ? (
                  <p className="text-xs text-destructive">
                    {errorMessage("agents.chat")}
                  </p>
                ) : null}
              </div>
            )}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Agent formalize prompt</p>
          <Controller
            control={control}
            name="agents.formalize"
            render={({ field }) => (
              <div className="space-y-1">
                <Textarea
                  {...field}
                  rows={5}
                  disabled={!canEditActiveTemplate}
                />
                {errorMessage("agents.formalize") ? (
                  <p className="text-xs text-destructive">
                    {errorMessage("agents.formalize")}
                  </p>
                ) : null}
              </div>
            )}
          />
        </div>
      </div>

      <DynamicFieldsEditor
        title="Witness metadata fields"
        description="Define metadata fields collected from the witness."
        fields={witnessFields}
        disabled={!canEditActiveTemplate}
        addLabel="Add metadata field"
        renderSummary={(field, index) => {
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {field.label || `Metadata field ${index + 1}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {field.description || "No description"}
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
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={field.label}
                placeholder="Field title"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...witnessFields];
                  const nextLabel = event.target.value;
                  const shouldAutoGenerateId = isWitnessFieldIdAutoManaged(
                    field.label,
                    field.id,
                  );
                  next[index] = {
                    ...next[index],
                    label: nextLabel,
                    id: shouldAutoGenerateId
                      ? uniqueSlug(
                          slugify(nextLabel || "", "witnessField"),
                          new Set(
                            next
                              .filter((_, i) => i !== index)
                              .map((item) => item.id),
                          ),
                        )
                      : field.id,
                  };
                  updateWitnessMetadataFields(next);
                }}
              />

              <Input
                value={field.id}
                placeholder="Custom id"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...witnessFields];
                  next[index] = {
                    ...next[index],
                    id: event.target.value,
                  };
                  updateWitnessMetadataFields(next);
                }}
              />

              {errorMessage(`witness_metadata_fields.${index}.id`) ? (
                <p className="text-xs text-destructive">
                  {errorMessage(`witness_metadata_fields.${index}.id`)}
                </p>
              ) : null}

              {errorMessage(`witness_metadata_fields.${index}.label`) ? (
                <p className="text-xs text-destructive">
                  {errorMessage(`witness_metadata_fields.${index}.label`)}
                </p>
              ) : null}

              <Textarea
                className="col-span-2"
                value={field.description ?? ""}
                placeholder="Description"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...witnessFields];
                  next[index] = {
                    ...next[index],
                    description: event.target.value,
                  };
                  updateWitnessMetadataFields(next);
                }}
              />

              <div>
                <label className="ml-1 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    disabled={!canEditActiveTemplate}
                    onChange={(event) => {
                      const next = [...witnessFields];
                      next[index] = {
                        ...next[index],
                        required: event.target.checked,
                      };
                      updateWitnessMetadataFields(next);
                    }}
                  />
                  Required on intake
                </label>

                <label className="ml-6 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!field.requiredOnCreate}
                    disabled={!canEditActiveTemplate}
                    onChange={(event) => {
                      const next = [...witnessFields];
                      next[index] = {
                        ...next[index],
                        requiredOnCreate: event.target.checked,
                      };
                      updateWitnessMetadataFields(next);
                    }}
                  />
                  Required on create
                </label>
              </div>
            </div>
          );
        }}
        onAdd={() => {
          updateWitnessMetadataFields([
            ...witnessFields,
            {
              label: "New metadata field",
              id: uniqueSlug(
                slugify("New metadata field", "witnessField"),
                new Set(witnessFields.map((field) => field.id)),
              ),
              description: "",
              required: false,
              requiredOnCreate: false,
            },
          ]);
        }}
        onChange={updateWitnessMetadataFields}
      />

      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Case field dependencies</p>
        <p className="text-xs text-muted-foreground">
          Add the case field keys used by this template.
        </p>
        <div className="space-y-2">
          {draftConfig.case_metadata_deps.map((dep, index) => (
            <div key={`case-metadata-dep-${index}`} className="flex gap-2">
              <Input
                value={dep}
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.case_metadata_deps];
                  next[index] = event.target.value;
                  updateCaseMetadataDeps(next);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditActiveTemplate}
                onClick={() => {
                  const next = draftConfig.case_metadata_deps.filter(
                    (_, i) => i !== index,
                  );
                  updateCaseMetadataDeps(next);
                }}
              >
                Remove
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEditActiveTemplate}
            onClick={() => {
              updateCaseMetadataDeps([...draftConfig.case_metadata_deps, ""]);
            }}
          >
            Add case field dependency
          </Button>
        </div>
      </div>

      <DynamicFieldsEditor
        title="Interview phases"
        description="Define the ordered flow of the statement interview."
        fields={phaseFields}
        disabled={!canEditActiveTemplate}
        addLabel="Add phase"
        renderSummary={(phase, index) => {
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {phase.title || `Phase ${index + 1}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {phase.description || "No description"}
                </p>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {phase.id || slugify(phase.title || "", "phase")}
              </p>
            </div>
          );
        }}
        renderDropdown={(phase, index) => {
          return (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={phase.title}
                placeholder="Phase title"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.phases];
                  const nextTitle = event.target.value;
                  const shouldAutoGenerateId = isPhaseIdAutoManaged(
                    phase.title,
                    phase.id,
                  );
                  const used = new Set(
                    next.filter((_, i) => i !== index).map((item) => item.id),
                  );

                  next[index] = {
                    ...next[index],
                    title: nextTitle,
                    id: shouldAutoGenerateId
                      ? uniqueSlug(slugify(nextTitle || "", "phase"), used)
                      : phase.id,
                  };

                  updatePhases(next);
                }}
              />

              <Input
                value={phase.id}
                placeholder="Custom id"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.phases];
                  next[index] = {
                    ...next[index],
                    id: event.target.value,
                  };
                  updatePhases(next);
                }}
              />

              {errorMessage(`phases.${index}.id`) ? (
                <p className="text-xs text-destructive">
                  {errorMessage(`phases.${index}.id`)}
                </p>
              ) : null}

              {errorMessage(`phases.${index}.title`) ? (
                <p className="text-xs text-destructive">
                  {errorMessage(`phases.${index}.title`)}
                </p>
              ) : null}

              <Textarea
                className="col-span-2"
                rows={2}
                value={phase.description}
                placeholder="Phase description"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.phases];
                  next[index] = {
                    ...next[index],
                    description: event.target.value,
                  };
                  updatePhases(next);
                }}
              />

              <Textarea
                className="col-span-2"
                rows={2}
                value={formatListValue(phase.allowedTopics, "comma")}
                placeholder="Allowed topics (comma-separated)"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.phases];
                  next[index] = {
                    ...next[index],
                    allowedTopics: parseListValue(event.target.value, "comma"),
                  };
                  updatePhases(next);
                }}
              />

              <Textarea
                className="col-span-2"
                rows={2}
                value={formatListValue(phase.forbiddenTopics, "comma")}
                placeholder="Forbidden topics (comma-separated)"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.phases];
                  next[index] = {
                    ...next[index],
                    forbiddenTopics: parseListValue(
                      event.target.value,
                      "comma",
                    ),
                  };
                  updatePhases(next);
                }}
              />

              <Textarea
                className="col-span-2"
                rows={2}
                value={formatListValue(phase.completionCriteria)}
                placeholder="Completion criteria (one per line)"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.phases];
                  next[index] = {
                    ...next[index],
                    completionCriteria: parseListValue(event.target.value),
                  };
                  updatePhases(next);
                }}
              />

              <div className="col-span-2 grid gap-1">
                <p className="text-xs text-muted-foreground">
                  Questioning mode
                </p>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={phase.questioningMode ?? ""}
                  disabled={!canEditActiveTemplate}
                  onChange={(event) => {
                    const next = [...draftConfig.phases];
                    const value = event.target.value;
                    next[index] = {
                      ...next[index],
                      questioningMode:
                        value === "narrative" ||
                        value === "structured" ||
                        value === "mixed"
                          ? value
                          : undefined,
                    };
                    updatePhases(next);
                  }}
                >
                  <option value="">Default</option>
                  <option value="narrative">Narrative</option>
                  <option value="structured">Structured</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
          );
        }}
        onAdd={() => {
          const next = draftConfig.phases;
          updatePhases([
            ...next,
            {
              title: "New phase",
              id: uniqueSlug(
                slugify("New phase", "phase"),
                new Set(next.map((phase) => phase.id)),
              ),
              description: "",
              allowedTopics: undefined,
              forbiddenTopics: undefined,
              completionCriteria: undefined,
              questioningMode: undefined,
            },
          ]);
        }}
        onChange={(next) => {
          updatePhases(
            next.map((phase) => ({
              id: phase.id,
              title: phase.title,
              description: phase.description ?? "",
              allowedTopics: phase.allowedTopics
                ?.map((item) => item.trim())
                .filter(Boolean).length
                ? phase.allowedTopics
                    ?.map((item) => item.trim())
                    .filter(Boolean)
                : undefined,
              forbiddenTopics: phase.forbiddenTopics
                ?.map((item) => item.trim())
                .filter(Boolean).length
                ? phase.forbiddenTopics
                    ?.map((item) => item.trim())
                    .filter(Boolean)
                : undefined,
              completionCriteria: phase.completionCriteria
                ?.map((item) => item.trim())
                .filter(Boolean).length
                ? phase.completionCriteria
                    ?.map((item) => item.trim())
                    .filter(Boolean)
                : undefined,
              questioningMode: phase.questioningMode,
            })),
          );
        }}
      />

      <Button
        type="button"
        variant="outline"
        disabled={!canEditActiveTemplate || phaseCount === 0}
        onClick={() => {
          const used = new Set<string>();
          const generatedSections: StatementSectionConfig[] =
            draftConfig.phases.map((phase) => ({
              id: uniqueSlug(slugify(phase.title || "", "section"), used),
              title: phase.title || "Untitled section",
              description: phase.description || "",
            }));

          updateSections(generatedSections);
        }}
      >
        Generate sections from phases
      </Button>

      <DynamicFieldsEditor
        title="Document sections"
        description="Define statement sections, including the section id, title and description."
        fields={sectionFields}
        disabled={!canEditActiveTemplate}
        addLabel="Add section"
        renderSummary={(section, index) => {
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {section.title || `Section ${index + 1}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {section.description || "No description"}
                </p>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {section.id || slugify(section.title || "", "section")}
              </p>
            </div>
          );
        }}
        renderDropdown={(section, index) => {
          return (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={section.title}
                placeholder="Title"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.sections];
                  const nextTitle = event.target.value;
                  const shouldAutoGenerateId = isSectionIdAutoManaged(
                    section.title,
                    section.id,
                  );
                  const generatedId = slugify(nextTitle || "", "section");
                  next[index] = {
                    ...next[index],
                    title: nextTitle,
                    id: shouldAutoGenerateId
                      ? uniqueSlug(
                          generatedId,
                          new Set(
                            next.filter((_, i) => i !== index).map((s) => s.id),
                          ),
                        )
                      : section.id,
                  };
                  updateSections(next);
                }}
              />

              <Input
                value={section.id}
                placeholder="Custom id"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.sections];
                  next[index] = {
                    ...next[index],
                    id: event.target.value,
                  };
                  updateSections(next);
                }}
              />

              {errorMessage(`sections.${index}.id`) ? (
                <p className="text-xs text-destructive">
                  {errorMessage(`sections.${index}.id`)}
                </p>
              ) : null}

              {errorMessage(`sections.${index}.title`) ? (
                <p className="text-xs text-destructive">
                  {errorMessage(`sections.${index}.title`)}
                </p>
              ) : null}

              <Textarea
                className="col-span-2"
                value={section.description ?? ""}
                placeholder="Description"
                disabled={!canEditActiveTemplate}
                onChange={(event) => {
                  const next = [...draftConfig.sections];
                  next[index] = {
                    ...next[index],
                    description: event.target.value,
                  };
                  updateSections(next);
                }}
              />

              {errorMessage(`sections.${index}.description`) ? (
                <p className="text-xs text-destructive">
                  {errorMessage(`sections.${index}.description`)}
                </p>
              ) : null}
            </div>
          );
        }}
        onAdd={() => {
          const next = draftConfig.sections;
          updateSections([
            ...next,
            {
              id: uniqueSlug("new-section", new Set(next.map((s) => s.id))),
              title: "New Section",
              description: "",
            },
          ]);
        }}
        onChange={(next) => {
          updateSections(
            next.map((section) => ({
              id: section.id,
              title: section.title,
              description: section.description?.trim() || undefined,
            })),
          );
        }}
      />

      <div className="flex items-center gap-2 rounded-md border p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditorTab("json")}
        >
          Open JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={resetConfig}
          disabled={!canEditActiveTemplate}
        >
          Reset config
        </Button>
      </div>
    </div>
  );
}
