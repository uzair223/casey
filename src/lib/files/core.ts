export const TEXT_LIKE_EXTENSIONS = [
  "txt",
  "md",
  "csv",
  "json",
  "xml",
  "html",
  "htm",
  "yaml",
  "yml",
];

export function getFileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

export function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

export function toDataUrl(mimeType: string, base64: string) {
  return `data:${mimeType};base64,${base64}`;
}

export function isPdfFile(file: Pick<File, "type" | "name">) {
  return (
    file.type === "application/pdf" || getFileExtension(file.name) === "pdf"
  );
}

export function isImageFile(file: Pick<File, "type" | "name">) {
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name)
  );
}

export function isVideoFile(file: Pick<File, "type" | "name">) {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|mov|avi|m4v|webm)$/i.test(file.name)
  );
}

export function isAudioFile(file: Pick<File, "type" | "name">) {
  return (
    file.type.startsWith("audio/") ||
    /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)
  );
}

export function isPlainTextLikeFile(file: Pick<File, "type" | "name">) {
  const mimeType = (file.type || "").toLowerCase();
  const extension = getFileExtension(file.name);

  return (
    mimeType.startsWith("text/") || TEXT_LIKE_EXTENSIONS.includes(extension)
  );
}

export function getAudioFormat(file: Pick<File, "type" | "name">) {
  const mimeType = (file.type || "").toLowerCase();
  const extension = getFileExtension(file.name);

  if (mimeType.includes("mpeg") || extension === "mp3") {
    return "mp3";
  }
  if (mimeType.includes("wav") || extension === "wav") {
    return "wav";
  }

  return null;
}

export function truncateText(value: string, maxLength = 20_000) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n\n[Truncated due to length]`;
}
