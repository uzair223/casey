import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { cn } from "@/lib/utils";
import {
  MessageSquareText,
  RotateCcw,
  SparklesIcon,
  Trash2,
  X,
} from "lucide-react";
import React from "react";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { MessageCard } from "@/components/ui/message";
import { Message } from "@/types";

type GenerateWithAIProps<T extends z.ZodObject> = React.ComponentProps<
  typeof Textarea
> & {
  resetTrigger: unknown;
  schema: T;
  seedData?: Partial<z.output<T>>;
  onRequestSent?: () => void;
  onPartial?: (partial: {
    data?: Partial<z.output<T>>;
    summary?: string;
  }) => void;
  onComplete?: (result: { data: z.output<T>; summary: string }) => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
};

type GenerateWithAIContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

const GenerateWithAIContext =
  React.createContext<GenerateWithAIContextValue | null>(null);

function useGenerateWithAIContext() {
  const context = React.useContext(GenerateWithAIContext);
  if (!context) {
    throw new Error("GenerateWithAITrigger must be used within GenerateWithAI");
  }
  return context;
}

export function GenerateWithAITrigger({
  children,
  onClick,
  type = "button",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpen } = useGenerateWithAIContext();

  return (
    <Button
      type={type}
      onClick={(event) => {
        setOpen(true);
        onClick?.(event);
      }}
      {...props}
    >
      {children ?? (
        <>
          <SparklesIcon /> Generate with AI
        </>
      )}
    </Button>
  );
}

export function GenerateWithAI<T extends z.ZodObject>({
  className,
  onRequestSent,
  onPartial,
  onComplete,
  onError,
  schema: _schema,
  seedData,
  children,
  resetTrigger,
  ...props
}: GenerateWithAIProps<T>) {
  type GeneratedPayload = { data: z.output<T>; summary: string };
  type PartialGeneratedPayload = {
    data?: Partial<z.output<T>>;
    summary?: string;
  };
  type ChatMessage = Message & {
    status?: "pending" | "complete" | "error";
    restorePoint?: GeneratedPayload;
  };

  const [input, setInput] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [position, setPosition] = React.useState({ x: 0, y: 96 });
  const [isDragging, setIsDragging] = React.useState(false);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const transcriptEndRef = React.useRef<HTMLDivElement>(null);
  const activeAssistantMessageIdRef = React.useRef<string | null>(null);
  const dragStateRef = React.useRef<{
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const schema = React.useMemo(() => {
    return z.object({
      data: _schema,
      summary: z
        .string()
        .describe(
          "Small human-readable summary of the generated output, i.e. a brief description of the changes made or things added.",
        ),
    });
  }, [_schema]);

  const partialSchema = React.useMemo(
    () =>
      z.object({
        data: _schema.partial().optional(),
        summary: z.string().optional(),
      }) as unknown as z.ZodType<PartialGeneratedPayload>,
    [_schema],
  );

  React.useEffect(() => {
    setInput("");
    setMessages([]);
  }, [resetTrigger]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    setPosition({
      x: Math.max(16, window.innerWidth - 480),
      y: 96,
    });
  }, [mounted]);

  React.useEffect(() => {
    if (!open) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current || !popupRef.current) return;

      const rect = popupRef.current.getBoundingClientRect();
      const width = rect.width || 440;
      const height = rect.height || 620;
      const nextX = Math.min(
        Math.max(16, event.clientX - dragStateRef.current.offsetX),
        Math.max(16, window.innerWidth - width - 16),
      );
      const nextY = Math.min(
        Math.max(16, event.clientY - dragStateRef.current.offsetY),
        Math.max(16, window.innerHeight - height - 16),
      );

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

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

  const saveRestorePoint = React.useCallback(
    (messageId: string, payload: GeneratedPayload) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                restorePoint: payload,
              }
            : message,
        ),
      );
    },
    [],
  );

  const applyRestorePoint = React.useCallback(
    (messageId: string) => {
      setMessages((prev) => {
        const index = prev.findIndex((message) => message.id === messageId);
        if (index < 0) {
          return prev;
        }

        const restorePoint = prev[index].restorePoint;
        if (restorePoint) {
          onComplete?.(restorePoint);
        }

        // Keep conversation up to this restore point and clear everything after it.
        return prev.slice(0, index + 1);
      });
    },
    [onComplete],
  );

  const generate = useAsync(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim()) return;

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: input.trim(),
      };
      const assistantMessageId = crypto.randomUUID();
      activeAssistantMessageIdRef.current = assistantMessageId;
      const conversationHistory = messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "Generating response...",
          status: "pending",
        },
      ]);
      setInput("");

      const response = await apiFetch(`/api/generate`, {
        method: "POST",
        body: JSON.stringify({
          input: userMessage.content,
          conversationHistory,
          seedData,
          responseFormat: zodResponseFormat(schema, "template_response"),
        }),
        returnType: "response",
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) ||
            "An unknown error occurred. Please try again.",
        );
      }

      onRequestSent?.();

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      let latestParsed: unknown = null;

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              continue;
            }

            const parsedLine = JSON.parse(trimmed) as PartialGeneratedPayload;
            const partialParsed = partialSchema.safeParse(parsedLine);
            if (partialParsed.success) {
              const nextPartial: PartialGeneratedPayload = {
                data: parsedLine.data,
                summary: parsedLine.summary,
              };
              onPartial?.(nextPartial);

              const assistantSummary =
                nextPartial.summary ?? "Generating response...";
              updateAssistantMessage(
                assistantMessageId,
                assistantSummary,
                "pending",
              );

              if (nextPartial.data) {
                latestParsed = parsedLine;
              }
            }
          }
        }

        if (done) {
          const flushChunk = decoder.decode();
          if (flushChunk) {
            buffer += flushChunk;
          }

          const trailing = buffer.trim();
          if (trailing) {
            const parsedTrailing = JSON.parse(
              trailing,
            ) as PartialGeneratedPayload;
            const partialParsed = partialSchema.safeParse(parsedTrailing);
            if (partialParsed.success) {
              const nextPartial: PartialGeneratedPayload = {
                data: parsedTrailing.data,
                summary: parsedTrailing.summary,
              };
              onPartial?.(nextPartial);

              const assistantSummary =
                nextPartial.summary ?? "Generating response...";
              updateAssistantMessage(
                assistantMessageId,
                assistantSummary,
                "pending",
              );

              if (nextPartial.data) {
                latestParsed = parsedTrailing;
              }
            }
          }
          break;
        }
      }

      const parsed = schema.safeParse(latestParsed);
      if (!parsed.success) {
        updateAssistantMessage(
          assistantMessageId,
          "Failed to parse AI response.",
          "error",
        );
        throw new Error(
          parsed.error.issues.map((err) => err.message).join("; ") ||
            "Failed to parse AI response",
        );
      }

      updateAssistantMessage(
        assistantMessageId,
        parsed.data.summary,
        "complete",
      );
      saveRestorePoint(assistantMessageId, parsed.data as GeneratedPayload);
      activeAssistantMessageIdRef.current = null;
      onComplete?.(parsed.data as GeneratedPayload);
    },
    [
      input,
      seedData,
      schema,
      onPartial,
      onComplete,
      updateAssistantMessage,
      saveRestorePoint,
      partialSchema,
      messages,
    ],
    {
      initialLoading: false,
      withUseEffect: false,
      onError: (error) => {
        if (activeAssistantMessageIdRef.current) {
          updateAssistantMessage(
            activeAssistantMessageIdRef.current,
            error.message || "An error occurred.",
            "error",
          );
        }
        activeAssistantMessageIdRef.current = null;
        onError?.(error);
      },
    },
  );

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setIsDragging(true);
    event.preventDefault();
  };

  const clearConversation = () => {
    setMessages([]);
  };

  const popup =
    mounted && open
      ? createPortal(
          <div
            ref={popupRef}
            className={cn(
              "fixed z-50 w-[min(92vw,520px)] overflow-hidden rounded-xl border bg-background shadow-2xl",
              className,
            )}
            style={{ left: position.x, top: position.y }}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b px-4 py-3",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerDown={handleDragStart}
            >
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">AI Template Generator</p>
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
                  onClick={() => setOpen(false)}
                  title="Close"
                >
                  <X />
                </Button>
              </div>
            </div>

            <div className="border-b bg-muted/30 px-4 py-3">
              <form onSubmit={generate.handler} className="space-y-3">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    if (!input.trim()) return;
                    event.currentTarget.form?.requestSubmit();
                  }}
                  className="min-h-24 resize-none"
                  placeholder="Ask for changes, refinements, or a new template direction..."
                  {...props}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Temporary Chat
                    <br /> Conversation will be lost when you switch templates
                    or refresh.
                  </p>
                  <Button
                    type="submit"
                    disabled={generate.isLoading || !input.trim()}
                  >
                    {generate.isLoading ? "Generating..." : "Send"}
                    <SparklesIcon />
                  </Button>
                </div>
              </form>
            </div>

            <ScrollArea className="h-90 px-4 py-4">
              <div className="space-y-3 pr-2">
                {messages.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Generate & refine your active template with the help of AI.
                  </div>
                ) : null}

                {messages.map((message) => (
                  <div key={message.id} className="space-y-1">
                    <MessageCard message={message} />
                    {message.role === "assistant" &&
                    message.status === "complete" &&
                    message.restorePoint ? (
                      <div className="flex justify-start pl-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => applyRestorePoint(message.id ?? "")}
                        >
                          <RotateCcw /> Restore This Point
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </ScrollArea>
          </div>,
          document.body,
        )
      : null;

  return (
    <GenerateWithAIContext.Provider value={{ open, setOpen }}>
      <div>{children}</div>
      {popup}
    </GenerateWithAIContext.Provider>
  );
}
