"use client";

import { useEffect, useRef } from "react";

type DocusealEmbedProps = {
  src: string;
  email: string;
  onComplete: () => void;
};

export function DocusealEmbed({ src, email, onComplete }: DocusealEmbedProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    const script = document.createElement("script");
    const origin = (() => {
      try {
        return new URL(src).origin;
      } catch {
        return "";
      }
    })();
    script.src = origin
      ? `${origin}/js/form.js`
      : "https://cdn.docuseal.com/js/form.js";
    script.async = true;

    const mountForm = () => {
      if (cancelled || !hostRef.current) {
        return;
      }
      const form = document.createElement("docuseal-form");
      form.setAttribute("data-src", src);
      form.setAttribute("data-email", email);
      form.addEventListener("completed", () => {
        onComplete();
      });
      hostRef.current.replaceChildren(form);
    };

    script.onload = mountForm;
    script.onerror = () => {
      if (script.src.includes("cdn.docuseal.com") || cancelled) {
        return;
      }
      script.src = "https://cdn.docuseal.com/js/form.js";
      script.onload = mountForm;
      document.body.appendChild(script);
    };
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      script.remove();
      host.replaceChildren();
    };
  }, [src, email, onComplete]);

  return <div ref={hostRef} className="min-h-[32rem] overflow-hidden rounded-md border" />;
}
