"use client";

import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader } from "@/components/ui/card";
import { MarkdownMessage } from "./MarkdownMessage";
import { ProgressIndicator } from "./ProgressIndicator";
import { useWitnessStatement } from "@/contexts/WitnessStatementContext";
import { CheckIcon, MicIcon, PaperclipIcon } from "lucide-react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { cn } from "@/lib/utils";

export function ChatAreaContent() {
  const {
    messages,
    statementData,
    isGenerating,
    isPrepared,
    isSubmitted,
    handlePrepareStatement,
    isPreparing,
    setEvidence,
  } = useWitnessStatement();
  const intakeStopped =
    statementData?.status === "locked" ||
    messages.some(
      (message) =>
        message.role === "assistant" && message.meta?.deviation?.stopIntake,
    );
  const stopReason =
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" && message.meta?.deviation?.stopIntake,
      )?.meta?.deviation?.deviationReason ||
    "This conversation has been flagged as out of scope.";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <>
      <div className="space-y-4">
        {messages.map((message, idx) => (
          <React.Fragment key={idx}>
            <div
              className={`space-y-1.5 ${
                message.role === "user"
                  ? "animate-slide-in-user"
                  : "animate-slide-in-assistant"
              }`}
            >
              <div
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <Card
                  size="sm"
                  className="max-w-sm text-sm rounded-md!"
                  variant={message.role === "user" ? "accent" : "default"}
                  opacity={40}
                >
                  <CardHeader className="relative">
                    <span className="absolute text-transparent select-text whitespace-nowrap text-[0px]">
                      {message.role.toUpperCase()}:
                    </span>
                    {message.role === "assistant" ? (
                      <div className="prose prose-invert">
                        <MarkdownMessage content={message.content} />
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </CardHeader>
                </Card>
              </div>
              {message.role === "assistant" && (
                <>
                  {!isPreparing &&
                    !isPrepared &&
                    !isSubmitted &&
                    !isGenerating &&
                    message.meta?.evidence?.currentAsk && (
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
                            accept={message.meta?.evidence.currentAsk.type}
                            onChange={(e) =>
                              setEvidence(
                                e.target.files,
                                message.meta?.evidence.currentAsk?.name,
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
              !intakeStopped &&
              !isPrepared &&
              !isSubmitted &&
              !isGenerating && (
                <div className="flex justify-center pt-2">
                  <Button
                    className="pl-3"
                    variant="outline"
                    onClick={handlePrepareStatement}
                    disabled={isPreparing}
                  >
                    <CheckIcon />
                    {isPreparing ? "Preparing..." : "Prepare Statement"}
                  </Button>
                </div>
              )}
          </React.Fragment>
        ))}
        {isGenerating && (
          <Card size="sm" className="w-min rounded-md!" opacity={40}>
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
        {intakeStopped && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-sm rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              Intake stopped: {stopReason}
            </div>
          </div>
        )}
      </div>
      <div ref={messagesEndRef} />
    </>
  );
}

export function ChatAreaFooter() {
  const {
    messages,
    statementData,
    input,
    setInput,
    isDemo,
    isGenerating,
    isPreparing,
    isPrepared,
    isSubmitted,
    handleSubmitMessage,
  } = useWitnessStatement();

  const intakeStopped =
    statementData?.status === "locked" ||
    messages.some(
      (message) =>
        message.role === "assistant" && message.meta?.deviation?.stopIntake,
    );
  const isInputDisabled =
    intakeStopped || isPreparing || isPrepared || isSubmitted || isGenerating;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    setInput(transcript.trim());
  }, [transcript, setInput]);

  useEffect(() => {
    if (!listening) return;
    if (!isGenerating && !isPrepared && !isSubmitted) return;
    SpeechRecognition.stopListening();
  }, [isGenerating, isPrepared, isSubmitted, listening]);

  const handleToggleRecording = () => {
    if (!browserSupportsSpeechRecognition) return;
    if (listening) {
      SpeechRecognition.stopListening();
      return;
    }

    resetTranscript();
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      }
      SpeechRecognition.startListening({
        continuous: true,
        interimResults: true,
        language: "en-GB",
      });
    } catch {
      SpeechRecognition.stopListening();
    }
  };

  return (
    <div className="w-full pt-3 border-t border-border">
      {isDemo ? (
        <div className="w-full text-center text-muted-foreground text-sm">
          <p>This is a demo. Responses are simulated.</p>
        </div>
      ) : (
        <form
          ref={formRef}
          onSubmit={handleSubmitMessage}
          className="w-full flex gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              if (isInputDisabled) return;
              if (!input.trim()) return;
              formRef.current?.requestSubmit();
            }}
            placeholder="Type your response..."
            disabled={isInputDisabled || listening}
            className="flex-1 min-h-0 resize-none overflow-hidden"
            rows={1}
            autoFocus
          />
          {browserSupportsSpeechRecognition && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleToggleRecording}
              disabled={!isMicrophoneAvailable || isInputDisabled}
              className={cn(listening && "bg-accent text-accent-foreground")}
              aria-pressed={listening}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
            >
              <MicIcon className={cn(listening && "animate-pulse")} />
            </Button>
          )}
          <Button type="submit" disabled={!input.trim() || isInputDisabled}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
