import { Invite } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { AsyncButton } from "./ui/async-button";

export default function InvitesTable({
  invites,
  onResendInvite,
  onRevokeInvite,
}: {
  invites: Invite[];
  onResendInvite: (inviteId: string) => Promise<void>;
  onRevokeInvite: (inviteId: string) => Promise<void>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Invite Code</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => {
          const isExpired = new Date(invite.expires_at) < new Date();
          const isAccepted = !!invite.accepted_at;

          return (
            <TableRow key={invite.id}>
              <TableCell>{invite.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {invite.role.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                  {invite.token}
                </code>
              </TableCell>
              <TableCell>
                {isAccepted ? (
                  <Badge variant="default">Accepted</Badge>
                ) : isExpired ? (
                  <Badge variant="destructive">Expired</Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(invite.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(invite.expires_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                {!isAccepted && !isExpired && (
                  <div className="flex justify-end gap-2">
                    <AsyncButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onResendInvite(invite.id)}
                      pendingText="Resending..."
                    >
                      Resend
                    </AsyncButton>
                    <AsyncButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevokeInvite(invite.id)}
                      pendingText="Revoking..."
                    >
                      Revoke
                    </AsyncButton>
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
