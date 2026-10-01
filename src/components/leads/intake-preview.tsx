"use client";

import {
  ChatAreaContent,
  ChatAreaFooter,
  type ChatAreaBubbleColors,
} from "@/components/chat/chat-area";

type IntakePreviewProps = {
  firmName: string;
  welcome: string;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  userBubbleColor: string;
  logoUrl: string;
  hideCaseyMark: boolean;
  hideAvatars: boolean;
};

export function IntakePreview({
  firmName,
  welcome,
  primaryColor,
  textColor,
  backgroundColor,
  userBubbleColor,
  logoUrl,
  hideCaseyMark,
  hideAvatars,
}: IntakePreviewProps) {
  const bubbleColors: ChatAreaBubbleColors = {
    assistant: { backgroundColor: primaryColor, color: textColor },
    user: { backgroundColor: userBubbleColor, color: textColor },
  };

  return (
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
          {hideCaseyMark ? null : (
            <p className="truncate text-xs text-white/80">Casey</p>
          )}
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
  );
}
