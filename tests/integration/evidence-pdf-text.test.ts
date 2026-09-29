import { describe, expect, it } from "vitest";

import { loadEvidenceFile } from "@/lib/llm/evidence-files";

describe("loadEvidenceFile", () => {
  it("does not send a PDF to the model as a file attachment", async () => {
    const loaded = await loadEvidenceFile(
      new Blob(["%PDF-1.4 not a real document"], { type: "application/pdf" }),
      { name: "accident-book.pdf", type: "application/pdf" },
    );

    expect(loaded.part).toBeUndefined();
    expect(loaded.handledAs).not.toBe("pdf");
  });
});