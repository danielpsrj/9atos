import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import * as fromSeed from './route';

// Contract tests for the "use the sample data" route (issue #35, FR-14),
// covering the #75 (idempotent path re-links an empty notebook) and #76 (the
// sample notebook contains exactly the seeded Knowledge's regras, never the
// user's own imported regras) fixes. Drives the real route handler against the
// ephemeral Postgres.

const SAMPLE_NAME = 'Constituição Federal — Direitos Fundamentais';

describe('POST /api/cadernos/from-seed', () => {
  let seededKnowledgeId: string;
  let seededRegraIds: string[];
  let nonSeededRegraId: string;

  async function makeRegra(knowledgeId: string | null, label: string): Promise<string> {
    const area = await prisma.area.create({ data: { nome: `A-${label}` } });
    const disc = await prisma.disciplina.create({
      data: { nome: `D-${label}`, areaId: area.id },
    });
    const topico = await prisma.topico.create({
      data: { nome: `T-${label}`, disciplinaId: disc.id },
    });
    const regra = await prisma.regra.create({
      data: {
        topicoId: topico.id,
        pergunta: `P-${label}`,
        respostaCerta: 'r',
        distratores: ['a', 'b', 'c'],
        ...(knowledgeId !== null ? { conhecimentoId: knowledgeId } : {}),
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
    await prisma.conhecimento.deleteMany();
    await prisma.configuracaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();

    await prisma.usuario.create({ data: { nome: 'From-Seed Tester' } });

    // The seeded Knowledge is the oldest (explicit past criadaEm) so the
    // route's findFirst({ orderBy: { criadaEm: 'asc' } }) picks it.
    seededKnowledgeId = (
      await prisma.conhecimento.create({
        data: {
          nome: 'Constituição Federal — Direitos Fundamentais',
          criadaEm: new Date('2020-01-01T00:00:00.000Z'),
        },
      })
    ).id;
    seededRegraIds = [await makeRegra(seededKnowledgeId, 's1'), await makeRegra(seededKnowledgeId, 's2')];

    // A non-seeded regra (no knowledge) — the user's own imported content.
    nonSeededRegraId = await makeRegra(null, 'imported');
  });

  it('creates the sample notebook linked to the seeded Knowledge and its regras (201)', async () => {
    const res = await fromSeed.POST();
    expect(res.status).toBe(201);
    const caderno = (await res.json()) as { id: string; nome: string; conhecimentoId: string | null };
    expect(caderno.nome).toBe(SAMPLE_NAME);
    expect(caderno.conhecimentoId).toBe(seededKnowledgeId);

    // The notebook contains exactly the two seeded regras.
    const links = await prisma.regraNoCaderno.findMany({ where: { cadernoId: caderno.id } });
    expect(links.map((l) => l.regraId).sort()).toEqual([...seededRegraIds].sort());
  });

  it('links ONLY the seeded Knowledge\'s regras, not the user\'s imported regras (#76)', async () => {
    const res = await fromSeed.POST();
    expect(res.status).toBe(201);
    const caderno = (await res.json()) as { id: string };

    const linkedIds = (
      await prisma.regraNoCaderno.findMany({ where: { cadernoId: caderno.id } })
    ).map((l) => l.regraId);

    // Both seeded regras are present…
    expect(linkedIds).toContain(seededRegraIds[0]);
    expect(linkedIds).toContain(seededRegraIds[1]);
    // …and the non-seeded (imported) regra is NOT swept in.
    expect(linkedIds).not.toContain(nonSeededRegraId);
    expect(linkedIds).toHaveLength(2);
  });

  it('is idempotent: a second call returns the existing notebook (200), no duplicate', async () => {
    const first = await fromSeed.POST();
    expect(first.status).toBe(201);
    const second = await fromSeed.POST();
    expect(second.status).toBe(200);

    const notebooks = await prisma.caderno.findMany({ where: { nome: SAMPLE_NAME } });
    expect(notebooks).toHaveLength(1);
  });

  it('re-links an empty notebook on the idempotent path (#75)', async () => {
    // Create the sample notebook, then drop its junction rows (simulating lost
    // RegraNoCaderno links — the #75 unrecoverable-empty-notebook state).
    const created = await fromSeed.POST();
    expect(created.status).toBe(201);
    const caderno = (await created.json()) as { id: string };
    await prisma.regraNoCaderno.deleteMany({ where: { cadernoId: caderno.id } });
    expect(await prisma.regraNoCaderno.count({ where: { cadernoId: caderno.id } })).toBe(0);

    // from-seed again: the idempotent path re-links the seeded regras.
    const res = await fromSeed.POST();
    expect(res.status).toBe(200);
    const restored = (await res.json()) as { _count: { regras: number } };
    expect(restored._count.regras).toBe(2);

    const linkedIds = (
      await prisma.regraNoCaderno.findMany({ where: { cadernoId: caderno.id } })
    ).map((l) => l.regraId);
    expect(linkedIds.sort()).toEqual([...seededRegraIds].sort());
  });

  it('attaches the missing knowledge link AND re-links an empty notebook in one call (#75)', async () => {
    // A notebook that predates the Knowledge concept: no knowledge link and no
    // regras (the exact state from the #75 reproduction).
    const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
    if (usuario === null) throw new Error('bootstrap user missing');
    const orphan = await prisma.caderno.create({
      data: { usuarioId: usuario.id, nome: SAMPLE_NAME, descricao: 'orphan' },
    });
    expect(orphan.conhecimentoId).toBeNull();

    const res = await fromSeed.POST();
    expect(res.status).toBe(200);
    const restored = (await res.json()) as {
      conhecimentoId: string | null;
      _count: { regras: number };
    };
    expect(restored.conhecimentoId).toBe(seededKnowledgeId);
    expect(restored._count.regras).toBe(2);
  });

  it('does not re-link a notebook that already has regras (no-op)', async () => {
    const created = await fromSeed.POST();
    expect(created.status).toBe(201);
    const caderno = (await created.json()) as { id: string };

    // The notebook already has its regras; a second call must not touch them.
    const res = await fromSeed.POST();
    expect(res.status).toBe(200);
    const links = await prisma.regraNoCaderno.findMany({ where: { cadernoId: caderno.id } });
    expect(links).toHaveLength(2);
  });
});
