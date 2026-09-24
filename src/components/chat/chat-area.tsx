"use client";

import React, { useRef, useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCard } from "../ui/message";
import { CaseyAvatar, PersonAvatar } from "@/components/person-avatar";
import {
  MovingChatAvatar,
  chatAvatarBoxClass,
} from "@/components/chat/moving-chat-avatar";
import { ProgressIndicator } from "@/components/intake/progress-indicator";
import {
  FileInput,
  FileInputTrigger,
  FileInputThumbnails,
} from "@/components/ui/file-input";
import { AttachmentPreviewCard } from "@/components/ui/attachment-preview-card";
import { getMessageResponseMeta } from "@/lib/statement-utils";
import { useOptionalWitnessStatement } from "@/components/intake/intake-context";
import { CheckIcon, Paperclip, SkipForwardIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { EvidenceDocument } from "@/lib/evidence";

export type ChatAreaMessage = {
  role: string;
  content: string;
  status?: "pending" | "complete" | "error";
  meta?: Record<string, unknown> | null;
};

export type ChatAreaBubbleColors = {
  assistant?: CSSProperties;
  user?: CSSProperties;
};

export type ChatAreaContentProps = {
  /** Standalone mode (hosted/widget/preview). Omit to use intake context. */
  messages?: ChatAreaMessage[];
  /** Show the pending assistant bounce while a reply is in flight. */
  pending?: boolean;
  userAvatar?: { name: string; title: string };
  bubbleColors?: ChatAreaBubbleColors;
  /** Hide Casey and enquirer avatars. Defaults to false so intake is unchanged. */
  hideAvatars?: boolean;
  /** Scroll to the latest message when the thread updates. Defaults to true. */
  autoScroll?: boolean;
  /** Hide intake-only extras (progress, review, attachments, stop banner). */
  variant?: "intake" | "lead";
  children?: React.ReactNode;
};

export type ChatAreaFooterProps = {
  /** Standalone send handler. Omit to use intake context. */
  onSend?: (text: string, files?: File[]) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  allowAttachments?: boolean;
  /** Disabled composer for settings preview. */
  readOnly?: boolean;
};

function getAttachedFiles(message: { meta?: Record<string, unknown> | null }) {
  if (!message.meta || typeof message.meta !== "object") {
    return [];
  }

  const attachedFiles = (message.meta as Record<string, unknown>).attachedFiles;
  return Array.isArray(attachedFiles)
    ? (attachedFiles as EvidenceDocument[])
    : [];
}

const avatarSpacer = (
  <span className={cn("block shrink-0", chatAvatarBoxClass)} aria-hidden />
);

export function ChatAreaContent({
  messages: messagesProp,
  pending: pendingProp,
  userAvatar,
  bubbleColors,
  hideAvatars = false,
  autoScroll = true,
  variant = messagesProp !== undefined ? "lead" : "intake",
  children,
}: ChatAreaContentProps = {}) {
  const intake = useOptionalWitnessStatement();
  const isStandalone = messagesProp !== undefined;

  if (!isStandalone && !intake) {
    throw new Error(
      "ChatAreaContent requires messages props or an IntakeProvider",
    );
  }

  const messages = messagesProp ?? intake!.messages;
  const sendMessageLoading = isStandalone
    ? Boolean(pendingProp)
    : intake!.sendMessage.isLoading;
  const hasConvoEnded = isStandalone ? false : intake!.hasConvoEnded;
  const hasIntakeStopped = isStandalone ? false : intake!.hasIntakeStopped;
  const intakeStopReason = isStandalone ? "" : intake!.intakeStopReason;
  const isDemo = isStandalone ? false : intake!.isDemo;
  const statementConfig = isStandalone
    ? null
    : intake!.data.statement.statement_config;
  const avatarName =
    userAvatar?.name ?? intake?.data.statement.id ?? "enquirer";
  const avatarTitle =
    userAvatar?.title ?? intake?.data.statement.witness_name ?? "You";

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!autoScroll) return;
    scrollToBottom();
  }, [autoScroll, messages, sendMessageLoading]);

  const hasPendingAssistantMessage = messages.some(
    (message) => message.role === "assistant" && message.status === "pending",
  );
  const showPendingAssistant =
    sendMessageLoading && !hasPendingAssistantMessage;
  const caseyThinking = showPendingAssistant || hasPendingAssistantMessage;
  const avatarLayoutKey = messages
    .map(
      (message) =>
        `${message.role}:${message.status ?? ""}:${message.content.length}`,
    )
    .join("|");
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  const lastAssistantIndex = messages.findLastIndex(
    (message) => message.role === "assistant",
  );
  const showIntakeExtras = variant === "intake";

  return (
    <>
      <div ref={threadRef} className="relative space-y-2">
        {messages.map((message, idx) => {
          const responseMeta =
            showIntakeExtras && statementConfig
              ? getMessageResponseMeta(message, statementConfig)
              : null;
          const attachedFiles =
            showIntakeExtras && message.role === "user"
              ? getAttachedFiles(message)
              : [];
          const isLatest =
            message.role === "user"
              ? idx === lastUserIndex
              : idx === lastAssistantIndex && !showPendingAssistant;
          const bubbleStyle =
            message.role === "user"
              ? bubbleColors?.user
              : bubbleColors?.assistant;

          return (
            <React.Fragment key={idx}>
              <div className="space-y-1">
                <MessageCard
                  message={message}
                  avatar={hideAvatars ? undefined : avatarSpacer}
                  avatarAnchor={
                    hideAvatars
                      ? undefined
                      : isLatest
                        ? message.role === "user"
                          ? "user"
                          : "assistant"
                        : undefined
                  }
                  bubbleStyle={bubbleStyle}
                >
                  {showIntakeExtras && message.role === "assistant" ? (
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
              {showIntakeExtras &&
                message.role === "assistant" &&
                idx === messages.length - 1 &&
                responseMeta?.progress.readyToPrepare &&
                !hasIntakeStopped &&
                !hasConvoEnded &&
                intake && (
                  <div className="flex justify-center pt-2">
                    <Button
                      className="pl-3"
                      variant="outline"
                      onClick={() => {
                        if (isDemo) {
                          intake.unlockDemoTabs();
                        }
                        intake.setTab(isDemo ? "evidence" : "statement");
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
            avatar={hideAvatars ? undefined : avatarSpacer}
            avatarAnchor={hideAvatars ? undefined : "assistant"}
            bubbleStyle={bubbleColors?.assistant}
          />
        )}
        {showIntakeExtras && hasIntakeStopped && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-sm rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              Intake stopped: {intakeStopReason}
            </div>
          </div>
        )}
        {children}
        {hideAvatars ? null : (
          <>
            <MovingChatAvatar
              side="assistant"
              containerRef={threadRef}
              layoutKey={`${avatarLayoutKey}-assistant-${showPendingAssistant}`}
            >
              <CaseyAvatar
                className={cn(chatAvatarBoxClass, "[&_svg]:size-full")}
                thinking={caseyThinking}
              />
            </MovingChatAvatar>
            <MovingChatAvatar
              side="user"
              containerRef={threadRef}
              layoutKey={`${avatarLayoutKey}-user`}
            >
              <PersonAvatar
                name={avatarName}
                title={avatarTitle}
                className={cn(chatAvatarBoxClass, "[&_svg]:size-full")}
              />
            </MovingChatAvatar>
          </>
        )}
      </div>
      <div ref={messagesEndRef} />
    </>
  );
}

export function ChatAreaFooter({
  onSend,
  disabled: disabledProp,
  placeholder: placeholderProp,
  allowAttachments,
  readOnly = false,
}: ChatAreaFooterProps = {}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const isStandalone = onSend !== undefined || readOnly;
  const intake = useOptionalWitnessStatement();

  if (!isStandalone && !intake) {
    throw new Error(
      "ChatAreaFooter requires onSend/readOnly props or an IntakeProvider",
    );
  }

  const attachmentsEnabled =
    allowAttachments ?? (!isStandalone && !readOnly);
  const isDemo = !isStandalone && Boolean(intake?.isDemo);
  const isBusy = isStandalone
    ? Boolean(disabledProp)
    : Boolean(intake?.isBusy);
  const hasIntakeStopped = isStandalone
    ? false
    : Boolean(intake?.hasIntakeStopped);
  const hasConvoEnded = isStandalone
    ? Boolean(disabledProp)
    : Boolean(intake?.hasConvoEnded);
  const isDemoPlaybackActive = Boolean(intake?.isDemoPlaybackActive);
  const latestRequestedEvidence = isStandalone
    ? null
    : (intake?.latestRequestedEvidence ?? null);

  const isInputDisabled =
    readOnly || isBusy || hasIntakeStopped || hasConvoEnded;

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

  const placeholder =
    placeholderProp ??
    (hasConvoEnded
      ? "Conversation ended"
      : attachmentsEnabled
        ? "Type your response, attach files, or both..."
        : "Type your reply");

  async function submit() {
    const submittedInput = input;
    const submittedAttachments = attachments;

    if (
      isInputDisabled ||
      (!submittedInput.trim() &&
        (!attachmentsEnabled || submittedAttachments.length === 0))
    ) {
      return;
    }

    setInput("");
    setAttachments([]);

    if (onSend) {
      await onSend(
        submittedInput,
        attachmentsEnabled ? submittedAttachments : undefined,
      );
      return;
    }

    await intake!.sendMessage.handler(
      submittedInput,
      submittedAttachments,
      latestRequestedEvidence?.name,
    );
  }

  const composer = (
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
            (!input.trim() &&
              (!attachmentsEnabled || attachments.length === 0))
          ) {
            return;
          }
          formRef.current?.requestSubmit();
        }}
        placeholder={placeholder}
        aria-label="Chat response"
        disabled={isInputDisabled}
        className="min-h-0 flex-1 resize-none overflow-hidden"
        rows={1}
        autoFocus={!readOnly && !isStandalone}
      />
      {attachmentsEnabled ? (
        <FileInputTrigger
          title="Attach files"
          aria-label="Attach files"
          size="icon"
          indicator={false}
          variant="outline"
        >
          <Paperclip />
        </FileInputTrigger>
      ) : null}
      <Button
        className="w-full sm:w-auto"
        type="submit"
        disabled={
          readOnly ||
          (!input.trim() &&
            (!attachmentsEnabled || attachments.length === 0)) ||
          isInputDisabled
        }
      >
        Send
      </Button>
    </div>
  );

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
              onClick={() => intake?.skipDemoPlayback()}
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
            await submit();
          }}
          className="w-full space-y-2"
        >
          {attachmentsEnabled ? (
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
              {composer}
            </FileInput>
          ) : (
            composer
          )}
        </form>
      )}
    </div>
  );
}
