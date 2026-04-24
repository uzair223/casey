import { vi } from "vitest";

export async function importFresh<T>(modulePath: string): Promise<T> {
  vi.resetModules();
  return (await import(modulePath)) as T;
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function readText(response: Response): Promise<string> {
  return await response.text();
}

export async function readStream(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode();
  return result;
}
