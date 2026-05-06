"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCard } from "../ui/message";
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
import type { EvidenceDocument } from "@/lib/evidence";

function getAttachedFiles(message: { meta?: Record<string, unknown> | null }) {
  if (!message.meta || typeof message.meta !== "object") {
    return [];
  }

  const attachedFiles = (message.meta as Record<string, unknown>).attachedFiles;
  return Array.isArray(attachedFiles)
    ? (attachedFiles as EvidenceDocument[])
    : [];
}

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const hasPendingAssistantMessage = messages.some(
    (message) => message.role === "assistant" && message.status === "pending",
  );

  return (
    <>
      <div className="space-y-2">
        {messages.map((message, idx) => {
          const responseMeta = getMessageResponseMeta(
            message,
            data.statement.statement_config,
          );
          const attachedFiles =
            message.role === "user" ? getAttachedFiles(message) : [];

          return (
            <React.Fragment key={idx}>
              <div
                className={`space-y-1 ${
                  message.role === "user"
                    ? "animate-slide-in-user"
                    : "animate-slide-in-assistant"
                }`}
              >
                <MessageCard message={message}>
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
        {sendMessage.isLoading && !hasPendingAssistantMessage && (
          <MessageCard
            message={{ role: "assistant", content: "", status: "pending" }}
          />
        )}
        {hasIntakeStopped && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-sm rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              Intake stopped: {intakeStopReason}
            </div>
          </div>
        )}
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
