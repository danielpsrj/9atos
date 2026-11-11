import { NextResponse } from 'next/server';
import { buildNotebookStats } from '@/lib/notebook-stats';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// ── GET /api/cadernos/:id/estatisticas ────────────────────────────────────────
// The per-notebook statistics payload (issue #61): the memory-stage breakdown
// (long-term / recent / not-learned) and the per-game plays (correct/wrong per
// play) + usage. One round-trip, no client fan-out.
// Params: id (the notebook id). Body: none.
// Response 200: NotebookStats. 404 NOT_FOUND if the notebook is missing.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const stats = await buildNotebookStats(id);
    return NextResponse.json(stats);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Caderno not found')) {
      return errorResponse(404, {
        code: ErrorCode.NOT_FOUND,
        message: 'Notebook not found.',
        details: { id },
      });
    }
    throw err;
  }
}
