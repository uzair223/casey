"use client";

import { useState } from "react";

import { useUser } from "@/contexts/user-context";
import { useTenant } from "@/contexts/tenant-context";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils/fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type CaseNotesCardProps = {
  caseId: string;
  tenantId: string;
  canPinNotes: boolean;
};

export function CaseNotesCard({
  caseId,
  tenantId,
  canPinNotes,
}: CaseNotesCardProps) {
  const { user } = useUser();
  const { team } = useTenant();
  const [noteBody, setNoteBody] = useState("");
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");

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
    if (!user?.id || !tenantId) {
      return;
    }

    const trimmed = noteBody.trim();
    if (!trimmed) {
      return;
    }

    const noteId = await createCaseNote({
      tenantId,
      caseId,
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
    if (!confirm("Delete this note? This action cannot be undone.")) {
      return;
    }

    await deleteCaseNote(note.id);

    if (editingNoteId === note.id) {
      onCancelEditNote();
    }

    await refreshNotes();
  };

  const mentionNameMap = team.data?.nameMap ?? {};
  const notesList = notes ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Case notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            placeholder="Add an internal note for this case"
            rows={3}
          />
          {team.data?.members?.length ? (
            <div className="rounded-md border p-3">
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
              <div key={note.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(note.created_at).toLocaleString()}
                  </p>
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
                  <p className="text-sm whitespace-pre-wrap">{note.body}</p>
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
