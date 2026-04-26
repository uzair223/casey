import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "gone"
  | "too_many_requests"
  | "validation_error"
  | "internal_error"
  | (string & {});

export type ApiErrorBody = {
  error: string;
  code?: ApiErrorCode;
};

export type ApiErrorOptions = {
  code?: ApiErrorCode;
  expose?: boolean;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: ApiErrorCode;
  readonly expose: boolean;
  readonly cause?: unknown;

  constructor(message: string, status: number, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options.code;
    this.expose = options.expose ?? status < 500;
    this.cause = options.cause;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function apiError(
  message: string,
  status = 500,
  options: ApiErrorOptions = {},
) {
  return new ApiError(message, status, options);
}

export function validationError(message: string, options: ApiErrorOptions = {}) {
  return apiError(message, 400, {
    code: "validation_error",
    expose: true,
    ...options,
  });
}

export function userError(
  message: string,
  status = 400,
  options: ApiErrorOptions = {},
) {
  return apiError(message, status, {
    expose: true,
    ...options,
  });
}

export function internalError(
  message = "Internal server error",
  options: ApiErrorOptions = {},
) {
  return apiError(message, 500, {
    code: "internal_error",
    expose: false,
    ...options,
  });
}

export function apiErrorResponse(error: ApiError) {
  const body: ApiErrorBody = {
    error: error.message,
  };

  if (error.code) {
    body.code = error.code;
  }

  return NextResponse.json(body, { status: error.status });
}

type HandleApiErrorOptions = {
  defaultMessage?: string;
  exposeUnexpected?: boolean;
  knownStatuses?: Record<string, number>;
};

export function handleApiError(
  error: unknown,
  {
    defaultMessage = "Internal server error",
    exposeUnexpected = process.env.NODE_ENV === "development",
    knownStatuses = {},
  }: HandleApiErrorOptions = {},
) {
  if (error instanceof Response) {
    return error;
  }

  if (isApiError(error)) {
    return apiErrorResponse(error);
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  const knownStatus = knownStatuses[message];

  if (knownStatus) {
    return apiErrorResponse(
      userError(message, knownStatus, { code: statusToCode(knownStatus) }),
    );
  }

  return apiErrorResponse(
    apiError(exposeUnexpected ? message : defaultMessage, 500, {
      code: "internal_error",
      expose: exposeUnexpected,
      cause: error,
    }),
  );
}

function statusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 410:
      return "gone";
    case 429:
      return "too_many_requests";
    default:
      return "internal_error";
  }
}
