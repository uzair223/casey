"use client";

import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
} from "react-hook-form";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { createInvite } from "@/lib/supabase/mutations";
import type { UserRole } from "@/types";
import { getRoleLabel } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteOrganisation = {
  id: string;
  name: string;
};

type InviteMemberCardProps = React.ComponentProps<typeof Card> & {
  createdByUserId: string;
  tenantId: string | null;
  organisations?: InviteOrganisation[];
  onTenantIdChange?: (tenantId: string) => void;
  defaultRole?: UserRole;
  allowedRoles?: UserRole[];
  onInviteCreated?: () => Promise<void> | void;
};

function emailLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function InviteMemberCard({
  createdByUserId,
  tenantId = null,
  organisations,
  onTenantIdChange,
  defaultRole = "tenant_admin",
  allowedRoles = ["tenant_admin", "app_admin"],
  onInviteCreated,
  ...props
}: InviteMemberCardProps) {
  const inviteFormMethods = useForm<{ emails: string; role: string }>({
    defaultValues: {
      emails: "",
      role: defaultRole,
    },
  });

  const showRolePicker = allowedRoles.length > 1;
  const selectedRole = useWatch({
    control: inviteFormMethods.control,
    name: "role",
  });

  const handleCreateInvite: SubmitHandler<{
    emails: string;
    role: string;
  }> = async (data) => {
    inviteFormMethods.clearErrors("emails");
    const emails = emailLines(data.emails);
    if (emails.length === 0) {
      inviteFormMethods.setError("emails", {
        message: "Enter at least one email address.",
      });
      throw new Error("Enter at least one email address.");
    }

    const invalid = emails.filter((email) => !EMAIL_PATTERN.test(email));
    if (invalid.length > 0) {
      const message = `These are not email addresses: ${invalid.join(", ")}`;
      inviteFormMethods.setError("emails", { message });
      throw new Error(message);
    }

    const role = (showRolePicker ? data.role : allowedRoles[0]) as UserRole;
    const failures: string[] = [];

    for (const email of emails) {
      try {
        const created = await createInvite(
          email,
          role,
          tenantId,
          createdByUserId,
        );
        if (created.email) {
          await apiFetch("/api/invites/send", {
            method: "POST",
            body: JSON.stringify({
              email: created.email,
              token: created.token,
            }),
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create invite";
        failures.push(`${email}: ${message}`);
      }
    }

    await onInviteCreated?.();

    if (failures.length > 0) {
      const message = failures.slice(0, 10).join("\n");
      inviteFormMethods.setError("emails", { message });
      throw new Error(message);
    }

    inviteFormMethods.reset({ emails: "", role });
  };

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Invite Member</CardTitle>
      </CardHeader>

      <FormProvider {...inviteFormMethods}>
        <form onSubmit={inviteFormMethods.handleSubmit(handleCreateInvite)}>
          <CardContent className="space-y-4">
            {organisations ? (
              <div className="space-y-1">
                <Label htmlFor="invite-organisation">Invite onto</Label>
                <Select
                  value={tenantId || "new"}
                  onValueChange={(value) =>
                    onTenantIdChange?.(value === "new" ? "" : value)
                  }
                >
                  <SelectTrigger id="invite-organisation">
                    <SelectValue placeholder="Choose an organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      Create the organisation when they accept
                    </SelectItem>
                    {organisations.map((organisation) => (
                      <SelectItem key={organisation.id} value={organisation.id}>
                        {organisation.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  An existing organisation lets the firm admin join without
                  typing the name again.
                </p>
              </div>
            ) : null}
            {showRolePicker ? (
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
                      aria-hidden
                      name={registration.name}
                      value={
                        typeof registration.value === "string" ||
                        typeof registration.value === "number"
                          ? registration.value
                          : ""
                      }
                      onBlur={registration.onBlur}
                      onChange={registration.onChange}
                      ref={registration.ref}
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
                        id="admin-invite-role"
                        className="w-full"
                        aria-required={required}
                        aria-invalid={registration["aria-invalid"]}
                        aria-describedby={registration["aria-describedby"]}
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
            ) : null}
            <RhfField
              form={inviteFormMethods}
              name="emails"
              controlId="admin-invite-emails"
              label="Emails"
              registerOptions={{ required: true }}
              renderControl={(registration, required) => (
                <Textarea
                  id="admin-invite-emails"
                  rows={4}
                  autoComplete="off"
                  placeholder={"one@example.co.uk\ntwo@example.co.uk"}
                  required={required}
                  {...registration}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              One email address per line.
              {showRolePicker
                ? " Every invite uses the role above."
                : ` Every invite is sent as ${getRoleLabel(allowedRoles[0])}.`}
            </p>
            <AsyncButton type="submit" pendingText="Sending...">
              Send invites
            </AsyncButton>
          </CardContent>
        </form>
      </FormProvider>
    </Card>
  );
}
