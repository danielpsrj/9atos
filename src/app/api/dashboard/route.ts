import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildDashboard } from '@/lib/dashboard';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// ── GET /api/dashboard ───────────────────────────────────────────────────────
// Single round-trip payload for the whole dashboard (FR-10, FR-11, FR-12):
// current + best streak, today's goal progress (America/Sao_Paulo day), and a
// progress-ring percentage per notebook. No client-side fan-out.
// Params: none. Body: none.
// Response 200: { ofensivaAtual, maiorOfensiva, metaDiaria, revisadasHoje,
//   cadernos: [{ id, nome, areaTag, ringPercentage }] }.
// 500 INTERNAL_ERROR if no user is provisioned.

export async function GET() {
  // V1 is single-user with no auth (AD-01): resolve the one bootstrap user.
  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
    });
  }
  const payload = await buildDashboard(usuario.id);
  return NextResponse.json(payload);
}
