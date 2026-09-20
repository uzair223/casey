export function createModelRequestTimeout(timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`${label} timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

export function getModelRequestError(error: unknown, label: string) {
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  ) {
    return new Error(`${label} timed out. Please try again.`);
  }

  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 400 && message.includes("no body")) {
    return new Error(
      `${label} failed with an empty 400 from the model gateway.`,
    );
  }

  return error instanceof Error ? error : new Error(message);
}
