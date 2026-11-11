import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncSession, type GradeEntry } from '@/lib/srs/sync';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// Plan §2.4 / spec §6 / issue #22: POST /api/study/session/sync.
// Applies a finished session's grades transactionally and returns the updated
// proximaRevisao per rule. Idempotent per sessionId (a replay returns the
// original result without re-applying SRS).

/** The four valid SRS grades (FR-04). */
const VALID_GRADES = new Set([1, 3, 4, 5]);

/** The four valid game types (issue #61 — recorded on the historico). */
const VALID_GAMES = new Set(['flashcards', 'match', 'multiple-choice', 'cloze']);

interface SyncBody {
  usuarioId?: unknown;
  sessionId?: unknown;
  resultados?: unknown;
  game?: unknown;
}

interface Resultado {
  regraId?: unknown;
  qualidade?: unknown;
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Request body must be valid JSON.',
    });
  }
  if (raw === null || typeof raw !== 'object') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Request body must be a JSON object.',
    });
  }
  const body = raw as SyncBody;
  const { usuarioId, sessionId, resultados, game } = body;

  // usuarioId: required non-empty string.
  if (typeof usuarioId !== 'string' || usuarioId.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'usuarioId is required and must be a non-empty string.',
    });
  }

  // sessionId: required non-empty string (idempotency key).
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'sessionId is required and must be a non-empty string.',
    });
  }

  // resultados: required non-empty array of {regraId, qualidade}.
  if (!Array.isArray(resultados) || resultados.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'resultados must be a non-empty array of {regraId, qualidade}.',
    });
  }

  // Validate each entry's shape and grade value.
  const batch: GradeEntry[] = [];
  const badEntries: { index: number; reason: string }[] = [];
  for (let i = 0; i < resultados.length; i++) {
    const entry = (resultados[i] ?? {}) as Resultado;
    const { regraId, qualidade } = entry;
    if (typeof regraId !== 'string' || regraId.length === 0) {
      badEntries.push({ index: i, reason: 'regraId must be a non-empty string' });
      continue;
    }
    if (typeof qualidade !== 'number' || !VALID_GRADES.has(qualidade)) {
      badEntries.push({ index: i, reason: 'qualidade must be one of 1, 3, 4, 5' });
      continue;
    }
    batch.push({ regraId, qualidade });
  }
  if (badEntries.length > 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'One or more resultados entries are invalid.',
      details: { entries: badEntries },
    });
  }

  // game (issue #61): optional; when present it must be a valid game type. It
  // is recorded on each historico entry so the per-game statistics can group
  // plays by game. Absent (or null) → not recorded (backward compatible).
  let gameType: string | undefined;
  if (game !== undefined && game !== null) {
    if (typeof game !== 'string' || !VALID_GAMES.has(game)) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'game must be one of flashcards, match, multiple-choice, cloze.',
      });
    }
    gameType = game;
  }

  // The user must exist.
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (usuario === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'User not found.',
      details: { usuarioId },
    });
  }

  // Every referenced regra must exist (unknown regraId → 400, not a 500 rollback).
  const regraIds = batch.map((b) => b.regraId);
  const found = await prisma.regra.count({ where: { id: { in: regraIds } } });
  if (found !== new Set(regraIds).size) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'One or more regraId values do not exist.',
      details: { regraIds },
    });
  }

  // Apply the batch transactionally (idempotent per sessionId). The game type
  // (issue #61) is recorded on each historico entry for the per-game statistics.
  const results = await syncSession(usuarioId, sessionId, batch, { game: gameType });

  return NextResponse.json(results);
}
