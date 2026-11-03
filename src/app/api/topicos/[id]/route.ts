import { NextRequest, NextResponse } from 'next/server';
import { topicoRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound, isPrismaForeignKey } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/topicos/:id ─────────────────────────────────────────────────────
// Fetches a single topico by id.
// Params: id. Body: none.
// Response 200: the Topico. 404 NOT_FOUND if missing.

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
  return NextResponse.json(topico);
}

// ── PATCH /api/topicos/:id ───────────────────────────────────────────────────
// Partially updates a topico. Any omitted field keeps its current value.
// Params: id. Body: { nome?, disciplinaId? }.
// Response 200: the updated Topico. 404 NOT_FOUND if missing; 400 on a bad field.

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await topicoRepository.getById(id);
  if (existing === null) {
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
  const body = (raw ?? {}) as { nome?: unknown; disciplinaId?: unknown };

  if (body.nome !== undefined && (typeof body.nome !== 'string' || body.nome.length === 0)) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome must be a non-empty string.',
    });
  }
  if (body.disciplinaId !== undefined && typeof body.disciplinaId !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'disciplinaId must be a string.',
    });
  }

  try {
    const updated = await topicoRepository.update(id, {
      nome: body.nome ?? existing.nome,
      disciplinaId: body.disciplinaId ?? existing.disciplinaId,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (isPrismaForeignKey(err)) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'disciplinaId does not reference an existing disciplina.',
        details: { disciplinaId: body.disciplinaId },
      });
    }
    throw err;
  }
}

// ── DELETE /api/topicos/:id ──────────────────────────────────────────────────
// Deletes a topico. The schema restricts deletion while regras exist.
// Params: id. Body: none.
// Response 200: the deleted Topico. 404 NOT_FOUND if missing; 409 CONFLICT if it
// still has regras.

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const topico = await topicoRepository.delete(id);
    return NextResponse.json(topico);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Topico not found.',
        details: { id },
      });
    }
    if (isPrismaForeignKey(err)) {
      return errorResponse(409, {
        code: ErrorCode.CONFLICT,
        message: 'Cannot delete: the topico still has regras.',
        details: { id },
      });
    }
    throw err;
  }
}
