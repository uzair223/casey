"use client";

import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { thinking as thinkingExpression } from "blobatar/expression";
import { cn } from "@/lib/utils";
import "blobatar/motion.css";
import "blobatar/gaze.css";

const CASEY_SEED = "casey";
const CASEY_HUE = 250;
const CASEY_HEAD = "#7357FF";

type PersonAvatarProps = {
  name: string;
  title: string;
  size?: number;
  hue?: number;
  palette?: {
    bg?: string;
    head?: string;
    eye?: string;
  };
  thinking?: boolean;
  className?: string;
};

export function PersonAvatar({
  name,
  title,
  size = 32,
  hue,
  palette,
  thinking = false,
  className,
}: PersonAvatarProps) {
  const { ref } = useGaze({ travel: 4, lookAt: "pointer" });

  return (
    <span
      className={cn(
        "inline-flex shrink-0 overflow-visible",
        thinking ? "avatar-thinking" : "avatar-bob",
        className,
      )}
    >
      <Blobatar
        ref={ref}
        name={name}
        title={title}
        size={size}
        background={false}
        animate="always"
        expression={thinking ? thinkingExpression : undefined}
        {...(hue !== undefined ? { hue } : {})}
        {...(palette ? { palette } : {})}
        className="shrink-0 overflow-visible"
      />
    </span>
  );
}

export function CaseyAvatar({
  size = 32,
  thinking = false,
  className,
}: {
  size?: number;
  thinking?: boolean;
  className?: string;
}) {
  return (
    <PersonAvatar
      name={CASEY_SEED}
      title="Casey"
      size={size}
      hue={CASEY_HUE}
      palette={{ head: CASEY_HEAD }}
      thinking={thinking}
      className={className}
    />
  );
}
