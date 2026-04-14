"use client";

import { useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-utils";

type StatementFollowUpCardProps = {
  statementId: string;
  canRequestFollowUp: boolean;
};

export function StatementFollowUpCard({
  statementId,
  canRequestFollowUp,
}: StatementFollowUpCardProps) {
  const [message, setMessage] = useState("");

  if (!canRequestFollowUp) {
    return null;
  }

  const sendFollowUp = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    await apiFetch(`/api/tenant/statement/${statementId}/request-follow-up`, {
      method: "POST",
      body: JSON.stringify({ message: trimmed }),
    });

    setMessage("");
    alert("Follow-up request sent to witness");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Request more details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Send a follow-up message to the witness when you need clarification or
          additional evidence.
        </p>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask for additional details, corrections, or supporting evidence"
          rows={4}
        />
        <AsyncButton
          type="button"
          onClick={sendFollowUp}
          pendingText="Sending follow-up..."
          disabled={!message.trim()}
        >
          Send follow-up request
        </AsyncButton>
      </CardContent>
    </Card>
  );
}
