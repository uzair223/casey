"use client";

import { useEffect, useMemo, useState } from "react";

import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CaseConfig } from "@/types";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RhfField } from "@/components/ui/rhf-field";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserProtected } from "@/contexts/user-context";
import { CaseSchema } from "@/lib/schema/case";
import { getRoleLabel } from "@/lib/utils";
import { listFavouriteCaseTemplatesForCaseCreation } from "@/lib/supabase/queries";
import { createCase } from "@/lib/supabase/mutations";
import type { CaseTemplate } from "@/types";
import { useTenant } from "@/contexts/tenant-context";

type CreateCaseFormProps = {
  onClose: () => unknown;
  onCreated: () => unknown;
};

export function CreateCaseForm({ onClose, onCreated }: CreateCaseFormProps) {
  const { user } = useUserProtected(["tenant_admin", "solicitor", "paralegal"]);
  const { team } = useTenant();

  const [availableCaseTemplates, setAvailableCaseTemplates] = useState<
    CaseTemplate[]
  >([]);

  const formMethods = useForm<CaseSchema>({
    resolver: zodResolver(CaseSchema),
    defaultValues: {
      title: "",
      case_template_id: null,
      case_metadata: {},
      assigned_to_ids: [],
      status: "draft",
    },
  });

  const selectedAssignees =
    useWatch({ control: formMethods.control, name: "assigned_to_ids" }) || [];
  const selectedStatus = useWatch({
    control: formMethods.control,
    name: "status",
  });
  const selectedCaseTemplateId = useWatch({
    control: formMethods.control,
    name: "case_template_id",
  });

  const selectedCaseTemplate = useMemo(
    () =>
      availableCaseTemplates.find(
        (template) => template.id === selectedCaseTemplateId,
      ) ?? null,
    [availableCaseTemplates, selectedCaseTemplateId],
  );

  const selectedCaseTemplateConfig: CaseConfig =
    selectedCaseTemplate?.published_config ?? {
      dynamicFields: [],
    };

  useEffect(() => {
    const titleTemplate = selectedCaseTemplate?.title_template?.trim();
    if (!titleTemplate) {
      return;
    }

    formMethods.setValue("title", titleTemplate, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [
    formMethods,
    selectedCaseTemplate?.id,
    selectedCaseTemplate?.title_template,
  ]);

  useEffect(() => {
    if (!user?.tenant_id) return;

    listFavouriteCaseTemplatesForCaseCreation({
      tenantId: user.tenant_id,
    }).then((templates) => {
      setAvailableCaseTemplates(templates);
      const preferredTemplateId = templates[0]?.id ?? null;
      formMethods.setValue("case_template_id", preferredTemplateId, {
        shouldDirty: false,
        shouldValidate: true,
      });
    });
  }, [formMethods, user?.tenant_id]);

  useEffect(() => {
    const templateFields = new Set(
      (selectedCaseTemplateConfig.dynamicFields ?? []).map((field) => field.id),
    );
    const currentMetadata = formMethods.getValues("case_metadata") ?? {};
    const nextMetadata = Object.fromEntries(
      Object.entries(currentMetadata).filter(([key]) =>
        templateFields.has(key),
      ),
    );

    for (const field of selectedCaseTemplateConfig.dynamicFields ?? []) {
      if (!(field.id in nextMetadata)) {
        nextMetadata[field.id] = null;
      }
    }

    formMethods.setValue("case_metadata", nextMetadata, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [formMethods, selectedCaseTemplateConfig.dynamicFields]);

  if (!user?.tenant_id) return null;

  const onSubmit: SubmitHandler<CaseSchema> = async (data) => {
    await createCase({
      tenant_id: user.tenant_id!,
      title: data.title,
      case_template_id: data.case_template_id ?? null,
      case_metadata:
        Object.fromEntries(
          Object.entries(data.case_metadata ?? {}).map(([key, value]) => [
            key,
            value == null || String(value).trim() === "" ? null : value,
          ]),
        ) ?? {},
      assigned_to_ids: data.assigned_to_ids ?? [],
      status: data.status,
    });
    await onCreated();
    onClose();
  };

  const toggleAssignee = (userId: string) => {
    const current = formMethods.getValues("assigned_to_ids") || [];
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    formMethods.setValue("assigned_to_ids", next, { shouldDirty: true });
  };

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <RhfField
            form={formMethods}
            name="title"
            controlId="case_title"
            label="Case name"
            registerOptions={{ required: true }}
            renderControl={(registration, required) => (
              <Input id="case_title" required={required} {...registration} />
            )}
          />

          <RhfField
            form={formMethods}
            name="status"
            controlId="case_status"
            label="Case status"
            registerOptions={{ required: true }}
            renderControl={(registration, required) => (
              <>
                <input
                  type="hidden"
                  id="case_status"
                  required={required}
                  {...registration}
                />
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => {
                    formMethods.setValue(
                      "status",
                      value as CaseSchema["status"],
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                >
                  <SelectTrigger aria-required={required}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="locked">Locked</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          />

          <RhfField
            form={formMethods}
            name="case_template_id"
            controlId="case_template_id"
            label="Case template"
            renderControl={(registration) => (
              <>
                <input type="hidden" id="case_template_id" {...registration} />
                <Select
                  value={selectedCaseTemplateId ?? "none"}
                  onValueChange={(value) => {
                    formMethods.setValue(
                      "case_template_id",
                      value === "none" ? null : value,
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select case template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template</SelectItem>
                    {availableCaseTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          />
        </div>

        {(selectedCaseTemplateConfig.dynamicFields ?? []).length > 0 ? (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Case template fields</p>
            <div className="grid gap-4 md:grid-cols-2">
              {selectedCaseTemplateConfig.dynamicFields.map((field) => {
                const fieldName = `case_metadata.${field.id}` as const;
                return (
                  <RhfField
                    key={field.id}
                    form={formMethods}
                    name={fieldName}
                    controlId={`case_metadata_${field.id}`}
                    label={field.label}
                    registerOptions={{ required: !!field.required }}
                    renderControl={(registration, required) => (
                      <Input
                        id={`case_metadata_${field.id}`}
                        type={
                          field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        placeholder={field.placeholder}
                        required={required}
                        {...registration}
                      />
                    )}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-2 rounded-md border p-3">
          <Label>
            Assigned Team Members{" "}
            <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Select one or more team members to own this case.
          </p>
          <ScrollArea>
            <div className="grid max-h-48 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {team.data.members.map((member) => (
                <label
                  key={member.user_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedAssignees.includes(member.user_id)}
                    onChange={() => toggleAssignee(member.user_id)}
                  />
                  <span>
                    {member.display_name ? (
                      <>
                        {member.display_name}{" "}
                        <span className="text-muted-foreground">
                          {member.email}
                        </span>
                      </>
                    ) : (
                      member.email
                    )}
                    &emsp;
                    <span className="text-xs">
                      {member.role ? ` (${getRoleLabel(member.role)})` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex gap-2">
          <AsyncButton type="submit" pendingText="Creating...">
            Create case
          </AsyncButton>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
