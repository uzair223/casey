"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatementStatus, UploadedDocument } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Info,
  ExternalLinkIcon,
  SendHorizonalIcon,
  PenIcon,
  Trash2Icon,
  FileTextIcon,
  RotateCwIcon,
} from "lucide-react";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import {
  deleteStatement,
  getFullStatementFromId,
  regenerateMagicLink,
  updateStatement,
} from "@/lib/supabase/queries";
import { useAsync } from "@/hooks/useAsync";
import { useUserRole } from "@/contexts/UserContext";
import {
  defaultProgress,
  statusBadgeStyles,
  statusLabels,
} from "@/lib/statementUtils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { StatementSchema, StatementSchemaType } from "@/lib/schema/statement";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiFetch } from "@/lib/utils";
import { ProfileWithEmail } from "@/lib/supabase/queries/team";

interface StatementDetailModalProps {
  id: string;
  fetchData: () => Promise<unknown>;
}

export function StatementDetailModal({
  id,
  fetchData,
}: StatementDetailModalProps) {
  const supabase = getSupabaseClient();

  const role = useUserRole();
  const canModify = ["tenant_admin", "solicitor"].includes(role);
  const [isEditing, setIsEditing] = useState(false);
  const formMethods = useForm({
    resolver: zodResolver(StatementSchema),
  });

  const {
    data: statement,
    setData,
    isLoading,
    handler: fetchStatement,
    reset,
  } = useAsync(
    async () => {
      const data = await getFullStatementFromId(id, false);
      if (!data) {
        throw new Error("Statement not found");
      }
      const normalized = {
        ...data,
        assigned_to_ids: data.assigned_to_ids ?? [],
      };
      formMethods.reset(normalized);
      return normalized;
    },
    [id],
    { withUseEffect: false, initialLoading: false },
  );

  const onOpenChange = (open: boolean) => {
    if (open) {
      fetchStatement();
      return;
    }
    formMethods.reset();
    reset();
    setIsEditing(false);
  };

  const isLinkExpired = statement?.link?.expires_at
    ? new Date(statement?.link?.expires_at) < new Date()
    : false;

  const meta = { ...statement?.latest?.meta };
  const progress = meta.progress ?? defaultProgress();

  const { data: members } = useAsync(
    async () => {
      if (!statement?.tenant_id) return [] as ProfileWithEmail[];
      const response = await apiFetch<{ members: ProfileWithEmail[] }>(
        "/api/tenant/members",
      );
      return response.members;
    },
    [statement?.tenant_id],
    { enabled: !!statement?.tenant_id },
  );

  const selectedAssignees = formMethods.watch("assigned_to_ids") || [];

  const toggleAssignee = (userId: string) => {
    const current = formMethods.getValues("assigned_to_ids") || [];
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    formMethods.setValue("assigned_to_ids", next, { shouldDirty: true });
  };

  const openDocument = async (doc: UploadedDocument) => {
    if (!statement) return;
    const bucketId = doc.bucketId || statement.tenant_id;
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

  const onSave: SubmitHandler<StatementSchemaType> = async (data) => {
    await updateStatement(id, data);
    fetchData();
    fetchStatement();
  };

  const onDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this statement? This action cannot be undone.",
      )
    ) {
      return;
    }
    await deleteStatement(id);
    onOpenChange(false);
    fetchData();
  };

  const onSendStatementLink = async () => {
    await apiFetch(`/api/tenant/statement/${id}/send-link`, {
      method: "POST",
    });
    alert("Statement link sent to witness email");
  };

  const onRegenerateLink = async () => {
    const link = await regenerateMagicLink(id);
    setData((prev) =>
      prev
        ? {
            ...prev,
            link,
          }
        : prev,
    );
    if (
      confirm(
        "Magic link has been regenerated. Do you want to email it to the witness?",
      )
    ) {
      onSendStatementLink();
    }
  };

  return (
    <Dialog open={!!statement} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={isLoading}>
          <FileTextIcon className="w-4 h-4" />
          {isLoading ? "Loading..." : "View Details"}
        </Button>
      </DialogTrigger>

      {statement && (
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader className="flex-row items-start gap-1.5 pr-6">
            <DialogTitle>Statement Details</DialogTitle>
            <Badge
              className="ml-auto"
              variant={isLinkExpired ? "destructive" : "outline"}
            >
              {isLinkExpired ? "Link Expired" : "Link Active"}
            </Badge>
            <Badge variant={statusBadgeStyles[statement.status]}>
              {statusLabels[statement.status]}
            </Badge>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(80vh-8rem)] pr-4">
            <div className="space-y-4">
              {/* Actions */}
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-base">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-x-1.5">
                  {canModify && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing((v) => !v)}
                      >
                        <PenIcon className="w-4 h-4" />
                        {isEditing ? "Cancel" : "Edit"}
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
                  <AsyncButton
                    size="sm"
                    variant="outline"
                    onClick={onRegenerateLink}
                    pendingText={
                      <>
                        <RotateCwIcon />
                        Regenerating...
                      </>
                    }
                  >
                    <RotateCwIcon />
                    Regenerate Link
                  </AsyncButton>
                  <AsyncButton
                    size="sm"
                    variant="outline"
                    onClick={onSendStatementLink}
                    disabled={!!isLinkExpired}
                    pendingText={
                      <>
                        <SendHorizonalIcon className="w-4 h-4" />
                        Sending...
                      </>
                    }
                  >
                    <SendHorizonalIcon className="w-4 h-4" />
                    Send Link
                  </AsyncButton>
                  {statement.link && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/statement/${statement.link.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLinkIcon className="w-4 h-4" />
                        View Link
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
              {/* Case Information */}
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-base">Case Information</CardTitle>
                </CardHeader>
                {isEditing ? (
                  <FormProvider {...formMethods}>
                    <form onSubmit={formMethods.handleSubmit(onSave)}>
                      <CardContent className="grid grid-cols-2 gap-3 [&_label]:text-muted-foreground">
                        <div className="form-item">
                          <Input
                            {...formMethods.register("title", {
                              required: true,
                            })}
                            required
                          />
                          <Label htmlFor="title">Title</Label>
                        </div>
                        <div className="form-item">
                          <Input
                            {...formMethods.register("reference", {
                              required: true,
                            })}
                            required
                          />
                          <Label htmlFor="reference">Reference</Label>
                        </div>
                        <div className="form-item">
                          <Input {...formMethods.register("claim_number")} />
                          <Label htmlFor="claim_number">Claim number</Label>
                        </div>
                        <div className="form-item">
                          <Input
                            type="date"
                            {...formMethods.register("incident_date")}
                          />
                          <Label htmlFor="incident_date">Incident date</Label>
                        </div>
                        <div className="form-item">
                          <Select
                            value={formMethods.watch("status")}
                            onValueChange={(value) =>
                              formMethods.setValue(
                                "status",
                                value as StatementStatus,
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="submitted">
                                  Submitted
                                </SelectItem>
                                <SelectItem value="reviewed">
                                  Reviewed
                                </SelectItem>
                                <SelectItem value="locked">Locked</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <Label htmlFor="status">Statement status</Label>
                        </div>
                        <div className="form-item">
                          <Label htmlFor="witnessName">Witness name</Label>
                          <Input {...formMethods.register("witness_name")} />
                        </div>
                        <div className="form-item">
                          <Input
                            type="email"
                            {...formMethods.register("witness_email")}
                          />
                          <Label htmlFor="witness_email">Witness Email</Label>
                        </div>
                        <div className="form-item">
                          <Input {...formMethods.register("witness_address")} />
                          <Label htmlFor="witness_address">
                            Witness Address
                          </Label>
                        </div>
                        <div className="form-item">
                          <Input
                            {...formMethods.register("witness_occupation")}
                          />
                          <Label htmlFor="witness_occupation">
                            Witness Occupation
                          </Label>
                        </div>
                        <div className="col-span-2 space-y-2 rounded-md border p-3">
                          <Label>Assigned Team Members</Label>
                          <p className="text-xs text-muted-foreground">
                            Select one or more assignees to review this
                            statement.
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {(members || []).map((member) => (
                              <label
                                key={member.user_id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedAssignees.includes(
                                    member.user_id,
                                  )}
                                  onChange={() =>
                                    toggleAssignee(member.user_id)
                                  }
                                />
                                <span>
                                  {member.display_name ||
                                    member.email ||
                                    member.user_id}
                                  {member.role
                                    ? ` (${member.role.replace("_", " ")})`
                                    : ""}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <AsyncButton pendingText="Saving..." type="submit">
                          Save
                        </AsyncButton>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            formMethods.reset();
                          }}
                        >
                          Cancel
                        </Button>
                      </CardFooter>
                    </form>
                  </FormProvider>
                ) : (
                  <CardContent className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Title
                      </p>
                      <p className="text-sm">{statement.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Reference
                      </p>
                      <p className="text-sm">{statement.reference}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Claim Number
                      </p>
                      <p className="text-sm">{statement.claim_number || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Incident Date
                      </p>
                      <p className="text-sm">
                        {statement.incident_date || "TBD"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Statement Status
                      </p>
                      <Badge variant="outline" className="capitalize">
                        {statement.status === "in_progress"
                          ? "Collecting"
                          : statement.status === "submitted"
                            ? "Review"
                            : statement.status}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Assigned Team Members
                      </p>
                      <p className="text-sm">
                        {statement.assigned_to_ids?.length
                          ? statement.assigned_to_ids
                              .map((id) => {
                                const member = (members || []).find(
                                  (candidate) => candidate.user_id === id,
                                );
                                return (
                                  member?.display_name || member?.email || id
                                );
                              })
                              .join(", ")
                          : "Unassigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Witness Name
                      </p>
                      <p className="text-sm">{statement.witness_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Witness Email
                      </p>
                      <Link
                        className="text-sm hover:underline"
                        href={`mailto:${statement.witness_email}`}
                      >
                        {statement.witness_email}
                      </Link>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Witness Address
                      </p>
                      <p className="text-sm">
                        {statement.witness_address || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Witness Occupation
                      </p>
                      <p className="text-sm">
                        {statement.witness_occupation || "—"}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Statement Progress */}
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Statement Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Overall Completion</p>
                      <p className="text-sm font-semibold">
                        {Math.round(progress.overallCompletion)}%
                      </p>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${progress.overallCompletion}%`,
                        }}
                      />
                    </div>
                  </div>

                  {statement.status !== "draft" &&
                    progress.overallCompletion < 100 && (
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">
                            Current Phase
                          </p>
                          <Badge variant="default">
                            {PERSONAL_INJURY_CONFIG.phases[
                              progress.currentPhase
                            ]?.title || `Phase ${progress.currentPhase}`}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Phase Breakdown
                        </p>
                        {Object.entries(progress.phaseCompleteness).map(
                          ([phase, completion]) =>
                            Object.keys(
                              defaultProgress().phaseCompleteness,
                            ).includes(phase) && (
                              <div
                                key={phase}
                                className="flex items-center justify-between"
                              >
                                <p className="text-xs capitalize">
                                  {PERSONAL_INJURY_CONFIG.phases[
                                    Number.parseInt(phase.replace(/phase/, ""))
                                  ]?.title.toLowerCase() ||
                                    phase.replace(/phase/, "Phase ")}
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
                    )}
                </CardContent>
              </Card>

              {/* Statement Documents */}
              {statement.signed_document?.name ||
              statement.supporting_documents?.length ? (
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="text-base">Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!statement.supporting_documents ? (
                      <p className="text-sm text-muted-foreground">
                        No uploaded documents yet.
                      </p>
                    ) : (
                      <>
                        {statement.signed_document?.name && (
                          <AsyncButton
                            size="sm"
                            variant="link"
                            onClick={() =>
                              openDocument(statement.signed_document!)
                            }
                            pendingText="Opening..."
                          >
                            {statement.signed_document.name}&nbsp;&gt;
                          </AsyncButton>
                        )}
                        {statement.supporting_documents.map((doc, idx) => (
                          <AsyncButton
                            key={idx}
                            size="sm"
                            variant="link"
                            onClick={() => openDocument(doc)}
                            pendingText="Opening..."
                            className="capitalize"
                          >
                            {doc.name}&nbsp;&gt;
                          </AsyncButton>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {/* Flagged Deviation */}
              {meta.deviation &&
                (meta.deviation.flaggedDeviation ||
                  meta.deviation.stopIntake) && (
                  <Card variant="destructive">
                    <CardHeader className="flex flex-row items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <CardTitle className="text-sm">
                        Intake{" "}
                        {meta.deviation.stopIntake
                          ? "Stopped"
                          : "Deviation Flagged"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">
                        {meta.deviation.deviationReason || "Unspecified reason"}
                      </p>
                    </CardContent>
                  </Card>
                )}

              {/* Ignored Missing Details */}
              {meta.ignoredMissingDetails &&
                meta.ignoredMissingDetails.length > 0 && (
                  <Card size="sm">
                    <CardHeader>
                      <p className="text-base inline-flex items-center font-semibold mb-2">
                        <Info className="h-4 w-4 mr-2" />
                        Missing Details
                      </p>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm">
                        {meta.ignoredMissingDetails.map((detail, idx) => (
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
      )}
    </Dialog>
  );
}
