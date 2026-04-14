"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader } from "@/components/ui/card";
import { MarkdownMessage } from "../ui/md-message";
import { ProgressIndicator } from "./progress-indicator";
import { useWitnessStatement } from "@/components/intake/intake-context";
import { CheckIcon, PaperclipIcon, SkipForwardIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <>
      <div className="space-y-2">
        {messages.map((message, idx) => (
          <React.Fragment key={idx}>
            <div
              className={`space-y-1 ${
                message.role === "user"
                  ? "animate-slide-in-user"
                  : "animate-slide-in-assistant"
              }`}
            >
              <MessageBox message={message} />
              {message.role === "assistant" && (
                <>
                  {message.meta?.evidence?.requestedEvidence && (
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
                          accept={message.meta?.evidence.requestedEvidence.type}
                          onChange={(e) =>
                            setEvidence(
                              e.target.files,
                              message.meta?.evidence.requestedEvidence?.name,
                            )
                          }
                        />
                        <PaperclipIcon />
                      </label>
                    </Button>
                  )}
                  {message.meta?.progress && (
                    <ProgressIndicator progress={message.meta?.progress} />
                  )}
                </>
              )}
            </div>
            {message.role === "assistant" &&
              idx === messages.length - 1 &&
              message.meta?.progress?.readyToPrepare &&
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
        ))}
        {sendMessage.isLoading && (
          <Card size="sm" className="w-min rounded-md!">
            <CardHeader className="flex flex-row justify-center gap-1">
              <div
                className="m-0 w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="m-0 w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></div>
              <div
                className="m-0 w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></div>
            </CardHeader>
          </Card>
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

  const {
    isDemo,
    isBusy,
    hasIntakeStopped,
    hasConvoEnded,
    isDemoPlaybackActive,
    skipDemoPlayback,
    sendMessage,
  } = useWitnessStatement();

  const isInputDisabled = isBusy || hasIntakeStopped || hasConvoEnded;

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
            void sendMessage.handler(input);
            setInput("");
          }}
          className="w-full flex gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              if (isInputDisabled || !input.trim()) return;
              formRef.current?.requestSubmit();
            }}
            placeholder={
              hasConvoEnded ? "Conversation ended" : "Type your response..."
            }
            disabled={isInputDisabled}
            className="flex-1 min-h-0 resize-none overflow-hidden"
            rows={1}
            autoFocus
          />
          <Button type="submit" disabled={!input.trim() || isInputDisabled}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}

export function MessageBox({
  message,
}: {
  message: { role: string; content: string };
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <Card
        size="sm"
        className={cn(
          "max-w-sm text-sm rounded-3xl [--card-opacity:90%]",
          isUser ? "rounded-tr-sm" : "rounded-tl-sm",
        )}
        variant={isUser ? "primary" : "default"}
      >
        <CardHeader className="relative">
          <span className="absolute text-transparent select-text whitespace-nowrap text-[0px]">
            {message.role.toUpperCase()}:
          </span>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-invert">
              <MarkdownMessage content={message.content} />
            </div>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}
