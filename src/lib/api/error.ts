import { NextResponse } from 'next/server';

// Plan §2.4: the standard error envelope. Every non-2xx API response uses this
// shape with a stable string code so clients can branch on `code`, not message.

export interface ApiError {
  /** Stable machine-readable code (e.g. VALIDATION_ERROR, NOT_FOUND). */
  code: string;
  /** Human-readable message. */
  message: string;
  /** Optional structured details (e.g. per-field validation errors). */
  details?: unknown;
}

/** Stable error codes used across the API. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Build a JSON error response in the standard envelope. */
export function errorResponse(status: number, error: ApiError): NextResponse {
  return NextResponse.json({ error }, { status });
}
