import { NextResponse } from 'next/server';
import { topicoRepository } from '@/lib/repositories';

// ── GET /api/topicos ─────────────────────────────────────────────────────────
// Lists every topico with its disciplina and area names (for the import
// screen's target selector, issue #45). Ordered by area, disciplina, then
// topico name.
// Body: none. Response 200: { id, nome, disciplina, area }[].

export async function GET() {
  const topicos = await topicoRepository.listWithHierarchy();
  return NextResponse.json(topicos);
}
