"use client";

import { useMemo, useState } from "react";

import { useUser } from "@/contexts/user-context";
import { useTenant } from "@/contexts/tenant-context";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils/fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AsyncButton } from "@/components/ui/async-button";

import type { CollaborationNoteView } from "@/types";
import { getCaseNotes } from "@/lib/supabase/queries";
import {
  createCaseNote,
  deleteCaseNote,
  setCaseNotePinned,
  updateCaseNote,
} from "@/lib/supabase/mutations";
import { toast } from "@/lib/toast";

type NoteStatementOption = {
  id: string;
  witness_name: string;
  title?: string | null;
};

type CaseNotesCardProps = React.ComponentProps<typeof Card> & {
  caseId: string;
  canPinNotes: boolean;
  statements?: NoteStatementOption[];
  defaultStatementId?: string | null;
  title?: string;
};

const GENERAL_REFERENCE = "__general__";
const ALL_NOTES = "__all__";

function getStatementLabel(statement?: NoteStatementOption) {
  if (!statement) {
    return "Unknown statement";
  }

  return statement.witness_name || statement.title || "Unnamed witness";
}

export function CaseNotesCard({
  caseId,
  canPinNotes,
  statements = [],
  defaultStatementId = null,
  title = "Notes",
  ...props
}: CaseNotesCardProps) {
  const { user } = useUser();
  const { team } = useTenant();
  const [noteBody, setNoteBody] = useState("");
  const [noteStatementId, setNoteStatementId] = useState<string>(
    defaultStatementId ?? GENERAL_REFERENCE,
  );
  const [filterStatementId, setFilterStatementId] = useState<string>(
    defaultStatementId ?? ALL_NOTES,
  );
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");

  const statementMap = useMemo(
    () => new Map(statements.map((statement) => [statement.id, statement])),
    [statements],
  );

  const {
    data: notes,
    isLoading: isNotesLoading,
    handler: refreshNotes,
  } = useAsync<CollaborationNoteView[], CollaborationNoteView[]>(
    async () => {
      if (!caseId) {
        return [];
      }
      return getCaseNotes(caseId);
    },
    [caseId],
    { initialState: [], withUseEffect: true },
  );

  const onCreateNote = async () => {
    if (!user?.tenant_id) {
      return;
    }

    const trimmed = noteBody.trim();
    if (!trimmed) {
      return;
    }

    const noteId = await createCaseNote({
      tenantId: user.tenant_id,
      caseId,
      statementId:
        noteStatementId === GENERAL_REFERENCE ? null : noteStatementId,
      authorUserId: user.id,
      body: trimmed,
      mentionedUserIds: selectedMentionIds,
    });

    await apiFetch("/api/notifications/mentions", {
      method: "POST",
      body: JSON.stringify({ kind: "case", noteId }),
    }).catch((error) => {
      console.error("Failed to dispatch mention notifications:", error);
    });

    setNoteBody("");
    setSelectedMentionIds([]);
    await refreshNotes();
  };

  const onTogglePinNote = async (note: CollaborationNoteView) => {
    if (!user?.id || !canPinNotes) {
      return;
    }

    await setCaseNotePinned({
      noteId: note.id,
      isPinned: !note.is_pinned,
      pinnedByUserId: user.id,
    });

    await refreshNotes();
  };

  const onToggleMention = (userId: string) => {
    setSelectedMentionIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const onStartEditNote = (note: CollaborationNoteView) => {
    setEditingNoteId(note.id);
    setEditingNoteBody(note.body);
  };

  const onCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteBody("");
  };

  const onSaveEditNote = async () => {
    if (!editingNoteId) {
      return;
    }

    const trimmed = editingNoteBody.trim();
    if (!trimmed) {
      return;
    }

    await updateCaseNote({
      noteId: editingNoteId,
      body: trimmed,
    });

    onCancelEditNote();
    await refreshNotes();
  };

  const onDeleteNote = async (note: CollaborationNoteView) => {
    const confirmed = await toast.confirm("Delete this note?", {
      description: "This action cannot be undone.",
      confirmLabel: "Delete note",
    });
    if (!confirmed) {
      return;
    }

    await deleteCaseNote(note.id);

    if (editingNoteId === note.id) {
      onCancelEditNote();
    }

    await refreshNotes();
  };

  const mentionNameMap = team.data?.nameMap ?? {};
  const notesList =
    filterStatementId === ALL_NOTES
      ? (notes ?? [])
      : filterStatementId === GENERAL_REFERENCE
        ? (notes ?? []).filter((note) => !note.statement_id)
        : (notes ?? []).filter(
            (note) => note.statement_id === filterStatementId,
          );

  return (
    <Card {...props}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Select value={filterStatementId} onValueChange={setFilterStatementId}>
          <SelectTrigger className="h-8 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_NOTES}>All notes</SelectItem>
            <SelectItem value={GENERAL_REFERENCE}>
              General case notes
            </SelectItem>
            {statements.map((statement) => (
              <SelectItem key={statement.id} value={statement.id}>
                {getStatementLabel(statement)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            placeholder="Add an internal note"
            rows={3}
          />
          <div className="grid gap-2 md:grid-cols-[220px_1fr]">
            <Select value={noteStatementId} onValueChange={setNoteStatementId}>
              <SelectTrigger>
                <SelectValue placeholder="Reference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_REFERENCE}>General case</SelectItem>
                {statements.map((statement) => (
                  <SelectItem key={statement.id} value={statement.id}>
                    {getStatementLabel(statement)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {team.data?.members?.length ? (
              <div className="rounded-md border p-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Mentions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {team.data.members.map((member) => {
                    const isSelected = selectedMentionIds.includes(
                      member.user_id,
                    );
                    return (
                      <Button
                        key={member.user_id}
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => onToggleMention(member.user_id)}
                      >
                        @{mentionNameMap[member.user_id] || "Team member"}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <AsyncButton
            type="button"
            onClick={onCreateNote}
            pendingText="Saving note..."
            disabled={!noteBody.trim()}
          >
            Save note
          </AsyncButton>
        </div>

        {isNotesLoading ? (
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        ) : notesList.length ? (
          <div className="space-y-2">
            {notesList.map((note) => (
              <div key={note.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                    <Badge variant="outline">
                      {note.statement_id
                        ? getStatementLabel(statementMap.get(note.statement_id))
                        : "General case"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {canPinNotes ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={note.is_pinned ? "default" : "outline"}
                        onClick={() => void onTogglePinNote(note)}
                      >
                        {note.is_pinned ? "Pinned" : "Pin"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onStartEditNote(note)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline-destructive"
                      onClick={() => void onDeleteNote(note)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingNoteBody}
                      onChange={(event) =>
                        setEditingNoteBody(event.target.value)
                      }
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <AsyncButton
                        type="button"
                        onClick={onSaveEditNote}
                        pendingText="Saving..."
                        disabled={!editingNoteBody.trim()}
                      >
                        Save
                      </AsyncButton>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onCancelEditNote}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                )}
                {note.mentions.length ? (
                  <div className="flex flex-wrap gap-1">
                    {note.mentions.map((mentionId) => (
                      <Badge key={mentionId} variant="secondary">
                        @{mentionNameMap[mentionId] || mentionId}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
