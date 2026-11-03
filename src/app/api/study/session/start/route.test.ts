import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

// Contract tests for POST /api/study/session/start (spec §6, issue #21).
// Drives the real route handler against the ephemeral Postgres.

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/study/session/start', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/study/session/start', () => {
  let usuarioId: string;
  let cadernoId: string;

  async function makeRegraInCaderno(pergunta: string, probabilidade: number | null) {
    const area = await prisma.area.create({ data: { nome: `A-${pergunta}` } });
    const disc = await prisma.disciplina.create({
      data: { nome: `D-${pergunta}`, areaId: area.id },
    });
    const topico = await prisma.topico.create({
      data: { nome: `T-${pergunta}`, disciplinaId: disc.id },
    });
    const regra = await prisma.regra.create({
      data: {
        topicoId: topico.id,
        pergunta,
        respostaCerta: `resposta-${pergunta}`,
        distratores: ['d1', 'd2', 'd3'],
        probabilidade,
      },
    });
    await prisma.regraNoCaderno.create({ data: { cadernoId: cadernoId, regraId: regra.id } });
    return regra;
  }

  beforeEach(async () => {
    await prisma.progressoUsuario.deleteMany();
    await prisma.regraNoCaderno.deleteMany();
    await prisma.caderno.deleteMany();
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    await prisma.configuracaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();

    const usuario = await prisma.usuario.create({ data: { nome: 'Contract Tester' } });
    usuarioId = usuario.id;
    const caderno = await prisma.caderno.create({ data: { usuarioId, nome: 'Test Notebook' } });
    cadernoId = caderno.id;
  });

  it('returns a playable flashcard session for a notebook with rules', async () => {
    await makeRegraInCaderno('Q1', 0.5);
    await makeRegraInCaderno('Q2', 0.7);

    const res = await POST(post({ cadernoId, gameType: 'flashcards' }));
    expect(res.status).toBe(200);
    const session = (await res.json()) as { type: string; items: unknown[] };
    expect(session.type).toBe('flashcard');
    expect(session.items).toHaveLength(2);
  });

  it('returns a playable session for each of the four game types', async () => {
    // Enough rules for matching (>=4 pairs) and meaningful MC/cloze.
    for (let i = 0; i < 5; i++) {
      const label = String(i);
      await makeRegraInCaderno(`Q-${label}`, 0.5);
    }

    const cases: [string, string][] = [
      ['flashcards', 'flashcard'],
      ['multiple-choice', 'multiple-choice'],
      ['match', 'matching'],
      ['cloze', 'cloze'],
    ];
    for (const [wire, expectedType] of cases) {
      const res = await POST(post({ cadernoId, gameType: wire }));
      expect(res.status, `gameType=${wire}`).toBe(200);
      const session = (await res.json()) as { type: string };
      expect(session.type, `gameType=${wire}`).toBe(expectedType);
    }
  });

  it('respects the limit cap', async () => {
    for (let i = 0; i < 5; i++) {
      const label = String(i);
      await makeRegraInCaderno(`Q-${label}`, 0.5);
    }
    const res = await POST(post({ cadernoId, gameType: 'flashcards', limit: 2 }));
    expect(res.status).toBe(200);
    const session = (await res.json()) as { items: unknown[] };
    expect(session.items).toHaveLength(2);
  });

  it('rejects a missing cadernoId with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(post({ gameType: 'flashcards' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBeTruthy();
  });

  it('rejects an unknown gameType with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(post({ cadernoId, gameType: 'trivia' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-integer limit with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(post({ cadernoId, gameType: 'flashcards', limit: 2.5 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for a notebook that does not exist', async () => {
    const res = await POST(post({ cadernoId: 'no-such-caderno', gameType: 'flashcards' }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a malformed JSON body with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(post('{not json'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
