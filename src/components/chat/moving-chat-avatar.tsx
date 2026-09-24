"use client";

import React, { useLayoutEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const chatAvatarBoxClass = "h-[28px] w-[28px] md:h-[40px] md:w-[40px]";

export function MovingChatAvatar({
  side,
  containerRef,
  layoutKey,
  children,
}: {
  side: "user" | "assistant";
  containerRef: React.RefObject<HTMLElement | null>;
  layoutKey: string;
  children: React.ReactNode;
}) {
  const [top, setTop] = useState<number | null>(null);
  const [canMove, setCanMove] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    let mutations: MutationObserver | null = null;

    const detach = () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      mutations?.disconnect();
      observer = null;
      mutations = null;
    };

    const attach = (container: HTMLElement) => {
      const update = () => {
        if (cancelled) return;
        const slot = container.querySelector(
          `[data-chat-avatar-anchor="${side}"]`,
        );
        if (!(slot instanceof HTMLElement)) {
          setTop(null);
          return;
        }

        const nextTop =
          slot.getBoundingClientRect().top -
          container.getBoundingClientRect().top;
        setTop(nextTop);
      };

      update();
      frame = requestAnimationFrame(() => {
        update();
        if (!cancelled) setCanMove(true);
      });

      observer = new ResizeObserver(update);
      observer.observe(container);
      const slot = container.querySelector(
        `[data-chat-avatar-anchor="${side}"]`,
      );
      if (slot instanceof HTMLElement) {
        observer.observe(slot);
      }

      mutations = new MutationObserver(update);
      mutations.observe(container, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    };

    const tryAttach = () => {
      detach();
      const container = containerRef.current;
      if (!container) {
        // Ref can lag one frame behind the first layout effect in nested trees.
        frame = requestAnimationFrame(tryAttach);
        return;
      }
      attach(container);
    };

    tryAttach();

    return () => {
      cancelled = true;
      detach();
    };
  }, [containerRef, layoutKey, side]);

  if (top == null) {
    return null;
  }

  return (
    <div
      data-moving-chat-avatar={side}
      className={cn(
        "pointer-events-none absolute z-10",
        chatAvatarBoxClass,
        side === "user" ? "right-0" : "left-0",
        canMove &&
          "transition-[top] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
      )}
      style={{ top }}
    >
      {children}
    </div>
  );
}
