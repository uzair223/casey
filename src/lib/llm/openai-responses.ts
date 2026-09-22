import type OpenAI from "openai";
import type { ResponseFormatTextConfig } from "openai/resources/responses/responses";

export type ResponsesTurn = {
  role: "user" | "assistant" | "developer";
  content: string;
};

type ResponsesRequest = {
  client: OpenAI;
  model: string;
  instructions: string;
  input: ResponsesTurn[];
  temperature?: number;
  textFormat?: ResponseFormatTextConfig;
  promptCacheKey?: string;
  signal?: AbortSignal;
};

function createParams(args: ResponsesRequest) {
  return {
    model: args.model,
    instructions: args.instructions,
    input: args.input,
    temperature: args.temperature,
    store: false as const,
    ...(args.promptCacheKey ? { prompt_cache_key: args.promptCacheKey } : {}),
    ...(args.textFormat ? { text: { format: args.textFormat } } : {}),
  };
}

export async function streamResponsesText(
  args: ResponsesRequest,
): Promise<AsyncIterable<string>> {
  const stream = await args.client.responses.create(
    {
      ...createParams(args),
      stream: true,
    },
    { signal: args.signal },
  );

  return (async function* () {
    for await (const event of stream) {
      if (event.type === "response.output_text.delta" && event.delta) {
        yield event.delta;
      }
      if (event.type === "response.failed") {
        throw new Error(
          event.response.error?.message || "LLM response failed.",
        );
      }
    }
  })();
}

export async function collectResponsesText(args: ResponsesRequest) {
  let text = "";
  for await (const delta of await streamResponsesText(args)) {
    text += delta;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No response content from LLM.");
  }

  return trimmed;
}
