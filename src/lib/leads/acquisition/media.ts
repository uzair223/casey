import { deflateSync } from "node:zlib";

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
};

function crc32(bytes: Buffer) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng(width: number, height: number, rgba: Uint8Array) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.subarray(y * width * 4, (y + 1) * width * 4).forEach((value, index) => {
      raw[row + 1 + index] = value;
    });
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function hexRgb(hex: string) {
  const value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#1f3a2e";
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function readableText(background: string, preferred: string) {
  const [red, green, blue] = hexRgb(background);
  const [textRed, textGreen, textBlue] = hexRgb(preferred);
  const backgroundLuma = 0.299 * red + 0.587 * green + 0.114 * blue;
  const textLuma = 0.299 * textRed + 0.587 * textGreen + 0.114 * textBlue;
  if (Math.abs(backgroundLuma - textLuma) >= 90) return preferred;
  return backgroundLuma > 150 ? "#1a1a1a" : "#f7f4ee";
}

function paint(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
  color: number[],
) {
  if (x < 0 || y < 0 || x >= width) return;
  const height = rgba.length / (width * 4);
  if (y >= height) return;
  const index = (y * width + x) * 4;
  rgba[index] = color[0];
  rgba[index + 1] = color[1];
  rgba[index + 2] = color[2];
  rgba[index + 3] = 255;
}

function wrap(text: string, maxChars: number) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word.slice(0, maxChars);
    } else {
      current = next.slice(0, maxChars);
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function drawLine(
  rgba: Uint8Array,
  width: number,
  line: string,
  top: number,
  scale: number,
  color: number[],
) {
  const glyphWidth = 6 * scale;
  const used = line.length * glyphWidth - scale;
  let x = Math.floor((width - used) / 2);
  for (const character of line) {
    const glyph = GLYPHS[character] ?? GLYPHS[" "];
    glyph.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] !== "1") continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            paint(rgba, width, x + column * scale + dx, top + rowIndex * scale + dy, color);
          }
        }
      }
    });
    x += glyphWidth;
  }
}

export function renderBrandAdPng(params: {
  firmName: string;
  line: string;
  background: string;
  text: string;
  size?: number;
}) {
  const size = params.size ?? 1080;
  const rgba = new Uint8Array(size * size * 4);
  const background = hexRgb(params.background);
  const band = background.map((channel) => Math.round(channel * 0.72));
  const ink = hexRgb(readableText(params.background, params.text));
  for (let y = 0; y < size; y += 1) {
    const color = y > size * 0.72 ? band : background;
    for (let x = 0; x < size; x += 1) paint(rgba, size, x, y, color);
  }
  const scale = Math.max(3, Math.floor(size / 70));
  const maxChars = Math.max(8, Math.floor((size * 0.82) / (6 * scale)));
  const nameLines = wrap(params.firmName || "The firm", maxChars);
  const claimLines = wrap(params.line, maxChars);
  const lineHeight = 8 * scale;
  const blockHeight = (nameLines.length + claimLines.length) * lineHeight;
  let top = Math.floor((size * 0.62 - blockHeight) / 2);
  for (const line of nameLines) {
    drawLine(rgba, size, line, top, scale, ink);
    top += lineHeight;
  }
  top += lineHeight;
  for (const line of claimLines) {
    drawLine(rgba, size, line, top, Math.max(2, scale - 1), ink);
    top += lineHeight;
  }
  return encodePng(size, size, rgba);
}
