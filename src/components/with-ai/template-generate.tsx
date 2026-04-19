import { Button } from "@/components/ui/button";
import {
  DraggableDialog,
  DraggableDialogContent,
  DraggableDialogHeader,
} from "@/components/ui/draggable-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
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
import { buildGenerateConfigResponseSchema } from "@/lib/schema/generate-config-response-format";

type GeneratedPayload<T extends z.ZodObject> = z.output<
  ReturnType<typeof buildGenerateConfigResponseSchema<T>>
>;
type PartialGeneratedPayload<T extends z.ZodObject> = Partial<
  GeneratedPayload<T>
>;

type GenerateWithAIDialogProps<T extends z.ZodObject> = React.ComponentProps<
  typeof Textarea
> & {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  resetTrigger: unknown;
  schema: T;
  seedData?: Partial<z.output<T>>;
  onRequestSent?: () => void;
  onPartial?: (partial: PartialGeneratedPayload<T>) => void;
  onComplete?: (result: GeneratedPayload<T>) => void;
  onError?: (error: Error) => void;
};

type GenerateWithAIProps<T extends z.ZodObject> = Omit<
  GenerateWithAIDialogProps<T>,
  "isOpen" | "onOpenChange"
> & {
  children?: React.ReactNode;
};

type GenerateWithAIContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  prepareAndOpen: () => Promise<void>;
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
  const { prepareAndOpen } = useGenerateWithAIContext();

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
          <SparklesIcon /> Generate with AI
        </>
      )}
    </Button>
  );
}

export function GenerateWithAI<T extends z.ZodObject>({
  resetTrigger,
  schema,
  seedData,
  onRequestSent,
  onPartial,
  onComplete,
  onError,
  children,
  ...props
}: GenerateWithAIProps<T>) {
  const [open, setOpen] = React.useState(false);

  const prepareAndOpen = React.useCallback(async () => {
    setOpen(true);
  }, []);

  return (
    <GenerateWithAIContext.Provider value={{ open, setOpen, prepareAndOpen }}>
      <div>{children}</div>
      <GenerateWithAIDialog
        isOpen={open}
        onOpenChange={setOpen}
        resetTrigger={resetTrigger}
        schema={schema}
        seedData={seedData}
        onRequestSent={onRequestSent}
        onPartial={onPartial}
        onComplete={onComplete}
        onError={onError}
        {...props}
      />
    </GenerateWithAIContext.Provider>
  );
}

export function GenerateWithAIDialog<T extends z.ZodObject>({
  isOpen,
  onOpenChange,
  className,
  onRequestSent,
  onPartial,
  onComplete,
  onError,
  schema: _schema,
  seedData,
  resetTrigger,
  ...props
}: GenerateWithAIDialogProps<T>) {
  type ChatMessage = Message & {
    createdAt?: number;
    status?: "pending" | "complete" | "error";
    restorePoint?: z.output<T>;
  };

  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const transcriptEndRef = React.useRef<HTMLDivElement>(null);
  const activeAssistantMessageIdRef = React.useRef<string | null>(null);
  const latestConfigRef = React.useRef<z.output<T> | null>(
    (seedData as z.output<T> | undefined) ?? null,
  );

  const schema = React.useMemo(
    () => buildGenerateConfigResponseSchema(_schema),
    [_schema],
  );

  const partialSchema = React.useMemo(() => schema.partial(), [schema]);

  const formatRestoreTime = React.useCallback((timestamp?: number) => {
    if (!timestamp) {
      return "this point";
    }

    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, []);

  React.useEffect(() => {
    setInput("");
    latestConfigRef.current = (seedData as z.output<T> | undefined) ?? null;
    setMessages([]);
  }, [resetTrigger]);

  React.useEffect(() => {
    latestConfigRef.current = (seedData as z.output<T> | undefined) ?? null;
  }, [seedData]);

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

  const saveRestorePoint = React.useCallback(
    (messageId: string, payload: z.output<T>) => {
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
      const targetMessage = messages.find(
        (message) => message.id === messageId,
      );
      const restoreData = targetMessage?.restorePoint ?? null;
      let restoreTimeText = "this point";

      if (targetMessage) {
        restoreTimeText = formatRestoreTime(targetMessage.createdAt);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Rolled back to restore point from ${restoreTimeText}.`,
          createdAt: Date.now(),
          status: "complete",
        },
      ]);

      if (restoreData) {
        latestConfigRef.current = restoreData;
        const restorePayload: GeneratedPayload<T> = {
          kind: "patch",
          message: "Restore checkpoint",
          data: restoreData,
        };
        onComplete?.(restorePayload);
      }
    },
    [messages, onComplete, formatRestoreTime],
  );

  const generate = useAsync(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim()) return;

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: input.trim(),
        createdAt: Date.now(),
      };
      const assistantMessageId = crypto.randomUUID();
      activeAssistantMessageIdRef.current = assistantMessageId;
      const checkpointBeforeResponse = latestConfigRef.current;
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
          createdAt: Date.now(),
          status: "pending",
        },
      ]);
      setInput("");

      const response = await apiFetch(`/api/generate/config`, {
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

            const parsedLine = JSON.parse(
              trimmed,
            ) as PartialGeneratedPayload<T>;
            const partialParsed = partialSchema.safeParse(parsedLine);
            if (partialParsed.success) {
              const nextPartial: PartialGeneratedPayload<T> = {
                kind: parsedLine.kind,
                data: parsedLine.data,
                message: parsedLine.message,
              };
              onPartial?.(nextPartial);

              const assistantmessage =
                nextPartial.message ?? "Generating response...";
              updateAssistantMessage(
                assistantMessageId,
                assistantmessage,
                "pending",
              );

              const hasCompleteMessagePayload =
                nextPartial.kind === "message" &&
                nextPartial.message &&
                nextPartial.data === null;
              const hasCompletePatchPayload =
                nextPartial.kind === "patch" &&
                Boolean(nextPartial.message) &&
                Boolean(nextPartial.data);

              if (hasCompleteMessagePayload || hasCompletePatchPayload) {
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
            ) as PartialGeneratedPayload<T>;
            const partialParsed = partialSchema.safeParse(parsedTrailing);
            if (partialParsed.success) {
              const nextPartial: PartialGeneratedPayload<T> = {
                data: parsedTrailing.data,
                message: parsedTrailing.message,
              };
              onPartial?.(nextPartial);

              const assistantmessage =
                nextPartial.message ?? "Generating response...";
              updateAssistantMessage(
                assistantMessageId,
                assistantmessage,
                "pending",
              );

              const hasCompleteMessagePayload =
                nextPartial.kind === "message" &&
                nextPartial.message &&
                nextPartial.data === null;
              const hasCompletePatchPayload =
                nextPartial.kind === "patch" &&
                nextPartial.message &&
                nextPartial.data;

              if (hasCompleteMessagePayload || hasCompletePatchPayload) {
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
        parsed.data.message,
        "complete",
      );
      if (parsed.data.kind === "patch") {
        if (parsed.data.data) {
          latestConfigRef.current = parsed.data.data as z.output<T>;
        }

        if (checkpointBeforeResponse) {
          saveRestorePoint(assistantMessageId, checkpointBeforeResponse);
        }
      }
      activeAssistantMessageIdRef.current = null;
      onComplete?.(parsed.data as GeneratedPayload<T>);
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

  const clearConversation = () => {
    setMessages([]);
    setInput("");
  };

  const messageBlocks = React.useMemo(() => {
    const blocks: Array<
      | {
          key: string;
          user: ChatMessage;
          assistant: ChatMessage;
        }
      | {
          key: string;
          message: ChatMessage;
        }
    > = [];

    for (let index = 0; index < messages.length; index += 1) {
      const current = messages[index];
      const next = messages[index + 1];

      if (current.role === "user" && next?.role === "assistant") {
        blocks.push({
          key: `${current.id ?? `user-${index}`}-${next.id ?? `assistant-${index + 1}`}`,
          user: current,
          assistant: next,
        });
        index += 1;
        continue;
      }

      blocks.push({
        key: current.id ?? `message-${index}`,
        message: current,
      });
    }

    return blocks;
  }, [messages]);

  return (
    <DraggableDialog open={isOpen} onOpenChange={onOpenChange}>
      <DraggableDialogContent className={className}>
        <DraggableDialogHeader className="flex items-center justify-between border-b px-4 py-3">
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
              onClick={() => onOpenChange(false)}
              title="Close"
            >
              <X />
            </Button>
          </div>
        </DraggableDialogHeader>

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
                <br /> Conversation will be lost when you switch templates or
                refresh.
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

            {messageBlocks.map((block) => {
              if ("message" in block) {
                const message = block.message;

                return (
                  <div key={block.key} className="group space-y-1">
                    <MessageCard message={message} />
                  </div>
                );
              }

              const { user, assistant } = block;

              return (
                <div key={block.key} className="group space-y-1">
                  {assistant.status === "complete" && assistant.restorePoint ? (
                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="h-px flex-1 bg-muted-foreground/30" />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-[11px] text-muted-foreground"
                        onClick={() => applyRestorePoint(assistant.id ?? "")}
                      >
                        Restore Checkpoint
                      </Button>
                      <div className="h-px flex-1 bg-muted-foreground/30" />
                    </div>
                  ) : null}
                  <MessageCard message={user} />
                  <MessageCard message={assistant} />
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>
        </ScrollArea>
      </DraggableDialogContent>
    </DraggableDialog>
  );
}
