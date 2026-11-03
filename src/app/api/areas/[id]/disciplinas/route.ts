import { NextRequest, NextResponse } from 'next/server';
import { areaRepository, disciplinaRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/areas/:id/disciplinas ───────────────────────────────────────────
// Lists the disciplinas of an area, ordered by name.
// Params: id (area id). Body: none.
// Response 200: Disciplina[]. 404 NOT_FOUND if the area is missing.

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const area = await areaRepository.getById(id);
  if (area === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Area not found.',
      details: { id },
    });
  }
  const disciplinas = await disciplinaRepository.list(id);
  return NextResponse.json(disciplinas);
}

// ── POST /api/areas/:id/disciplinas ──────────────────────────────────────────
// Creates a disciplina under an area.
// Params: id (area id). Body: { nome: string, iconeUrl?: string, corHex?: string }.
// Response 201: the created Disciplina. 404 NOT_FOUND if the area is missing;
// 400 VALIDATION_ERROR on a bad body.

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const area = await areaRepository.getById(id);
  if (area === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Area not found.',
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
  const body = (raw ?? {}) as { nome?: unknown; iconeUrl?: unknown; corHex?: unknown };
  if (typeof body.nome !== 'string' || body.nome.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome is required and must be a non-empty string.',
    });
  }
  const iconeUrl = body.iconeUrl === undefined ? null : body.iconeUrl;
  const corHex = body.corHex === undefined ? null : body.corHex;
  if (iconeUrl !== null && typeof iconeUrl !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'iconeUrl must be a string.',
    });
  }
  if (corHex !== null && typeof corHex !== 'string') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'corHex must be a string.',
    });
  }

  try {
    const disciplina = await disciplinaRepository.create({
      nome: body.nome,
      iconeUrl,
      corHex,
      areaId: id,
    });
    return NextResponse.json(disciplina, { status: 201 });
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Area not found.',
        details: { id },
      });
    }
    throw err;
  }
}
