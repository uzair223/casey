"use client";

import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { cn } from "@/lib/utils";
import "blobatar/motion.css";
import "blobatar/gaze.css";

const CASEY_SEED = "casey";
const CASEY_HUE = 250;

type PersonAvatarProps = {
  name: string;
  title: string;
  size?: number;
  hue?: number;
  className?: string;
};

export function PersonAvatar({
  name,
  title,
  size = 32,
  hue,
  className,
}: PersonAvatarProps) {
  const { ref } = useGaze({ travel: 4, lookAt: "pointer" });

  return (
    <Blobatar
      ref={ref}
      name={name}
      title={title}
      size={size}
      background="circle"
      animate="always"
      {...(hue !== undefined ? { hue } : {})}
      className={cn("shrink-0 overflow-visible", className)}
    />
  );
}

export function CaseyAvatar({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <PersonAvatar
      name={CASEY_SEED}
      title="Casey"
      size={size}
      hue={CASEY_HUE}
      className={className}
    />
  );
}
