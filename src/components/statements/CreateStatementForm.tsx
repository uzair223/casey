"use client";

import {
  useForm,
  FormProvider,
  SubmitHandler,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStatement } from "@/lib/supabase/queries";
import { useUser } from "@/contexts/UserContext";
import { StatementSchema, StatementSchemaType } from "@/lib/schema/statement";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch, getRoleLabel } from "@/lib/utils";
import { ProfileWithEmail } from "@/lib/supabase/queries/team";
import { useAsync } from "@/hooks/useAsync";
import { ScrollArea } from "../ui/scroll-area";

interface CreateStatementFormProps {
  status: string | null;
  onClose: () => void;
  fetchData: () => Promise<unknown>;
}

export function CreateStatementForm({
  status,
  onClose,
  fetchData,
}: CreateStatementFormProps) {
  const { user } = useUser(["tenant_admin", "solicitor", "paralegal"]);

  const { data: members } = useAsync(
    async () => {
      if (!user?.tenant_id) return [] as ProfileWithEmail[];
      const response = await apiFetch<{ members: ProfileWithEmail[] }>(
        "/api/tenant/members",
      );
      return response.members;
    },
    [user?.tenant_id],
    { enabled: !!user?.tenant_id },
  );

  const formMethods = useForm({
    resolver: zodResolver(StatementSchema),
    defaultValues: {
      title: "",
      tenant_id: user?.tenant_id || "",
      reference: "",
      claim_number: "",
      witness_name: "",
      witness_address: "",
      witness_occupation: "",
      witness_email: "",
      incident_date: "",
      assigned_to_ids: [],
    },
  });

  const onSubmit: SubmitHandler<StatementSchemaType> = async (data) => {
    if (!user || !user.tenant_id) return null;
    try {
      const { id } = await createStatement({
        ...data,
        tenant_id: user.tenant_id,
      });
      await apiFetch(`/api/tenant/statement/${id}/send-link`);
      onClose();
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create case");
    }
  };

  const selectedAssignees =
    useWatch({ control: formMethods.control, name: "assigned_to_ids" }) || [];

  if (!user || !user.tenant_id) return null;

  const toggleAssignee = (userId: string) => {
    const current = formMethods.getValues("assigned_to_ids") || [];
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    formMethods.setValue("assigned_to_ids", next, { shouldDirty: true });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Create a new case</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormProvider {...formMethods}>
          <form
            onSubmit={formMethods.handleSubmit(onSubmit)}
            className="grid grid-cols-2 gap-4"
          >
            <div className="form-item">
              <Input
                {...formMethods.register("title", { required: true })}
                placeholder="Doe vs. Company"
                required
              />
              <Label htmlFor="title">Case Title</Label>
            </div>
            <div className="form-item">
              <Input
                {...formMethods.register("reference", { required: true })}
                placeholder="REF-2026-014"
                required
              />
              <Label htmlFor="reference">Reference</Label>
            </div>
            <div className="form-item">
              <Input
                {...formMethods.register("claim_number")}
                placeholder="CLM-2026-014"
              />
              <Label htmlFor="claim_number">Claim Number</Label>
            </div>
            <div className="form-item">
              <Input
                {...formMethods.register("witness_name", { required: true })}
                placeholder="Jane Doe"
                required
              />
              <Label htmlFor="witness_name">Witness Name</Label>
            </div>
            <div className="form-item">
              <Input
                {...formMethods.register("witness_email", { required: true })}
                type="email"
                placeholder="jane.doe@example.com"
                required
              />
              <Label htmlFor="witness_email">Witness Email</Label>
            </div>
            <div className="form-item">
              <Input
                {...formMethods.register("witness_address")}
                placeholder="123 High Street, Manchester"
              />
              <Label htmlFor="witness_address">Witness Address</Label>
            </div>
            <div className="form-item">
              <Input
                {...formMethods.register("witness_occupation")}
                placeholder="Engineer"
              />
              <Label htmlFor="witness_occupation">Witness Occupation</Label>
            </div>
            <div className="form-item">
              <Input type="date" {...formMethods.register("incident_date")} />
              <Label htmlFor="incident_date">Incident Date</Label>
            </div>
            <div className="col-span-2 space-y-2 rounded-md border p-3">
              <Label>
                Assigned Team Members{" "}
                <span className="text-xs text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Select one or more assignees to review this statement.
              </p>
              <ScrollArea>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-48">
                  {(members || []).map((member) => (
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
            <div className="col-span-2 flex gap-2">
              <AsyncButton type="submit" pendingText="Creating...">
                Create Case
              </AsyncButton>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </FormProvider>
        {status ? (
          <p
            className={
              status.includes("success") ? "text-green-600" : "text-red-600"
            }
          >
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
