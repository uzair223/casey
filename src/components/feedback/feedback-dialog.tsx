"use client";

import { useState } from "react";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-utils";
import { toast } from "@/lib/toast";
import type { ProductFeedbackKind } from "@/types";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [kind, setKind] = useState<Exclude<ProductFeedbackKind, "survey">>(
    "bug",
  );
  const [message, setMessage] = useState("");

  const reset = () => {
    setKind("bug");
    setMessage("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Report a bug or suggest an improvement. This goes to the Casey team,
            not your organisation inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2" role="group" aria-label="Feedback type">
            <Button
              type="button"
              size="sm"
              variant={kind === "bug" ? "brand" : "outline"}
              aria-pressed={kind === "bug"}
              onClick={() => setKind("bug")}
            >
              Bug
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "idea" ? "brand" : "outline"}
              aria-pressed={kind === "idea"}
              onClick={() => setKind("idea")}
            >
              Idea
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="firm-feedback-message">What happened?</Label>
            <Textarea
              id="firm-feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={
                kind === "bug"
                  ? "What went wrong, and what did you expect?"
                  : "What would make this easier?"
              }
            />
          </div>
        </div>
        <DialogFooter>
          <AsyncButton
            type="button"
            disabled={!message.trim()}
            pendingText="Sending..."
            onClick={async () => {
              await apiFetch("/api/feedback", {
                method: "POST",
                body: JSON.stringify({
                  kind,
                  message: message.trim(),
                  pagePath:
                    typeof window === "undefined"
                      ? undefined
                      : window.location.pathname,
                }),
              });
              toast.success("Thanks, we have that.");
              reset();
              onOpenChange(false);
            }}
          >
            Send
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
