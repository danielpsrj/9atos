import { NextRequest, NextResponse } from 'next/server';
import { areaRepository } from '@/lib/repositories';
import { errorResponse, ErrorCode, isPrismaNotFound, isPrismaForeignKey } from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── GET /api/areas/:id ───────────────────────────────────────────────────────
// Fetches a single area by id.
// Params: id (string). Body: none.
// Response 200: the Area. 404 NOT_FOUND if missing.

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
  return NextResponse.json(area);
}

// ── PATCH /api/areas/:id ─────────────────────────────────────────────────────
// Updates an area's name.
// Params: id. Body: { nome: string } (required, non-empty).
// Response 200: the updated Area. 404 NOT_FOUND if missing; 400 on a bad body.

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
  const body = (raw ?? {}) as { nome?: unknown };
  if (typeof body.nome !== 'string' || body.nome.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'nome is required and must be a non-empty string.',
    });
  }
  try {
    const area = await areaRepository.update(id, { nome: body.nome });
    return NextResponse.json(area);
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

// ── DELETE /api/areas/:id ────────────────────────────────────────────────────
// Deletes an area. By default the schema restricts deletion while disciplinas
// exist (409 CONFLICT). With ?cascade=true the area and its entire subtree
// (disciplinas, topicos, regras) plus the study progress of those regras are
// deleted in one transaction (issue #63 — "delete a parent including children").
// Params: id. Query: cascade (optional, "true"). Body: none.
// Response 200: the deleted Area. 404 NOT_FOUND if missing; 409 CONFLICT if it
// still has disciplinas and cascade was not requested.

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cascade = req.nextUrl.searchParams.get('cascade') === 'true';
  try {
    const area = cascade ? await areaRepository.deleteCascade(id) : await areaRepository.delete(id);
    return NextResponse.json(area);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Area not found.',
        details: { id },
      });
    }
    if (isPrismaForeignKey(err)) {
      return errorResponse(409, {
        code: ErrorCode.CONFLICT,
        message: 'Cannot delete: the area still has disciplinas.',
        details: { id },
      });
    }
    throw err;
  }
}
