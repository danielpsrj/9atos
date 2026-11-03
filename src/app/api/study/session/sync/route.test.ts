import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from './route';

// Contract tests for POST /api/study/session/sync (spec §6, issue #22).
// Drives the real route handler against the ephemeral Postgres.

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/study/session/sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

interface SyncResponse {
  regraId: string;
  proximaRevisao: string;
}

describe('POST /api/study/session/sync', () => {
  let usuarioId: string;
  let regra1: string;
  let regra2: string;

  async function makeRegra(label: string): Promise<string> {
    const area = await prisma.area.create({ data: { nome: `A-${label}` } });
    const disc = await prisma.disciplina.create({ data: { nome: `D-${label}`, areaId: area.id } });
    const topico = await prisma.topico.create({
      data: { nome: `T-${label}`, disciplinaId: disc.id },
    });
    const regra = await prisma.regra.create({
      data: {
        topicoId: topico.id,
        pergunta: `P-${label}`,
        respostaCerta: 'r',
        distratores: ['a', 'b', 'c'],
      },
    });
    return regra.id;
  }

  beforeEach(async () => {
    await prisma.sessaoEstudo.deleteMany();
    await prisma.progressoUsuario.deleteMany();
    await prisma.regraNoCaderno.deleteMany();
    await prisma.caderno.deleteMany();
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    await prisma.configuracaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();

    const usuario = await prisma.usuario.create({ data: { nome: 'Sync Route Tester' } });
    usuarioId = usuario.id;
    regra1 = await makeRegra('1');
    regra2 = await makeRegra('2');
  });

  it('returns the updated proximaRevisao for every submitted rule', async () => {
    const res = await POST(
      post({
        usuarioId,
        sessionId: 'sess-1',
        resultados: [
          { regraId: regra1, qualidade: 4 },
          { regraId: regra2, qualidade: 5 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SyncResponse[];
    expect(body).toHaveLength(2);
    const byId = new Map(body.map((r) => [r.regraId, r.proximaRevisao]));
    expect(byId.has(regra1)).toBe(true);
    expect(byId.has(regra2)).toBe(true);
    // Both are valid ISO dates.
    for (const iso of [byId.get(regra1), byId.get(regra2)]) {
      expect(typeof iso).toBe('string');
      if (typeof iso === 'string') {
        expect(Number.isNaN(Date.parse(iso))).toBe(false);
      }
    }
  });

  it('is idempotent: double-posting the same sessionId does not double-apply', async () => {
    const payload = {
      usuarioId,
      sessionId: 'sess-idem',
      resultados: [{ regraId: regra1, qualidade: 4 }],
    };
    const first = (await (await POST(post(payload))).json()) as SyncResponse[];
    const second = (await (await POST(post(payload))).json()) as SyncResponse[];

    // The replay returns the identical proximaRevisao.
    expect(second).toEqual(first);

    // SRS was applied exactly once: reps is 1, historico length 1.
    const progress = await prisma.progressoUsuario.findUniqueOrThrow({
      where: { usuarioId_regraId: { usuarioId, regraId: regra1 } },
    });
    expect(progress.reps).toBe(1);
    expect(progress.historico).toHaveLength(1);
  });

  it('rejects an unknown regraId with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(
      post({
        usuarioId,
        sessionId: 'sess-x',
        resultados: [{ regraId: 'no-such-regra', qualidade: 4 }],
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a qualidade outside {1,3,4,5} with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(
      post({
        usuarioId,
        sessionId: 'sess-y',
        resultados: [{ regraId: regra1, qualidade: 2 }],
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing sessionId with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(
      post({
        usuarioId,
        resultados: [{ regraId: regra1, qualidade: 4 }],
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty resultados array with a 400 VALIDATION_ERROR envelope', async () => {
    const res = await POST(post({ usuarioId, sessionId: 'sess-z', resultados: [] }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for an unknown usuarioId', async () => {
    const res = await POST(
      post({
        usuarioId: 'no-such-user',
        sessionId: 'sess-u',
        resultados: [{ regraId: regra1, qualidade: 4 }],
      }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
