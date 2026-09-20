"use client";

import { Blobatar } from "@blobatar/react";
import { cn } from "@/lib/utils";

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
  return (
    <Blobatar
      name={name}
      title={title}
      size={size}
      background="circle"
      {...(hue !== undefined ? { hue } : {})}
      className={cn("shrink-0", className)}
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
