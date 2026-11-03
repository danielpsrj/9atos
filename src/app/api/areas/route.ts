import { NextRequest, NextResponse } from 'next/server';
import { areaRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// ── GET /api/areas ───────────────────────────────────────────────────────────
// Lists all knowledge areas, ordered by name.
// Params: none. Body: none.
// Response 200: Area[].

export async function GET() {
  const areas = await areaRepository.list();
  return NextResponse.json(areas);
}

// ── POST /api/areas ──────────────────────────────────────────────────────────
// Creates a knowledge area.
// Body: { nome: string } (required, non-empty).
// Response 201: the created Area. 400 VALIDATION_ERROR on a bad body.

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
  const body = (raw ?? {}) as { nome?: unknown };
  if (typeof body.nome !== 'string' || body.nome.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome is required and must be a non-empty string.',
    });
  }
  const area = await areaRepository.create({ nome: body.nome });
  return NextResponse.json(area, { status: 201 });
}
