import { NextRequest, NextResponse } from 'next/server';
import { disciplinaRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound, isPrismaForeignKey } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/disciplinas/:id ─────────────────────────────────────────────────
// Fetches a single disciplina by id.
// Params: id. Body: none.
// Response 200: the Disciplina. 404 NOT_FOUND if missing.

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
  return NextResponse.json(disciplina);
}

// ── PATCH /api/disciplinas/:id ───────────────────────────────────────────────
// Partially updates a disciplina. Any omitted field keeps its current value.
// Params: id. Body: { nome?, iconeUrl?, corHex?, areaId? }.
// Response 200: the updated Disciplina. 404 NOT_FOUND if missing; 400 on a bad
// field type.

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await disciplinaRepository.getById(id);
  if (existing === null) {
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
  const body = (raw ?? {}) as {
    nome?: unknown;
    iconeUrl?: unknown;
    corHex?: unknown;
    areaId?: unknown;
  };

  if (body.nome !== undefined && (typeof body.nome !== 'string' || body.nome.length === 0)) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome must be a non-empty string.',
    });
  }
  if (body.iconeUrl !== undefined && body.iconeUrl !== null && typeof body.iconeUrl !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'iconeUrl must be a string or null.',
    });
  }
  if (body.corHex !== undefined && body.corHex !== null && typeof body.corHex !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'corHex must be a string or null.',
    });
  }
  if (body.areaId !== undefined && typeof body.areaId !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'areaId must be a string.',
    });
  }

  try {
    const updated = await disciplinaRepository.update(id, {
      nome: body.nome ?? existing.nome,
      iconeUrl: body.iconeUrl === undefined ? existing.iconeUrl : body.iconeUrl,
      corHex: body.corHex === undefined ? existing.corHex : body.corHex,
      areaId: body.areaId ?? existing.areaId,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (isPrismaForeignKey(err)) {
      return errorResponse(400, {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'areaId does not reference an existing area.',
        details: { areaId: body.areaId },
      });
    }
    throw err;
  }
}

// ── DELETE /api/disciplinas/:id ──────────────────────────────────────────────
// Deletes a disciplina. By default the schema restricts deletion while topicos
// exist (409 CONFLICT). With ?cascade=true the disciplina and its subtree
// (topicos, regras) plus the study progress of those regras are deleted in one
// transaction (issue #63). Params: id. Query: cascade (optional, "true").
// Body: none. Response 200: the deleted Disciplina. 404 NOT_FOUND if missing;
// 409 CONFLICT if it still has topicos and cascade was not requested.

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cascade = req.nextUrl.searchParams.get('cascade') === 'true';
  try {
    const disciplina = cascade
      ? await disciplinaRepository.deleteCascade(id)
      : await disciplinaRepository.delete(id);
    return NextResponse.json(disciplina);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Disciplina not found.',
        details: { id },
      });
    }
    if (isPrismaForeignKey(err)) {
      return errorResponse(409, {
        code: ErrorCode.CONFLICT,
        message: 'Cannot delete: the disciplina still has topicos.',
        details: { id },
      });
    }
    throw err;
  }
}
