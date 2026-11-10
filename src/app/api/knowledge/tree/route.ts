import { NextResponse } from 'next/server';
import { areaRepository } from '@/lib/repositories';

// ── GET /api/knowledge/tree ──────────────────────────────────────────────────
// Returns the full knowledge hierarchy (Area → Disciplina → Topico → Regra) in
// a single nested query, ordered by name at every level. The tree browser
// (issue #46) renders this directly — no N+1 fan-out.
// Params: none. Body: none.
// Response 200: KnowledgeTree[].

export async function GET() {
  const tree = await areaRepository.fullTree();
  return NextResponse.json(tree);
}
