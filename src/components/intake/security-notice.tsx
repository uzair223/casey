"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useState } from "react";

export function SecurityNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Card size="md" variant="secondary">
      <CardHeader className="flex-row items-center gap-2">
        <div className="text-xl shrink-0">🔒</div>
        <div className="flex-1">
          <CardTitle className="text-sm">Your session is secure</CardTitle>
          <CardDescription className="text-xs">
            Your session is protected with security monitoring. This link is for
            one-time use only and expires after submission or within the
            designated time period. All activities are logged for security
            purposes.
          </CardDescription>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto mb-auto text-xs"
          aria-label="Dismiss notice"
        >
          ✕
        </button>
      </CardHeader>
    </Card>
  );
}
