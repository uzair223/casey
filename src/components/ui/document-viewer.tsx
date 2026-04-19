"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UploadedDocument } from "@/types";
import { ReviewWithAI, ReviewWithAITrigger } from "@/components/with-ai";
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  UploadIcon,
  ZapIcon,
} from "lucide-react";
import Image from "next/image";
import type { ImageLoaderProps } from "next/image";
import { DocxEditor, DocxEditorPanel, type DocxEditorRef } from "./docx-editor";

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
  editable?: boolean;
  onReplace?: (file: File) => Promise<void>;
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  children: React.ReactNode;
};

type DocumentViewerContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DocumentViewerContext = createContext<DocumentViewerContextValue | null>(
  null,
);

function useDocumentViewerContext() {
  const value = useContext(DocumentViewerContext);
  if (!value) {
    throw new Error(
      "DocumentViewer components must be rendered within <DocumentViewer>.",
    );
  }

  return value;
}

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
  editable = false,
  onReplace,
  triggerLabel,
  triggerVariant = "outline",
  children,
}: DocumentViewerProps) {
  const supabase = getSupabaseClient();
  const [open, setOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [docxSource, setDocxSource] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isDocxFullscreen, setIsDocxFullscreen] = useState(false);
  const [isDocxReviewOpen, setIsDocxReviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const standaloneDocxEditorRef = useRef<DocxEditorRef>(null);

  const previewKind = useMemo(() => inferPreviewKind(document), [document]);
  const canReplace = editable && !!onReplace;
  const isDocxInteractionLocked =
    previewKind === "docx" && (isDocxFullscreen || isDocxReviewOpen);

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

  const handleReplaceFile = async (file: File | null) => {
    if (!file || !onReplace) return;

    setIsReplacing(true);
    setError(null);

    try {
      await onReplace(file);
      // For immediate UX on docx, use the updated in-memory file buffer.
      if (previewKind === "docx") {
        setDocxSource(file);
      }
    } catch (replaceError) {
      setError(
        replaceError instanceof Error
          ? replaceError.message
          : "Failed to replace document",
      );
      throw replaceError;
    } finally {
      setIsReplacing(false);
    }
  };

  const handleDocxReviewComplete = (reviewedBuffer: ArrayBuffer) => {
    setDocxSource(new Blob([reviewedBuffer], { type: document.type }));
  };

  const handleDocxSave = async (buffer: ArrayBuffer) => {
    if (!onReplace) {
      throw new Error("Replace handler is not available.");
    }

    const file = new File([buffer], document.name, {
      type:
        document.type ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await handleReplaceFile(file);
  };

  const getCurrentStandaloneDocxBuffer = async () => {
    if (!standaloneDocxEditorRef.current) {
      return null;
    }
    return standaloneDocxEditorRef.current.getBuffer();
  };

  const preview = (() => {
    if (isLoading) {
      return (
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      );
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
      return (
        <DocxEditorPanel
          ref={standaloneDocxEditorRef}
          mode="minimal"
          showFullscreenToggle
          showError={false}
          className="h-[65vh] max-h-[65vh] w-full min-w-0 overflow-x-hidden"
        />
      );
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
    <DocumentViewerContext.Provider value={{ open, setOpen }}>
      <DocxEditor
        source={docxSource}
        documentName={document.name}
        canEdit={canReplace}
        isSaving={isReplacing}
        onSave={handleDocxSave}
        onFullscreenChange={setIsDocxFullscreen}
        fullscreenModal={false}
        className="z-100"
      >
        <ReviewWithAI
          getBuffer={getCurrentStandaloneDocxBuffer}
          documentName={document.name}
          onReviewComplete={handleDocxReviewComplete}
          onOpenChange={setIsDocxReviewOpen}
          className="z-150"
        >
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              if (!nextOpen && isDocxInteractionLocked) {
                return;
              }
              setOpen(nextOpen);
            }}
            modal={previewKind !== "docx"}
          >
            {open && previewKind === "docx" ? (
              <div className="fixed inset-0 z-50 bg-black/50 pointer-events-none" />
            ) : null}

            {triggerLabel ? (
              <DocumentViewerTrigger asChild>
                <Button variant={triggerVariant} size="sm">
                  <FileTextIcon className="h-4 w-4" />
                  {triggerLabel}
                </Button>
              </DocumentViewerTrigger>
            ) : null}

            {children}

            <DialogContent
              className="max-w-4xl overflow-x-hidden"
              aria-describedby="Document viewer"
              onInteractOutside={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest("[data-docx-review-trigger='true']")) {
                  event.preventDefault();
                }
              }}
            >
              <DialogHeader className="space-y-2 pr-6 text-left">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                  {document.name}
                  <Badge variant="outline" className="capitalize">
                    {document.type || previewKind}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 min-w-0 overflow-x-hidden">
                {error ? (
                  <Card variant="destructive" size="sm">
                    <CardHeader>
                      <CardTitle className="text-sm">{error}</CardTitle>
                    </CardHeader>
                  </Card>
                ) : null}

                {preview}

                {signedUrl && previewKind !== "unsupported" ? (
                  <div className="flex flex-wrap gap-2">
                    {canReplace ? (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            void handleReplaceFile(
                              event.target.files?.[0] ?? null,
                            );
                            event.currentTarget.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isReplacing}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <UploadIcon className="h-4 w-4" />
                          {isReplacing ? "Replacing..." : "Replace file"}
                        </Button>
                      </>
                    ) : null}
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
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

            {open && canReplace && previewKind === "docx" ? (
              <div
                data-docx-review-trigger="true"
                className="fixed bottom-6 right-6 z-120 pointer-events-auto"
              >
                <ReviewWithAITrigger className="rounded-full" />
              </div>
            ) : null}
          </Dialog>
        </ReviewWithAI>
      </DocxEditor>
    </DocumentViewerContext.Provider>
  );
}

export function DocumentViewerTrigger({
  children,
  asChild = true,
  type = "button",
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpen } = useDocumentViewerContext();
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      type={type}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        setOpen(true);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}
