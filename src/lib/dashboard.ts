import { format, parseISO } from 'date-fns';
import { tz } from '@date-fns/tz';
import { prisma } from '@/lib/prisma';

// Plan §2.4 / spec §5.2 / issue #25: builds the single dashboard payload
// (streak, daily-goal progress, and per-notebook progress rings) in one pass.
// "Today" for the goal is bucketed in America/Sao_Paulo.

const EXAM_TIMEZONE = 'America/Sao_Paulo';
const saoPaulo = tz(EXAM_TIMEZONE);

/** A notebook card on the dashboard. */
export interface DashboardNotebook {
  id: string;
  nome: string;
  /** The dominant area among the notebook's rules (null when it has none). */
  areaTag: string | null;
  /** 0–100: share of the notebook's rules with intervaloDias > 21. */
  ringPercentage: number;
}

/** The full dashboard payload (one round-trip, no client fan-out). */
export interface DashboardPayload {
  ofensivaAtual: number;
  maiorOfensiva: number;
  metaDiaria: number;
  /** Distinct rules reviewed in the current America/Sao_Paulo day. */
  revisadasHoje: number;
  cadernos: DashboardNotebook[];
}

/** Calendar-day key (YYYY-MM-DD) in the exam timezone. */
function dayKey(instant: Date): string {
  return format(saoPaulo(instant), 'yyyy-MM-dd');
}

/**
 * Build the dashboard payload for a user.
 *
 * - Streak: straight from the Usuario row.
 * - Goal: distinct rules with at least one review in the current Sao Paulo day,
 *   versus the user's metaDiaria (AD-10 default 30).
 * - Rings: for each notebook, the share of its rules whose SRS interval exceeds
 *   21 days (spec §5.2). Rules never studied count toward the denominator only.
 * - Area tag: the most frequent area among a notebook's rules (null if empty).
 */
export async function buildDashboard(
  usuarioId: string,
  now: Date = new Date(),
): Promise<DashboardPayload> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const config = await prisma.configuracaoUsuario.findUnique({ where: { usuarioId } });
  const metaDiaria = config?.metaDiaria ?? 30;

  // All of the user's progress (for rings and the daily-goal count).
  const progressos = await prisma.progressoUsuario.findMany({ where: { usuarioId } });
  const progressByRegra = new Map(progressos.map((p) => [p.regraId, p]));

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

  // Notebooks with their rules resolved to their area.
  const cadernos = await prisma.caderno.findMany({
    where: { usuarioId },
    include: {
      regras: {
        include: {
          regra: { include: { topico: { include: { disciplina: { include: { area: true } } } } } },
        },
      },
    },
    orderBy: { nome: 'asc' },
  });

  const notebookCards: DashboardNotebook[] = cadernos.map((caderno) => {
    const rules = caderno.regras.map((link) => link.regra);
    const total = rules.length;

    // Ring: share of rules with intervaloDias > 21.
    const mature = rules.filter((regra) => {
      const progress = progressByRegra.get(regra.id);
      return progress !== undefined && progress.intervaloDias > 21;
    }).length;
    const ringPercentage = total === 0 ? 0 : Math.round((mature / total) * 100);

    // Area tag: the most frequent area among the notebook's rules.
    const areaCounts = new Map<string, number>();
    for (const regra of rules) {
      const areaName = regra.topico.disciplina.area.nome;
      areaCounts.set(areaName, (areaCounts.get(areaName) ?? 0) + 1);
    }
    let areaTag: string | null = null;
    let maxCount = 0;
    for (const [areaName, count] of areaCounts) {
      if (count > maxCount) {
        maxCount = count;
        areaTag = areaName;
      }
    }

    return { id: caderno.id, nome: caderno.nome, areaTag, ringPercentage };
  });

  return {
    ofensivaAtual: usuario.ofensivaAtual,
    maiorOfensiva: usuario.maiorOfensiva,
    metaDiaria,
    revisadasHoje: reviewedToday.size,
    cadernos: notebookCards,
  };
}
