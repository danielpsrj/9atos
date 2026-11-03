import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

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
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Build a JSON error response in the standard envelope. */
export function errorResponse(status: number, error: ApiError): NextResponse {
  return NextResponse.json({ error }, { status });
}

/** True when `err` is a Prisma "record not found" (P2025) error. */
export function isPrismaNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}

/** True when `err` is a Prisma foreign-key violation (P2003) error. */
export function isPrismaForeignKey(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003';
}

/** True when `err` is a Prisma unique-constraint violation (P2002) error. */
export function isPrismaUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
