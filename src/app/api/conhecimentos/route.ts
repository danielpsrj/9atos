import { NextRequest, NextResponse } from 'next/server';
import { conhecimentoRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// ── GET /api/conhecimentos ────────────────────────────────────────────────────
// Lists all unities of knowledge (issue #62), newest first, each with its rule
// count. Params: none. Body: none. Response 200: ConhecimentoWithCount[].

export async function GET() {
  const conhecimentos = await conhecimentoRepository.list();
  return NextResponse.json(conhecimentos);
}

// ── POST /api/conhecimentos ───────────────────────────────────────────────────
// Creates a unity of knowledge. Body: { nome: string (required), descricao?:
// string }. Response 201: the created Conhecimento. 400 VALIDATION_ERROR on a
// bad body.

export async function POST(req: NextRequest) {
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
  if (typeof body.nome !== 'string' || body.nome.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome is required and must be a non-empty string.',
    });
  }
  const descricao =
    body.descricao === undefined || body.descricao === null
      ? null
      : typeof body.descricao === 'string'
        ? body.descricao
        : null;
  const conhecimento = await conhecimentoRepository.create({ nome: body.nome, descricao });
  return NextResponse.json(conhecimento, { status: 201 });
}
