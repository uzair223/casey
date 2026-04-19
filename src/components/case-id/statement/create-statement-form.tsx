"use client";

import {
  FormProvider,
  SubmitHandler,
  type Resolver,
  useForm,
} from "react-hook-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RhfField } from "@/components/ui/rhf-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserProtected } from "@/contexts/user-context";
import {
  buildCreateWitnessSchema,
  type CreateWitnessFormData,
} from "@/lib/schema/witness-statement";
import { listAllowedStatementTemplatesForCaseTemplate } from "@/lib/supabase/queries";
import { createStatement } from "@/lib/supabase/mutations";
import { apiFetch } from "@/lib/api-utils";
import type { Case, StatementConfigTemplate } from "@/types";

type CreateStatementFormProps = {
  caseData: Case;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
};

export function CreateStatementForm({
  caseData,
  onClose: _onClose,
  onCreated,
}: CreateStatementFormProps) {
  const { user } = useUserProtected(["tenant_admin", "solicitor", "paralegal"]);
  const [stage, setStage] = useState<1 | 2>(1);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(
    null,
  );
  const [availableTemplates, setAvailableTemplates] = useState<
    StatementConfigTemplate[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const selectedTemplateRef = useRef<StatementConfigTemplate | null>(null);

  const selectedTemplate =
    availableTemplates.find((template) => template.id === selectedTemplateId) ??
    null;

  const selectedConfig = useMemo(
    () =>
      selectedTemplate?.published_config ??
      selectedTemplate?.draft_config ?? {
        id: "custom_template",
        name: "Template config",
        agents: { chat: "", formalize: "" },
        includeStatementOfTruth: true,
        phases: [],
        sections: [],
        witness_metadata_fields: [],
        case_metadata_deps: [],
        prompts: null,
      },
    [selectedTemplate],
  );

  const dynamicResolver = useCallback<Resolver<CreateWitnessFormData>>(
    async (values, context, options) => {
      const config =
        selectedTemplateRef.current?.published_config ??
        selectedTemplateRef.current?.draft_config ??
        selectedConfig;
      const schema = buildCreateWitnessSchema(config);

      return zodResolver(schema)(values, context, options);
    },
    [selectedConfig],
  );

  const formMethods = useForm<CreateWitnessFormData>({
    resolver: dynamicResolver,
    defaultValues: {
      witness_name: "",
      witness_email: "",
      witness_metadata: {},
      template_id: "",
    },
  });
  const witnessMetadataFields = selectedConfig.witness_metadata_fields ?? [];

  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
    if (selectedTemplate) {
      formMethods.setValue("template_id", selectedTemplate.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [selectedTemplate, formMethods]);

  useEffect(() => {
    let isCancelled = false;

    const loadTemplates = async () => {
      if (!user?.tenant_id) return;

      if (!caseData.case_template_id) {
        if (isCancelled) return;
        setAvailableTemplates([]);
        setSelectedTemplateId("");
        setTemplateLoadError(
          "This case is missing a case template. Assign a case template before creating a witness statement.",
        );
        setIsLoadingTemplates(false);
        return;
      }

      if (isCancelled) return;
      setIsLoadingTemplates(true);
      setTemplateLoadError(null);

      try {
        const templates = await listAllowedStatementTemplatesForCaseTemplate({
          tenantId: user.tenant_id,
          caseTemplateId: caseData.case_template_id,
        });

        if (isCancelled) return;

        setAvailableTemplates(templates);
        if (templates.length === 0) {
          setTemplateLoadError(
            "No statement templates are mapped to this case template.",
          );
        }

        const nextTemplateId = templates[0]?.id ?? "";
        setSelectedTemplateId(nextTemplateId);
        if (templates[0]) {
          formMethods.setValue("template_id", templates[0].id, {
            shouldDirty: false,
            shouldValidate: true,
          });
        }
      } catch (error) {
        if (isCancelled) return;
        setTemplateLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load templates for this case template.",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingTemplates(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      isCancelled = true;
    };
  }, [user?.tenant_id, formMethods, caseData.case_template_id]);

  const onClose = useCallback(() => {
    _onClose();
    formMethods.reset({
      witness_name: "",
      witness_email: "",
      witness_metadata: {},
      template_id: selectedTemplate?.id ?? "",
    });
    setStage(1);
  }, [_onClose, formMethods, selectedTemplate]);

  if (!user?.tenant_id) return null;
  if (isLoadingTemplates) return null;

  const onSubmit: SubmitHandler<CreateWitnessFormData> = async (data) => {
    if (!user.tenant_id) return;

    const normalizedMetadata = Object.fromEntries(
      witnessMetadataFields.map((field) => {
        const raw = data.witness_metadata?.[field.id];
        const value = typeof raw === "string" ? raw.trim() : "";
        return [field.id, value === "" ? null : value];
      }),
    );

    const created = await createStatement({
      case_id: caseData.id,
      tenant_id: user.tenant_id,
      title: caseData.title,
      witness_name: data.witness_name,
      witness_email: data.witness_email,
      witness_metadata: normalizedMetadata,
      template_id: selectedTemplate?.id ?? null,
    });

    await apiFetch(`/api/tenant/statement/${created.id}/send-link`, {
      method: "POST",
    });

    formMethods.reset({
      witness_name: "",
      witness_email: "",
      witness_metadata: {},
      template_id: selectedTemplate?.id ?? "",
    });
    await onCreated();
    onClose();
  };

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={formMethods.handleSubmit(onSubmit)} className="space-y-4">
        {stage === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Stage 1: Select configuration
            </p>
            <div className="md:col-span-2">
              {templateLoadError ? (
                <p className="text-sm text-destructive">{templateLoadError}</p>
              ) : availableTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No templates available for this case template.
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Template</p>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(value) => setSelectedTemplateId(value)}
                  >
                    <SelectTrigger aria-required>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setStage(2)}
                disabled={availableTemplates.length === 0 || !selectedTemplate}
              >
                Continue
              </Button>
              <Button
                className="ml-auto"
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Stage 2: Complete witness details for {selectedTemplate?.name}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <RhfField
                form={formMethods}
                name="witness_name"
                controlId="witness_name"
                label="Name"
                registerOptions={{ required: true }}
                renderControl={(registration, required) => (
                  <Input
                    id="witness_name"
                    required={required}
                    {...registration}
                  />
                )}
              />

              <RhfField
                form={formMethods}
                name="witness_email"
                controlId="witness_email"
                label="Email"
                registerOptions={{ required: true }}
                renderControl={(registration, required) => (
                  <Input
                    id="witness_email"
                    type="email"
                    required={required}
                    {...registration}
                  />
                )}
              />

              {witnessMetadataFields.map((field) => {
                const fieldKey = `witness_metadata.${field.id}` as const;
                const isRequiredOnCreate =
                  field.requiredOnCreate ?? field.requiredOnIntake ?? false;
                return (
                  <RhfField
                    key={field.id}
                    form={formMethods}
                    name={fieldKey}
                    controlId={`witness_metadata_${field.id}`}
                    label={field.label}
                    registerOptions={{ required: isRequiredOnCreate }}
                    renderControl={(registration, required) => (
                      <Input
                        id={`witness_metadata_${field.id}`}
                        required={required}
                        {...registration}
                      />
                    )}
                  />
                );
              })}
            </div>

            {formMethods.formState.errors.witness_metadata?.message ? (
              <p className="text-xs text-destructive">
                {String(formMethods.formState.errors.witness_metadata.message)}
              </p>
            ) : null}

            <div className="flex gap-2">
              <AsyncButton type="submit" pendingText="Creating...">
                Create witness statement
              </AsyncButton>
              <Button
                className="ml-auto"
                type="button"
                variant="outline"
                onClick={() => setStage(1)}
              >
                Back
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </form>
    </FormProvider>
  );
}
