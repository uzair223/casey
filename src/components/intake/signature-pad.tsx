"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignaturePadProps = {
  onSignatureCapture: (canvas: HTMLCanvasElement, typedName: string) => void;
  witnessName: string;
  isDisabled?: boolean;
};

export function SignaturePad({
  onSignatureCapture,
  witnessName,
  isDisabled = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState(witnessName);
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
    if (isDisabled || !context) return;

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

  const handleCapture = () => {
    if (canvasRef.current && typedName.trim()) {
      onSignatureCapture(canvasRef.current, typedName.trim());
    }
  };

  const isValid = hasSignature && typedName.trim().length > 0;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold mb-2 block">
          Draw Your Signature
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Sign using your mouse or finger on the touchscreen
        </p>
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
            width: "600px",
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

      <div>
        <Label
          htmlFor="typed-name"
          className="text-sm font-semibold mb-2 block"
        >
          Printed Name (Required)
        </Label>
        <Input
          id="typed-name"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="Enter your full name"
          disabled={isDisabled}
          className="font-serif"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Enter your full legal name to confirm the signature
        </p>
      </div>

      <Button
        onClick={handleCapture}
        disabled={!isValid || isDisabled}
        className="w-full"
      >
        {isValid ? "Confirm Signature" : "Draw signature and enter name"}
      </Button>
    </div>
  );
}
