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

  return error;
}
