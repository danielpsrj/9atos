import { NextRequest, NextResponse } from 'next/server';
import { conhecimentoRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/conhecimentos/:id ────────────────────────────────────────────────
// Fetches a single unity of knowledge with its full rule list (issue #62).
// Params: id. Body: none. Response 200: ConhecimentoWithRegras. 404 if missing.

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const conhecimento = await conhecimentoRepository.withRegras(id);
  if (conhecimento === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Conhecimento not found.',
      details: { id },
    });
  }
  return NextResponse.json(conhecimento);
}

// ── PATCH /api/conhecimentos/:id ──────────────────────────────────────────────
// Updates a knowledge's name and/or description.
// Params: id. Body: { nome?: string, descricao?: string | null }.
// Response 200: the updated Conhecimento. 404 if missing; 400 on a bad body.

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
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
  const data: { nome?: string; descricao?: string | null } = {};
  if (body.nome !== undefined) {
    if (typeof body.nome !== 'string' || body.nome.length === 0) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'nome must be a non-empty string.',
      });
    }
    data.nome = body.nome;
  }
  if (body.descricao !== undefined) {
    data.descricao =
      body.descricao === null ? null : typeof body.descricao === 'string' ? body.descricao : null;
  }
  if (data.nome === undefined && data.descricao === undefined) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Provide at least one of nome or descricao.',
    });
  }
  try {
    const conhecimento = await conhecimentoRepository.update(id, data);
    return NextResponse.json(conhecimento);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Conhecimento not found.',
        details: { id },
      });
    }
    throw err;
  }
}

// ── DELETE /api/conhecimentos/:id ─────────────────────────────────────────────
// Deletes a unity of knowledge. Its rules keep existing (conhecimentoId is set
// to null by the schema's ON DELETE SET NULL); notebooks that referenced it are
// likewise detached. Params: id. Body: none.
// Response 200: the deleted Conhecimento. 404 NOT_FOUND if missing.

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const conhecimento = await conhecimentoRepository.delete(id);
    return NextResponse.json(conhecimento);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Conhecimento not found.',
        details: { id },
      });
    }
    throw err;
  }
}
