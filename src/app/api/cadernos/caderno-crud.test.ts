import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as cadernosRoute from './route';
import * as cadernoDetail from './[id]/route';
import * as cadernoRegras from './[id]/regras/route';

// Contract tests for the notebook (Caderno) CRUD routes (issue #24). Drives the
// real route handlers against the ephemeral Postgres.

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

describe('notebook (Caderno) CRUD', () => {
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

    await prisma.usuario.create({ data: { nome: 'Caderno Tester' } });
    regra1 = await makeRegra('1');
    regra2 = await makeRegra('2');
  });

  it('create → list → rename → add rules → remove rules → delete, end-to-end', async () => {
    // Create.
    const created = await cadernosRoute.POST(
      req('POST', { nome: 'Constitucional', descricao: 'CF/88' }),
    );
    expect(created.status).toBe(201);
    const caderno = (await created.json()) as {
      id: string;
      nome: string;
      descricao: string | null;
    };
    expect(caderno.nome).toBe('Constitucional');
    expect(caderno.descricao).toBe('CF/88');

    // List.
    const list = await cadernosRoute.GET();
    expect(list.status).toBe(200);
    expect(((await list.json()) as { id: string }[]).map((c) => c.id)).toContain(caderno.id);

    // Rename.
    const renamed = await cadernoDetail.PATCH(
      req('PATCH', { nome: 'Dir. Constitucional' }),
      params(caderno.id),
    );
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as { nome: string }).nome).toBe('Dir. Constitucional');

    // Add two rules.
    const add1 = await cadernoRegras.POST(req('POST', { regraId: regra1 }), params(caderno.id));
    expect(add1.status).toBe(201);
    const add2 = await cadernoRegras.POST(req('POST', { regraId: regra2 }), params(caderno.id));
    expect(add2.status).toBe(201);

    // The notebook now lists both rules.
    const withRules = await cadernoDetail.GET(req('GET'), params(caderno.id));
    expect(withRules.status).toBe(200);
    const fetched = (await withRules.json()) as { regras: { regraId: string }[] };
    const regraIds = fetched.regras.map((r) => r.regraId);
    expect(regraIds).toContain(regra1);
    expect(regraIds).toContain(regra2);

    // Remove one rule.
    const remove = await cadernoRegras.DELETE(
      req('DELETE', { regraId: regra1 }),
      params(caderno.id),
    );
    expect(remove.status).toBe(200);
    const afterRemove = (await (
      await cadernoDetail.GET(req('GET'), params(caderno.id))
    ).json()) as {
      regras: { regraId: string }[];
    };
    expect(afterRemove.regras.map((r) => r.regraId)).not.toContain(regra1);
    expect(afterRemove.regras.map((r) => r.regraId)).toContain(regra2);

    // Delete the notebook.
    const deleted = await cadernoDetail.DELETE(req('DELETE'), params(caderno.id));
    expect(deleted.status).toBe(200);
    const gone = await cadernoDetail.GET(req('GET'), params(caderno.id));
    expect(gone.status).toBe(404);
  });

  it('deleting a notebook leaves the knowledge base intact (rules survive)', async () => {
    const created = await cadernosRoute.POST(req('POST', { nome: 'Temp' }));
    const caderno = (await created.json()) as { id: string };
    await cadernoRegras.POST(req('POST', { regraId: regra1 }), params(caderno.id));

    await cadernoDetail.DELETE(req('DELETE'), params(caderno.id));

    // The junction row is gone, but the Regra row survives.
    const links = await prisma.regraNoCaderno.count({ where: { cadernoId: caderno.id } });
    expect(links).toBe(0);
    const regra = await prisma.regra.findUnique({ where: { id: regra1 } });
    expect(regra).not.toBeNull();
  });

  it('adding the same rule twice is a no-op (composite key)', async () => {
    const created = await cadernosRoute.POST(req('POST', { nome: 'Noop' }));
    const caderno = (await created.json()) as { id: string };

    const first = await cadernoRegras.POST(req('POST', { regraId: regra1 }), params(caderno.id));
    expect(first.status).toBe(201);
    const second = await cadernoRegras.POST(req('POST', { regraId: regra1 }), params(caderno.id));
    expect(second.status).toBe(200); // no-op, not an error

    // Exactly one junction row.
    const links = await prisma.regraNoCaderno.count({
      where: { cadernoId: caderno.id, regraId: regra1 },
    });
    expect(links).toBe(1);
  });

  it('rejects a create without nome (400 VALIDATION_ERROR)', async () => {
    const res = await cadernosRoute.POST(req('POST', {}));
    expect(res.status).toBe(400);
    expect(((await res.json()) as Envelope).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 NOT_FOUND for a missing notebook', async () => {
    const res = await cadernoDetail.GET(req('GET'), params('no-such-caderno'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as Envelope).error.code).toBe('NOT_FOUND');
  });

  it('returns 404 NOT_FOUND when adding a missing regra', async () => {
    const created = await cadernosRoute.POST(req('POST', { nome: 'X' }));
    const caderno = (await created.json()) as { id: string };
    const res = await cadernoRegras.POST(
      req('POST', { regraId: 'no-such-regra' }),
      params(caderno.id),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as Envelope).error.code).toBe('NOT_FOUND');
  });

  it('returns 404 NOT_FOUND when removing a rule not in the notebook', async () => {
    const created = await cadernosRoute.POST(req('POST', { nome: 'Y' }));
    const caderno = (await created.json()) as { id: string };
    const res = await cadernoRegras.DELETE(req('DELETE', { regraId: regra1 }), params(caderno.id));
    expect(res.status).toBe(404);
    expect(((await res.json()) as Envelope).error.code).toBe('NOT_FOUND');
  });
});
