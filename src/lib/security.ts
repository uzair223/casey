import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random token
 * Uses 32 bytes (256 bits) of entropy for maximum security
 *
 * @param length - Number of bytes (default: 32)
 * @returns Hex-encoded token string
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Generate a short code (for 2FA-style verification)
 *
 * @param length - Number of digits (default: 6)
 * @returns Numeric code as string
 */
export function generateShortCode(length: number = 6): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const code = Math.floor(Math.random() * (max - min) + min);
  return code.toString();
}

/**
 * Generate an alphanumeric uppercase code (for invite codes, enrollment codes)
 *
 * @param length - Number of characters (default: 8)
 * @returns Alphanumeric uppercase code string
 */
export function generateAlphanumericCode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Validate token format
 * Ensures token meets minimum security requirements
 */
export function isValidTokenFormat(
  token: string,
  minLength: number = 32,
): boolean {
  return (
    typeof token === "string" &&
    token.length >= minLength &&
    /^[a-f0-9]+$/i.test(token)
  );
}
