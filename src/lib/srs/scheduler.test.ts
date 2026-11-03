import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { dueRules, weightedSample } from './scheduler';

describe('dueRules', () => {
  let usuarioId: string;
  const NOW = new Date('2026-06-01T12:00:00.000Z');

  async function makeRegra(probabilidade: number | null, pergunta: string) {
    const area = await prisma.area.create({ data: { nome: `A-${pergunta}` } });
    const disc = await prisma.disciplina.create({
      data: { nome: `D-${pergunta}`, areaId: area.id },
    });
    const topico = await prisma.topico.create({
      data: { nome: `T-${pergunta}`, disciplinaId: disc.id },
    });
    return prisma.regra.create({
      data: {
        topicoId: topico.id,
        pergunta,
        respostaCerta: 'r',
        distratores: ['a', 'b', 'c'],
        probabilidade,
      },
    });
  }

  async function makeProgress(regraId: string, proximaRevisao: Date) {
    return prisma.progressoUsuario.create({
      data: { usuarioId, regraId, proximaRevisao },
    });
  }

  beforeEach(async () => {
    await prisma.progressoUsuario.deleteMany();
    await prisma.regraNoCaderno.deleteMany();
    await prisma.caderno.deleteMany();
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    await prisma.usuario.deleteMany();
    const usuario = await prisma.usuario.create({ data: { nome: 'Scheduler Tester' } });
    usuarioId = usuario.id;
  });

  it('returns overdue rules before future-due rules', async () => {
    const overdueRegra = await makeRegra(0.5, 'overdue');
    const futureRegra = await makeRegra(0.5, 'future');
    await makeProgress(overdueRegra.id, new Date(NOW.getTime() - 1000)); // 1s ago → overdue
    await makeProgress(futureRegra.id, new Date(NOW.getTime() + 1000)); // 1s ahead → future

    const due = await dueRules(usuarioId, { now: NOW, limit: 10 });
    expect(due).toHaveLength(2);
    expect(due[0]?.regra.pergunta).toBe('overdue');
    expect(due[1]?.regra.pergunta).toBe('future');
  });

  it('always includes overdue rules even when future rules exist (limit respected)', async () => {
    const overdueRegra = await makeRegra(0.5, 'overdue');
    const futureRegra = await makeRegra(0.5, 'future');
    await makeProgress(overdueRegra.id, new Date(NOW.getTime() - 1000));
    await makeProgress(futureRegra.id, new Date(NOW.getTime() + 1000));

    const due = await dueRules(usuarioId, { now: NOW, limit: 1 });
    expect(due).toHaveLength(1);
    expect(due[0]?.regra.pergunta).toBe('overdue');
  });

  it('scopes to a caderno: rules outside the notebook never appear', async () => {
    const inCadernoRegra = await makeRegra(0.5, 'in-caderno');
    const outCadernoRegra = await makeRegra(0.5, 'out-caderno');
    await makeProgress(inCadernoRegra.id, new Date(NOW.getTime() - 1000));
    await makeProgress(outCadernoRegra.id, new Date(NOW.getTime() - 1000));

    const caderno = await prisma.caderno.create({ data: { usuarioId, nome: 'C' } });
    await prisma.regraNoCaderno.create({
      data: { cadernoId: caderno.id, regraId: inCadernoRegra.id },
    });

    const due = await dueRules(usuarioId, { now: NOW, cadernoId: caderno.id, limit: 10 });
    expect(due).toHaveLength(1);
    expect(due[0]?.regra.pergunta).toBe('in-caderno');
  });

  it('treats null probabilidade as weight 1.0 (AD-11)', async () => {
    // Two overdue rules: one with probabilidade 1.0, one with null (→ weight 1.0).
    // Equal weights → each selected ~50% of the time over many draws.
    const weighted = await makeRegra(1.0, 'weighted');
    const nullProb = await makeRegra(null, 'null-prob');
    await makeProgress(weighted.id, new Date(NOW.getTime() - 1000));
    await makeProgress(nullProb.id, new Date(NOW.getTime() - 1000));

    let weightedCount = 0;
    let nullCount = 0;
    // 1000 draws × 2 queries each stays well under the 5s timeout; the ±0.08
    // tolerance is still ~5 standard errors at p=0.5, so the assertion is safe.
    const draws = 1000;
    for (let i = 0; i < draws; i++) {
      const due = await dueRules(usuarioId, { now: NOW, limit: 1 });
      if (due[0]?.regra.pergunta === 'weighted') weightedCount++;
      else nullCount++;
    }
    // Equal weights → frequencies near 0.5 each (tolerance ±0.08).
    expect(weightedCount / draws).toBeGreaterThan(0.42);
    expect(weightedCount / draws).toBeLessThan(0.58);
    expect(nullCount / draws).toBeGreaterThan(0.42);
    expect(nullCount / draws).toBeLessThan(0.58);
  });

  it('uses UTC instants for overdue/future classification (no local-timezone drift)', async () => {
    // A rule due exactly at NOW is overdue (<=). One 1ms after NOW is future.
    const dueAtNow = await makeRegra(0.5, 'due-at-now');
    const justAfter = await makeRegra(0.5, 'just-after');
    await makeProgress(dueAtNow.id, NOW);
    await makeProgress(justAfter.id, new Date(NOW.getTime() + 1));

    const due = await dueRules(usuarioId, { now: NOW, limit: 10 });
    const perguntas = due.map((d) => d.regra.pergunta);
    expect(perguntas).toContain('due-at-now');
    expect(perguntas[0]).toBe('due-at-now'); // overdue first
  });

  it('includes never-studied rules (no progress row) as due-now', async () => {
    // A regra with no ProgressoUsuario row must be returned (due immediately),
    // so a brand-new user gets a playable session from seeded data.
    await makeRegra(0.5, 'never-studied');
    const overdue = await makeRegra(0.5, 'overdue');
    await makeProgress(overdue.id, new Date(NOW.getTime() - 1000));

    const due = await dueRules(usuarioId, { now: NOW, limit: 10 });
    const perguntas = due.map((d) => d.regra.pergunta);
    expect(perguntas).toContain('never-studied');
    expect(perguntas).toContain('overdue');
    // The never-studied rule carries a null progresso.
    const never = due.find((d) => d.regra.pergunta === 'never-studied');
    expect(never?.progresso).toBeNull();
    // The overdue rule carries its progress.
    const over = due.find((d) => d.regra.pergunta === 'overdue');
    expect(over?.progresso).not.toBeNull();
  });

  it('returns every seeded regra for a user with no progress (playable from empty)', async () => {
    // No progress rows at all — every regra is due-now.
    await makeRegra(0.5, 'a');
    await makeRegra(0.6, 'b');
    await makeRegra(0.7, 'c');

    const due = await dueRules(usuarioId, { now: NOW, limit: 20 });
    expect(due).toHaveLength(3);
    for (const d of due) {
      expect(d.progresso).toBeNull();
    }
  });
});

describe('weightedSample (statistical, AD-11)', () => {
  it('selection frequency approximates the probabilidade distribution over many draws', () => {
    // Three overdue rules with probabilidade 0.5 / 0.3 / 0.2 (total 1.0).
    // Over 10,000 single-draw selections, frequencies must approximate 0.5/0.3/0.2.
    const rules = [
      { id: 'r1', probabilidade: 0.5 },
      { id: 'r2', probabilidade: 0.3 },
      { id: 'r3', probabilidade: 0.2 },
    ];
    let r1 = 0;
    let r2 = 0;
    let r3 = 0;
    const draws = 10000;
    for (let i = 0; i < draws; i++) {
      const picked = weightedSample(rules, (r) => r.probabilidade, 1)[0];
      if (picked?.id === 'r1') r1++;
      else if (picked?.id === 'r2') r2++;
      else r3++;
    }
    expect(r1 / draws).toBeGreaterThan(0.45);
    expect(r1 / draws).toBeLessThan(0.55);
    expect(r2 / draws).toBeGreaterThan(0.25);
    expect(r2 / draws).toBeLessThan(0.35);
    expect(r3 / draws).toBeGreaterThan(0.15);
    expect(r3 / draws).toBeLessThan(0.25);
  });

  it('never returns more items than requested or available', () => {
    const items = [{ w: 1 }, { w: 1 }, { w: 1 }];
    expect(weightedSample(items, (i) => i.w, 5)).toHaveLength(3); // capped at pool size
    expect(weightedSample(items, (i) => i.w, 2)).toHaveLength(2);
    expect(weightedSample([], () => 1, 3)).toHaveLength(0);
  });
});
