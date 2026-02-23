"use client";

import { useState } from "react";
import { ProgressData, StatementStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatementDetailModal } from "./StatementDetailModal";
import { CaseWithWitness } from "@/lib/supabase/queries";
import { FileTextIcon } from "lucide-react";

const statusStyles: Record<StatementStatus, BadgeProps["variant"]> = {
  draft: "outline",
  in_progress: "warning",
  submitted: "accent",
  locked: "outline",
};

const statusLabels: Record<StatementStatus, string> = {
  draft: "Draft",
  in_progress: "Collecting",
  submitted: "Review",
  locked: "Locked",
};

interface CaseCardProps {
  item: CaseWithWitness;
  isEditing: boolean;
  role: string | null;
  currentuser_id: string | null;
  teamMembers: { user_id: string; role: string; email: string | null }[];
  editForm: {
    title: string;
    reference: string;
    claimNumber: string;
    witnessName: string;
    witnessAddress: string;
    witnessOccupation: string;
    witnessEmail: string;
    incidentDate: string;
    status: StatementStatus;
    assignedTo: string;
  };
  onEditFormChange: (updates: Partial<CaseCardProps["editForm"]>) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  onSendStatementLink: () => Promise<void>;
  onRegenerateLink: () => Promise<void>;
  progress?: ProgressData | null;
  flaggedDeviation?: boolean;
  deviationReason?: string | null;
}

export function CaseCard({
  item,
  isEditing,
  role,
  currentuser_id,
  teamMembers,
  editForm,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onSendStatementLink,
  onRegenerateLink,
  progress,
  flaggedDeviation,
  deviationReason,
}: CaseCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const resolveAssignee = (assignedTo?: string | null) => {
    if (!assignedTo) return "Unassigned";
    if (assignedTo === currentuser_id) return "You";
    const match = teamMembers.find((member) => member.user_id === assignedTo);
    return match?.email ?? assignedTo;
  };

  const isLinkExpired =
    item.magic_link_expires_at &&
    new Date(item.magic_link_expires_at) < new Date();

  const isLinkUsed = !!item.magic_link_used_at;

  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {item.reference}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-primary">
              {item.title}
            </h2>
            {item.claim_number && (
              <p className="mt-2 text-sm text-muted-foreground">
                Claim Number: {item.claim_number}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Witness: {item.witness_name}
            </p>
            <p className="text-sm text-muted-foreground">
              Assigned: {resolveAssignee(item.assigned_to)}
            </p>
            <p className="text-sm text-muted-foreground">
              Incident date: {item.incident_date ?? "TBD"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {item.statement_status && (
              <Badge
                className="uppercase"
                variant={statusStyles[item.statement_status]}
              >
                {statusLabels[item.statement_status]}
              </Badge>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={() => setDetailsOpen(true)}
            >
              <FileTextIcon className="w-4 h-4" />
              View Details
            </Button>
          </div>
        </div>
      </Card>
      <StatementDetailModal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        caseData={{
          id: item.id,
          tenant_id: item.tenant_id,
          title: item.title,
          reference: item.reference,
          claim_number: item.claim_number,
          incident_date: item.incident_date,
          status: item.statement_status || "draft",
          witness_name: item.witness_name,
          witness_address: item.witness_address,
          witness_occupation: item.witness_occupation,
          witness_email: item.witness_email,
          magic_link_token: item.magic_link_token,
          magic_link_expires_at: item.magic_link_expires_at,
          magic_link_used_at: item.magic_link_used_at,
          signed_document: item.signed_document,
          supporting_documents: item.supporting_documents,
        }}
        progress={progress}
        flaggedDeviation={flaggedDeviation}
        deviationReason={deviationReason}
        role={role}
        currentUserId={currentuser_id}
        assignedTo={item.assigned_to}
        teamMembers={teamMembers}
        isEditing={isEditing}
        editForm={editForm}
        onEditFormChange={onEditFormChange}
        onEdit={onStartEdit}
        onCancelEdit={onCancelEdit}
        onSave={onSave}
        onDelete={onDelete}
        onSendStatementLink={onSendStatementLink}
        onRegenerateLink={onRegenerateLink}
      />
    </>
  );
}
