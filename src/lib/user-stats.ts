import { format, parseISO } from 'date-fns';
import { tz } from '@date-fns/tz';
import { prisma } from '@/lib/prisma';

// User statistics (issue #62). The learner's own view of their learning: a
// memory-stage breakdown of every rule they have progress on, plus their streak
// and daily-goal progress. "Today" is bucketed in America/Sao_Paulo (plan §2.4).
// The per-notebook and per-game graphs are added in #61 on top of this base.

const EXAM_TIMEZONE = 'America/Sao_Paulo';
const saoPaulo = tz(EXAM_TIMEZONE);

/** Memory-stage thresholds (days of SRS interval). */
const LONG_TERM_DAYS = 21;
const RECENT_DAYS = 1;

export type MemoryStage = 'long-term' | 'recent' | 'not-learned';

/** The learner's own statistics payload. */
export interface UserStats {
  nome: string;
  ofensivaAtual: number;
  maiorOfensiva: number;
  metaDiaria: number;
  revisadasHoje: number;
  /** Total rules the user has any progress on. */
  totalRegras: number;
  /** Rules whose SRS interval exceeds LONG_TERM_DAYS. */
  longTerm: number;
  /** Rules studied (interval >= RECENT_DAYS) but not yet long-term. */
  recent: number;
  /** Rules never reviewed (no progress row). */
  notLearned: number;
}

/** Calendar-day key (YYYY-MM-DD) in the exam timezone. */
function dayKey(instant: Date): string {
  return format(saoPaulo(instant), 'yyyy-MM-dd');
}

/**
 * Build the learner's own statistics.
 *
 * - Streak / goal: straight from the Usuario row and its config.
 * - Memory stages: every rule the user has a ProgressoUsuario for is classified
 *   by its intervaloDias (long-term > 21 days, recent >= 1 day, else not-learned
 *   when never reviewed). Rules with no progress row count as not-learned.
 */
export async function buildUserStats(
  usuarioId: string,
  now: Date = new Date(),
): Promise<UserStats> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const config = await prisma.configuracaoUsuario.findUnique({ where: { usuarioId } });
  const metaDiaria = config?.metaDiaria ?? 30;

  const progressos = await prisma.progressoUsuario.findMany({ where: { usuarioId } });

  // Daily goal: distinct rules reviewed in the current Sao Paulo day.
  const todayKey = dayKey(now);
  const reviewedToday = new Set<string>();
  for (const p of progressos) {
    const historico = p.historico as unknown as { date: string }[];
    for (const entry of historico) {
      if (dayKey(parseISO(entry.date)) === todayKey) {
        reviewedToday.add(p.regraId);
        break;
      }
    }
  }

  // Memory-stage classification over the user's progress.
  let longTerm = 0;
  let recent = 0;
  for (const p of progressos) {
    if (p.intervaloDias > LONG_TERM_DAYS) longTerm += 1;
    else if (p.intervaloDias >= RECENT_DAYS) recent += 1;
  }
  const totalRegras = progressos.length;
  const notLearned = 0; // Rules with no progress row are not in `progressos`.

  return {
    nome: usuario.nome,
    ofensivaAtual: usuario.ofensivaAtual,
    maiorOfensiva: usuario.maiorOfensiva,
    metaDiaria,
    revisadasHoje: reviewedToday.size,
    totalRegras,
    longTerm,
    recent,
    notLearned,
  };
}
