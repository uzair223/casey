"use client";

import { useState } from "react";

import {
  ChatAreaContent,
  ChatAreaFooter,
  type ChatAreaBubbleColors,
} from "@/components/chat/chat-area";
import { SelectorChoice } from "@/components/leads/selector-choice";
import { Button } from "@/components/ui/button";

type IntakePreviewProps = {
  firmName: string;
  welcome: string;
  selectorTitle: string;
  selectorCaption: string;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  userBubbleColor: string;
  logoUrl: string;
  hideCaseyMark: boolean;
  hideAvatars: boolean;
  leadTypeNames: string[];
};

export function IntakePreview({
  firmName,
  welcome,
  selectorTitle,
  selectorCaption,
  primaryColor,
  textColor,
  backgroundColor,
  userBubbleColor,
  logoUrl,
  hideCaseyMark,
  hideAvatars,
  leadTypeNames,
}: IntakePreviewProps) {
  const [selectedType, setSelectedType] = useState<string | null>(
    leadTypeNames.length === 1 ? leadTypeNames[0] : null,
  );
  const showingChooser = leadTypeNames.length > 1 && !selectedType;
  const bubbleColors: ChatAreaBubbleColors = {
    assistant: { backgroundColor: primaryColor, color: textColor },
    user: { backgroundColor: userBubbleColor, color: textColor },
  };

  if (showingChooser) {
    return (
      <div
        className="space-y-4 rounded-2xl border p-4 shadow-sm"
        style={{ backgroundColor }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-12 w-12 rounded bg-white object-contain"
          />
        ) : null}
        <div className="space-y-1">
          <h2 className="text-xl font-medium" style={{ color: textColor }}>
            {selectorTitle}
          </h2>
          <p className="text-sm" style={{ color: textColor }}>
            {selectorCaption}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {leadTypeNames.map((name) => (
            <SelectorChoice
              key={name}
              primaryColor={primaryColor}
              textColor={textColor}
              onClick={() => setSelectedType(name)}
            >
              {name}
            </SelectorChoice>
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
      <div
        className="flex h-[32rem] flex-col rounded-2xl border shadow-sm"
        style={{ backgroundColor }}
      >
        <div
          className="flex items-center gap-3 rounded-t-2xl px-4 py-3 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-8 rounded bg-white object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{firmName}</p>
            {selectedType || !hideCaseyMark ? (
              <p className="truncate text-xs text-white/80">
                {[selectedType, hideCaseyMark ? null : "Casey"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ChatAreaContent
            messages={[
              { role: "assistant", content: welcome },
              { role: "user", content: "I need some advice." },
            ]}
            userAvatar={{ name: "preview-enquirer", title: "You" }}
            bubbleColors={bubbleColors}
            hideAvatars={hideAvatars}
            autoScroll={false}
            variant="lead"
          />
        </div>
        <div className="px-3 pb-3">
          <ChatAreaFooter
            readOnly
            allowAttachments={false}
            placeholder="Type your reply"
          />
        </div>
      </div>
    </div>
  );
}
