"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type IntakePreviewProps = {
  firmName: string;
  welcome: string;
  primaryColor: string;
  logoUrl: string;
  hideCaseyMark: boolean;
  leadTypeNames: string[];
};

export function IntakePreview({
  firmName,
  welcome,
  primaryColor,
  logoUrl,
  hideCaseyMark,
  leadTypeNames,
}: IntakePreviewProps) {
  const [selectedType, setSelectedType] = useState<string | null>(
    leadTypeNames.length === 1 ? leadTypeNames[0] : null,
  );
  const showingChooser = leadTypeNames.length > 1 && !selectedType;
  const accent = /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#1f3a2e";

  if (showingChooser) {
    return (
      <div className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-medium">Tell {firmName} what happened</h2>
          <p className="text-sm text-muted-foreground">
            Choose the kind of enquiry, then Casey will ask for the details the firm needs.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {leadTypeNames.map((name) => (
            <Button
              key={name}
              type="button"
              variant="outline"
              onClick={() => setSelectedType(name)}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leadTypeNames.length > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSelectedType(null)}
        >
          Choose a different enquiry
        </Button>
      ) : null}
      <div className="flex h-[32rem] flex-col rounded-2xl border bg-background shadow-sm">
        <div
          className="flex items-center gap-3 rounded-t-2xl px-4 py-3 text-white"
          style={{ backgroundColor: accent }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 rounded bg-white object-contain"
            />
          ) : null}
          <div>
            <p className="text-sm font-medium">{firmName}</p>
            {hideCaseyMark ? null : (
              <p className="text-xs text-white/80">Casey</p>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p
            className="mr-8 rounded-2xl px-3 py-2 text-sm text-white"
            style={{ backgroundColor: accent }}
          >
            {welcome}
          </p>
        </div>
        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(event) => event.preventDefault()}
        >
          <Input placeholder="Type your reply" disabled />
          <Button type="button" disabled>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
