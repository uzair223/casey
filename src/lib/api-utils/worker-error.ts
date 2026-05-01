export function getWorkerFailureMessage(params: {
  fallback: string;
  responseBody: string;
  status: number;
}) {
  const body = params.responseBody.trim();

  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      const message =
        typeof parsed.error === "string"
          ? parsed.error
          : typeof parsed.message === "string"
            ? parsed.message
            : null;

      if (message?.trim()) {
        return message.trim();
      }
    } catch {
      return body;
    }
  }

  return `${params.fallback} (${params.status})`;
}
