"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressData, StatementStatus, UploadedDocument } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Info,
  ExternalLinkIcon,
  SendHorizonalIcon,
  PenIcon,
  Trash2Icon,
} from "lucide-react";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";

interface StatementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: {
    id: string;
    tenant_id: string;
    title: string;
    reference: string;
    incident_date: string | null;
    status: StatementStatus;
    witness_name?: string | null;
    witness_address?: string | null;
    witness_occupation?: string | null;
    witness_email?: string | null;
    magic_link_token?: string;
    magic_link_expires_at?: string;
    magic_link_used_at?: string | null;
    signed_document?: UploadedDocument | null;
    supporting_documents?: UploadedDocument[];
    claim_number?: string | null;
  } | null;
  progress?: ProgressData | null;
  flaggedDeviation?: boolean;
  deviationReason?: string | null | undefined;
  role: string | null;
  currentUserId: string | null;
  assignedTo?: string | null;
  teamMembers: { user_id: string; role: string; email: string | null }[];
  isEditing: boolean;
  editForm: {
    title: string;
    reference: string;
    witnessName: string;
    witnessAddress: string;
    witnessOccupation: string;
    witnessEmail: string;
    incidentDate: string;
    status: StatementStatus;
    assignedTo: string;
    claimNumber: string;
  };
  onEditFormChange: (
    updates: Partial<{
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
    }>,
  ) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  onSendStatementLink: () => Promise<void>;
  onRegenerateLink: () => Promise<void>;
}

export function StatementDetailModal({
  isOpen,
  onClose,
  caseData,
  progress,
  flaggedDeviation,
  deviationReason,
  role,
  currentUserId,
  assignedTo,
  teamMembers,
  isEditing,
  editForm,
  onEditFormChange,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onSendStatementLink,
  onRegenerateLink,
}: StatementDetailModalProps) {
  if (!caseData) return null;
  const supabase = getSupabaseClient();

  const completionPercentage = progress?.structuredData?.overallCompletion || 0;
  const currentPhase = progress?.currentPhase || 1;
  const ignoredDetails = progress?.ignoredMissingDetails || [];
  const supportingDocuments = caseData.supporting_documents || [];
  const hasAnyDocuments =
    Boolean(caseData.signed_document) || supportingDocuments.length > 0;

  const isLinkExpired =
    caseData.magic_link_expires_at &&
    new Date(caseData.magic_link_expires_at) < new Date();
  const isLinkUsed = !!caseData.magic_link_used_at;
  const canModify = role !== "paralegal" || assignedTo === currentUserId;

  const openDocument = async (doc: UploadedDocument) => {
    const bucketId = doc.bucketId || caseData.tenant_id;
    try {
      const { data, error } = await supabase.storage
        .from(bucketId)
        .createSignedUrl(doc.path, 60 * 10);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Failed to open document");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to open document");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Statement Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(80vh-8rem)] pr-4">
          <div className="space-y-4">
            {/* Actions */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {caseData.witness_email && (
                    <>
                      {isLinkExpired &&
                      !isLinkUsed &&
                      (role === "tenant_admin" || role === "solicitor") ? (
                        <AsyncButton
                          size="sm"
                          variant="default"
                          onClick={onRegenerateLink}
                          pendingText="Regenerating..."
                        >
                          Regenerate Link
                        </AsyncButton>
                      ) : (
                        <AsyncButton
                          size="sm"
                          variant="outline"
                          onClick={onSendStatementLink}
                          disabled={!!isLinkExpired}
                          pendingText="Sending..."
                        >
                          <SendHorizonalIcon className="w-4 h-4" />
                          Send Link
                        </AsyncButton>
                      )}
                    </>
                  )}
                  {isLinkExpired && (
                    <Badge variant="destructive" className="text-xs">
                      Link Expired
                    </Badge>
                  )}
                  {isLinkUsed && (
                    <Badge variant="outline" className="text-xs">
                      Link Used
                    </Badge>
                  )}
                  {caseData.magic_link_token && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/statement/${caseData.magic_link_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLinkIcon className="w-4 h-4" />
                        View Link
                      </Link>
                    </Button>
                  )}
                  {canModify && (
                    <>
                      <Button variant="outline" size="sm" onClick={onEdit}>
                        <PenIcon className="w-4 h-4" />
                        Edit
                      </Button>
                      <AsyncButton
                        variant="outline-destructive"
                        size="sm"
                        onClick={onDelete}
                      >
                        <Trash2Icon className="w-4 h-4" />
                        Delete
                      </AsyncButton>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* Case Information */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-base">Case Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditing ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`title-${caseData.id}`}>Title</Label>
                        <Input
                          id={`title-${caseData.id}`}
                          value={editForm.title}
                          onChange={(e) =>
                            onEditFormChange({ title: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`reference-${caseData.id}`}>
                          Reference
                        </Label>
                        <Input
                          id={`reference-${caseData.id}`}
                          value={editForm.reference}
                          onChange={(e) =>
                            onEditFormChange({ reference: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`claimNumber-${caseData.id}`}>
                          Claim number
                        </Label>
                        <Input
                          id={`claimNumber-${caseData.id}`}
                          value={editForm.claimNumber}
                          onChange={(e) =>
                            onEditFormChange({ claimNumber: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`incidentDate-${caseData.id}`}>
                          Incident date
                        </Label>
                        <Input
                          id={`incidentDate-${caseData.id}`}
                          type="date"
                          value={editForm.incidentDate}
                          onChange={(e) =>
                            onEditFormChange({ incidentDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`status-${caseData.id}`}>
                          Statement status
                        </Label>
                        <select
                          id={`status-${caseData.id}`}
                          value={editForm.status}
                          onChange={(e) =>
                            onEditFormChange({
                              status: e.target.value as StatementStatus,
                            })
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="draft">Draft</option>
                          <option value="in_progress">Collecting</option>
                          <option value="submitted">Review</option>
                          <option value="locked">Locked</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`witnessName-${caseData.id}`}>
                          Witness name
                        </Label>
                        <Input
                          id={`witnessName-${caseData.id}`}
                          value={editForm.witnessName}
                          onChange={(e) =>
                            onEditFormChange({ witnessName: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`witnessAddress-${caseData.id}`}>
                          Witness address
                        </Label>
                        <Input
                          id={`witnessAddress-${caseData.id}`}
                          value={editForm.witnessAddress}
                          onChange={(e) =>
                            onEditFormChange({ witnessAddress: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`witnessOccupation-${caseData.id}`}>
                          Witness occupation
                        </Label>
                        <Input
                          id={`witnessOccupation-${caseData.id}`}
                          value={editForm.witnessOccupation}
                          onChange={(e) =>
                            onEditFormChange({
                              witnessOccupation: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`witnessEmail-${caseData.id}`}>
                          Witness email
                        </Label>
                        <Input
                          id={`witnessEmail-${caseData.id}`}
                          type="email"
                          value={editForm.witnessEmail}
                          onChange={(e) =>
                            onEditFormChange({ witnessEmail: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {role !== "paralegal" ? (
                      <div className="space-y-2">
                        <Label htmlFor={`assignedTo-${caseData.id}`}>
                          Assigned to
                        </Label>
                        <select
                          id={`assignedTo-${caseData.id}`}
                          value={editForm.assignedTo}
                          onChange={(e) =>
                            onEditFormChange({ assignedTo: e.target.value })
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {teamMembers.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                              {member.email ?? member.user_id} ({member.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <AsyncButton onClick={onSave} pendingText="Saving...">
                        Save changes
                      </AsyncButton>
                      <Button variant="outline" onClick={onCancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Title
                        </p>
                        <p className="text-sm">{caseData.title}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Reference
                        </p>
                        <p className="text-sm">{caseData.reference}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Claim Number
                        </p>
                        <p className="text-sm">
                          {caseData.claim_number || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Incident Date
                        </p>
                        <p className="text-sm">
                          {caseData.incident_date || "TBD"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Statement Status
                        </p>
                        <Badge variant="outline" className="capitalize">
                          {caseData.status === "in_progress"
                            ? "Collecting"
                            : caseData.status === "submitted"
                              ? "Review"
                              : caseData.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Witness Name
                        </p>
                        <p className="text-sm">
                          {caseData.witness_name || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Witness Address
                        </p>
                        <p className="text-sm">
                          {caseData.witness_address || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Witness Occupation
                        </p>
                        <p className="text-sm">
                          {caseData.witness_occupation || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Witness Email
                        </p>
                        <p className="text-sm text-blue-600">
                          {caseData.witness_email || "—"}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Statement Progress */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-base">Statement Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Overall Completion</p>
                    <p className="text-sm font-semibold">
                      {Math.round(completionPercentage)}%
                    </p>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Current Phase
                  </p>
                  <Badge variant="default">
                    {PERSONAL_INJURY_CONFIG.phases[currentPhase]?.title ||
                      `Phase ${currentPhase}`}
                  </Badge>
                </div>

                {progress?.phaseCompleteness && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Phase Breakdown
                    </p>
                    <div className="space-y-2">
                      {Object.entries(progress.phaseCompleteness).map(
                        ([phase, completion]) => (
                          <div
                            key={phase}
                            className="flex items-center justify-between"
                          >
                            <p className="text-xs capitalize">
                              {PERSONAL_INJURY_CONFIG.phases[
                                Number.parseInt(phase.replace(/phase/, ""))
                              ]?.title || phase.replace(/phase/, "Phase ")}
                            </p>
                            <div className="flex items-center gap-2 w-32">
                              <div className="flex-1 h-1.5 bg-secondary rounded-full">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    completion >= 80
                                      ? "bg-green-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${completion}%` }}
                                />
                              </div>
                              <p className="text-xs font-medium w-8 text-right">
                                {Math.round(completion as number)}%
                              </p>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statement Documents */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 space-x-2">
                {!hasAnyDocuments ? (
                  <p className="text-sm text-muted-foreground">
                    No uploaded documents yet.
                  </p>
                ) : (
                  <>
                    {caseData.signed_document && (
                      <AsyncButton
                        size="sm"
                        variant="outline"
                        onClick={() => openDocument(caseData.signed_document!)}
                        pendingText="Opening..."
                      >
                        <ExternalLinkIcon className="w-4 h-4" />
                        View Signed Statement
                      </AsyncButton>
                    )}
                    {supportingDocuments.map((doc, idx) => (
                      <AsyncButton
                        key={`${doc.path}-${idx}`}
                        size="sm"
                        variant="outline"
                        onClick={() => openDocument(doc)}
                        pendingText="Opening..."
                      >
                        <ExternalLinkIcon className="w-4 h-4" />
                        View Evidence {idx + 1}
                      </AsyncButton>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Flagged Deviation */}
            {flaggedDeviation && (
              <Card variant="destructive">
                <CardHeader className="flex flex-row items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <CardTitle className="text-sm">Intake Flagged</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {deviationReason || "Unspecified reason"}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Ignored Missing Details */}
            {ignoredDetails && ignoredDetails.length > 0 && (
              <Card size="sm">
                <CardHeader>
                  <p className="text-base inline-flex items-center font-semibold mb-2">
                    <Info className="h-4 w-4 mr-2" />
                    Missing Details
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm">
                    {ignoredDetails.map((detail, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
