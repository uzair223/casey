"use client";

import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { thinking as thinkingExpression } from "blobatar/expression";
import { cn } from "@/lib/utils";
import "blobatar/motion.css";
import "blobatar/gaze.css";

const CASEY_SEED = "casey";
const CASEY_HUE = 12;
const CASEY_HEAD = "#9a4034";

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
  background?: boolean | "square" | "circle" | "squircle";
};

export function PersonAvatar({
  name,
  title,
  size,
  hue,
  palette,
  thinking = false,
  className,
  background = false,
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
        background={background}
        animate="always"
        expression={thinking ? thinkingExpression : undefined}
        {...(size !== undefined ? { size } : {})}
        {...(hue !== undefined ? { hue } : {})}
        {...(palette ? { palette } : {})}
        className="size-full shrink-0 overflow-visible"
      />
    </span>
  );
}

export function CaseyAvatar({
  size,
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
