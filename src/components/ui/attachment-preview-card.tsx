"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FileTextIcon, ImageIcon, PaperclipIcon } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UploadedDocument } from "@/types";
import { DocumentViewer, DocumentViewerTrigger } from "./document-viewer";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type ThumbnailSize = "sm" | "md" | "lg";
type AttachmentPreviewCardProps = {
  document: UploadedDocument;
  hideLabel?: "all" | "images" | "files";
  thumbnailSize?:
    | ThumbnailSize
    | { image?: ThumbnailSize; file?: ThumbnailSize };
};

const THUMBNAIL_SIZE = 64;
const THUMBNAIL_SOURCE_SIZE = 64;
const THUMBNAIL_QUALITY = 20;
const THUMBNAIL_CACHE_TTL_MS = 9 * 60 * 1000;

type ThumbnailCacheEntry = {
  expiresAt: number;
  promise?: Promise<string | null>;
  url?: string;
};

const thumbnailUrlCache = new Map<string, ThumbnailCacheEntry>();

function inferPreviewKind(document: UploadedDocument) {
  const lowerName = document.name.toLowerCase();

  if (
    document.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|avif|svg)$/.test(lowerName)
  ) {
    return "image";
  }

  if (
    document.type === "application/pdf" ||
    document.type.startsWith("text/") ||
    lowerName.endsWith(".pdf") ||
    /\.(txt|md|csv|json|xml|log)$/.test(lowerName)
  ) {
    return "iframe";
  }

  return "file";
}

function canTransformThumbnail(document: UploadedDocument) {
  const lowerName = document.name.toLowerCase();

  return (
    document.type.startsWith("image/") &&
    !document.type.includes("svg") &&
    !lowerName.endsWith(".svg") &&
    !lowerName.endsWith(".gif")
  );
}

function getThumbnailCacheKey(
  bucketId: string,
  path: string,
  shouldTransformThumbnail: boolean,
) {
  return [
    bucketId,
    path,
    shouldTransformThumbnail ? THUMBNAIL_SOURCE_SIZE : "original",
    shouldTransformThumbnail ? THUMBNAIL_QUALITY : "source",
  ].join(":");
}

export function AttachmentPreviewCard({
  document,
  hideLabel = "images",
  thumbnailSize = { image: "md", file: "sm" },
}: AttachmentPreviewCardProps) {
  const supabase = getSupabaseClient();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const previewKind = useMemo(() => inferPreviewKind(document), [document]);
  const shouldTransformThumbnail = useMemo(
    () => canTransformThumbnail(document),
    [document],
  );
  const thumbnailCacheKey = useMemo(() => {
    if (!document.bucketId) return null;
    return getThumbnailCacheKey(
      document.bucketId,
      document.path,
      shouldTransformThumbnail,
    );
  }, [document.bucketId, document.path, shouldTransformThumbnail]);

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnail() {
      if (previewKind !== "image" || thumbnailUrl || !document.bucketId) {
        return;
      }

      const cacheKey =
        thumbnailCacheKey ??
        getThumbnailCacheKey(
          document.bucketId,
          document.path,
          shouldTransformThumbnail,
        );
      const now = Date.now();
      const cached = thumbnailUrlCache.get(cacheKey);

      if (cached?.url && cached.expiresAt > now) {
        setThumbnailUrl(cached.url);
        return;
      }

      const thumbnailPromise =
        cached?.promise && cached.expiresAt > now
          ? cached.promise
          : supabase.storage
              .from(document.bucketId)
              .createSignedUrl(
                document.path,
                60 * 10,
                shouldTransformThumbnail
                  ? {
                      transform: {
                        width: THUMBNAIL_SOURCE_SIZE,
                        height: THUMBNAIL_SOURCE_SIZE,
                        resize: "cover",
                        quality: THUMBNAIL_QUALITY,
                      },
                    }
                  : undefined,
              )
              .then(({ data, error: signedUrlError }) => {
                if (signedUrlError || !data?.signedUrl) {
                  thumbnailUrlCache.delete(cacheKey);
                  return null;
                }

                thumbnailUrlCache.set(cacheKey, {
                  expiresAt: Date.now() + THUMBNAIL_CACHE_TTL_MS,
                  url: data.signedUrl,
                });

                return data.signedUrl;
              });

      if (!cached?.promise || cached.expiresAt <= now) {
        thumbnailUrlCache.set(cacheKey, {
          expiresAt: now + THUMBNAIL_CACHE_TTL_MS,
          promise: thumbnailPromise,
        });
      }

      const signedUrl = await thumbnailPromise;
      if (cancelled) {
        return;
      }

      if (!signedUrl) {
        return;
      }

      setThumbnailUrl(signedUrl);
    }

    void loadThumbnail();

    return () => {
      cancelled = true;
    };
  }, [
    document.bucketId,
    document.path,
    previewKind,
    shouldTransformThumbnail,
    thumbnailCacheKey,
    thumbnailUrl,
    supabase.storage,
  ]);

  const shouldHide =
    hideLabel === "all" ||
    (hideLabel === "images" && previewKind === "image") ||
    (hideLabel === "files" && previewKind !== "image");

  const thumbnailVariant =
    typeof thumbnailSize === "string"
      ? thumbnailSize
      : previewKind === "image"
        ? thumbnailSize.image || "md"
        : thumbnailSize.file || "sm";

  const thumbnailClass = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  }[thumbnailVariant];

  return (
    <DocumentViewer document={document} bucketId={document.bucketId ?? ""}>
      <div className="flex flex-col gap-0.5 items-center justify-center">
        <DocumentViewerTrigger asChild>
          <Button
            variant={null}
            size={null}
            className={cn(
              "bg-border p-0 overflow-hidden active:scale-95",
              thumbnailClass,
            )}
          >
            {previewKind === "image" && thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={document.name}
                width={THUMBNAIL_SIZE}
                height={THUMBNAIL_SIZE}
                quality={THUMBNAIL_QUALITY}
                sizes={`${THUMBNAIL_SIZE}px`}
                loading="eager"
                decoding="async"
                fetchPriority="low"
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <>
                {previewKind === "image" ? (
                  <ImageIcon className="h-5 w-5" />
                ) : previewKind === "iframe" ? (
                  <FileTextIcon className="h-5 w-5" />
                ) : (
                  <PaperclipIcon className="h-5 w-5" />
                )}
              </>
            )}
          </Button>
        </DocumentViewerTrigger>
        {!shouldHide && (
          <span className="text-xs text-muted-foreground">{document.name}</span>
        )}
      </div>
    </DocumentViewer>
  );
}
