export function attachedMediaPlaceholder(params: {
  kind: "image" | "audio" | "video" | "file";
  name: string;
  type?: string | null;
}) {
  const mime = params.type?.trim() || "unknown";
  return `[Attached ${params.kind}: ${params.name} (${mime}). Contents were not sent to the model.]`;
}
