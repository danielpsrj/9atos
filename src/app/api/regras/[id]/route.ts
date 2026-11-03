import { NextRequest, NextResponse } from 'next/server';
import { regraRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound, isPrismaForeignKey } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/regras/:id ──────────────────────────────────────────────────────
// Fetches a single regra by id.
// Params: id. Body: none.
// Response 200: the Regra. 404 NOT_FOUND if missing.

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const regra = await regraRepository.getById(id);
  if (regra === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Regra not found.',
      details: { id },
    });
  }
  return NextResponse.json(regra);
}

// ── PATCH /api/regras/:id ────────────────────────────────────────────────────
// Partially updates a regra. Any omitted field keeps its current value.
// Params: id.
// Body: { pergunta?, respostaCerta?, justificativa?, dica?, distratores?,
//         nivelDificuldade? (1..5), probabilidade? (0.0..1.0|null), topicoId? }.
// Response 200: the updated Regra. 404 NOT_FOUND if missing; 400 on any
// out-of-range or malformed field.

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await regraRepository.getById(id);
  if (existing === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Regra not found.',
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
    topicoId?: unknown;
  };

  if (
    body.pergunta !== undefined &&
    (typeof body.pergunta !== 'string' || body.pergunta.length === 0)
  ) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'pergunta must be a non-empty string.',
    });
  }
  if (
    body.respostaCerta !== undefined &&
    (typeof body.respostaCerta !== 'string' || body.respostaCerta.length === 0)
  ) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'respostaCerta must be a non-empty string.',
    });
  }
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
  if (
    body.distratores !== undefined &&
    (!Array.isArray(body.distratores) || body.distratores.some((d) => typeof d !== 'string'))
  ) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'distratores must be an array of strings.',
    });
  }
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
  }
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
  }
  if (body.topicoId !== undefined && typeof body.topicoId !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'topicoId must be a string.',
    });
  }

  try {
    const updated = await regraRepository.update(id, {
      ...(body.pergunta !== undefined ? { pergunta: body.pergunta } : {}),
      ...(body.respostaCerta !== undefined ? { respostaCerta: body.respostaCerta } : {}),
      ...(body.justificativa !== undefined ? { justificativa: body.justificativa } : {}),
      ...(body.dica !== undefined ? { dica: body.dica } : {}),
      ...(body.distratores !== undefined ? { distratores: body.distratores as string[] } : {}),
      ...(body.nivelDificuldade !== undefined ? { nivelDificuldade: body.nivelDificuldade } : {}),
      ...(body.probabilidade !== undefined ? { probabilidade: body.probabilidade } : {}),
      ...(body.topicoId !== undefined ? { topicoId: body.topicoId } : {}),
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (isPrismaForeignKey(err)) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'topicoId does not reference an existing topico.',
        details: { topicoId: body.topicoId },
      });
    }
    throw err;
  }
}

// ── DELETE /api/regras/:id ───────────────────────────────────────────────────
// Deletes a regra. Caderno links cascade per the schema; existing study
// progress restricts deletion.
// Params: id. Body: none.
// Response 200: the deleted Regra. 404 NOT_FOUND if missing; 409 CONFLICT if it
// still has study progress.

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const regra = await regraRepository.delete(id);
    return NextResponse.json(regra);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Regra not found.',
        details: { id },
      });
    }
    if (isPrismaForeignKey(err)) {
      return errorResponse(409, {
        code: ErrorCode.CONFLICT,
        message: 'Cannot delete: the regra still has study progress.',
        details: { id },
      });
    }
    throw err;
  }
}
