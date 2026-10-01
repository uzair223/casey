import { inflateSync } from "node:zlib";

import { encodePng } from "./media";

const MAX_SIDE = 512;

function pngSize(bytes: Uint8Array) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
}

function jpegSize(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc2) {
      return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
    }
    offset += 2 + length;
  }
  return null;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  );
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonal = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left;
  if (upDistance <= diagonal) return up;
  return upLeft;
}

function decodePng(bytes: Uint8Array) {
  const size = pngSize(bytes);
  if (!size || bytes[24] !== 8 || bytes[28] !== 0) return null;
  const colour = bytes[25];
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
  if (!channels) return null;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString("ascii");
    const data = Buffer.from(bytes.subarray(offset + 8, offset + 8 + length));
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!idat.length) return null;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const stride = size.width * channels;
  const pixels = Buffer.alloc(size.height * stride);
  let cursor = 0;
  for (let y = 0; y < size.height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    if (filter === undefined || cursor + stride > raw.length) return null;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[cursor + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      let current = value;
      if (filter === 1) current = (value + left) & 255;
      else if (filter === 2) current = (value + up) & 255;
      else if (filter === 3) current = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) current = (value + paeth(left, up, upLeft)) & 255;
      else if (filter !== 0) return null;
      pixels[y * stride + x] = current;
    }
    cursor += stride;
  }
  const rgba = new Uint8Array(size.width * size.height * 4);
  for (let index = 0; index < size.width * size.height; index += 1) {
    rgba[index * 4] = pixels[index * channels];
    rgba[index * 4 + 1] = pixels[index * channels + 1];
    rgba[index * 4 + 2] = pixels[index * channels + 2];
    rgba[index * 4 + 3] = channels === 4 ? pixels[index * channels + 3] : 255;
  }
  return { width: size.width, height: size.height, rgba };
}

function resizedPng(width: number, height: number, rgba: Uint8Array) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  if (nextWidth === width && nextHeight === height) return null;
  const next = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y * height) / nextHeight));
    for (let x = 0; x < nextWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x * width) / nextWidth));
      const from = (sourceY * width + sourceX) * 4;
      const to = (y * nextWidth + x) * 4;
      next.set(rgba.subarray(from, from + 4), to);
    }
  }
  return encodePng(nextWidth, nextHeight, next);
}

export function fitReferenceImage(bytes: Uint8Array) {
  const jpeg = jpegSize(bytes);
  if (jpeg) {
    if (jpeg.width <= MAX_SIDE && jpeg.height <= MAX_SIDE) return Buffer.from(bytes);
    return null;
  }
  const png = pngSize(bytes);
  if (!png) return null;
  if (png.width <= MAX_SIDE && png.height <= MAX_SIDE) return Buffer.from(bytes);
  const decoded = decodePng(bytes);
  if (!decoded) return null;
  return resizedPng(decoded.width, decoded.height, decoded.rgba);
}
