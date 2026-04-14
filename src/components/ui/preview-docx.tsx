"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { cn } from "@/lib/utils";

type PreviewDocxProps = {
  source: Blob | ArrayBuffer | Uint8Array | null | undefined;
  className?: string;
  emptyMessage?: string;
};

async function toArrayBuffer(
  source: Blob | ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  if (source instanceof Blob) {
    return await source.arrayBuffer();
  }

  if (source instanceof Uint8Array) {
    return source.buffer.slice(
      source.byteOffset,
      source.byteOffset + source.byteLength,
    ) as ArrayBuffer;
  }

  return source;
}

export function PreviewDocx({
  source,
  className,
  emptyMessage = "No DOCX selected for preview.",
}: PreviewDocxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = "";
      setError(null);

      if (!source) {
        return;
      }

      setIsLoading(true);
      try {
        const buffer = await toArrayBuffer(source);
        if (cancelled || !containerRef.current) {
          return;
        }

        await renderAsync(buffer, containerRef.current, undefined, {
          className: "docx-preview-content",
          breakPages: true,
          inWrapper: true,
          renderHeaders: true,
          renderFooters: true,
          ignoreLastRenderedPageBreak: true,
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to render DOCX preview.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <div className={cn("space-y-2", className)}>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">
          Rendering DOCX preview...
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {!source && !isLoading ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : null}

      <div
        ref={containerRef}
        className="max-h-[65vh] overflow-auto rounded-md border bg-white p-2"
      />
    </div>
  );
}
