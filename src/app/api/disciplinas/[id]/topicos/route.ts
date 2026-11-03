import { NextRequest, NextResponse } from 'next/server';
import { disciplinaRepository, topicoRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/disciplinas/:id/topicos ─────────────────────────────────────────
// Lists the topicos of a disciplina, ordered by name.
// Params: id (disciplina id). Body: none.
// Response 200: Topico[]. 404 NOT_FOUND if the disciplina is missing.

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const disciplina = await disciplinaRepository.getById(id);
  if (disciplina === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Disciplina not found.',
      details: { id },
    });
  }
  const topicos = await topicoRepository.list(id);
  return NextResponse.json(topicos);
}

// ── POST /api/disciplinas/:id/topicos ────────────────────────────────────────
// Creates a topico under a disciplina.
// Params: id (disciplina id). Body: { nome: string } (required, non-empty).
// Response 201: the created Topico. 404 NOT_FOUND if the disciplina is missing;
// 400 VALIDATION_ERROR on a bad body.

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const disciplina = await disciplinaRepository.getById(id);
  if (disciplina === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Disciplina not found.',
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
  const body = (raw ?? {}) as { nome?: unknown };
  if (typeof body.nome !== 'string' || body.nome.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome is required and must be a non-empty string.',
    });
  }

  try {
    const topico = await topicoRepository.create({ nome: body.nome, disciplinaId: id });
    return NextResponse.json(topico, { status: 201 });
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Disciplina not found.',
        details: { id },
      });
    }
    throw err;
  }
}
