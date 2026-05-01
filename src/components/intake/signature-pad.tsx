"use client";

import { createContext, useRef, useEffect, useState, useContext } from "react";
import { Button } from "../ui/button";
import { Slot } from "@radix-ui/react-slot";

const SignaturePadContext = createContext<{
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hasSignature: boolean;
  disabled: boolean;
  draw: (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => void;
  startDrawing: (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => void;
  stopDrawing: (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => void;
  clearSignature: () => void;
} | null>(null);

type SignaturePadProviderProps = React.PropsWithChildren<{
  disabled?: boolean;
}>;

export function SignaturePadProvider({
  disabled,
  children,
}: SignaturePadProviderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";

    contextRef.current = ctx;
  }, []);

  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const context = contextRef.current;
    if (disabled || !context) return;

    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;

    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const context = contextRef.current;
    if (!isDrawing || !context) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ("touches" in e ? e.touches[0].clientY : e.clientY) - rect.top;

    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const context = contextRef.current;
    if (context) {
      context.closePath();
      // Check if anything was drawn
      const canvas = canvasRef.current;
      if (canvas) {
        const imageData = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const hasPixels = imageData.data.some(
          (pixel, i) => i % 4 !== 3 && pixel < 255,
        );
        setHasSignature(hasPixels);
      }
    }
  };

  const clearSignature = () => {
    const context = contextRef.current;
    if (!context || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    context.fillStyle = "white";
    context.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  };

  return (
    <SignaturePadContext.Provider
      value={{
        canvasRef,
        draw,
        startDrawing,
        stopDrawing,
        clearSignature,
        hasSignature,
        disabled: !!disabled,
      }}
    >
      {children}
    </SignaturePadContext.Provider>
  );
}

export function useSignaturePad() {
  const context = useContext(SignaturePadContext);
  if (!context) {
    throw new Error(
      "useSignaturePad must be used within a SignaturePadProvider",
    );
  }
  return context;
}

export function SignaturePad() {
  const {
    canvasRef,
    draw,
    startDrawing,
    stopDrawing,
    clearSignature,
    disabled: isDisabled,
    hasSignature,
  } = useSignaturePad();

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="border-2 border-border rounded bg-white w-full cursor-crosshair touch-none"
        style={{
          width: "100%",
          maxWidth: "600px",
          height: "150px",
          pointerEvents: isDisabled ? "none" : "auto",
        }}
      />
      <button
        onClick={clearSignature}
        disabled={!hasSignature || isDisabled}
        className="text-xs text-muted-foreground hover:text-foreground mt-1 underline disabled:opacity-50"
      >
        Clear signature
      </button>
    </div>
  );
}

type SignaturePadSubmitButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "onClick"
> & {
  onCaptureSignature: (canvas: HTMLCanvasElement) => void;
};

export function SignaturePadSubmitButton({
  onCaptureSignature,
  disabled,
  children,
  ...props
}: SignaturePadSubmitButtonProps) {
  const { canvasRef, hasSignature, disabled: isDisabled } = useSignaturePad();
  return (
    <Button
      onClick={() =>
        canvasRef?.current && onCaptureSignature(canvasRef.current)
      }
      disabled={disabled || !hasSignature || isDisabled}
      {...props}
    >
      {children ?? "Confirm Signature"}
    </Button>
  );
}
