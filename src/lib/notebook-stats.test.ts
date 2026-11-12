import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { buildNotebookStats } from './notebook-stats';

// Tests for the per-notebook statistics builder (issue #61). Drives the real
// Prisma client against the ephemeral Postgres. Covers the memory-stage
// breakdown and the per-game plays grouping (which reads the historico `game`
// field and formats day keys — a regression guard for the date-fns `dd` token).

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

describe('buildNotebookStats (issue #61)', () => {
  let usuarioId: string;
  let cadernoId: string;
  let regra1: string;
  let regra2: string;
  let regra3: string;

  beforeEach(async () => {
    await prisma.sessaoEstudo.deleteMany();
    await prisma.progressoUsuario.deleteMany();
    await prisma.regraNoCaderno.deleteMany();
    await prisma.caderno.deleteMany();
    await prisma.regra.deleteMany();
    await prisma.topico.deleteMany();
    await prisma.disciplina.deleteMany();
    await prisma.area.deleteMany();
    await prisma.usuario.deleteMany();

    const usuario = await prisma.usuario.create({ data: { nome: 'Stats Tester' } });
    usuarioId = usuario.id;
    regra1 = await makeRegra('1');
    regra2 = await makeRegra('2');
    regra3 = await makeRegra('3');
    const caderno = await prisma.caderno.create({
      data: { usuarioId, nome: 'Stats Notebook' },
    });
    cadernoId = caderno.id;
    await prisma.regraNoCaderno.createMany({
      data: [
        { cadernoId, regraId: regra1 },
        { cadernoId, regraId: regra2 },
        { cadernoId, regraId: regra3 },
      ],
    });
  });

  it('classifies all rules as not-learned when there is no progress', async () => {
    const stats = await buildNotebookStats(cadernoId);
    expect(stats.memoryStages).toEqual({
      longTerm: 0,
      recent: 0,
      notLearned: 3,
      total: 3,
    });
    // No plays recorded for any game.
    for (const game of stats.games) {
      expect(game.plays).toEqual([]);
      expect(game.usage).toBe(0);
    }
  });

  it('splits rules into long-term / recent / not-learned by interval', async () => {
    // regra1: long-term (interval > 21). regra2: recent (interval >= 1, <= 21).
    // regra3: no progress row → not-learned.
    await prisma.progressoUsuario.create({
      data: {
        usuarioId,
        regraId: regra1,
        reps: 5,
        easeFactor: 2.5,
        intervaloDias: 30,
        historico: [{ date: '2026-01-01T12:00:00.000Z', grade: 4, game: 'flashcards' }],
      },
    });
    await prisma.progressoUsuario.create({
      data: {
        usuarioId,
        regraId: regra2,
        reps: 1,
        easeFactor: 2.5,
        intervaloDias: 3,
        historico: [{ date: '2026-01-02T12:00:00.000Z', grade: 3, game: 'multiple-choice' }],
      },
    });

    const stats = await buildNotebookStats(cadernoId);
    expect(stats.memoryStages).toEqual({
      longTerm: 1,
      recent: 1,
      notLearned: 1,
      total: 3,
    });
  });

  it('groups per-game plays by day + game and splits correct vs. wrong', async () => {
    // Two flashcard reviews of regra1 on the same day (one correct, one wrong)
    // and one multiple-choice review of regra2 on a different day (correct).
    await prisma.progressoUsuario.create({
      data: {
        usuarioId,
        regraId: regra1,
        reps: 1,
        easeFactor: 2.5,
        intervaloDias: 1,
        historico: [
          { date: '2026-01-01T12:00:00.000Z', grade: 4, game: 'flashcards' },
          { date: '2026-01-01T18:00:00.000Z', grade: 1, game: 'flashcards' },
        ],
      },
    });
    await prisma.progressoUsuario.create({
      data: {
        usuarioId,
        regraId: regra2,
        reps: 1,
        easeFactor: 2.5,
        intervaloDias: 1,
        historico: [{ date: '2026-01-03T12:00:00.000Z', grade: 5, game: 'multiple-choice' }],
      },
    });

    const stats = await buildNotebookStats(cadernoId);
    const flashcards = stats.games.find((g) => g.game === 'flashcards');
    const multipleChoice = stats.games.find((g) => g.game === 'multiple-choice');

    // Flashcards: one play (2026-01-01) with 1 correct + 1 wrong.
    expect(flashcards?.plays).toEqual([{ date: '2026-01-01', correct: 1, wrong: 1 }]);
    expect(flashcards?.usage).toBe(1);
    // Multiple choice: one play (2026-01-03) with 1 correct + 0 wrong.
    expect(multipleChoice?.plays).toEqual([{ date: '2026-01-03', correct: 1, wrong: 0 }]);
    expect(multipleChoice?.usage).toBe(1);
  });

  it('throws a "Caderno not found" error for an unknown notebook id', async () => {
    await expect(buildNotebookStats('no-such-caderno')).rejects.toThrow('Caderno not found');
  });
});
