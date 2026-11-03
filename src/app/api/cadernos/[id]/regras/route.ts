import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cadernoRepository } from '@/lib/repositories';
import {
  errorResponse,
  ErrorCode,
  isPrismaNotFound,
  isPrismaUniqueViolation,
} from '@/lib/api/error';

interface Params {
  params: Promise<{ id: string }>;
}

// ── POST /api/cadernos/:id/regras ────────────────────────────────────────────
// Adds a rule to a notebook (many-to-many, FR-03). Adding a rule that is
// already in the notebook is a no-op (composite key cadernoId+regraId).
// Params: id (caderno id). Body: { regraId: string (required, non-empty) }.
// Response 201: the created RegraNoCaderno link. 200: no-op (already present).
// 404 NOT_FOUND if the caderno or regra is missing; 400 on a bad body.

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const caderno = await cadernoRepository.getById(id);
  if (caderno === null) {
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
  const body = (raw ?? {}) as { regraId?: unknown };
  if (typeof body.regraId !== 'string' || body.regraId.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'regraId is required and must be a non-empty string.',
    });
  }

  const regra = await prisma.regra.findUnique({ where: { id: body.regraId } });
  if (regra === null) {
    return errorResponse(404, {
      code: ErrorCode.NOT_FOUND,
      message: 'Regra not found.',
      details: { regraId: body.regraId },
    });
  }

  try {
    const link = await cadernoRepository.addRegra(id, body.regraId);
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    // Already present → no-op (composite key).
    if (isPrismaUniqueViolation(err)) {
      return NextResponse.json({ cadernoId: id, regraId: body.regraId, alreadyPresent: true });
    }
    throw err;
  }
}

// ── DELETE /api/cadernos/:id/regras ──────────────────────────────────────────
// Removes a rule from a notebook. The underlying Regra row survives (only the
// junction row is deleted).
// Params: id (caderno id). Body: { regraId: string (required, non-empty) }.
// Response 200: the removed RegraNoCaderno link. 404 NOT_FOUND if the caderno
// is missing or the rule is not in the notebook; 400 on a bad body.

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const caderno = await cadernoRepository.getById(id);
  if (caderno === null) {
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
  const body = (raw ?? {}) as { regraId?: unknown };
  if (typeof body.regraId !== 'string' || body.regraId.length === 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'regraId is required and must be a non-empty string.',
    });
  }

  try {
    const link = await cadernoRepository.removeRegra(id, body.regraId);
    return NextResponse.json(link);
  } catch (err) {
    if (isPrismaNotFound(err)) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Rule is not in this notebook.',
        details: { regraId: body.regraId },
      });
    }
    throw err;
  }
}
