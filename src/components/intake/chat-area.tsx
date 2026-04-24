"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCard } from "../ui/message";
import { ProgressIndicator } from "./progress-indicator";
import {
  FileInput,
  FileInputList,
  FileInputTrigger,
} from "@/components/ui/file-input";
import { AttachmentPreviewCard } from "@/components/ui/attachment-preview-card";
import { getMessageResponseMeta } from "@/lib/statement-utils";
import { useWitnessStatement } from "@/components/intake/intake-context";
import { CheckIcon, PaperclipIcon, SkipForwardIcon } from "lucide-react";
import type { EvidenceDocument } from "@/lib/intake-evidence";

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
    setEvidence,
    setTab,
    isDemo,
    data,
    statementFormalization,
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
          const requestedEvidence = responseMeta?.evidence.requestedEvidence;
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
                      {requestedEvidence && (
                        <Button
                          className="bg-card/20"
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              multiple
                              accept={requestedEvidence.type}
                              onChange={(e) => {
                                void setEvidence(
                                  e.target.files,
                                  requestedEvidence.name,
                                );
                              }}
                            />
                            <PaperclipIcon />
                          </label>
                        </Button>
                      )}
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
                          void statementFormalization.handler();
                        }
                        setTab("statement");
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
    data,
    messages,
    sendMessage,
  } = useWitnessStatement();

  const isInputDisabled = isBusy || hasIntakeStopped || hasConvoEnded;

  const latestRequestedEvidence = [...messages]
    .reverse()
    .map((message) =>
      getMessageResponseMeta(message, data.statement.statement_config),
    )
    .find((metadata) => metadata?.evidence.requestedEvidence)
    ?.evidence.requestedEvidence;

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
        <div className="w-full flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {isDemoPlaybackActive
              ? "Playing demo conversation..."
              : "This is a demo. Responses are simulated."}
          </p>
          {isDemoPlaybackActive && (
            <Button size="sm" variant="outline" onClick={skipDemoPlayback}>
              Skip to end <SkipForwardIcon />
            </Button>
          )}
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage.handler(
              input,
              attachments,
              latestRequestedEvidence?.name,
            );
            setInput("");
            setAttachments([]);
          }}
          className="w-full space-y-2"
        >
          {latestRequestedEvidence && (
            <p className="text-xs text-muted-foreground">
              Requested evidence: {latestRequestedEvidence.name} (
              {latestRequestedEvidence.type})
            </p>
          )}
          <FileInput
            multiple
            accept={attachmentAccept}
            disabled={isInputDisabled}
            value={attachments}
            onChange={setAttachments}
          >
            <FileInputTrigger variant="outline">
              {latestRequestedEvidence
                ? "Attach requested evidence"
                : "Attach files"}
            </FileInputTrigger>
            <div className="mt-2 space-y-1.5">
              <FileInputList />
            </div>
          </FileInput>

          <div className="w-full flex gap-2">
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
              className="flex-1 min-h-0 resize-none overflow-hidden"
              rows={1}
              autoFocus
            />
            <Button
              type="submit"
              disabled={
                (!input.trim() && attachments.length === 0) || isInputDisabled
              }
            >
              Send
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
