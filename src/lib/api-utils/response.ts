import { NextResponse } from "next/server";

type ErrorStatusMap = Record<string, number>;

export const ok = <T>(body: T, status = 200) =>
  NextResponse.json(body, { status });

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

export const unauthorized = (message = "Unauthorized") =>
  NextResponse.json({ error: message }, { status: 401 });

export const forbidden = (message = "Forbidden") =>
  NextResponse.json({ error: message }, { status: 403 });

export const notFound = (message: string) =>
  NextResponse.json({ error: message }, { status: 404 });

export const conflict = (message: string) =>
  NextResponse.json({ error: message }, { status: 409 });

export const gone = (message: string) =>
  NextResponse.json({ error: message }, { status: 410 });

export const tooManyRequests = (message: string) =>
  NextResponse.json({ error: message }, { status: 429 });

export const serverError = (
  error: unknown,
  knownStatuses: ErrorStatusMap = {},
) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = knownStatuses[message] ?? 500;
  return NextResponse.json({ error: message }, { status });
};
