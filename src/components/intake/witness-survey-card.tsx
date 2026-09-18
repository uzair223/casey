"use client";

import { useState } from "react";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { toast } from "@/lib/toast";

const ratings = [1, 2, 3, 4, 5] as const;

export function WitnessSurveyCard({ token }: { token: string }) {
  const status = useAsync(
    () =>
      apiFetch<{ submitted: boolean }>(`/api/intake/${token}/feedback`, {
        requireAuth: false,
      }),
    [token],
    { enabled: true },
  );
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const alreadySubmitted = submitted || status.data?.submitted === true;

  if (status.isLoading && !status.data) {
    return null;
  }

  if (alreadySubmitted) {
    return (
      <div className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
        Thanks — your feedback helps us improve the interview.
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-border p-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div>
        <p className="text-sm font-medium">How easy was this interview?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. 1 is difficult, 5 is easy.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ease rating">
        {ratings.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={rating === value ? "brand" : "outline"}
            aria-pressed={rating === value}
            className="min-w-9"
            onClick={() => setRating(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="witness-survey-comment">Anything confusing?</Label>
        <Textarea
          id="witness-survey-comment"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Optional"
        />
      </div>
      <AsyncButton
        type="button"
        size="sm"
        disabled={rating == null}
        pendingText="Sending..."
        onClick={async () => {
          if (rating == null) return;
          try {
            await apiFetch(`/api/intake/${token}/feedback`, {
              method: "POST",
              requireAuth: false,
              body: JSON.stringify({
                rating,
                message: message.trim() || undefined,
              }),
            });
            setSubmitted(true);
          } catch (error) {
            const text =
              error instanceof Error ? error.message : "Failed to send feedback";
            if (/already shared feedback/i.test(text)) {
              setSubmitted(true);
              return;
            }
            toast.errorFromUnknown(error, "Failed to send feedback");
          }
        }}
      >
        Send feedback
      </AsyncButton>
    </form>
  );
}
