import { format, parseISO } from 'date-fns';
import { tz } from '@date-fns/tz';
import { prisma } from '@/lib/prisma';

// Notebook statistics (issue #61). The per-notebook statistics screen is a
// dashboard: a slot per graph. This lib builds the payload for each graph. The
// structure is built first with the memory-stage breakdown (the headline graph);
// the per-game graphs are added on top once the dashboard structure is ready.
// "Today" and day windows are bucketed in America/Sao_Paulo (plan §2.4).

const EXAM_TIMEZONE = 'America/Sao_Paulo';
const saoPaulo = tz(EXAM_TIMEZONE);

/** Memory-stage thresholds (days of SRS interval). */
const LONG_TERM_DAYS = 21;
const RECENT_DAYS = 1;

/** The four game types (the ?game= wire values). */
export const GAME_TYPES = ['flashcards', 'match', 'multiple-choice', 'cloze'] as const;
export type GameType = (typeof GAME_TYPES)[number];

/** The memory-stage breakdown for a notebook's rules. */
export interface MemoryStageBreakdown {
  longTerm: number;
  recent: number;
  notLearned: number;
  total: number;
}

/** One play of a game: how many concepts were answered correctly vs. wrongly. */
export interface GamePlay {
  /** ISO date of the play (the session's sync time). */
  date: string;
  correct: number;
  wrong: number;
}

/** Per-game statistics for a notebook. */
export interface GameStats {
  game: GameType;
  /** Correct/wrong per play, oldest first. */
  plays: GamePlay[];
  /** Total times this game was used (number of plays). */
  usage: number;
}

/** The full per-notebook statistics payload (one round-trip). */
export interface NotebookStats {
  memoryStages: MemoryStageBreakdown;
  games: GameStats[];
}

/** Calendar-day key (YYYY-MM-DD) in the exam timezone. */
function dayKey(instant: Date): string {
  return format(saoPaulo(instant), 'yyyy-MM-dd');
}

/**
 * Build the per-notebook statistics payload.
 *
 * - Memory stages: each rule in the notebook is classified by its SRS interval
 *   (long-term > 21 days, recent >= 1 day, not-learned when never reviewed).
 * - Per-game: the historico log of each rule's progress is grouped by play
 *   (a play = one session's grades for that rule). Each play's grades are split
 *   into correct (q >= 3) and wrong (q < 3). The game type of a play is read
 *   from the historico entry's `game` field (recorded by the sync route).
 */
export async function buildNotebookStats(cadernoId: string): Promise<NotebookStats> {
  const caderno = await prisma.caderno.findUnique({
    where: { id: cadernoId },
    include: { regras: { include: { regra: true } } },
  });
  if (caderno === null) {
    throw new Error(`Caderno not found: ${cadernoId}`);
  }

  const regraIds = caderno.regras.map((link) => link.regra.id);
  const progressos = await prisma.progressoUsuario.findMany({
    where: { regraId: { in: regraIds } },
  });
  const progressByRegra = new Map(progressos.map((p) => [p.regraId, p]));

  // Memory-stage breakdown over the notebook's rules.
  let longTerm = 0;
  let recent = 0;
  let notLearned = 0;
  for (const regraId of regraIds) {
    const progress = progressByRegra.get(regraId);
    if (progress === undefined) {
      notLearned += 1;
    } else if (progress.intervaloDias > LONG_TERM_DAYS) {
      longTerm += 1;
    } else if (progress.intervaloDias >= RECENT_DAYS) {
      recent += 1;
    } else {
      notLearned += 1;
    }
  }
  const memoryStages: MemoryStageBreakdown = {
    longTerm,
    recent,
    notLearned,
    total: regraIds.length,
  };

  // Per-game plays: group each rule's historico by play (date + game). A play is
  // one session's grades for that rule; the historico entries share the session
  // date. We bucket by (date, game) and count correct (q >= 3) vs. wrong (q < 3).
  const playsByGame = new Map<GameType, Map<string, { correct: number; wrong: number }>>();
  for (const progress of progressos) {
    const historico = progress.historico as unknown as {
      date: string;
      grade: number;
      game?: string;
    }[];
    for (const entry of historico) {
      const game = (entry.game ?? 'flashcards') as GameType;
      const day = dayKey(parseISO(entry.date));
      let plays = playsByGame.get(game);
      if (plays === undefined) {
        plays = new Map();
        playsByGame.set(game, plays);
      }
      const play = plays.get(day) ?? { correct: 0, wrong: 0 };
      if (entry.grade >= 3) play.correct += 1;
      else play.wrong += 1;
      plays.set(day, play);
    }
  }

  const games: GameStats[] = GAME_TYPES.map((game) => {
    const plays = playsByGame.get(game);
    const playList: GamePlay[] =
      plays === undefined
        ? []
        : [...plays.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { correct, wrong }]) => ({ date, correct, wrong }));
    return { game, plays: playList, usage: playList.length };
  });

  return { memoryStages, games };
}
