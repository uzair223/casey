"use client";
import {
  DocxEditor as DocxEditorComponent,
  type DocxEditorRef as DocxEditorComponentRef,
} from "@eigenpal/docx-js-editor";
import "@eigenpal/docx-js-editor/styles.css";

import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { ExpandIcon, Loader2, MinimizeIcon, SaveIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogTitle,
} from "@radix-ui/react-dialog";

const DOCX_REVIEW_INTERACTIVE_SELECTOR =
  "[data-docx-review-trigger='true'], [data-docx-review-window='true']";

const COMMENT_NODE_TYPES = new Set([
  "commentRangeStart",
  "commentRangeEnd",
  "commentReference",
]);

function stripCommentNodes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => {
        if (!item || typeof item !== "object") {
          return true;
        }

        const itemType = (item as { type?: unknown }).type;
        return !(
          typeof itemType === "string" && COMMENT_NODE_TYPES.has(itemType)
        );
      })
      .map((item) => stripCommentNodes(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const next = value as Record<string, unknown>;

  for (const [key, child] of Object.entries(next)) {
    if (key === "comments" && Array.isArray(child)) {
      next[key] = [];
      continue;
    }

    next[key] = stripCommentNodes(child);
  }

  return next;
}

type SharedDocxEditorProps = {
  source: Blob | ArrayBuffer | Uint8Array | null;
  documentName: string;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (buffer: ArrayBuffer) => Promise<void>;
};

type DocxEditorProps = SharedDocxEditorProps & {
  children?: React.ReactNode;
  defaultFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  fullscreenModal?: boolean;
  className?: string;
};

export type DocxEditorRef = {
  getBuffer: () => Promise<ArrayBuffer | null>;
  reloadBuffer: (buffer: ArrayBuffer | Blob | Uint8Array) => void;
  save: () => Promise<void>;
};

type PanelMode = "minimal" | "full";

type DocxEditorPanelProps = React.ComponentProps<typeof Card> & {
  mode?: PanelMode;
  showFullscreenToggle?: boolean;
  showError?: boolean;
};

type DocxEditorContextValue = SharedDocxEditorProps & {
  isFullscreen: boolean;
  openFullscreen: () => void;
  closeFullscreen: () => void;
  toggleFullscreen: () => void;
  registerPanel: (
    panelId: string,
    entry: { mode: PanelMode; getBuffer: () => Promise<ArrayBuffer | null> },
  ) => () => void;
};

const DocxEditorContext = createContext<DocxEditorContextValue | null>(null);

function useDocxEditorContext() {
  const value = useContext(DocxEditorContext);
  if (!value) {
    throw new Error(
      "DocxEditor components must be rendered within <DocxEditor>.",
    );
  }
  return value;
}

export function DocxEditor({
  children,
  className,
  source,
  documentName,
  canEdit,
  isSaving,
  onSave,
  defaultFullscreen = false,
  onFullscreenChange,
  fullscreenModal = true,
}: DocxEditorProps) {
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const panelRegistryRef = useRef<
    Map<
      string,
      { mode: PanelMode; getBuffer: () => Promise<ArrayBuffer | null> }
    >
  >(new Map());
  const [workingSource, setWorkingSource] = useState(source);
  const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);

  useEffect(() => {
    setWorkingSource(source);
  }, [source]);

  const registerPanel = React.useCallback(
    (
      panelId: string,
      entry: { mode: PanelMode; getBuffer: () => Promise<ArrayBuffer | null> },
    ) => {
      panelRegistryRef.current.set(panelId, entry);
      return () => {
        panelRegistryRef.current.delete(panelId);
      };
    },
    [],
  );

  const syncFromMode = React.useCallback(async (mode: PanelMode) => {
    const entries = Array.from(panelRegistryRef.current.values());
    const panel = [...entries].reverse().find((entry) => entry.mode === mode);
    if (!panel) {
      return;
    }

    const nextBuffer = await panel.getBuffer();
    if (nextBuffer) {
      setWorkingSource(nextBuffer);
    }
  }, []);

  const openFullscreen = React.useCallback(() => {
    void (async () => {
      await syncFromMode("minimal");
      setIsFullscreen(true);
    })();
  }, [syncFromMode]);

  const closeFullscreen = React.useCallback(() => {
    void (async () => {
      await syncFromMode("full");
      setIsFullscreen(false);
    })();
  }, [syncFromMode]);

  const toggleFullscreen = React.useCallback(() => {
    if (isFullscreen) {
      closeFullscreen();
      return;
    }

    openFullscreen();
  }, [closeFullscreen, isFullscreen, openFullscreen]);

  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
    return () => {
      onFullscreenChange?.(false);
    };
  }, [isFullscreen, onFullscreenChange]);

  const contextValue: DocxEditorContextValue = {
    source: workingSource,
    documentName,
    canEdit,
    isSaving,
    onSave,
    isFullscreen,
    openFullscreen,
    closeFullscreen,
    toggleFullscreen,
    registerPanel,
  };

  return (
    <DocxEditorContext.Provider value={contextValue}>
      <Dialog
        open={isFullscreen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            openFullscreen();
            return;
          }
          closeFullscreen();
        }}
        modal={fullscreenModal}
      >
        {children}
        <DialogPortal>
          <DialogContent
            ref={dialogContentRef}
            className={cn(
              "fixed inset-0 overflow-hidden p-0 m-0 border-none rounded-none",
              className,
            )}
            onInteractOutside={(event) => {
              const target = event.target as HTMLElement | null;
              if (target?.closest(DOCX_REVIEW_INTERACTIVE_SELECTOR)) {
                event.preventDefault();
                return;
              }

              if (!fullscreenModal) {
                event.preventDefault();
              }
            }}
            onFocusOutside={(event) => {
              const target = event.target as HTMLElement | null;
              if (target?.closest(DOCX_REVIEW_INTERACTIVE_SELECTOR)) {
                event.preventDefault();
                return;
              }

              if (!fullscreenModal) {
                event.preventDefault();
              }
            }}
          >
            <DialogTitle className="sr-only">Document editor</DialogTitle>
            <DocxEditorPanel
              mode="full"
              showFullscreenToggle
              className="h-screen max-h-screen [--card-opacity:100%]"
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </DocxEditorContext.Provider>
  );
}

type DocxEditorFullscreenTriggerProps = Omit<
  React.ComponentProps<typeof Button>,
  "children"
> & {
  children?: React.ReactNode;
};

export function DocxEditorFullscreenTrigger({
  children,
  variant = "outline",
  type = "button",
  onClick,
  ...props
}: DocxEditorFullscreenTriggerProps) {
  const { source, openFullscreen } = useDocxEditorContext();

  return (
    <Button
      type={type}
      variant={variant}
      onClick={(event) => {
        openFullscreen();
        onClick?.(event);
      }}
      disabled={!source || props.disabled}
      {...props}
    >
      <ExpandIcon className="h-4 w-4" />
      {children ?? "Open fullscreen editor"}
    </Button>
  );
}

export const DocxEditorPanel = forwardRef<DocxEditorRef, DocxEditorPanelProps>(
  function DocxEditorPanel(
    {
      children,
      className,
      mode = "minimal",
      showFullscreenToggle,
      showError = true,
      ...props
    }: DocxEditorPanelProps,
    ref,
  ) {
    const {
      source,
      documentName,
      canEdit,
      isSaving,
      onSave,
      isFullscreen,
      toggleFullscreen,
      registerPanel,
    } = useDocxEditorContext();

    const isModeFull = mode === "full";

    const editorRef = useRef<DocxEditorComponentRef>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const reactId = React.useId();
    const panelIdRef = useRef(`docx-panel-${reactId}`);
    const [isDirty, setIsDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCurrentBuffer = React.useCallback(async () => {
      const editor = editorRef.current;
      if (!editor) return null;
      return (await editor.save()) || null;
    }, []);

    useEffect(() => {
      return registerPanel(panelIdRef.current, {
        mode,
        getBuffer: getCurrentBuffer,
      });
    }, [getCurrentBuffer, mode, registerPanel]);

    const handleSave = React.useCallback(async () => {
      setError(null);

      if (!canEdit) {
        setError("This template is read-only for your role.");
        return;
      }

      const editor = editorRef.current;
      if (!editor) {
        setError("The editor is not ready yet.");
        return;
      }

      const currentDocument = editor.getDocument();
      if (!currentDocument) {
        setError("The editor document is not ready yet.");
        return;
      }

      let sanitizedDocument: unknown;
      try {
        sanitizedDocument = structuredClone(currentDocument);
      } catch {
        sanitizedDocument = JSON.parse(JSON.stringify(currentDocument));
      }

      stripCommentNodes(sanitizedDocument);
      editor.loadDocument(
        sanitizedDocument as Parameters<typeof editor.loadDocument>[0],
      );

      const buffer = await editor.save({ selective: false });
      if (!buffer) {
        setError("Unable to save the current DOCX buffer.");
        return;
      }

      try {
        await onSave(buffer);
        setIsDirty(false);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save template changes.",
        );
      }
    }, [canEdit, onSave]);

    useImperativeHandle(
      ref,
      () => ({
        getBuffer: async () => {
          return getCurrentBuffer();
        },
        reloadBuffer: (buffer: ArrayBuffer | Blob | Uint8Array) => {
          void buffer;
          setIsDirty(false);
          setError(null);
        },
        save: async () => {
          await handleSave();
        },
      }),
      [getCurrentBuffer, handleSave],
    );

    return (
      <Card
        ref={panelRef}
        size="sm"
        className={cn("flex min-w-0 flex-col overflow-hidden", className)}
        {...props}
      >
        <CardHeader>
          {children}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void handleSave();
              }}
              disabled={!canEdit || isSaving || !source}
            >
              <SaveIcon className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save changes"}
            </Button>

            {showFullscreenToggle ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!source}
                onClick={() => {
                  toggleFullscreen();
                }}
              >
                {isFullscreen ? (
                  <MinimizeIcon className="h-4 w-4" />
                ) : (
                  <ExpandIcon className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </span>
              </Button>
            ) : null}

            <div className="ml-auto flex flex-wrap items-center gap-1">
              {isDirty ? (
                <Badge variant="outline">Unsaved changes</Badge>
              ) : null}
              {source ? <Badge variant="secondary">Loaded</Badge> : null}
            </div>
          </div>

          {showError && error && (
            <Card variant="destructive" size="sm">
              <CardHeader>
                <CardTitle className="text-sm">{error}</CardTitle>
              </CardHeader>
            </Card>
          )}
        </CardHeader>
        <CardContent className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {source ? (
            <DocxEditorComponent
              className={cn(
                "h-full min-h-0 min-w-0 text-black!",
                "[&_.docx-editor]:min-w-0",
                "[&_.docx-editor]:overflow-x-hidden",
                "[&_.paged-editor__container]:overflow-y-auto",
                "[&_.paged-editor__container]:overflow-x-hidden",
                "[&_.paged-editor__container]:overscroll-contain",
                "[&_.paged-editor__container]:touch-pan-y",
              )}
              loadingIndicator={<Loader2 className="animate-spin" />}
              ref={editorRef}
              documentBuffer={source}
              documentName={documentName}
              mode={canEdit ? "editing" : "viewing"}
              readOnly={!canEdit}
              showToolbar={canEdit && isModeFull}
              showRuler={isModeFull}
              showMarginGuides={isModeFull}
              showOutlineButton={false}
              onChange={() => {
                setIsDirty(true);
              }}
              onError={(editorError) => {
                setError(editorError.message);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No DOCX source is available for editing.
            </p>
          )}
        </CardContent>
      </Card>
    );
  },
);
