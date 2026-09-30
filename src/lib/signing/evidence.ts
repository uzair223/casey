import { sha256Hex } from "@/lib/crypto/hash";

const MAX_SIGNATURE_PNG_BYTES = 500 * 1024;
const MAX_DOCX_BYTES = 4_500_000;

export function statementContentSha256(params: {
  statementId: string;
  witnessName: string;
  witnessEmail: string;
  sections: Record<string, string>;
}) {
  const sections = Object.keys(params.sections)
    .sort()
    .map((key) => [key, params.sections[key] ?? ""]);
  return sha256Hex(
    JSON.stringify({
      statementId: params.statementId,
      witnessName: params.witnessName.trim(),
      witnessEmail: params.witnessEmail.trim().toLowerCase(),
      sections,
    }),
  );
}

function decodeBase64(value: unknown, maxBytes: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s/g, "").replace(/^data:[^;]+;base64,/, "");
  if (!trimmed || trimmed.length > Math.ceil((maxBytes * 4) / 3) + 8) {
    return null;
  }
  const bytes = Uint8Array.from(Buffer.from(trimmed, "base64"));
  if (bytes.byteLength < 4 || bytes.byteLength > maxBytes) return null;
  return bytes;
}

export function decodeSignaturePng(value: unknown) {
  const bytes = decodeBase64(value, MAX_SIGNATURE_PNG_BYTES);
  if (!bytes) return null;
  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  return png ? bytes : null;
}

export function decodeSignedDocx(value: unknown) {
  const bytes = decodeBase64(value, MAX_DOCX_BYTES);
  if (!bytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
  return bytes;
}
