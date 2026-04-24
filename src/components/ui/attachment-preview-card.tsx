"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FileTextIcon, ImageIcon, PaperclipIcon } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UploadedDocument } from "@/types";
import { DocumentViewer, DocumentViewerTrigger } from "./document-viewer";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type AttachmentPreviewCardProps = {
  document: UploadedDocument;
};

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

export function AttachmentPreviewCard({
  document,
}: AttachmentPreviewCardProps) {
  const supabase = getSupabaseClient();
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const previewKind = useMemo(() => inferPreviewKind(document), [document]);

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnail() {
      if (previewKind !== "image" || thumbnailUrl || !document.bucketId) {
        return;
      }

      const { data, error: signedUrlError } = await supabase.storage
        .from(document.bucketId)
        .createSignedUrl(document.path, 60 * 10);

      if (cancelled) {
        return;
      }

      if (signedUrlError || !data?.signedUrl) {
        return;
      }

      setThumbnailUrl(data.signedUrl);
    }

    void loadThumbnail();

    return () => {
      cancelled = true;
    };
  }, [
    document.bucketId,
    document.path,
    previewKind,
    thumbnailUrl,
    supabase.storage,
  ]);

  return (
    <DocumentViewer document={document} bucketId={document.bucketId ?? ""}>
      <div className="flex flex-col gap-0.5 items-center justify-center">
        <DocumentViewerTrigger asChild>
          <Button
            variant={null}
            size={null}
            className={cn(
              "p-0 overflow-hidden active:scale-95",
              previewKind === "image" && thumbnailUrl
                ? "h-20 w-20"
                : "bg-border border h-12 w-12",
            )}
          >
            {previewKind === "image" && thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={document.name}
                width={80}
                height={80}
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
        {(previewKind !== "image" || !thumbnailUrl) && (
          <span className="text-xs text-muted-foreground">{document.name}</span>
        )}
      </div>
    </DocumentViewer>
  );
}
