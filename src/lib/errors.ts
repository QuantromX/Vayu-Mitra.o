/**
 * Consistent typed error hierarchy for validation, configuration, rate limiting, and upstream failures.
 * Never exposes sensitive internal details or secrets in serialized error messages.
 */

export type AppErrorCode =
  | 'CONFIG_ERROR'
  | 'VALIDATION_ERROR'
  | 'UPSTREAM_API_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'PAYLOAD_TOO_LARGE';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    code: AppErrorCode,
    statusCode: number,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 500);
  }
}

export class ValidationError extends AppError {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class UpstreamApiError extends AppError {
  readonly upstreamStatus?: number;
  readonly isTimeout: boolean;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      upstreamStatus?: number;
      isTimeout?: boolean;
      cause?: unknown;
    }
  ) {
    super(message, 'UPSTREAM_API_ERROR', options?.statusCode ?? 502, {
      cause: options?.cause,
    });
    this.upstreamStatus = options?.upstreamStatus;
    this.isTimeout = options?.isTimeout ?? false;
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSec: number;

  constructor(message: string, retryAfterSec: number) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.retryAfterSec = retryAfterSec;
  }
}
