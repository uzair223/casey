"use client";

import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { getSupabaseClient } from "@/lib/supabase/client";
import { createInvite } from "@/lib/supabase/mutations";
import { getWaitlistSignups } from "@/lib/supabase/queries";
import { CardSkeleton } from "../shared/skeleton";

type AppAdminWaitlistTabProps = {
  userId: string;
};

export function AppAdminWaitlistTab({ userId }: AppAdminWaitlistTabProps) {
  const waitlist = useAsync(getWaitlistSignups, [], { enabled: true });

  const handleInviteWaitlist = async (waitlistId: string, email: string) => {
    try {
      const { email: inviteEmail, token } = await createInvite(
        email,
        "tenant_admin",
        null,
        userId,
      );

      if (inviteEmail) {
        await apiFetch("/api/invites/send", {
          method: "POST",
          body: JSON.stringify({ email: inviteEmail, token }),
        });
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("waitlist_signups")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", waitlistId);

      if (error) {
        throw error;
      }

      await waitlist.handler();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to send invite to waitlist signup",
      );
    }
  };

  if (!waitlist.data || waitlist.isLoading) {
    return <CardSkeleton title="Waitlist Signups" />;
  }

  return (
    <Card size="md">
      <CardHeader>
        <CardTitle>Waitlist Signups</CardTitle>
      </CardHeader>
      <CardContent>
        {waitlist.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No waitlist signups yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waitlist.data.map((signup) => (
                <TableRow key={signup.id}>
                  <TableCell>{signup.full_name}</TableCell>
                  <TableCell>{signup.company_name}</TableCell>
                  <TableCell>{signup.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(signup.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {signup.invited_at ? (
                      <Badge variant="secondary">Invited</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AsyncButton
                      variant="ghost"
                      size="sm"
                      pendingText={
                        signup.invited_at ? "Resending..." : "Sending..."
                      }
                      onClick={() =>
                        handleInviteWaitlist(signup.id, signup.email)
                      }
                    >
                      {signup.invited_at ? "Resend Invite" : "Invite"}
                    </AsyncButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
