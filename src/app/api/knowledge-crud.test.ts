import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as areasRoute from './areas/route';
import * as areaDetail from './areas/[id]/route';
import * as disciplinasRoute from './areas/[id]/disciplinas/route';
import * as disciplinaDetail from './disciplinas/[id]/route';
import * as topicosRoute from './disciplinas/[id]/topicos/route';
import * as topicoDetail from './topicos/[id]/route';
import * as regrasRoute from './topicos/[id]/regras/route';
import * as regraDetail from './regras/[id]/route';

// Contract tests for the knowledge CRUD routes (issue #23). Drives the real
// route handlers against the ephemeral Postgres.

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

interface Envelope {
  error: { code: string; message: string };
}

describe('knowledge CRUD (areas → disciplinas → topicos → regras)', () => {
  let areaId: string;
  let disciplinaId: string;
  let topicoId: string;
  let regraId: string;

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
  });

  it('full round-trip: create, read, list, update, delete at every level', async () => {
    // Area.
    const createArea = await areasRoute.POST(req('POST', { nome: 'Direito Constitucional' }));
    expect(createArea.status).toBe(201);
    const area = (await createArea.json()) as { id: string; nome: string };
    areaId = area.id;
    expect(area.nome).toBe('Direito Constitucional');

    const getArea = await areaDetail.GET(req('GET'), params(areaId));
    expect(getArea.status).toBe(200);
    expect(((await getArea.json()) as { nome: string }).nome).toBe('Direito Constitucional');

    const listAreas = await areasRoute.GET();
    expect(listAreas.status).toBe(200);
    expect(((await listAreas.json()) as { id: string }[]).map((a) => a.id)).toContain(areaId);

    const patchArea = await areaDetail.PATCH(
      req('PATCH', { nome: 'Dir. Constitucional' }),
      params(areaId),
    );
    expect(patchArea.status).toBe(200);
    expect(((await patchArea.json()) as { nome: string }).nome).toBe('Dir. Constitucional');

    // Disciplina.
    const createDisc = await disciplinasRoute.POST(
      req('POST', { nome: 'Direitos Fundamentais', iconeUrl: 'scale', corHex: '#3B82F6' }),
      params(areaId),
    );
    expect(createDisc.status).toBe(201);
    const disc = (await createDisc.json()) as { id: string; nome: string };
    disciplinaId = disc.id;

    const listDisc = await disciplinasRoute.GET(req('GET'), params(areaId));
    expect(listDisc.status).toBe(200);
    expect(((await listDisc.json()) as { id: string }[]).map((d) => d.id)).toContain(disciplinaId);

    const getDisc = await disciplinaDetail.GET(req('GET'), params(disciplinaId));
    expect(getDisc.status).toBe(200);

    const patchDisc = await disciplinaDetail.PATCH(
      req('PATCH', { corHex: '#000000' }),
      params(disciplinaId),
    );
    expect(patchDisc.status).toBe(200);
    expect(((await patchDisc.json()) as { corHex: string | null }).corHex).toBe('#000000');

    // Topico.
    const createTop = await topicosRoute.POST(
      req('POST', { nome: 'Princípios' }),
      params(disciplinaId),
    );
    expect(createTop.status).toBe(201);
    const top = (await createTop.json()) as { id: string; nome: string };
    topicoId = top.id;

    const listTop = await topicosRoute.GET(req('GET'), params(disciplinaId));
    expect(listTop.status).toBe(200);
    expect(((await listTop.json()) as { id: string }[]).map((t) => t.id)).toContain(topicoId);

    const getTop = await topicoDetail.GET(req('GET'), params(topicoId));
    expect(getTop.status).toBe(200);

    const patchTop = await topicoDetail.PATCH(
      req('PATCH', { nome: 'Princípios Básicos' }),
      params(topicoId),
    );
    expect(patchTop.status).toBe(200);
    expect(((await patchTop.json()) as { nome: string }).nome).toBe('Princípios Básicos');

    // Regra.
    const createRegra = await regrasRoute.POST(
      req('POST', {
        pergunta: 'Qual é o fundamento?',
        respostaCerta: 'Soberania',
        justificativa: 'Art. 1º.',
        dica: 'Lembre-se.',
        distratores: ['x', 'y', 'z'],
        nivelDificuldade: 2,
        probabilidade: 0.8,
      }),
      params(topicoId),
    );
    expect(createRegra.status).toBe(201);
    const regra = (await createRegra.json()) as { id: string; pergunta: string };
    regraId = regra.id;

    const listRegras = await regrasRoute.GET(req('GET'), params(topicoId));
    expect(listRegras.status).toBe(200);
    expect(((await listRegras.json()) as { id: string }[]).map((r) => r.id)).toContain(regraId);

    const getRegra = await regraDetail.GET(req('GET'), params(regraId));
    expect(getRegra.status).toBe(200);

    const patchRegra = await regraDetail.PATCH(
      req('PATCH', { probabilidade: 0.5, nivelDificuldade: 3 }),
      params(regraId),
    );
    expect(patchRegra.status).toBe(200);
    const patched = (await patchRegra.json()) as {
      probabilidade: number | null;
      nivelDificuldade: number;
    };
    expect(patched.probabilidade).toBe(0.5);
    expect(patched.nivelDificuldade).toBe(3);

    // Delete leaf-to-root.
    expect((await regraDetail.DELETE(req('DELETE'), params(regraId))).status).toBe(200);
    expect((await topicoDetail.DELETE(req('DELETE'), params(topicoId))).status).toBe(200);
    expect((await disciplinaDetail.DELETE(req('DELETE'), params(disciplinaId))).status).toBe(200);
    expect((await areaDetail.DELETE(req('DELETE'), params(areaId))).status).toBe(200);
  });

  it('rejects an area create without nome (400 VALIDATION_ERROR)', async () => {
    const res = await areasRoute.POST(req('POST', {}));
    expect(res.status).toBe(400);
    expect(((await res.json()) as Envelope).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a regra with nivelDificuldade out of 1..5 (400)', async () => {
    const area = (await (await areasRoute.POST(req('POST', { nome: 'A' }))).json()) as {
      id: string;
    };
    const disc = (await (
      await disciplinasRoute.POST(req('POST', { nome: 'D' }), params(area.id))
    ).json()) as { id: string };
    const top = (await (
      await topicosRoute.POST(req('POST', { nome: 'T' }), params(disc.id))
    ).json()) as {
      id: string;
    };
    const res = await regrasRoute.POST(
      req('POST', {
        pergunta: 'Q',
        respostaCerta: 'R',
        distratores: ['a', 'b', 'c'],
        nivelDificuldade: 6,
      }),
      params(top.id),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as Envelope).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a regra with probabilidade out of 0.0..1.0 (400)', async () => {
    const area = (await (await areasRoute.POST(req('POST', { nome: 'A' }))).json()) as {
      id: string;
    };
    const disc = (await (
      await disciplinasRoute.POST(req('POST', { nome: 'D' }), params(area.id))
    ).json()) as { id: string };
    const top = (await (
      await topicosRoute.POST(req('POST', { nome: 'T' }), params(disc.id))
    ).json()) as {
      id: string;
    };
    const res = await regrasRoute.POST(
      req('POST', {
        pergunta: 'Q',
        respostaCerta: 'R',
        distratores: ['a', 'b', 'c'],
        probabilidade: 1.5,
      }),
      params(top.id),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as Envelope).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a regra with a non-array distratores (400)', async () => {
    const area = (await (await areasRoute.POST(req('POST', { nome: 'A' }))).json()) as {
      id: string;
    };
    const disc = (await (
      await disciplinasRoute.POST(req('POST', { nome: 'D' }), params(area.id))
    ).json()) as { id: string };
    const top = (await (
      await topicosRoute.POST(req('POST', { nome: 'T' }), params(disc.id))
    ).json()) as {
      id: string;
    };
    const res = await regrasRoute.POST(
      req('POST', { pergunta: 'Q', respostaCerta: 'R', distratores: 'not-an-array' }),
      params(top.id),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as Envelope).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for a missing area', async () => {
    const res = await areaDetail.GET(req('GET'), params('no-such-area'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as Envelope).error.code).toBe('NOT_FOUND');
  });

  it('returns 409 CONFLICT when deleting an area that still has disciplinas', async () => {
    const area = (await (await areasRoute.POST(req('POST', { nome: 'A' }))).json()) as {
      id: string;
    };
    await disciplinasRoute.POST(req('POST', { nome: 'D' }), params(area.id));
    const res = await areaDetail.DELETE(req('DELETE'), params(area.id));
    expect(res.status).toBe(409);
    expect(((await res.json()) as Envelope).error.code).toBe('CONFLICT');
  });

  it('returns 404 NOT_FOUND when creating a disciplina under a missing area', async () => {
    const res = await disciplinasRoute.POST(req('POST', { nome: 'D' }), params('no-such-area'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as Envelope).error.code).toBe('NOT_FOUND');
  });
});
