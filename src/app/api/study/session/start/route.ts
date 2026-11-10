import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { dueRules } from '@/lib/srs/scheduler';
import {
  buildFlashcardSession,
  buildMultipleChoiceSession,
  buildMatchSession,
  buildClozeSession,
  toGameRule,
  type GameType,
  type GameSession,
} from '@/lib/games';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// Plan §2.4 / spec §6 / issue #21: POST /api/study/session/start.
// Wire gameType values (per the issue) map to the internal GameType union.
// Returns null for an unknown wire value (the route turns that into a 400).
function wireToGameType(wire: string): GameType | null {
  switch (wire) {
    case 'flashcards':
      return 'flashcard';
    case 'match':
      return 'matching';
    case 'cloze':
      return 'cloze';
    case 'multiple-choice':
      return 'multiple-choice';
    default:
      return null;
  }
}

interface StartBody {
  cadernoId?: unknown;
  limit?: unknown;
  gameType?: unknown;
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
  const body = raw as StartBody;
  const { cadernoId, limit, gameType } = body;

  // cadernoId: required non-empty string.
  if (typeof cadernoId !== 'string' || cadernoId.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'cadernoId is required and must be a non-empty string.',
    });
  }

  // gameType: must be one of the four wire values.
  if (typeof gameType !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'gameType must be one of: flashcards, match, cloze, multiple-choice.',
    });
  }
  const gameTypeInternal = wireToGameType(gameType);
  if (gameTypeInternal === null) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'gameType must be one of: flashcards, match, cloze, multiple-choice.',
      details: { gameType },
    });
  }

  // limit: optional positive integer (defaults to 20 in the scheduler, AD-13).
  let resolvedLimit: number | undefined;
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'limit must be a positive integer.',
      });
    }
    resolvedLimit = limit;
  }

  // V1 is single-user with no auth (AD-01): resolve the one bootstrap user.
  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
    });
  }

  // The notebook must exist and belong to the user.
  const caderno = await prisma.caderno.findFirst({
    where: { id: cadernoId, usuarioId: usuario.id },
  });
  if (caderno === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Notebook not found.',
      details: { cadernoId },
    });
  }

  // Fetch the due rules for the notebook, capped by limit.
  const due = await dueRules(usuario.id, {
    cadernoId: caderno.id,
    limit: resolvedLimit,
  });

  // Build the session for the requested game type.
  const sessionId = randomUUID();
  const rules = due.map((d) => toGameRule(d.regra));
  let session: GameSession;
  switch (gameTypeInternal) {
    case 'flashcard':
      session = buildFlashcardSession(rules, sessionId);
      break;
    case 'multiple-choice':
      session = buildMultipleChoiceSession(rules, sessionId);
      break;
    case 'matching':
      session = buildMatchSession(rules, sessionId);
      break;
    case 'cloze':
      session = buildClozeSession(rules, sessionId);
      break;
  }

  // Include the resolved usuarioId alongside the session so the client can call
  // the sync endpoint (which requires it) without a separate round-trip. The
  // spread preserves the GameSession shape (type/items/...) that the route
  // tests assert; usuarioId is an extra field the client reads for the sync.
  return NextResponse.json({ ...session, usuarioId: usuario.id });
}
