"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import {
  DraggableDialog,
  DraggableDialogContent,
  DraggableDialogHeader,
} from "@/components/ui/draggable-dialog";
import { MessageCard } from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { Message } from "@/types";
import { MessageSquareText, Sparkles, Trash2, X, Zap } from "lucide-react";

type ReviewWithAIDialogProps = React.ComponentProps<typeof Textarea> & {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  buffer: ArrayBuffer | null;
  documentName: string;
  onReviewComplete?: (buffer: ArrayBuffer) => void;
};

type ReviewWithAIProps = React.ComponentProps<typeof Textarea> & {
  getBuffer: () => Promise<ArrayBuffer | null>;
  documentName: string;
  onReviewComplete?: (buffer: ArrayBuffer) => void;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

type ChatMessage = Message & {
  status?: "pending" | "complete" | "error";
};

type ReviewWithAIContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  prepareAndOpen: () => Promise<void>;
};

const ReviewWithAIContext =
  React.createContext<ReviewWithAIContextValue | null>(null);

function useReviewWithAIContext() {
  const context = React.useContext(ReviewWithAIContext);
  if (!context) {
    throw new Error("ReviewWithAITrigger must be used within ReviewWithAI");
  }
  return context;
}

export function ReviewWithAITrigger({
  children,
  onClick,
  type = "button",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { prepareAndOpen } = useReviewWithAIContext();

  return (
    <Button
      type={type}
      onClick={(event) => {
        void prepareAndOpen();
        onClick?.(event);
      }}
      {...props}
    >
      {children ?? (
        <>
          <Zap /> Review with AI
        </>
      )}
    </Button>
  );
}

export function ReviewWithAI({
  getBuffer,
  documentName,
  onReviewComplete,
  onOpenChange,
  children,
  ...props
}: ReviewWithAIProps) {
  const [open, setOpen] = React.useState(false);
  const [buffer, setBuffer] = React.useState<ArrayBuffer | null>(null);

  React.useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const prepareAndOpen = React.useCallback(async () => {
    const nextBuffer = await getBuffer();
    if (!nextBuffer) return;
    setBuffer(nextBuffer);
    setOpen(true);
  }, [getBuffer]);

  return (
    <ReviewWithAIContext.Provider value={{ open, setOpen, prepareAndOpen }}>
      <ReviewWithAIDialog
        isOpen={open}
        onOpenChange={setOpen}
        buffer={buffer}
        documentName={documentName}
        onReviewComplete={onReviewComplete}
        {...props}
      >
        {children}
      </ReviewWithAIDialog>
    </ReviewWithAIContext.Provider>
  );
}

export function ReviewWithAIDialog({
  isOpen,
  onOpenChange,
  buffer,
  documentName,
  onReviewComplete,
  className,
  children,
  ...props
}: ReviewWithAIDialogProps) {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [hasPendingReview, setHasPendingReview] = React.useState(false);
  const transcriptEndRef = React.useRef<HTMLDivElement>(null);
  const activeAssistantMessageIdRef = React.useRef<string | null>(null);
  const lastBufferRef = React.useRef<ArrayBuffer | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const updateAssistantMessage = React.useCallback(
    (messageId: string, content: string, status: ChatMessage["status"]) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content,
                status,
              }
            : message,
        ),
      );
    },
    [],
  );

  const review = useAsync(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !buffer) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: input.trim(),
    };
    const assistantMessageId = crypto.randomUUID();
    activeAssistantMessageIdRef.current = assistantMessageId;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "Reviewing your document...",
        status: "pending",
      },
    ]);
    setInput("");

    try {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const bufferBase64 = btoa(binary);

      const result = (await apiFetch("/api/generate/docx-review", {
        method: "POST",
        body: JSON.stringify({
          bufferBase64,
          reviewGoal: input.trim(),
        }),
      })) as {
        bufferBase64: string;
        summary: {
          commentsCount: number;
          proposalsCount: number;
          generatedResponse?: string;
          comments?: Array<{
            text: string;
            rangeStart: number;
            rangeEnd: number;
          }>;
          proposals?: Array<{
            oldText: string;
            newText: string;
            rangeStart: number;
            rangeEnd: number;
          }>;
        };
      };

      const decodedBinary = atob(result.bufferBase64);
      const reviewedBytes = new Uint8Array(decodedBinary.length);
      for (let i = 0; i < decodedBinary.length; i++) {
        reviewedBytes[i] = decodedBinary.charCodeAt(i);
      }
      lastBufferRef.current = reviewedBytes.buffer;
      setHasPendingReview(true);

      const generatedSummary = result.summary.generatedResponse?.trim();
      const summary = generatedSummary
        ? `${generatedSummary}\n\n*Use Apply Review to update the document.*`
        : "Review complete. Use Apply Review to update the document.";

      updateAssistantMessage(assistantMessageId, summary, "complete");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to review document";
      updateAssistantMessage(assistantMessageId, errorMessage, "error");
    }
  });

  const clearConversation = () => {
    setMessages([]);
    setInput("");
    lastBufferRef.current = null;
    setHasPendingReview(false);
  };

  const handleApplyReview = () => {
    if (!lastBufferRef.current) return;
    onReviewComplete?.(lastBufferRef.current);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Review applied to the document. Open the comments sidebar to inspect suggestions and proposals.",
        status: "complete",
      },
    ]);
    lastBufferRef.current = null;
    setHasPendingReview(false);
  };

  return (
    <DraggableDialog open={isOpen} onOpenChange={onOpenChange}>
      {children}
      <DraggableDialogContent
        className={className}
        data-docx-review-window="true"
      >
        <DraggableDialogHeader className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" />
            <div>
              <p className="text-sm font-medium">AI Document Reviewer</p>
              <p className="text-xs text-muted-foreground">
                Drag this window anywhere on screen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={clearConversation}
              title="Clear conversation"
            >
              <Trash2 />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              title="Close"
            >
              <X />
            </Button>
          </div>
        </DraggableDialogHeader>

        <div className="border-b bg-muted/30 px-4 py-3">
          <form onSubmit={review.handler} className="space-y-3">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                if (!input.trim() || !buffer) return;
                event.currentTarget.form?.requestSubmit();
              }}
              className="min-h-24 resize-none"
              placeholder="Ask for clarity edits, consistency fixes, or legal tone improvements..."
              disabled={review.isLoading}
              {...props}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Temporary Chat
                <br /> Conversation will be lost when you switch documents or
                refresh.
              </p>
              <div className="flex items-center gap-2">
                {hasPendingReview ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleApplyReview}
                  >
                    Apply Review
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  disabled={review.isLoading || !input.trim() || !buffer}
                >
                  {review.isLoading ? "Reviewing..." : "Send"}
                  <Sparkles />
                </Button>
              </div>
            </div>
          </form>
        </div>

        <ScrollArea className="h-90 px-4 py-4">
          <div className="space-y-3 pr-2">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Review and refine your active DOCX document with the help of AI.
              </div>
            ) : null}

            {messages.map((message) => (
              <div key={message.id} className="space-y-1">
                <MessageCard message={message} />
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </ScrollArea>
      </DraggableDialogContent>
    </DraggableDialog>
  );
}
