const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Unknown error";
};

export const labelled = <Args extends unknown[], Result>(
  name: string,
  task: (...args: Args) => PromiseLike<Result>,
) => {
  return async (...args: Args): Promise<Result> => {
    try {
      return await task(...args);
    } catch (error) {
      throw new Error(`${name}: ${toErrorMessage(error)}`);
    }
  };
};
