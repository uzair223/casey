"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Controller,
  get,
  useFormContext,
  useFormState,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DelimitedTextareaField, Textarea } from "@/components/ui/textarea";
import {
  DraggablePanel,
  DraggablePanelContent,
  DraggablePanelHeader,
} from "@/components/ui/draggable-panel";
import type {
  StatementConfig,
  StatementMetadataFieldConfig,
  StatementPhaseConfig,
  StatementSectionConfig,
} from "@/types";
import { cn, slugify, uniqueSlug } from "@/lib/utils";
import { DynamicFieldsEditor } from "../shared/dynamic-fields-editor";
import { useStatementTemplateSettings } from "./context";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import { materializePendingPatch } from "@/lib/diff-utils";

export function StatementTemplateSimpleView() {
  const {
    isBusy,
    draftName,
    draftNameValidationError,
    setDraftName,
    resetConfig,
    setEditorTab,
    activeTemplateId,
    pendingAiPatchDiffs,
    applyPendingAiPatch,
    discardPendingAiPatch,
    applyPendingAiPatchPath,
    discardPendingAiPatchPath,
    pendingAiPatch,
  } = useStatementTemplateSettings();
  const { control, setValue } = useFormContext<StatementConfig>();

  const draftConfig = (useWatch({ control }) ??
    EMPTY_STATEMENT_CONFIG) as StatementConfig;
  const pendingConfig = pendingAiPatch
    ? materializePendingPatch(draftConfig, pendingAiPatch)
    : null;
  const { errors } = useFormState({ control });
  const [touchedTemplateNameKey, setTouchedTemplateNameKey] = useState<
    string | null
  >(null);
  const [activeDiffIndex, setActiveDiffIndex] = useState(0);
  const currentTemplateTouchKey = activeTemplateId ?? "__new__";
  const boundedActiveDiffIndex =
    pendingAiPatchDiffs.length === 0
      ? 0
      : Math.min(activeDiffIndex, pendingAiPatchDiffs.length - 1);
  const activeDiff = pendingAiPatchDiffs[boundedActiveDiffIndex] ?? null;

  const scrollToDiffPath = useCallback((path: string) => {
    if (typeof document === "undefined") {
      return;
    }

    const tryPath = (candidate: string) =>
      document.querySelector<HTMLElement>(
        `[data-ai-patch-path="${candidate}"]`,
      );

    let candidate = path;
    let element = tryPath(candidate);
    while (!element && candidate.includes(".")) {
      candidate = candidate.slice(0, candidate.lastIndexOf("."));
      element = tryPath(candidate);
    }

    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.classList.add("ring-2", "ring-ring", "ring-offset-2");
    window.setTimeout(() => {
      element?.classList.remove("ring-2", "ring-ring", "ring-offset-2");
    }, 1200);
  }, []);

  useEffect(() => {
    if (!activeDiff) {
      return;
    }

    scrollToDiffPath(activeDiff.path);
  }, [activeDiff, scrollToDiffPath]);

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

  const formatDiffValue = (value: unknown) => {
    if (value === undefined) return "";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const getDiffEntry = (path: string) =>
    pendingAiPatchDiffs.find((diff) => diff.path === path) ?? null;

  const getBranchDiffEntry = (path: string) => {
    const exact = getDiffEntry(path);
    if (exact) {
      return exact;
    }

    const matchingDiffs = pendingAiPatchDiffs.filter(
      (diff) => diff.path === path || diff.path.startsWith(`${path}.`),
    );

    if (matchingDiffs.length === 0) {
      return null;
    }

    const current = matchingDiffs.find(
      (diff) => diff.status !== "added",
    )?.current;
    const proposed = matchingDiffs.find(
      (diff) => diff.status !== "removed",
    )?.proposed;

    if (matchingDiffs.every((diff) => diff.status === "removed")) {
      return { path, current, proposed, status: "removed" as const };
    }

    if (matchingDiffs.every((diff) => diff.status === "added")) {
      return { path, current, proposed, status: "added" as const };
    }

    return { path, current, proposed, status: "modified" as const };
  };

  const getBranchDiffStatus = (path: string) => {
    const matchingDiffs = pendingAiPatchDiffs.filter(
      (diff) => diff.path === path || diff.path.startsWith(`${path}.`),
    );

    if (matchingDiffs.some((diff) => diff.status === "removed")) {
      return "removed";
    }

    if (matchingDiffs.some((diff) => diff.status === "added")) {
      return "added";
    }

    if (matchingDiffs.some((diff) => diff.status === "modified")) {
      return "modified";
    }

    return null;
  };

  const getDiffBorderClass = (status: string | null) => {
    switch (status) {
      case "added":
        return "border-accent/70 bg-accent/5";
      case "removed":
        return "border-destructive/70 bg-destructive/5";
      case "modified":
        return "border-warning/70 bg-warning/5";
      default:
        return "border-border";
    }
  };

  const isActiveDiffPath = (path: string) => activeDiff?.path === path;

  const focusDiff = (nextIndex: number) => {
    if (pendingAiPatchDiffs.length === 0) {
      return;
    }

    const wrappedIndex =
      (nextIndex + pendingAiPatchDiffs.length) % pendingAiPatchDiffs.length;
    setActiveDiffIndex(wrappedIndex);
    scrollToDiffPath(pendingAiPatchDiffs[wrappedIndex].path);
  };

  const acceptCurrentDiff = () => {
    if (!activeDiff) {
      return;
    }

    void applyPendingAiPatchPath(activeDiff.path, activeDiff.status);
  };

  const declineCurrentDiff = () => {
    if (!activeDiff) {
      return;
    }

    discardPendingAiPatchPath(activeDiff.path);
  };

  const hasPendingDiffs = pendingAiPatchDiffs.length > 0;

  const renderAddedPreviewCards = <
    T extends
      | StatementMetadataFieldConfig
      | StatementPhaseConfig
      | StatementSectionConfig,
  >(
    basePath: "witness_metadata_fields" | "phases" | "sections",
    items: T[],
    renderContent: (item: T) => ReactNode,
  ) => {
    const currentCount =
      basePath === "witness_metadata_fields"
        ? draftConfig.witness_metadata_fields.length
        : basePath === "phases"
          ? draftConfig.phases.length
          : draftConfig.sections.length;
    const previewItems = items.slice(currentCount);

    if (previewItems.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3 rounded-md border border-accent/40 bg-accent/5 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="accent" className="uppercase tracking-wide">
            added
          </Badge>
          <span className="text-sm font-medium">
            Pending
            {basePath === "witness_metadata_fields"
              ? " witness metadata fields"
              : basePath === "phases"
                ? " phases"
                : " sections"}
          </span>
        </div>

        {previewItems.map((item, offset) => {
          const index = currentCount + offset;
          const path = `${basePath}.${index}`;

          return (
            <div
              key={path}
              className="space-y-3 rounded-md border border-accent/70 bg-background p-3"
              data-ai-patch-path={path}
              data-ai-patch-status="added"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="accent" className="uppercase tracking-wide">
                    added
                  </Badge>
                  <span className="text-sm font-medium">
                    {basePath === "witness_metadata_fields"
                      ? "Metadata field"
                      : basePath === "phases"
                        ? "Phase"
                        : "Section"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    className="py-1"
                    size="sm"
                    variant="outline"
                    onClick={() => discardPendingAiPatchPath(path)}
                  >
                    Decline
                  </Button>
                  <Button
                    type="button"
                    className="py-1"
                    size="sm"
                    onClick={() => applyPendingAiPatchPath(path, "added")}
                    disabled={isBusy}
                  >
                    Accept
                  </Button>
                </div>
              </div>

              {renderContent(item)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderNativeDiffField = (
    path: string,
    label: string,
    node: ReactNode,
    controlType: "field" | "group" = "field",
  ) => {
    const diff = getDiffEntry(path);
    const status = diff?.status ?? null;
    if (!status) {
      return node;
    }

    const currentValue = diff?.current;
    const proposedValue = diff?.proposed;

    return (
      <div
        data-ai-patch-path={path}
        data-ai-patch-status={status}
        className={cn(
          "rounded-md border p-3",
          getDiffBorderClass(status),
          controlType === "group" && "space-y-3",
          isActiveDiffPath(path) && "ring-2 ring-ring ring-offset-2",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                status === "added"
                  ? "accent"
                  : status === "removed"
                    ? "destructive"
                    : "warning"
              }
              className="uppercase tracking-wide"
            >
              {status}
            </Badge>
            <span className="text-sm font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="py-1"
              size="sm"
              variant="outline"
              onClick={() => discardPendingAiPatchPath(path)}
            >
              Decline
            </Button>
            <Button
              type="button"
              className="py-1"
              size="sm"
              onClick={() => applyPendingAiPatchPath(path, status)}
              disabled={isBusy}
            >
              Accept
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Current
            </p>
            <pre className="overflow-x-auto rounded-md border p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
              {formatDiffValue(currentValue)}
            </pre>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Proposed
            </p>
            <pre className="overflow-x-auto rounded-md border border-warning p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
              {formatDiffValue(proposedValue)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const renderBranchDiffField = (
    path: string,
    label: string,
    node: ReactNode,
    controlType: "field" | "group" = "field",
  ) => {
    const diff = getBranchDiffEntry(path);
    const status = diff?.status ?? null;
    if (!status) {
      return node;
    }

    return (
      <div
        data-ai-patch-path={path}
        data-ai-patch-status={status}
        className={cn(
          "rounded-md border p-3",
          getDiffBorderClass(status),
          controlType === "group" && "space-y-3",
          isActiveDiffPath(path) && "ring-2 ring-ring ring-offset-2",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                status === "added"
                  ? "accent"
                  : status === "removed"
                    ? "destructive"
                    : "warning"
              }
              className="uppercase tracking-wide"
            >
              {status}
            </Badge>
            <span className="text-sm font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="py-1"
              size="sm"
              variant="outline"
              onClick={() => discardPendingAiPatchPath(path)}
            >
              Decline
            </Button>
            <Button
              type="button"
              className="py-1"
              size="sm"
              onClick={() => applyPendingAiPatchPath(path, status)}
              disabled={isBusy}
            >
              Accept
            </Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Current
            </p>
            <pre className="overflow-x-auto rounded-md border p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
              {formatDiffValue(diff?.current)}
            </pre>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Proposed
            </p>
            <pre className="overflow-x-auto rounded-md border border-warning p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
              {formatDiffValue(diff?.proposed)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const renderRemovedBlock = (
    path: string,
    label: string,
    content: ReactNode,
  ) => {
    const status = getBranchDiffStatus(path);
    if (status !== "removed") {
      return content;
    }

    return (
      <div className="space-y-3 rounded-md border border-destructive/70 bg-destructive/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="uppercase tracking-wide">
              removed
            </Badge>
            <span className="text-sm font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="py-1"
              size="sm"
              variant="outline"
              onClick={() => discardPendingAiPatchPath(path)}
            >
              Decline
            </Button>
            <Button
              type="button"
              className="py-1"
              size="sm"
              onClick={() => applyPendingAiPatchPath(path, "removed")}
              disabled={isBusy}
            >
              Accept
            </Button>
          </div>
        </div>

        {content}
      </div>
    );
  };

  const getItemOpen = (path: string) => !!getBranchDiffStatus(path);

  const getItemClassName = (path: string) => {
    const status = getBranchDiffStatus(path);
    if (!status) {
      return undefined;
    }

    return `${getDiffBorderClass(status)} border-2`;
  };

  return (
    <div className="space-y-4">
      {renderNativeDiffField(
        "name",
        "Template Name",
        <div className="grid gap-2">
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => setTouchedTemplateNameKey(currentTemplateTouchKey)}
            disabled={isBusy}
            placeholder="Template name"
          />
          {touchedTemplateNameKey === currentTemplateTouchKey &&
          draftNameValidationError ? (
            <p className="text-xs text-destructive">
              {draftNameValidationError}
            </p>
          ) : null}
        </div>,
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {renderNativeDiffField(
          "agents.chat",
          "Agent chat prompt",
          <div className="space-y-1">
            <Controller
              control={control}
              name="agents.chat"
              render={({ field }) => (
                <Textarea {...field} rows={5} disabled={isBusy} />
              )}
            />
            {errorMessage("agents.chat") ? (
              <p className="text-xs text-destructive">
                {errorMessage("agents.chat")}
              </p>
            ) : null}
          </div>,
        )}
        {renderNativeDiffField(
          "agents.formalize",
          "Agent formalize prompt",
          <div className="space-y-1">
            <Controller
              control={control}
              name="agents.formalize"
              render={({ field }) => (
                <Textarea {...field} rows={5} disabled={isBusy} />
              )}
            />
            {errorMessage("agents.formalize") ? (
              <p className="text-xs text-destructive">
                {errorMessage("agents.formalize")}
              </p>
            ) : null}
          </div>,
        )}
      </div>

      <DynamicFieldsEditor
        title="Witness metadata fields"
        description="Define metadata fields collected from the witness."
        fields={witnessFields}
        disabled={isBusy}
        addLabel="Add metadata field"
        getItemOpen={(_, index) =>
          getItemOpen(`witness_metadata_fields.${index}`)
        }
        getItemClassName={(_, index) =>
          getItemClassName(`witness_metadata_fields.${index}`)
        }
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
        headerActions={
          pendingAiPatchDiffs.some((diff) =>
            diff.path.startsWith("witness_metadata_fields"),
          ) ? (
            <Badge variant="outline">AI changes</Badge>
          ) : null
        }
        renderDropdown={(field, index) => {
          const basePath = `witness_metadata_fields.${index}`;
          const branchStatus = getBranchDiffStatus(basePath);

          if (branchStatus === "removed") {
            return renderRemovedBlock(
              basePath,
              "Metadata field",
              <div
                className="rounded-md border bg-background/80 p-3"
                data-ai-patch-path={basePath}
                data-ai-patch-status="removed"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  Current metadata field
                </p>
                <div className="mt-2 grid gap-1 text-sm">
                  <p>
                    <span className="font-medium">Title:</span> {field.label}
                  </p>
                  <p>
                    <span className="font-medium">Id:</span> {field.id}
                  </p>
                  <p>
                    <span className="font-medium">Description:</span>{" "}
                    {field.description || "No description"}
                  </p>
                  <p>
                    <span className="font-medium">Required on intake:</span>{" "}
                    {field.requiredOnIntake ? "Yes" : "No"}
                  </p>
                  <p>
                    <span className="font-medium">Required on create:</span>{" "}
                    {field.requiredOnCreate ? "Yes" : "No"}
                  </p>
                </div>
              </div>,
            );
          }

          if (branchStatus === "modified") {
            return renderBranchDiffField(
              basePath,
              "Metadata field",
              <div
                className="rounded-md border bg-background/80 p-3"
                data-ai-patch-path={basePath}
                data-ai-patch-status="modified"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  Proposed metadata field
                </p>
                <div className="mt-2 grid gap-1 text-sm">
                  <p>
                    <span className="font-medium">Title:</span> {field.label}
                  </p>
                  <p>
                    <span className="font-medium">Id:</span> {field.id}
                  </p>
                  <p>
                    <span className="font-medium">Description:</span>{" "}
                    {field.description || "No description"}
                  </p>
                  <p>
                    <span className="font-medium">Required on intake:</span>{" "}
                    {field.requiredOnIntake ? "Yes" : "No"}
                  </p>
                  <p>
                    <span className="font-medium">Required on create:</span>{" "}
                    {field.requiredOnCreate ? "Yes" : "No"}
                  </p>
                </div>
              </div>,
              "group",
            );
          }

          return (
            <div className="grid grid-cols-2 gap-2">
              {renderNativeDiffField(
                `${basePath}.label`,
                "Field title",
                <Input
                  value={field.label}
                  placeholder="Field title"
                  disabled={isBusy}
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
                />,
              )}

              {renderNativeDiffField(
                `${basePath}.id`,
                "Custom id",
                <Input
                  value={field.id}
                  placeholder="Custom id"
                  disabled={isBusy}
                  onChange={(event) => {
                    const next = [...witnessFields];
                    next[index] = {
                      ...next[index],
                      id: event.target.value,
                    };
                    updateWitnessMetadataFields(next);
                  }}
                />,
              )}

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

              {renderNativeDiffField(
                `${basePath}.description`,
                "Description",
                <Textarea
                  className="col-span-2"
                  value={field.description ?? ""}
                  placeholder="Description"
                  disabled={isBusy}
                  onChange={(event) => {
                    const next = [...witnessFields];
                    next[index] = {
                      ...next[index],
                      description: event.target.value,
                    };
                    updateWitnessMetadataFields(next);
                  }}
                />,
              )}

              {renderNativeDiffField(
                `${basePath}.requiredOnIntake`,
                "Required on intake",
                <label className="ml-1 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!field.requiredOnIntake}
                    disabled={isBusy}
                    onChange={(event) => {
                      const next = [...witnessFields];
                      next[index] = {
                        ...next[index],
                        requiredOnIntake: event.target.checked,
                      };
                      updateWitnessMetadataFields(next);
                    }}
                  />
                  Required on intake
                </label>,
              )}

              {renderNativeDiffField(
                `${basePath}.requiredOnCreate`,
                "Required on create",
                <label className="ml-6 inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!field.requiredOnCreate}
                    disabled={isBusy}
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
                </label>,
              )}
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
              requiredOnIntake: false,
              requiredOnCreate: false,
            },
          ]);
        }}
        onChange={updateWitnessMetadataFields}
      />

      {renderAddedPreviewCards(
        "witness_metadata_fields",
        pendingConfig?.witness_metadata_fields ?? [],
        (field) => (
          <div className="rounded-md border bg-background/80 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Generated metadata field
            </p>
            <div className="mt-2 grid gap-1 text-sm">
              <p>
                <span className="font-medium">Title:</span> {field.label}
              </p>
              <p>
                <span className="font-medium">Id:</span> {field.id}
              </p>
              <p>
                <span className="font-medium">Description:</span>{" "}
                {field.description || "No description"}
              </p>
              <p>
                <span className="font-medium">Required on intake:</span>{" "}
                {field.requiredOnIntake ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-medium">Required on create:</span>{" "}
                {field.requiredOnCreate ? "Yes" : "No"}
              </p>
            </div>
          </div>
        ),
      )}

      {renderBranchDiffField(
        "case_metadata_deps",
        "Case field dependencies",
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Add the case field keys used by this template.
          </p>
          <div className="space-y-2">
            {draftConfig.case_metadata_deps.map((dep, index) => (
              <div key={`case-metadata-dep-${index}`} className="flex gap-2">
                <Input
                  value={dep}
                  disabled={isBusy}
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
                  disabled={isBusy}
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
              disabled={isBusy}
              onClick={() => {
                updateCaseMetadataDeps([...draftConfig.case_metadata_deps, ""]);
              }}
            >
              Add case field dependency
            </Button>
          </div>
        </div>,
        "group",
      )}

      <DynamicFieldsEditor
        title="Interview phases"
        description="Define the ordered flow of the statement interview."
        fields={phaseFields}
        disabled={isBusy}
        addLabel="Add phase"
        getItemOpen={(_, index) => getItemOpen(`phases.${index}`)}
        getItemClassName={(_, index) => getItemClassName(`phases.${index}`)}
        headerActions={
          pendingAiPatchDiffs.some((diff) => diff.path.startsWith("phases")) ? (
            <Badge variant="outline">AI changes</Badge>
          ) : null
        }
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
          const basePath = `phases.${index}`;
          const branchStatus = getBranchDiffStatus(basePath);
          if (branchStatus === "removed") {
            return renderRemovedBlock(
              basePath,
              "Phase",
              <div
                className="grid gap-2"
                data-ai-patch-path={basePath}
                data-ai-patch-status="removed"
              >
                <div className="rounded-md border bg-background/80 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Current phase
                  </p>
                  <div className="mt-2 grid gap-1 text-sm">
                    <p>
                      <span className="font-medium">Title:</span> {phase.title}
                    </p>
                    <p>
                      <span className="font-medium">Id:</span> {phase.id}
                    </p>
                    <p>
                      <span className="font-medium">Description:</span>{" "}
                      {phase.description || "No description"}
                    </p>
                    <p>
                      <span className="font-medium">Allowed topics:</span>{" "}
                      {JSON.stringify(phase.allowedTopics) || "None"}
                    </p>
                    <p>
                      <span className="font-medium">Forbidden topics:</span>{" "}
                      {JSON.stringify(phase.forbiddenTopics) || "None"}
                    </p>
                    <p>
                      <span className="font-medium">Completion criteria:</span>{" "}
                      {JSON.stringify(phase.completionCriteria) || "None"}
                    </p>
                    <p>
                      <span className="font-medium">Questioning mode:</span>{" "}
                      {phase.questioningMode || "Default"}
                    </p>
                  </div>
                </div>
              </div>,
            );
          }

          return (
            <div className="grid grid-cols-2 gap-2">
              {renderNativeDiffField(
                `${basePath}.title`,
                "Phase title",
                <Input
                  value={phase.title}
                  placeholder="Phase title"
                  disabled={isBusy}
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
                />,
              )}

              {renderNativeDiffField(
                `${basePath}.id`,
                "Custom id",
                <Input
                  value={phase.id}
                  placeholder="Custom id"
                  disabled={isBusy}
                  onChange={(event) => {
                    const next = [...draftConfig.phases];
                    next[index] = {
                      ...next[index],
                      id: event.target.value,
                    };
                    updatePhases(next);
                  }}
                />,
              )}

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

              {renderNativeDiffField(
                `${basePath}.description`,
                "Phase description",
                <Textarea
                  className="col-span-2"
                  rows={2}
                  value={phase.description}
                  placeholder="Phase description"
                  disabled={isBusy}
                  onChange={(event) => {
                    const next = [...draftConfig.phases];
                    next[index] = {
                      ...next[index],
                      description: event.target.value,
                    };
                    updatePhases(next);
                  }}
                />,
              )}

              {renderBranchDiffField(
                `${basePath}.allowedTopics`,
                "Allowed topics",
                <DelimitedTextareaField
                  className="col-span-2"
                  value={
                    (getBranchDiffEntry(`${basePath}.allowedTopics`)
                      ?.proposed as string[] | null) ?? phase.allowedTopics
                  }
                  placeholder="Allowed topics (one per line)"
                  disabled={isBusy}
                  onCommit={(nextValue) => {
                    const next = [...draftConfig.phases];
                    next[index] = {
                      ...next[index],
                      allowedTopics: nextValue,
                    };
                    updatePhases(next);
                  }}
                />,
              )}

              {renderBranchDiffField(
                `${basePath}.forbiddenTopics`,
                "Forbidden topics",
                <DelimitedTextareaField
                  className="col-span-2"
                  value={
                    (getBranchDiffEntry(`${basePath}.forbiddenTopics`)
                      ?.proposed as string[] | null) ?? phase.forbiddenTopics
                  }
                  placeholder="Forbidden topics (one per line)"
                  disabled={isBusy}
                  onCommit={(nextValue) => {
                    const next = [...draftConfig.phases];
                    next[index] = {
                      ...next[index],
                      forbiddenTopics: nextValue,
                    };
                    updatePhases(next);
                  }}
                />,
              )}

              {renderBranchDiffField(
                `${basePath}.completionCriteria`,
                "Completion criteria",
                <DelimitedTextareaField
                  className="col-span-2"
                  value={
                    (getBranchDiffEntry(`${basePath}.completionCriteria`)
                      ?.proposed as string[] | null) ?? phase.completionCriteria
                  }
                  placeholder="Completion criteria (one per line)"
                  disabled={isBusy}
                  onCommit={(nextValue) => {
                    const next = [...draftConfig.phases];
                    next[index] = {
                      ...next[index],
                      completionCriteria: nextValue,
                    };
                    updatePhases(next);
                  }}
                />,
              )}

              <div className="col-span-2 grid gap-1">
                <p className="text-xs text-muted-foreground">
                  Questioning mode
                </p>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={phase.questioningMode ?? ""}
                  disabled={isBusy}
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
                          : null,
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
              allowedTopics: null,
              forbiddenTopics: null,
              completionCriteria: null,
              questioningMode: null,
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
                : null,
              forbiddenTopics: phase.forbiddenTopics
                ?.map((item) => item.trim())
                .filter(Boolean).length
                ? phase.forbiddenTopics
                    ?.map((item) => item.trim())
                    .filter(Boolean)
                : null,
              completionCriteria: phase.completionCriteria
                ?.map((item) => item.trim())
                .filter(Boolean).length
                ? phase.completionCriteria
                    ?.map((item) => item.trim())
                    .filter(Boolean)
                : null,
              questioningMode: phase.questioningMode,
            })),
          );
        }}
      />

      {renderAddedPreviewCards(
        "phases",
        pendingConfig?.phases ?? [],
        (phase) => (
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-md border bg-background/80 p-3 md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">
                Generated phase
              </p>
              <div className="mt-2 grid gap-1 text-sm">
                <p>
                  <span className="font-medium">Title:</span> {phase.title}
                </p>
                <p>
                  <span className="font-medium">Id:</span> {phase.id}
                </p>
                <p>
                  <span className="font-medium">Description:</span>{" "}
                  {phase.description || "No description"}
                </p>
                <p>
                  <span className="font-medium">Allowed topics:</span>{" "}
                  {JSON.stringify(phase.allowedTopics) || "None"}
                </p>
                <p>
                  <span className="font-medium">Forbidden topics:</span>{" "}
                  {JSON.stringify(phase.forbiddenTopics) || "None"}
                </p>
                <p>
                  <span className="font-medium">Completion criteria:</span>{" "}
                  {JSON.stringify(phase.completionCriteria) || "None"}
                </p>
                <p>
                  <span className="font-medium">Questioning mode:</span>{" "}
                  {phase.questioningMode || "Default"}
                </p>
              </div>
            </div>
          </div>
        ),
      )}

      <Button
        type="button"
        variant="outline"
        disabled={isBusy || phaseCount === 0}
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
        disabled={isBusy}
        addLabel="Add section"
        getItemOpen={(_, index) => getItemOpen(`sections.${index}`)}
        getItemClassName={(_, index) => getItemClassName(`sections.${index}`)}
        headerActions={
          pendingAiPatchDiffs.some((diff) =>
            diff.path.startsWith("sections"),
          ) ? (
            <Badge variant="outline">AI changes</Badge>
          ) : null
        }
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
          const basePath = `sections.${index}`;
          const branchStatus = getBranchDiffStatus(basePath);
          if (branchStatus === "removed") {
            return renderRemovedBlock(
              basePath,
              "Section",
              <div
                className="rounded-md border bg-background/80 p-3"
                data-ai-patch-path={basePath}
                data-ai-patch-status="removed"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  Current section
                </p>
                <div className="mt-2 grid gap-1 text-sm">
                  <p>
                    <span className="font-medium">Title:</span> {section.title}
                  </p>
                  <p>
                    <span className="font-medium">Id:</span> {section.id}
                  </p>
                  <p>
                    <span className="font-medium">Description:</span>{" "}
                    {section.description || "No description"}
                  </p>
                </div>
              </div>,
            );
          }

          return (
            <div className="grid grid-cols-2 gap-2">
              {renderNativeDiffField(
                `${basePath}.title`,
                "Title",
                <Input
                  value={section.title}
                  placeholder="Title"
                  disabled={isBusy}
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
                              next
                                .filter((_, i) => i !== index)
                                .map((s) => s.id),
                            ),
                          )
                        : section.id,
                    };
                    updateSections(next);
                  }}
                />,
              )}

              {renderNativeDiffField(
                `${basePath}.id`,
                "Custom id",
                <Input
                  value={section.id}
                  placeholder="Custom id"
                  disabled={isBusy}
                  onChange={(event) => {
                    const next = [...draftConfig.sections];
                    next[index] = {
                      ...next[index],
                      id: event.target.value,
                    };
                    updateSections(next);
                  }}
                />,
              )}

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

              {renderNativeDiffField(
                `${basePath}.description`,
                "Description",
                <Textarea
                  className="col-span-2"
                  value={section.description ?? ""}
                  placeholder="Description"
                  disabled={isBusy}
                  onChange={(event) => {
                    const next = [...draftConfig.sections];
                    next[index] = {
                      ...next[index],
                      description: event.target.value,
                    };
                    updateSections(next);
                  }}
                />,
              )}

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
              id: uniqueSlug("newSection", new Set(next.map((s) => s.id))),
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
              description: section.description?.trim() || null,
            })),
          );
        }}
      />

      {renderAddedPreviewCards(
        "sections",
        pendingConfig?.sections ?? [],
        (section) => (
          <div className="rounded-md border bg-background/80 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Generated section
            </p>
            <div className="mt-2 grid gap-1 text-sm">
              <p>
                <span className="font-medium">Title:</span> {section.title}
              </p>
              <p>
                <span className="font-medium">Id:</span> {section.id}
              </p>
              <p>
                <span className="font-medium">Description:</span>{" "}
                {section.description || "No description"}
              </p>
            </div>
          </div>
        ),
      )}

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
          disabled={isBusy}
        >
          Reset config
        </Button>
      </div>

      <DraggablePanel open={hasPendingDiffs}>
        <DraggablePanelContent
          className="z-150 w-[min(92vw,360px)] rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur"
          initialTop={120}
        >
          <DraggablePanelHeader className="-mx-3 -mt-3 mb-3 rounded-t-2xl px-3 py-2">
            <div className="flex w-full items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Pending changes
                </p>
                <p className="text-sm font-semibold">
                  {boundedActiveDiffIndex + 1} / {pendingAiPatchDiffs.length}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => focusDiff(boundedActiveDiffIndex - 1)}
                  aria-label="Previous change"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => focusDiff(boundedActiveDiffIndex + 1)}
                  aria-label="Next change"
                >
                  ↓
                </Button>
              </div>
            </div>
          </DraggablePanelHeader>

          {activeDiff ? (
            <div className="mt-3 rounded-lg border bg-muted/30 p-2">
              <p className="truncate text-sm font-medium">{activeDiff.path}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {activeDiff.status}
              </p>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={declineCurrentDiff}
              size="sm"
            >
              Decline
            </Button>
            <Button type="button" onClick={acceptCurrentDiff} size="sm">
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => discardPendingAiPatch()}
              size="sm"
            >
              Decline all
            </Button>
            <Button
              type="button"
              onClick={() => applyPendingAiPatch()}
              size="sm"
            >
              Accept all
            </Button>
          </div>
        </DraggablePanelContent>
      </DraggablePanel>
    </div>
  );
}
