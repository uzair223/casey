import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  handleApiError,
  userError,
  validationError,
} from "./errors";

type ErrorStatusMap = Record<string, number>;

export const ok = <T>(body: T, status = 200) =>
  NextResponse.json(body, { status });

export const badRequest = (message: string) =>
  apiErrorResponse(validationError(message, { code: "bad_request" }));

export const unauthorized = (message = "Unauthorized") =>
  apiErrorResponse(userError(message, 401, { code: "unauthorized" }));

export const forbidden = (message = "Forbidden") =>
  apiErrorResponse(userError(message, 403, { code: "forbidden" }));

export const notFound = (message: string) =>
  apiErrorResponse(userError(message, 404, { code: "not_found" }));

export const conflict = (message: string) =>
  apiErrorResponse(userError(message, 409, { code: "conflict" }));

export const gone = (message: string) =>
  apiErrorResponse(userError(message, 410, { code: "gone" }));

export const tooManyRequests = (message: string) =>
  apiErrorResponse(userError(message, 429, { code: "too_many_requests" }));

export const serverError = (
  error: unknown,
  knownStatuses: ErrorStatusMap = {},
) => handleApiError(error, { knownStatuses });
