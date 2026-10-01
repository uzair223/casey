"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatAreaContent, ChatAreaFooter } from "@/components/chat/chat-area";
import { useUser } from "@/contexts/user-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileInput,
  FileInputList,
  FileInputTrigger,
} from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-utils";
import { getSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { presentWitnessMessages } from "@/lib/witness-chat/presentation";
import { formatTypingLabel } from "@/lib/witness-chat/state";
import type {
  WitnessChatFileRequest,
  WitnessChatMessage,
  WitnessChatSnapshot,
} from "@/lib/witness-chat/types";

type WitnessChatProps =
  | { mode: "firm"; statementId: string; canSend: boolean }
  | { mode: "witness"; token: string };

type TypingState = Record<string, { name: string; at: number }>;

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

function FileRequestCard({
  request,
  mode,
  busy,
  onUpload,
  onCancel,
}: {
  request: WitnessChatFileRequest;
  mode: "firm" | "witness";
  busy: boolean;
  onUpload: (requestId: string, files: File[]) => Promise<void>;
  onCancel: (requestId: string) => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const open = !request.fulfilledAt && !request.cancelledAt;
  const status = request.cancelledAt
    ? "Cancelled"
    : request.fulfilledAt
      ? "Received"
      : request.dueAt
        ? `Due ${formatWhen(request.dueAt)}`
        : "Requested";

  return (
    <div className="mt-1 max-w-sm rounded-md border bg-muted/30 p-3 text-sm">
      <p className="font-medium">{request.label}</p>
      <p className="text-xs text-muted-foreground">{status}</p>
      {open && mode === "witness" ? (
        <div className="mt-2 space-y-2">
          <FileInput
            multiple
            accept="application/pdf,image/*,video/*,audio/*,.doc,.docx,.txt"
            value={files}
            onChange={setFiles}
            disabled={busy}
          >
            <FileInputTrigger>
              {files.length > 0 ? "Change files" : "Choose files"}
            </FileInputTrigger>
            <div className="mt-2">
              <FileInputList />
            </div>
          </FileInput>
          <Button
            type="button"
            size="sm"
            disabled={busy || files.length === 0}
            onClick={() => void onUpload(request.id, files).then(() => setFiles([]))}
          >
            Send file
          </Button>
        </div>
      ) : null}
      {open && mode === "firm" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={busy}
          onClick={() => void onCancel(request.id)}
        >
          Cancel request
        </Button>
      ) : null}
    </div>
  );
}

export function WitnessChat(props: WitnessChatProps) {
  const { user } = useUser();
  const mode = props.mode;
  const canSend = props.mode === "witness" ? true : props.canSend;
  const requireAuth = props.mode === "witness" ? "optional" : true;
  const urls = useMemo(() => {
    if (props.mode === "firm") {
      const base = `/api/tenant/statement/${props.statementId}/witness-chat`;
      return {
        load: base,
        send: base,
        read: `${base}/read`,
        presence: `${base}/presence`,
        cancel: (requestId: string) => `${base}/file-requests/${requestId}`,
      };
    }
    const base = `/api/intake/${props.token}/follow-up`;
    return {
      load: base,
      send: base,
      read: `${base}/read`,
      presence: `${base}/presence`,
      cancel: () => base,
    };
  }, [props]);

  const [snapshot, setSnapshot] = useState<WitnessChatSnapshot | null>(null);
  const [pendingMessages, setPendingMessages] = useState<WitnessChatMessage[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [requestingFile, setRequestingFile] = useState(false);
  const [fileLabel, setFileLabel] = useState("");
  const [fileDue, setFileDue] = useState("");
  const [typers, setTypers] = useState<TypingState>({});
  const channelRef = useRef<{
    send: (message: {
      type: "broadcast";
      event: "chat";
      payload: Record<string, unknown>;
    }) => Promise<unknown>;
  } | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const readForRef = useRef<string | null>(null);
  const lastTypingAt = useRef(0);

  const myKey =
    mode === "witness"
      ? "witness"
      : `firm:${user?.id ?? "firm"}`;
  const myName =
    mode === "witness"
      ? snapshot?.witnessName || "Witness"
      : user?.display_name || user?.email || "Legal team";

  const refresh = useCallback(async () => {
    const next = await apiFetch<WitnessChatSnapshot>(urls.load, {
      method: "GET",
      requireAuth,
    });
    setSnapshot(next);
    setPendingMessages((current) =>
      current.filter(
        (message) =>
          !next.messages.some((saved) => saved.clientId === message.clientId),
      ),
    );
    setError(null);
  }, [requireAuth, urls.load]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void refresh()
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the conversation",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const channelName = snapshot?.realtimeChannel;
    if (!channelName) return;
    const supabase = getSupabaseClient();
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    channel.on("broadcast", { event: "chat" }, ({ payload }) => {
      const event = payload as {
        type?: string;
        senderKey?: string;
        name?: string;
      };
      if (event.type === "typing" && event.senderKey && event.name) {
        if (event.senderKey === myKey) return;
        setTypers((current) => ({
          ...current,
          [event.senderKey as string]: {
            name: event.name as string,
            at: Date.now(),
          },
        }));
        return;
      }
      if (event.type === "message" || event.type === "read") {
        void refreshRef.current();
      }
    });
    channel.subscribe();
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [myKey, snapshot?.realtimeChannel]);

  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void apiFetch(urls.presence, { method: "POST", requireAuth }).catch(
        () => undefined,
      );
    };
    beat();
    const timer = window.setInterval(beat, 15_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [requireAuth, urls.presence]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshRef.current().catch(() => undefined);
      }
    }, 12_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTypers((current) => {
        const next: TypingState = {};
        let changed = false;
        for (const [key, value] of Object.entries(current)) {
          if (Date.now() - value.at < 3000) {
            next[key] = value;
          } else {
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const messages = useMemo(() => {
    const saved = snapshot?.messages ?? [];
    const extras = pendingMessages.filter(
      (message) => !saved.some((item) => item.clientId === message.clientId),
    );
    return [...saved, ...extras];
  }, [pendingMessages, snapshot?.messages]);

  useEffect(() => {
    if (!snapshot || document.visibilityState !== "visible") return;
    const latest = [...snapshot.messages].reverse().find((message) => message.id);
    if (!latest) return;
    const cursor =
      mode === "witness" ? snapshot.witnessLastReadAt : snapshot.firmLastReadAt;
    if (
      cursor &&
      new Date(cursor).getTime() >= new Date(latest.createdAt).getTime()
    ) {
      return;
    }
    if (readForRef.current === latest.createdAt) return;
    readForRef.current = latest.createdAt;
    void apiFetch(urls.read, { method: "POST", requireAuth })
      .then(() => refreshRef.current())
      .catch(() => {
        readForRef.current = null;
      });
  }, [mode, requireAuth, snapshot, urls.read]);

  const presented = snapshot
    ? presentWitnessMessages({
        messages,
        viewer: mode,
        viewerUserId: mode === "firm" ? user?.id ?? null : null,
        witnessLastReadAt: snapshot.witnessLastReadAt,
        firmLastReadAt: snapshot.firmLastReadAt,
      })
    : [];

  const requestsByMessage = useMemo(() => {
    const map = new Map<string, WitnessChatFileRequest>();
    for (const request of snapshot?.fileRequests ?? []) {
      map.set(request.messageId, request);
    }
    return map;
  }, [snapshot?.fileRequests]);

  async function send(
    text: string,
    files?: File[],
    extra?: { fileRequestId?: string; fileLabel?: string; fileDue?: string },
  ) {
    const clientId = crypto.randomUUID();
    const body = text.trim();
    const optimistic: WitnessChatMessage = {
      id: `pending-${clientId}`,
      senderType: mode === "witness" ? "witness" : "firm",
      senderUserId: mode === "firm" ? user?.id ?? null : null,
      senderName: myName,
      body,
      attachments: [],
      createdAt: new Date().toISOString(),
      clientId,
      pending: true,
    };
    setPendingMessages((current) => [...current, optimistic]);
    setSending(true);
    try {
      const formData = new FormData();
      formData.set("body", body);
      formData.set("clientId", clientId);
      if (extra?.fileRequestId) {
        formData.set("fileRequestId", extra.fileRequestId);
      }
      if (extra?.fileLabel) {
        formData.set("fileRequestLabel", extra.fileLabel);
        if (extra.fileDue) {
          const due = new Date(extra.fileDue);
          if (Number.isNaN(due.getTime())) {
            throw new Error("File deadline is not a valid date");
          }
          formData.set("fileRequestDueAt", due.toISOString());
        }
      }
      (files ?? []).forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      const next = await apiFetch<WitnessChatSnapshot>(urls.send, {
        method: "POST",
        requireAuth,
        body: formData,
      });
      setSnapshot(next);
      setPendingMessages((current) =>
        current.filter((message) => message.clientId !== clientId),
      );
      setRequestingFile(false);
      setFileLabel("");
      setFileDue("");
    } catch (sendError) {
      setPendingMessages((current) =>
        current.filter((message) => message.clientId !== clientId),
      );
      toast.errorFromUnknown(sendError, "Could not send message");
    } finally {
      setSending(false);
    }
  }

  async function uploadForRequest(requestId: string, files: File[]) {
    await send("", files, { fileRequestId: requestId });
  }

  async function cancelRequest(requestId: string) {
    setSending(true);
    try {
      const next = await apiFetch<WitnessChatSnapshot>(urls.cancel(requestId), {
        method: "POST",
        requireAuth,
      });
      setSnapshot(next);
    } catch (cancelError) {
      toast.errorFromUnknown(cancelError, "Could not cancel the file request");
    } finally {
      setSending(false);
    }
  }

  const typingLabel = formatTypingLabel(
    Object.values(typers).map((typer) => typer.name),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Messages</CardTitle>
        <CardDescription>
          {mode === "firm"
            ? "Chat with the witness. They are emailed or texted only if they are not already in this conversation."
            : `${snapshot?.witnessName || "You"} can message the legal team here about ${snapshot?.caseTitle || "your account"}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="max-h-[32rem] overflow-y-auto pr-1">
              {presented.length === 0 ? (
                <p className="pb-3 text-sm text-muted-foreground">
                  No messages yet.
                </p>
              ) : null}
              <ChatAreaContent
                messages={presented}
                hideAvatars
                showAttachments
                variant="lead"
                typingLabel={typingLabel}
                renderMessageExtra={(message) => {
                  const request = requestsByMessage.get(message.id ?? "");
                  if (!request) return null;
                  return (
                    <FileRequestCard
                      request={request}
                      mode={mode}
                      busy={sending}
                      onUpload={uploadForRequest}
                      onCancel={cancelRequest}
                    />
                  );
                }}
              />
            </div>
            {mode === "firm" && canSend ? (
              <div className="mt-3 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestingFile((current) => !current)}
                >
                  {requestingFile ? "Hide file request" : "Request a file"}
                </Button>
                {requestingFile ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="file-request-label">What to send</Label>
                      <Input
                        id="file-request-label"
                        value={fileLabel}
                        onChange={(event) => setFileLabel(event.target.value)}
                        placeholder="Dashcam footage"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="file-request-due">Deadline (optional)</Label>
                      <Input
                        id="file-request-due"
                        type="datetime-local"
                        value={fileDue}
                        onChange={(event) => setFileDue(event.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      className="sm:col-span-2 sm:w-fit"
                      disabled={sending || !fileLabel.trim()}
                      onClick={() =>
                        void send("", [], {
                          fileLabel: fileLabel.trim(),
                          fileDue,
                        })
                      }
                    >
                      Send file request
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <ChatAreaFooter
              allowAttachments
              readOnly={!canSend}
              disabled={sending || !canSend}
              placeholder={
                canSend
                  ? "Write a message"
                  : "You can read this conversation"
              }
              onDraftChange={(value) => {
                if (!value.trim() || !channelRef.current) return;
                const now = Date.now();
                if (now - lastTypingAt.current < 1000) return;
                lastTypingAt.current = now;
                void channelRef.current.send({
                  type: "broadcast",
                  event: "chat",
                  payload: { type: "typing", senderKey: myKey, name: myName },
                });
              }}
              onSend={(text, files) =>
                send(text, files, {
                  fileLabel: requestingFile ? fileLabel.trim() : undefined,
                  fileDue: requestingFile ? fileDue : undefined,
                })
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
