import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { syncSession } from './sync';

describe('syncSession', () => {
  let usuarioId: string;
  let regra1: string;
  let regra2: string;
  let regra3: string;

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
    const usuario = await prisma.usuario.create({
      data: { nome: 'Sync Tester', ofensivaAtual: 0, maiorOfensiva: 0 },
    });
    usuarioId = usuario.id;
    regra1 = await makeRegra('1');
    regra2 = await makeRegra('2');
    regra3 = await makeRegra('3');
  });

  it('applies a batch of N grades and persists each SRS state', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await syncSession(
      usuarioId,
      'sess-batch',
      [
        { regraId: regra1, qualidade: 4 },
        { regraId: regra2, qualidade: 5 },
        { regraId: regra3, qualidade: 3 },
      ],
      { now },
    );

    const progressos = await prisma.progressoUsuario.findMany({ where: { usuarioId } });
    expect(progressos).toHaveLength(3);
    for (const p of progressos) {
      expect(p.reps).toBe(1); // first success → reps 1
      expect(p.historico).toHaveLength(1);
    }
  });

  it('is idempotent per sessionId: a replay returns the original result without re-applying', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const first = await syncSession(usuarioId, 'sess-idem', [{ regraId: regra1, qualidade: 4 }], {
      now,
    });
    expect(first).toHaveLength(1);
    const originalProxima = first[0]?.proximaRevisao;
    expect(originalProxima).toBeDefined();

    // Replay the same sessionId.
    const replay = await syncSession(usuarioId, 'sess-idem', [{ regraId: regra1, qualidade: 4 }], {
      now,
    });
    expect(replay).toHaveLength(1);
    // The replay returns the ORIGINAL proximaRevisao (not a re-computed one).
    expect(replay[0]?.proximaRevisao).toEqual(originalProxima);

    // The SRS state was NOT re-applied: reps is still 1, historico still length 1.
    const progress = await prisma.progressoUsuario.findUniqueOrThrow({
      where: { usuarioId_regraId: { usuarioId, regraId: regra1 } },
    });
    expect(progress.reps).toBe(1);
    expect(progress.historico).toHaveLength(1);
  });

  it('treats a different sessionId as a new session (re-applies)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await syncSession(usuarioId, 'sess-a', [{ regraId: regra1, qualidade: 4 }], { now });
    // A different sessionId re-applies the grade (reps advances to 2).
    await syncSession(usuarioId, 'sess-b', [{ regraId: regra1, qualidade: 4 }], { now });
    const progress = await prisma.progressoUsuario.findUniqueOrThrow({
      where: { usuarioId_regraId: { usuarioId, regraId: regra1 } },
    });
    expect(progress.reps).toBe(2);
    expect(progress.historico).toHaveLength(2);
  });

  it('updates ultimoAcesso to now (FR-15)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await syncSession(usuarioId, 'sess-ultimo', [{ regraId: regra1, qualidade: 4 }], { now });
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ultimoAcesso).toEqual(now);
  });

  it('increments the streak on a consecutive qualifying day (regras mode)', async () => {
    // Yesterday (Sao Paulo) the user was active with a streak of 1.
    const yesterday = new Date('2026-05-31T12:00:00.000Z');
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual: 1, ultimoAcesso: yesterday },
    });
    const today = new Date('2026-06-01T12:00:00.000Z');
    await syncSession(usuarioId, 'sess-consec', [{ regraId: regra1, qualidade: 4 }], {
      now: today,
    });

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ofensivaAtual).toBe(2); // consecutive → increment
    expect(usuario.maiorOfensiva).toBe(2);
  });

  it('resets the streak after a skipped day and keeps maiorOfensiva', async () => {
    // 3 days ago the user had a streak of 5. Today is a new streak.
    const threeDaysAgo = new Date('2026-05-29T12:00:00.000Z');
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual: 5, maiorOfensiva: 5, ultimoAcesso: threeDaysAgo },
    });
    const today = new Date('2026-06-01T12:00:00.000Z');
    await syncSession(usuarioId, 'sess-skip', [{ regraId: regra1, qualidade: 4 }], { now: today });

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ofensivaAtual).toBe(1); // skipped days → new streak
    expect(usuario.maiorOfensiva).toBe(5); // historical max preserved
  });

  it('regras mode: a batch below the threshold does not qualify (streak resets to 0)', async () => {
    // Threshold 5, but only 1 rule reviewed → not qualifying.
    await prisma.configuracaoUsuario.create({
      data: { usuarioId, modoOfensiva: 'regras', limiarOfensiva: 5 },
    });
    const yesterday = new Date('2026-05-31T12:00:00.000Z');
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual: 3, ultimoAcesso: yesterday },
    });
    const today = new Date('2026-06-01T12:00:00.000Z');
    await syncSession(usuarioId, 'sess-below', [{ regraId: regra1, qualidade: 4 }], { now: today });

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ofensivaAtual).toBe(0); // below threshold → reset
  });

  it('sessoes mode: a single sync counts as one session (qualifies at threshold 1)', async () => {
    await prisma.configuracaoUsuario.create({
      data: { usuarioId, modoOfensiva: 'sessoes', limiarOfensiva: 1 },
    });
    const yesterday = new Date('2026-05-31T12:00:00.000Z');
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual: 2, ultimoAcesso: yesterday },
    });
    const today = new Date('2026-06-01T12:00:00.000Z');
    // Even a single-rule batch counts as one session in sessoes mode.
    await syncSession(usuarioId, 'sess-sessoes', [{ regraId: regra1, qualidade: 4 }], {
      now: today,
    });

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ofensivaAtual).toBe(3); // consecutive session → increment
  });

  it('rolls back the entire batch if one grade references a missing regra', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const validRegra = regra1;
    const missingRegra = '00000000-0000-0000-0000-000000000000';
    await expect(
      syncSession(
        usuarioId,
        'sess-rollback',
        [
          { regraId: validRegra, qualidade: 4 },
          { regraId: missingRegra, qualidade: 4 },
        ],
        { now },
      ),
    ).rejects.toThrow();

    // The valid grade must NOT have been persisted (full rollback).
    const progressos = await prisma.progressoUsuario.findMany({ where: { usuarioId } });
    expect(progressos).toHaveLength(0);
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ultimoAcesso.getTime()).not.toBe(now.getTime());
  });

  it('rolls the streak day at America/Sao_Paulo midnight, not UTC midnight', async () => {
    // Sao Paulo is UTC-3. Sao Paulo midnight = 03:00 UTC.
    // ultimoAcesso at 2026-05-31T23:30:00Z is 2026-05-31 20:30 in Sao Paulo (May 31).
    // now at 2026-06-01T03:30:00Z is 2026-06-01 00:30 in Sao Paulo (June 1).
    // That is a consecutive day in Sao Paulo → streak increments.
    const lastAccess = new Date('2026-05-31T23:30:00.000Z');
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual: 1, ultimoAcesso: lastAccess },
    });
    const now = new Date('2026-06-01T03:30:00.000Z');
    await syncSession(usuarioId, 'sess-midnight', [{ regraId: regra1, qualidade: 4 }], { now });

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ofensivaAtual).toBe(2); // consecutive in Sao Paulo
  });

  it('does NOT increment when both instants are the same Sao Paulo day (even if UTC day differs)', async () => {
    // Both instants fall on 2026-06-01 in Sao Paulo (after 03:00 UTC), so no
    // new day has started — the streak must not increment.
    const lastAccess = new Date('2026-06-01T03:10:00.000Z'); // 00:10 Sao Paulo, June 1
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual: 4, ultimoAcesso: lastAccess },
    });
    const now = new Date('2026-06-01T15:00:00.000Z'); // 12:00 Sao Paulo, June 1
    await syncSession(usuarioId, 'sess-sameday', [{ regraId: regra1, qualidade: 4 }], { now });

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.ofensivaAtual).toBe(4); // same Sao Paulo day → no increment
  });
});
