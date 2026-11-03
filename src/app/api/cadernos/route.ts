import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cadernoRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// V1 is single-user with no auth (AD-01): resolve the one bootstrap user.
async function resolveUser() {
  return prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
}

// ── GET /api/cadernos ────────────────────────────────────────────────────────
// Lists the user's notebooks, ordered by name.
// Params: none. Body: none.
// Response 200: Caderno[]. 500 INTERNAL_ERROR if no user is provisioned.

export async function GET() {
  const usuario = await resolveUser();
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
    });
  }
  const cadernos = await cadernoRepository.list(usuario.id);
  return NextResponse.json(cadernos);
}

// ── POST /api/cadernos ───────────────────────────────────────────────────────
// Creates a notebook for the user.
// Body: { nome: string (required, non-empty), descricao?: string|null }.
// Response 201: the created Caderno. 400 VALIDATION_ERROR on a bad body.

export async function POST(req: NextRequest) {
  const usuario = await resolveUser();
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
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
  if (typeof body.nome !== 'string' || body.nome.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome is required and must be a non-empty string.',
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

  const caderno = await cadernoRepository.create({
    usuarioId: usuario.id,
    nome: body.nome,
    descricao: body.descricao === undefined ? null : body.descricao,
  });
  return NextResponse.json(caderno, { status: 201 });
}
