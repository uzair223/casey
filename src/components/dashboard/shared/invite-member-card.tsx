"use client";

import { ChangeEvent, useState } from "react";
import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
} from "react-hook-form";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RhfField } from "@/components/ui/rhf-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-utils";
import { parseInviteCsv } from "@/lib/invite-csv";
import { createInvite } from "@/lib/supabase/mutations";
import type { UserRole } from "@/types";
import { getRoleLabel } from "@/lib/utils";

type BulkInviteResult = {
  successCount: number;
  failureMessages: string[];
};

type InviteMemberCardProps = React.ComponentProps<typeof Card> & {
  createdByUserId: string;
  tenantId: string | null;
  defaultRole?: UserRole;
  allowedRoles?: UserRole[];
  onInviteCreated?: () => Promise<void> | void;
};

export function InviteMemberCard({
  createdByUserId,
  tenantId = null,
  defaultRole = "tenant_admin",
  allowedRoles = ["tenant_admin", "app_admin"],
  onInviteCreated,
  ...props
}: InviteMemberCardProps) {
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkCsvInput, setBulkCsvInput] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkInviteResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const inviteFormMethods = useForm<{ email: string; role: string }>({
    defaultValues: {
      email: "",
      role: defaultRole,
    },
  });

  const selectedRole = useWatch({
    control: inviteFormMethods.control,
    name: "role",
  });

  const handleCreateInvite: SubmitHandler<{
    email: string;
    role: string;
  }> = async (data) => {
    inviteFormMethods.clearErrors("email");

    try {
      const { email, token } = await createInvite(
        data.email,
        data.role,
        tenantId,
        createdByUserId,
      );
      if (email) {
        await apiFetch("/api/invites/send", {
          method: "POST",
          body: JSON.stringify({ email, token }),
        });
      }
      await onInviteCreated?.();
      inviteFormMethods.reset({ email: "", role: data.role });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create invite";
      inviteFormMethods.setError("email", { message: errorMessage });
      throw new Error(errorMessage);
    }
  };

  const handleBulkFileSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setBulkCsvInput(text);
    setBulkResult(null);
    setBulkError(null);
    event.target.value = "";
  };

  const handleBulkInvite = async () => {
    setBulkError(null);
    setBulkResult(null);

    const parsed = parseInviteCsv(bulkCsvInput);
    const allowedRolesSet = new Set<UserRole>(allowedRoles);

    const roleErrors = parsed.rows
      .filter((row) => !allowedRolesSet.has(row.role))
      .map(
        (row) => `Line ${row.lineNumber}: role \"${row.role}\" is not allowed`,
      );

    const parseErrors = [...parsed.errors, ...roleErrors];
    if (parseErrors.length > 0) {
      setBulkError(parseErrors.slice(0, 10).join("\n"));
      return;
    }

    let successCount = 0;
    const failureMessages: string[] = [];

    for (const row of parsed.rows) {
      try {
        const { email, token } = await createInvite(
          row.email,
          row.role,
          tenantId,
          createdByUserId,
        );

        if (email) {
          await apiFetch("/api/invites/send", {
            method: "POST",
            body: JSON.stringify({ email, token }),
          });
        }

        successCount += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create invite";
        failureMessages.push(
          `Line ${row.lineNumber} (${row.email}): ${message}`,
        );
      }
    }

    setBulkResult({ successCount, failureMessages });
    await onInviteCreated?.();
  };

  return (
    <Card {...props}>
      <CardHeader>
        <div className="flex justify-between gap-2">
          <CardTitle>Invite Member </CardTitle>
          <AsyncButton
            size="sm"
            type="button"
            variant="outline"
            onClick={async () => {
              setIsBulkDialogOpen(true);
              setBulkError(null);
              setBulkResult(null);
            }}
          >
            Bulk CSV Invite
          </AsyncButton>
        </div>
      </CardHeader>

      <FormProvider {...inviteFormMethods}>
        <form onSubmit={inviteFormMethods.handleSubmit(handleCreateInvite)}>
          <CardContent className="flex items-end gap-2 max-w-2xl">
            <div className="flex-1">
              <RhfField
                form={inviteFormMethods}
                name="email"
                controlId="admin-invite-email"
                label="Email"
                registerOptions={{ required: true }}
                renderControl={(registration, required) => (
                  <Input
                    id="admin-invite-email"
                    type="email"
                    placeholder="admin@example.com"
                    required={required}
                    {...registration}
                  />
                )}
              />
            </div>
            <div className="w-48">
              <RhfField
                form={inviteFormMethods}
                name="role"
                controlId="admin-invite-role"
                label="Role"
                registerOptions={{ required: true }}
                renderControl={(registration, required) => (
                  <>
                    <input
                      type="hidden"
                      id="admin-invite-role"
                      required={required}
                      {...registration}
                    />
                    <Select
                      value={selectedRole}
                      onValueChange={(value) => {
                        inviteFormMethods.setValue("role", value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-required={required}
                      >
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {getRoleLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              />
            </div>
            <AsyncButton
              className="mb-1.5"
              type="submit"
              pendingText="Creating..."
            >
              Create Invite
            </AsyncButton>
          </CardContent>
        </form>
      </FormProvider>

      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Invite Tenant and App Admins</DialogTitle>
            <DialogDescription>
              Paste CSV data or upload a CSV file with columns email,role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-admin-bulk-csv">CSV editor</Label>
              <Textarea
                id="app-admin-bulk-csv"
                value={bulkCsvInput}
                onChange={(event) => {
                  setBulkCsvInput(event.target.value);
                  setBulkError(null);
                  setBulkResult(null);
                }}
                rows={10}
                placeholder={
                  "email,role\ntenantadmin@example.com,tenant_admin\nops@example.com,app_admin"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-admin-bulk-file">Upload CSV file</Label>
              <Input
                id="app-admin-bulk-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleBulkFileSelected}
              />
            </div>

            {bulkError && (
              <p className="whitespace-pre-line text-sm text-destructive">
                {bulkError}
              </p>
            )}

            {bulkResult && (
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  Created {bulkResult.successCount} invite(s).
                </p>
                {bulkResult.failureMessages.length > 0 && (
                  <p className="whitespace-pre-line text-destructive">
                    {bulkResult.failureMessages.slice(0, 10).join("\n")}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <AsyncButton
              type="button"
              variant="outline"
              onClick={async () => {
                setIsBulkDialogOpen(false);
              }}
            >
              Close
            </AsyncButton>
            <AsyncButton
              type="button"
              onClick={handleBulkInvite}
              pendingText="Sending bulk invites..."
            >
              Send Invites
            </AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
