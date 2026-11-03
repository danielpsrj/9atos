import { NextRequest, NextResponse } from 'next/server';
import { cadernoRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/cadernos/:id ────────────────────────────────────────────────────
// Fetches a single notebook by id, including its rules.
// Params: id. Body: none.
// Response 200: the Caderno with its regras. 404 NOT_FOUND if missing.

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const caderno = await cadernoRepository.withRegras(id);
  if (caderno === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Notebook not found.',
      details: { id },
    });
  }
  return NextResponse.json(caderno);
}

// ── PATCH /api/cadernos/:id ──────────────────────────────────────────────────
// Renames a notebook and/or updates its description. Omitted fields keep their
// current value.
// Params: id. Body: { nome?: string, descricao?: string|null }.
// Response 200: the updated Caderno. 404 NOT_FOUND if missing; 400 on a bad body.

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await cadernoRepository.getById(id);
  if (existing === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Notebook not found.',
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
  const body = (raw ?? {}) as { nome?: unknown; descricao?: unknown };
  if (body.nome !== undefined && (typeof body.nome !== 'string' || body.nome.length === 0)) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome must be a non-empty string.',
    });
  }
  if (
    body.descricao !== undefined &&
    body.descricao !== null &&
    typeof body.descricao !== 'string'
  ) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'descricao must be a string or null.',
    });
  }

  const updated = await cadernoRepository.update(id, {
    nome: body.nome ?? existing.nome,
    descricao: body.descricao === undefined ? existing.descricao : body.descricao,
  });
  return NextResponse.json(updated);
}

// ── DELETE /api/cadernos/:id ─────────────────────────────────────────────────
// Deletes a notebook. Its RegraNoCaderno links cascade per the schema (FR-03),
// but the underlying Regra rows survive.
// Params: id. Body: none.
// Response 200: the deleted Caderno. 404 NOT_FOUND if missing.

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const caderno = await cadernoRepository.delete(id);
    return NextResponse.json(caderno);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Notebook not found.',
        details: { id },
      });
    }
    throw err;
  }
}
