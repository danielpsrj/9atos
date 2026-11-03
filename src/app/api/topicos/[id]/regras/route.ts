import { NextRequest, NextResponse } from 'next/server';
import { topicoRepository, regraRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/topicos/:id/regras ──────────────────────────────────────────────
// Lists the regras of a topico, ordered by pergunta.
// Params: id (topico id). Body: none.
// Response 200: Regra[]. 404 NOT_FOUND if the topico is missing.

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const topico = await topicoRepository.getById(id);
  if (topico === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Topico not found.',
      details: { id },
    });
  }
  const regras = await regraRepository.list({ topicoId: id });
  return NextResponse.json(regras);
}

// ── POST /api/topicos/:id/regras ─────────────────────────────────────────────
// Creates a regra under a topico.
// Params: id (topico id).
// Body: {
//   pergunta: string (required), respostaCerta: string (required),
//   justificativa?: string|null, dica?: string|null,
//   distratores: string[] (required),
//   nivelDificuldade?: 1..5 (default 1), probabilidade?: 0.0..1.0|null
// }
// Response 201: the created Regra. 404 NOT_FOUND if the topico is missing;
// 400 VALIDATION_ERROR on any out-of-range or malformed field.

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const topico = await topicoRepository.getById(id);
  if (topico === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Topico not found.',
      details: { id },
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Body must be valid JSON.',
    });
  }
  const body = (raw ?? {}) as {
    pergunta?: unknown;
    respostaCerta?: unknown;
    justificativa?: unknown;
    dica?: unknown;
    distratores?: unknown;
    nivelDificuldade?: unknown;
    probabilidade?: unknown;
  };

  // Required text fields.
  if (typeof body.pergunta !== 'string' || body.pergunta.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'pergunta is required and must be a non-empty string.',
    });
  }
  if (typeof body.respostaCerta !== 'string' || body.respostaCerta.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'respostaCerta is required and must be a non-empty string.',
    });
  }

  // Optional text fields.
  if (
    body.justificativa !== undefined &&
    body.justificativa !== null &&
    typeof body.justificativa !== 'string'
  ) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'justificativa must be a string or null.',
    });
  }
  if (body.dica !== undefined && body.dica !== null && typeof body.dica !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'dica must be a string or null.',
    });
  }

  // distratores: required array of strings.
  if (!Array.isArray(body.distratores) || body.distratores.some((d) => typeof d !== 'string')) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'distratores is required and must be an array of strings.',
    });
  }

  // nivelDificuldade: optional integer 1..5.
  let nivelDificuldade = 1;
  if (body.nivelDificuldade !== undefined) {
    if (typeof body.nivelDificuldade !== 'number' || !Number.isInteger(body.nivelDificuldade)) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'nivelDificuldade must be an integer between 1 and 5.',
      });
    }
    if (body.nivelDificuldade < 1 || body.nivelDificuldade > 5) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'nivelDificuldade must be between 1 and 5.',
        details: { nivelDificuldade: body.nivelDificuldade },
      });
    }
    nivelDificuldade = body.nivelDificuldade;
  }

  // probabilidade: optional number 0.0..1.0 or null.
  let probabilidade: number | null = null;
  if (body.probabilidade !== undefined && body.probabilidade !== null) {
    if (typeof body.probabilidade !== 'number' || Number.isNaN(body.probabilidade)) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'probabilidade must be a number between 0.0 and 1.0, or null.',
      });
    }
    if (body.probabilidade < 0 || body.probabilidade > 1) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'probabilidade must be between 0.0 and 1.0.',
        details: { probabilidade: body.probabilidade },
      });
    }
    probabilidade = body.probabilidade;
  }

  try {
    const regra = await regraRepository.create({
      topicoId: id,
      pergunta: body.pergunta,
      respostaCerta: body.respostaCerta,
      justificativa: body.justificativa === undefined ? null : body.justificativa,
      dica: body.dica === undefined ? null : body.dica,
      distratores: body.distratores as string[],
      nivelDificuldade,
      probabilidade,
    });
    return NextResponse.json(regra, { status: 201 });
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Topico not found.',
        details: { id },
      });
    }
    throw err;
  }
}
