"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import * as DismissableLayerPrimitive from "@radix-ui/react-dismissable-layer";
import { createPortal } from "react-dom";
import { FocusScope } from "@radix-ui/react-focus-scope";

import { cn } from "@/lib/utils";
import { Button } from "./button";

type DraggablePanelContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

type DraggablePanelDragContextValue = {
  isDragging: boolean;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void;
};

const DraggablePanelContext =
  React.createContext<DraggablePanelContextValue | null>(null);

const DraggablePanelDragContext =
  React.createContext<DraggablePanelDragContextValue | null>(null);

function useDraggablePanelContext() {
  const context = React.useContext(DraggablePanelContext);
  if (!context) {
    throw new Error(
      "DraggablePanel components must be used within DraggablePanel.",
    );
  }
  return context;
}

function useDraggablePanelDragContext() {
  const context = React.useContext(DraggablePanelDragContext);
  if (!context) {
    throw new Error(
      "DraggablePanelHeader must be used within DraggablePanelContent.",
    );
  }
  return context;
}

type DraggablePanelProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export function DraggablePanel({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: DraggablePanelProps) {
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
    <DraggablePanelContext.Provider value={{ open, setOpen }}>
      {children}
    </DraggablePanelContext.Provider>
  );
}

type DraggablePanelTriggerProps = React.ComponentPropsWithoutRef<
  typeof Button
> & {
  asChild?: boolean;
};

export const DraggablePanelTrigger = React.forwardRef<
  HTMLButtonElement,
  DraggablePanelTriggerProps
>(({ asChild = false, onClick, className, ...props }, ref) => {
  const { setOpen } = useDraggablePanelContext();
  const Comp = asChild ? Slot : Button;

  return (
    <Comp
      ref={ref}
      className={cn("pointer-events-auto", className)}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        setOpen(true);
        onClick?.(event);
      }}
      data-draggable-panel-trigger="true"
      {...props}
    />
  );
});
DraggablePanelTrigger.displayName = "DraggablePanelTrigger";

type DraggablePanelCloseProps = React.ComponentPropsWithoutRef<
  typeof Button
> & {
  asChild?: boolean;
};

export const DraggablePanelClose = React.forwardRef<
  HTMLButtonElement,
  DraggablePanelCloseProps
>(({ asChild = false, onClick, ...props }, ref) => {
  const { setOpen } = useDraggablePanelContext();
  const Comp = asChild ? Slot : Button;

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
DraggablePanelClose.displayName = "DraggablePanelClose";

type DraggablePanelContentProps = React.ComponentPropsWithoutRef<"div"> & {
  initialTop?: number;
};

export const DraggablePanelContent = React.forwardRef<
  HTMLDivElement,
  DraggablePanelContentProps
>(({ className, style, initialTop = 96, children, ...props }, forwardedRef) => {
  const { open } = useDraggablePanelContext();
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
    <DismissableLayerPrimitive.Branch asChild>
      <div
        ref={setRefs}
        className={cn(
          "fixed w-[min(92vw,520px)] overflow-hidden rounded-xl border bg-background shadow-lg",
          "pointer-events-auto",
          className,
        )}
        style={{
          left: position.x,
          top: position.y,
          ...style,
        }}
        data-dragging={isDragging ? "true" : "false"}
        data-draggable-panel="true"
        onFocus={(e) => e.stopPropagation()}
        onBlur={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        {...props}
      >
        <FocusScope asChild trapped={false}>
          <DraggablePanelDragContext.Provider
            value={{ isDragging, onDragStart: handleDragStart }}
          >
            <div className="select-auto">{children}</div>
          </DraggablePanelDragContext.Provider>
        </FocusScope>
      </div>
    </DismissableLayerPrimitive.Branch>,
    document.body,
  );
});
DraggablePanelContent.displayName = "DraggablePanelContent";

type DraggablePanelHeaderProps = React.ComponentProps<"div">;

export function DraggablePanelHeader({
  className,
  onPointerDown,
  ...props
}: DraggablePanelHeaderProps) {
  const { isDragging, onDragStart } = useDraggablePanelDragContext();

  return (
    <div
      className={cn(
        "border-b px-4 py-3 cursor-grab select-none",
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

type DraggablePanelFooterProps = React.ComponentProps<"div">;

export function DraggablePanelFooter({
  className,
  ...props
}: DraggablePanelFooterProps) {
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

type DraggablePanelTitleProps = React.ComponentProps<"h2">;

export function DraggablePanelTitle({
  className,
  ...props
}: DraggablePanelTitleProps) {
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

type DraggablePanelDescriptionProps = React.ComponentProps<"p">;

export function DraggablePanelDescription({
  className,
  ...props
}: DraggablePanelDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
