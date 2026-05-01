type StructuredChoice = {
  finish_reason?: string | null;
  message?: {
    content?: string | null;
    parsed?: unknown;
    refusal?: string | null;
  } | null;
  error?: unknown;
};

type StructuredResponse = {
  choices?: StructuredChoice[];
};

function stringifyProviderError(error: unknown) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function getStructuredResponseJson(response: StructuredResponse) {
  const choice = response.choices?.[0];
  const message = choice?.message;
  const content = message?.content?.trim();

  if (content) {
    return content;
  }

  if (message?.parsed) {
    return JSON.stringify(message.parsed);
  }

  if (message?.refusal) {
    throw new Error(`LLM refused the request: ${message.refusal}`);
  }

  const providerError = stringifyProviderError(choice?.error);
  if (providerError) {
    throw new Error(`LLM provider returned an error: ${providerError}`);
  }

  const finishReason = choice?.finish_reason
    ? ` Finish reason: ${choice.finish_reason}.`
    : "";
  throw new Error(`No response content from LLM.${finishReason}`);
}
