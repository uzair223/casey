import { createHash } from "node:crypto";

export function sha256Hex(data: Buffer | Uint8Array | string) {
  return createHash("sha256").update(data).digest("hex");
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  return (
    forwardedFor.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

export function getRequestUserAgent(request: Request) {
  return request.headers.get("user-agent") || null;
}
