"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type DraggableDialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

type DraggableDialogDragContextValue = {
  isDragging: boolean;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
};

const DraggableDialogContext =
  React.createContext<DraggableDialogContextValue | null>(null);

const DraggableDialogDragContext =
  React.createContext<DraggableDialogDragContextValue | null>(null);

function useDraggableDialogContext() {
  const context = React.useContext(DraggableDialogContext);
  if (!context) {
    throw new Error(
      "DraggableDialog components must be used within DraggableDialog.",
    );
  }
  return context;
}

function useDraggableDialogDragContext() {
  const context = React.useContext(DraggableDialogDragContext);
  if (!context) {
    throw new Error(
      "DraggableDialogHeader must be used within DraggableDialogContent.",
    );
  }
  return context;
}

type DraggableDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export function DraggableDialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: DraggableDialogProps) {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DraggableDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DraggableDialogContext.Provider>
  );
}

type DraggableDialogTriggerProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
};

export const DraggableDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  DraggableDialogTriggerProps
>(({ asChild = false, onClick, ...props }, ref) => {
  const { setOpen } = useDraggableDialogContext();
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        setOpen(true);
        onClick?.(event);
      }}
      {...props}
    />
  );
});
DraggableDialogTrigger.displayName = "DraggableDialogTrigger";

type DraggableDialogCloseProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean;
};

export const DraggableDialogClose = React.forwardRef<
  HTMLButtonElement,
  DraggableDialogCloseProps
>(({ asChild = false, onClick, ...props }, ref) => {
  const { setOpen } = useDraggableDialogContext();
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        setOpen(false);
        onClick?.(event);
      }}
      {...props}
    />
  );
});
DraggableDialogClose.displayName = "DraggableDialogClose";

type DraggableDialogContentProps = React.ComponentPropsWithoutRef<"div"> & {
  initialTop?: number;
};

export const DraggableDialogContent = React.forwardRef<
  HTMLDivElement,
  DraggableDialogContentProps
>(({ className, style, initialTop = 96, children, ...props }, forwardedRef) => {
  const { open } = useDraggableDialogContext();
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: initialTop });
  const [isDragging, setIsDragging] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<{
    offsetX: number;
    offsetY: number;
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || !open) return;
    setPosition({
      x: Math.max(16, window.innerWidth - 520),
      y: initialTop,
    });
  }, [mounted, open, initialTop]);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current || !dialogRef.current) return;

      const rect = dialogRef.current.getBoundingClientRect();
      const width = rect.width || 520;
      const height = rect.height || 620;
      const nextX = Math.min(
        Math.max(16, event.clientX - dragStateRef.current.offsetX),
        Math.max(16, window.innerWidth - width - 16),
      );
      const nextY = Math.min(
        Math.max(16, event.clientY - dragStateRef.current.offsetY),
        Math.max(16, window.innerHeight - height - 16),
      );

      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const handleDragStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !dialogRef.current) return;
      const rect = dialogRef.current.getBoundingClientRect();
      dragStateRef.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      setIsDragging(true);
      event.preventDefault();
    },
    [],
  );

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      dialogRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      ref={setRefs}
      className={cn(
        "fixed z-50 w-[min(92vw,520px)] overflow-hidden rounded-xl border bg-background shadow-lg",
        className,
      )}
      style={{ left: position.x, top: position.y, ...style }}
      data-dragging={isDragging ? "true" : "false"}
      {...props}
    >
      <DraggableDialogDragContext.Provider
        value={{ isDragging, onDragStart: handleDragStart }}
      >
        {children}
      </DraggableDialogDragContext.Provider>
    </div>,
    document.body,
  );
});
DraggableDialogContent.displayName = "DraggableDialogContent";

type DraggableDialogHeaderProps = React.ComponentProps<"div">;

export function DraggableDialogHeader({
  className,
  onPointerDown,
  ...props
}: DraggableDialogHeaderProps) {
  const { isDragging, onDragStart } = useDraggableDialogDragContext();

  return (
    <div
      className={cn(
        "cursor-grab select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      onPointerDown={(event) => {
        onDragStart(event);
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
}

type DraggableDialogFooterProps = React.ComponentProps<"div">;

export function DraggableDialogFooter({
  className,
  ...props
}: DraggableDialogFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className,
      )}
      {...props}
    />
  );
}

type DraggableDialogTitleProps = React.ComponentProps<"h2">;

export function DraggableDialogTitle({
  className,
  ...props
}: DraggableDialogTitleProps) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

type DraggableDialogDescriptionProps = React.ComponentProps<"p">;

export function DraggableDialogDescription({
  className,
  ...props
}: DraggableDialogDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
