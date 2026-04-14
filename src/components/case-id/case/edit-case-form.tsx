"use client";

import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { CaseSchema } from "@/lib/schema/case";
import { getRoleLabel } from "@/lib/utils";
import { updateCase } from "@/lib/supabase/mutations";
import type { Case, CaseConfig } from "@/types";
import { useTenant } from "@/contexts/tenant-context";

type EditCaseFormProps = {
  caseData: Case;
  caseTemplateConfig?: CaseConfig | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export function EditCaseForm(props: EditCaseFormProps) {
  const { caseData, caseTemplateConfig, onClose, onSaved } = props;
  const { team } = useTenant();

  const formMethods = useForm<
    CaseSchema & {
      case_metadata?: Record<string, string | number | null | undefined>;
    }
  >({
    resolver: zodResolver(CaseSchema),
    defaultValues: {
      title: caseData.title ?? "",
      incident_date: caseData.incident_date ?? "",
      assigned_to_ids:
        caseData.assigned_to_ids ??
        (caseData.assigned_to ? [caseData.assigned_to] : []),
      status: (caseData.status as CaseSchema["status"]) || "draft",
      case_metadata: caseData.case_metadata ?? {},
    },
  });

  const selectedAssignees =
    useWatch({
      control: formMethods.control,
      name: "assigned_to_ids",
    }) || [];
  const selectedStatus = useWatch({
    control: formMethods.control,
    name: "status",
  });

  const onSubmit: SubmitHandler<
    CaseSchema & {
      case_metadata?: Record<string, string | number | null | undefined>;
    }
  > = async (data) => {
    await updateCase(caseData.id, {
      title: data.title,
      incident_date: data.incident_date || null,
      assigned_to_ids: data.assigned_to_ids ?? [],
      status: data.status,
      case_metadata: data.case_metadata ?? {},
    });
    await onSaved();
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
            name="incident_date"
            controlId="case_incident_date"
            label="Incident date"
            renderControl={(registration, required) => (
              <Input
                id="case_incident_date"
                type="date"
                required={required}
                {...registration}
              />
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
        </div>
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
        {/* Dynamic case metadata fields */}
        {caseTemplateConfig?.dynamicFields?.length ? (
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold mb-2">Case metadata</h3>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              {caseTemplateConfig.dynamicFields.map((field) => (
                <RhfField
                  key={field.id}
                  form={formMethods}
                  name={
                    `case_metadata.${field.id}` as `case_metadata.${string}`
                  }
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
                      required={required}
                      placeholder={field.placeholder}
                      {...registration}
                    />
                  )}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2 pt-2">
          <AsyncButton type="submit" pendingText="Saving...">
            Save case
          </AsyncButton>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
