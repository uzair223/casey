"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
  eager?: boolean;
};

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  eager = false,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const [intersected, setIntersected] = useState(false);
  const visible = prefersReducedMotion || eager || intersected;

  useEffect(() => {
    if (prefersReducedMotion || eager) {
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersected(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, prefersReducedMotion]);

  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      )}
      style={
        { transitionDelay: visible ? `${delay}ms` : "0ms" } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
