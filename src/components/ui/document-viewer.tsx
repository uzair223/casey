"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PreviewDocx } from "@/components/ui/preview-docx";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UploadedDocument } from "@/types";
import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import Image from "next/image";
import type { ImageLoaderProps } from "next/image";

const PREVIEW_IMAGE_MAX_WIDTH = 1600;
const PREVIEW_IMAGE_DEFAULT_QUALITY = 80;

function supabaseImageLoader({ src, width, quality }: ImageLoaderProps) {
  const targetWidth = Math.min(width, PREVIEW_IMAGE_MAX_WIDTH);
  const targetQuality = quality ?? PREVIEW_IMAGE_DEFAULT_QUALITY;

  try {
    const url = new URL(src);
    url.searchParams.set("width", String(targetWidth));
    url.searchParams.set("quality", String(targetQuality));
    return url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}width=${targetWidth}&quality=${targetQuality}`;
  }
}

type DocumentViewerProps = {
  document: UploadedDocument;
  bucketId: string;
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
};

function inferPreviewKind(document: UploadedDocument) {
  const lowerName = document.name.toLowerCase();

  if (
    document.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|avif|svg)$/.test(lowerName)
  ) {
    return "image";
  }

  if (document.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    document.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }

  if (
    document.type.startsWith("text/") ||
    /\.(txt|md|csv|json|xml|log)$/.test(lowerName)
  ) {
    return "text";
  }

  return "unsupported";
}

export function DocumentViewer({
  document,
  bucketId,
  triggerLabel = "View file",
  triggerVariant = "outline",
}: DocumentViewerProps) {
  const supabase = getSupabaseClient();
  const [open, setOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [docxSource, setDocxSource] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const previewKind = useMemo(() => inferPreviewKind(document), [document]);

  useEffect(() => {
    let cancelled = false;

    async function loadUrl() {
      if (!open) return;

      setIsLoading(true);
      setError(null);
      setSignedUrl(null);
      setDocxSource(null);

      const { data, error: signedUrlError } = await supabase.storage
        .from(bucketId)
        .createSignedUrl(document.path, 60 * 10);

      if (cancelled) return;

      if (signedUrlError || !data?.signedUrl) {
        setError(signedUrlError?.message || "Failed to load file preview");
        setIsLoading(false);
        return;
      }

      if (previewKind === "docx") {
        const docxResponse = await fetch(data.signedUrl);

        if (cancelled) return;

        if (!docxResponse.ok) {
          setError("Failed to load DOCX preview");
          setIsLoading(false);
          return;
        }

        const blob = await docxResponse.blob();

        if (cancelled) return;

        setDocxSource(blob);
      }

      setSignedUrl(data.signedUrl);
      setIsLoading(false);
    }

    loadUrl();

    return () => {
      cancelled = true;
    };
  }, [bucketId, document.path, open, previewKind, supabase.storage]);

  const preview = (() => {
    if (isLoading) {
      return (
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      );
    }

    if (error) {
      return <p className="text-sm text-destructive">{error}</p>;
    }

    if (!signedUrl) {
      return null;
    }

    if (previewKind === "image") {
      return (
        <Image
          loader={supabaseImageLoader}
          src={signedUrl}
          alt={document.name}
          width={PREVIEW_IMAGE_MAX_WIDTH}
          height={900}
          quality={PREVIEW_IMAGE_DEFAULT_QUALITY}
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="max-h-[65vh] w-full rounded-lg border object-contain bg-muted"
        />
      );
    }

    if (previewKind === "pdf" || previewKind === "text") {
      return (
        <iframe
          title={document.name}
          src={signedUrl}
          className="h-[65vh] w-full rounded-lg border bg-white"
        />
      );
    }

    if (previewKind === "docx") {
      return <PreviewDocx source={docxSource} />;
    }

    return (
      <Card size="sm" className="border-dashed">
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            This file type does not have an inline preview. Open it in a new tab
            or download it instead.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={signedUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLinkIcon className="h-4 w-4" />
                Open file
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={signedUrl} download={document.name}>
                <DownloadIcon className="h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <FileTextIcon className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl">
        <DialogHeader className="space-y-2 pr-6 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
            {document.name}
            <Badge variant="outline" className="capitalize">
              {document.type || previewKind}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {preview}

          {signedUrl && previewKind !== "unsupported" ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={signedUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLinkIcon className="h-4 w-4" />
                  Open in new tab
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={signedUrl} download={document.name}>
                  <DownloadIcon className="h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
