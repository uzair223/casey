"use client";

import React, { useRef, useEffect, useState, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCard } from "../ui/message";
import { CaseyAvatar, PersonAvatar } from "@/components/person-avatar";
import { ProgressIndicator } from "./progress-indicator";
import {
  FileInput,
  FileInputTrigger,
  FileInputThumbnails,
} from "@/components/ui/file-input";
import { AttachmentPreviewCard } from "@/components/ui/attachment-preview-card";
import { getMessageResponseMeta } from "@/lib/statement-utils";
import { useWitnessStatement } from "@/components/intake/intake-context";
import { CheckIcon, Paperclip, SkipForwardIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvidenceDocument } from "@/lib/evidence";

const AVATAR_SIZE = 40;

function getAttachedFiles(message: { meta?: Record<string, unknown> | null }) {
  if (!message.meta || typeof message.meta !== "object") {
    return [];
  }

  const attachedFiles = (message.meta as Record<string, unknown>).attachedFiles;
  return Array.isArray(attachedFiles)
    ? (attachedFiles as EvidenceDocument[])
    : [];
}

function MovingChatAvatar({
  side,
  containerRef,
  layoutKey,
  children,
}: {
  side: "user" | "assistant";
  containerRef: React.RefObject<HTMLDivElement | null>;
  layoutKey: string;
  children: React.ReactNode;
}) {
  const [top, setTop] = useState<number | null>(null);
  const [canMove, setCanMove] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const update = () => {
      const slot = container.querySelector(
        `[data-chat-avatar-anchor="${side}"]`,
      );
      if (!(slot instanceof HTMLElement)) {
        setTop(null);
        return;
      }

      const nextTop =
        slot.getBoundingClientRect().top - container.getBoundingClientRect().top;
      setTop(nextTop);
    };

    update();
    const frame = requestAnimationFrame(() => {
      update();
      setCanMove(true);
    });

    const observer = new ResizeObserver(update);
    observer.observe(container);
    const slot = container.querySelector(`[data-chat-avatar-anchor="${side}"]`);
    if (slot instanceof HTMLElement) {
      observer.observe(slot);
    }

    const mutations = new MutationObserver(update);
    mutations.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [containerRef, layoutKey, side]);

  if (top === null) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10",
        side === "user" ? "right-0" : "left-0",
        canMove && "transition-[top] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
      style={{ top, width: AVATAR_SIZE }}
    >
      {children}
    </div>
  );
}

const avatarSpacer = (
  <span
    className="block shrink-0"
    style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
    aria-hidden
  />
);

export function ChatAreaContent() {
  const {
    messages,
    sendMessage,
    hasConvoEnded,
    hasIntakeStopped,
    intakeStopReason,
    setTab,
    isDemo,
    data,
    unlockDemoTabs,
  } = useWitnessStatement();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const hasPendingAssistantMessage = messages.some(
    (message) => message.role === "assistant" && message.status === "pending",
  );
  const showPendingAssistant =
    sendMessage.isLoading && !hasPendingAssistantMessage;
  const caseyThinking = showPendingAssistant || hasPendingAssistantMessage;
  const avatarLayoutKey = messages
    .map((message) => `${message.role}:${message.status}:${message.content.length}`)
    .join("|");
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  const lastAssistantIndex = messages.findLastIndex(
    (message) => message.role === "assistant",
  );

  return (
    <>
      <div ref={threadRef} className="relative space-y-2">
        {messages.map((message, idx) => {
          const responseMeta = getMessageResponseMeta(
            message,
            data.statement.statement_config,
          );
          const attachedFiles =
            message.role === "user" ? getAttachedFiles(message) : [];
          const isLatest =
            message.role === "user"
              ? idx === lastUserIndex
              : idx === lastAssistantIndex && !showPendingAssistant;

          return (
            <React.Fragment key={idx}>
              <div className="space-y-1">
                <MessageCard
                  message={message}
                  avatar={avatarSpacer}
                  avatarAnchor={
                    isLatest
                      ? message.role === "user"
                        ? "user"
                        : "assistant"
                      : undefined
                  }
                >
                  {message.role === "assistant" ? (
                    <>
                      {responseMeta?.progress && (
                        <ProgressIndicator progress={responseMeta.progress} />
                      )}
                    </>
                  ) : null}

                  {attachedFiles.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {attachedFiles.map((file) => (
                        <AttachmentPreviewCard
                          key={file.path}
                          document={file}
                        />
                      ))}
                    </div>
                  ) : null}
                </MessageCard>
              </div>
              {message.role === "assistant" &&
                idx === messages.length - 1 &&
                responseMeta?.progress.readyToPrepare &&
                !hasIntakeStopped &&
                !hasConvoEnded && (
                  <div className="flex justify-center pt-2">
                    <Button
                      className="pl-3"
                      variant="outline"
                      onClick={() => {
                        if (isDemo) {
                          unlockDemoTabs();
                        }
                        setTab(isDemo ? "evidence" : "statement");
                      }}
                    >
                      <CheckIcon />
                      Review
                    </Button>
                  </div>
                )}
            </React.Fragment>
          );
        })}
        {showPendingAssistant && (
          <MessageCard
            message={{ role: "assistant", content: "", status: "pending" }}
            avatar={avatarSpacer}
            avatarAnchor="assistant"
          />
        )}
        {hasIntakeStopped && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-sm rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              Intake stopped: {intakeStopReason}
            </div>
          </div>
        )}
        <MovingChatAvatar
          side="assistant"
          containerRef={threadRef}
          layoutKey={`${avatarLayoutKey}-assistant-${showPendingAssistant}`}
        >
          <CaseyAvatar size={AVATAR_SIZE} thinking={caseyThinking} />
        </MovingChatAvatar>
        <MovingChatAvatar
          side="user"
          containerRef={threadRef}
          layoutKey={`${avatarLayoutKey}-user`}
        >
          <PersonAvatar
            name={data.statement.id}
            title={data.statement.witness_name || "Witness"}
            size={AVATAR_SIZE}
          />
        </MovingChatAvatar>
      </div>
      <div ref={messagesEndRef} />
    </>
  );
}

export function ChatAreaFooter() {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const {
    isDemo,
    isBusy,
    hasIntakeStopped,
    hasConvoEnded,
    isDemoPlaybackActive,
    skipDemoPlayback,
    latestRequestedEvidence,
    sendMessage,
  } = useWitnessStatement();

  const isInputDisabled = isBusy || hasIntakeStopped || hasConvoEnded;

  const attachmentAccept =
    latestRequestedEvidence?.type ||
    "application/pdf,image/*,video/*,audio/*,.doc,.docx,.txt";

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [input]);

  return (
    <div className="w-full pt-3 border-t border-border">
      {isDemo ? (
        <div className="w-full flex flex-col items-start gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            {isDemoPlaybackActive
              ? "Playing demo conversation..."
              : "This is a demo. Responses are simulated."}
          </p>
          {isDemoPlaybackActive && (
            <Button
              className="w-full sm:w-auto"
              size="sm"
              variant="outline"
              onClick={skipDemoPlayback}
            >
              Skip to end <SkipForwardIcon />
            </Button>
          )}
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={async (e) => {
            e.preventDefault();
            const submittedInput = input;
            const submittedAttachments = attachments;

            if (
              isInputDisabled ||
              (!submittedInput.trim() && submittedAttachments.length === 0)
            ) {
              return;
            }

            setInput("");
            setAttachments([]);
            await sendMessage.handler(
              submittedInput,
              submittedAttachments,
              latestRequestedEvidence?.name,
            );
          }}
          className="w-full space-y-2"
        >
          <FileInput
            multiple
            accept={attachmentAccept}
            disabled={isInputDisabled}
            value={attachments}
            onChange={setAttachments}
          >
            {latestRequestedEvidence && (
              <p className="text-xs text-muted-foreground mb-2">
                Requested evidence: {latestRequestedEvidence.name} (
                {latestRequestedEvidence.type})
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 empty:hidden">
              <FileInputThumbnails />
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  e.preventDefault();
                  if (
                    isInputDisabled ||
                    (!input.trim() && attachments.length === 0)
                  ) {
                    return;
                  }
                  formRef.current?.requestSubmit();
                }}
                placeholder={
                  hasConvoEnded
                    ? "Conversation ended"
                    : "Type your response, attach files, or both..."
                }
                disabled={isInputDisabled}
                className="min-h-0 flex-1 resize-none overflow-hidden"
                rows={1}
                autoFocus
              />
              <FileInputTrigger
                title="Attach files"
                size="icon"
                indicator={false}
                variant="outline"
              >
                <Paperclip />
              </FileInputTrigger>
              <Button
                className="w-full sm:w-auto"
                type="submit"
                disabled={
                  (!input.trim() && attachments.length === 0) || isInputDisabled
                }
              >
                Send
              </Button>
            </div>
          </FileInput>
        </form>
      )}
    </div>
  );
}
