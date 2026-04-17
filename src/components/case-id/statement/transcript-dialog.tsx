"use client";

import { Loader2, MessageSquareTextIcon } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { getConversationHistory } from "@/lib/supabase/queries/statement";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageCard } from "@/components/ui/message";
import React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type TranscriptDialogProps = {
  statementId: string;
};

function TranscriptContent({ statementId }: { statementId: string }) {
  const {
    data: messages,
    isLoading,
    error,
  } = useAsync(
    async () => {
      return await getConversationHistory(statementId);
    },
    [statementId],
    {
      initialState: [],
      initialLoading: true,
      withUseEffect: true,
    },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load transcript. Please try again.
      </p>
    );
  }

  if (!messages.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No transcript messages available.
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[60vh] pr-4">
      <div className="flex flex-col gap-2">
        {messages.map((message) => (
          <React.Fragment key={message.id}>
            <span
              className={cn(
                "text-xs uppercase tracking-wide text-muted-foreground",
                message.role === "user" && "ml-auto",
              )}
            >
              {message.role === "assistant" ? "AI" : "Witness"}
            </span>
            <MessageCard message={message} key={message.id} />
          </React.Fragment>
        ))}
      </div>
    </ScrollArea>
  );
}

export function TranscriptDialog({ statementId }: TranscriptDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquareTextIcon className="h-4 w-4" />
          Open transcript
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Interview transcript</DialogTitle>
          <DialogDescription>
            Messages exchanged between the witness and AI assistant.
          </DialogDescription>
        </DialogHeader>

        <TranscriptContent statementId={statementId} />
      </DialogContent>
    </Dialog>
  );
}
