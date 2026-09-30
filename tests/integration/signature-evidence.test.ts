import { describe, expect, it } from "vitest";

import { sha256Hex } from "@/lib/crypto/hash";
import {
  decodeSignaturePng,
  decodeSignedDocx,
  statementContentSha256,
} from "@/lib/signing/evidence";
import { STATEMENT_OF_TRUTH } from "@/lib/signing/statement-of-truth";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("canvas signature evidence", () => {
  it("hashes the statement the server holds, not a file the browser names", () => {
    const first = statementContentSha256({
      statementId: "statement-1",
      witnessName: "Aisha Khan",
      witnessEmail: "aisha.khan@caseyhq.co.uk",
      sections: { whatTheySaw: "The parcel hit his left foot." },
    });
    const changed = statementContentSha256({
      statementId: "statement-1",
      witnessName: "Aisha Khan",
      witnessEmail: "aisha.khan@caseyhq.co.uk",
      sections: { whatTheySaw: "The parcel missed him." },
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(changed).not.toBe(first);
  });

  it("accepts a drawn signature and a Word file, and keeps the statement of truth", () => {
    const png = decodeSignaturePng(PNG);
    const docx = decodeSignedDocx("UEsDBA==");
    expect(png).not.toBeNull();
    expect(sha256Hex(png!)).toMatch(/^[a-f0-9]{64}$/);
    expect(docx?.[0]).toBe(0x50);
    expect(STATEMENT_OF_TRUTH).toContain(
      "I believe that the facts stated in this witness statement are true.",
    );
    expect(decodeSignaturePng("UEsDBA==")).toBeNull();
  });
});
