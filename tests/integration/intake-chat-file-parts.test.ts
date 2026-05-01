import { describe, expect, it } from "vitest";

import { buildIntakeChatFileParts } from "@/lib/files";

describe("buildIntakeChatFileParts", () => {
  it("turns uploaded files into real model input parts without storage", async () => {
    const image = new File(["fake-image"], "photo.png", {
      type: "image/png",
    });
    const text = new File(["Line one\nLine two"], "notes.txt", {
      type: "text/plain",
    });
    const pdf = new File(["%PDF-1.4 fake"], "report.pdf", {
      type: "application/pdf",
    });

    const result = await buildIntakeChatFileParts({
      userMessage: "Please review these files.",
      files: [image, text, pdf],
    });

    expect(Array.isArray(result.content)).toBe(true);
    expect(result.attachedFiles.map((file) => file.handledAs)).toEqual([
      "image",
      "text",
      "metadata_only",
    ]);
    expect(result.requiresPdfPlugin).toBe(false);

    const parts = result.content as Array<{ type: string }>;
    expect(parts.some((part) => part.type === "image_url")).toBe(true);
    expect(parts.some((part) => part.type === "text")).toBe(true);
  });
});
