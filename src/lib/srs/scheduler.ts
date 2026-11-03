import { prisma } from '@/lib/prisma';
import type { ProgressoUsuario, Regra } from '@prisma/client';

// Plan §2.4 / spec §4, §6: decides which rules a study session contains.
// Urgency, most to least:
//   1. Never studied (no ProgressoUsuario row) — due immediately.
//   2. Overdue (proximaRevisao <= now).
//   3. Future (proximaRevisao > now), earliest first.
// Ties and over-limit selection use stochastic sampling weighted by
// Regra.probabilidade (AD-11), with null probabilidade treated as weight 1.0.
// All comparisons are UTC.

/** A rule selected for a session, with its existing SRS progress (or null). */
export interface DueRule {
  regra: Regra;
  /** The existing SRS progress, or null if the rule has never been studied. */
  progresso: ProgressoUsuario | null;
}

export interface DueRulesOptions {
  /** Scope to a single notebook (only rules in that caderno). */
  cadernoId?: string;
  /** Maximum number of rules to return (default 20, AD-13). */
  limit?: number;
  /** The "now" instant (UTC). Injected for testability; defaults to Date.now(). */
  now?: Date;
}

const DEFAULT_LIMIT = 20; // AD-13

/** AD-11: null probabilidade behaves as weight 1.0. */
function weightOf(regra: Regra): number {
  return regra.probabilidade ?? 1.0;
}

/** Weight for a due rule (delegates to its regra's probabilidade). */
function dueRuleWeight(due: DueRule): number {
  return weightOf(due.regra);
}

/**
 * Sample `count` items without replacement, each pick's probability proportional
 * to its weight. Deterministic given the same pool, weights, count, and RNG.
 */
export function weightedSample<T>(items: T[], weight: (item: T) => number, count: number): T[] {
  const pool = [...items];
  const selected: T[] = [];
  while (selected.length < count && pool.length > 0) {
    const total = pool.reduce((sum, item) => sum + weight(item), 0);
    if (total <= 0) break;
    let roll = Math.random() * total;
    let pickedIndex = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= weight(pool[i] as T);
      if (roll <= 0) {
        pickedIndex = i;
        break;
      }
    }
    selected.push(pool[pickedIndex] as T);
    pool.splice(pickedIndex, 1);
  }
  return selected;
}

/**
 * Return the rules due for a study session, at most `limit`.
 *
 * Ordering: never-studied and overdue rules first (both are "due now"), then
 * earliest future proximaRevisao. When the due-now pool exceeds `limit`, or when
 * future rules tie at the selection boundary, the choice is made by
 * probabilidade-weighted sampling (AD-11).
 */
export async function dueRules(
  usuarioId: string,
  options: DueRulesOptions = {},
): Promise<DueRule[]> {
  const { cadernoId, limit = DEFAULT_LIMIT, now = new Date() } = options;

  // All rules in scope (caderno, or the whole knowledge base).
  const regras = await prisma.regra.findMany({
    where: cadernoId ? { cadernos: { some: { cadernoId } } } : undefined,
  });

  // The user's existing progress for those rules.
  const progressos = await prisma.progressoUsuario.findMany({
    where: {
      usuarioId,
      ...(cadernoId ? { regra: { cadernos: { some: { cadernoId } } } } : {}),
    },
  });
  const progressByRegra = new Map(progressos.map((p) => [p.regraId, p]));

  const dueNow: DueRule[] = [];
  const future: DueRule[] = [];
  for (const regra of regras) {
    const progresso = progressByRegra.get(regra.id) ?? null;
    const due: DueRule = { regra, progresso };
    if (progresso === null || progresso.proximaRevisao.getTime() <= now.getTime()) {
      dueNow.push(due);
    } else {
      future.push(due);
    }
  }
  future.sort((a, b) => {
    const aTime = a.progresso?.proximaRevisao.getTime() ?? 0;
    const bTime = b.progresso?.proximaRevisao.getTime() ?? 0;
    return aTime - bTime;
  });

  const selected: DueRule[] = [];

  // Due-now rules (never studied + overdue) are always prioritized. If they fit,
  // take all; otherwise sample `limit` of them by weight.
  if (dueNow.length <= limit) {
    selected.push(...dueNow);
  } else {
    selected.push(...weightedSample(dueNow, dueRuleWeight, limit));
    return selected; // no slots left for future rules
  }

  // Fill remaining slots with the earliest future rules. A tie at the boundary
  // (multiple rules sharing the cutoff proximaRevisao) is broken by weight.
  const remaining = limit - selected.length;
  if (remaining > 0 && future.length > 0) {
    if (future.length <= remaining) {
      selected.push(...future);
    } else {
      // future.length > remaining here, so index (remaining - 1) is in bounds.
      const cutoff = future[remaining - 1];
      if (cutoff === undefined) return selected; // unreachable; satisfies TS
      const cutoffTime = cutoff.progresso?.proximaRevisao.getTime() ?? 0;
      const beforeCutoff = future.slice(0, remaining - 1);
      const atCutoff = future
        .slice(remaining - 1)
        .filter((d) => d.progresso?.proximaRevisao.getTime() === cutoffTime);
      const slotsAtCutoff = remaining - beforeCutoff.length;
      selected.push(...beforeCutoff, ...weightedSample(atCutoff, dueRuleWeight, slotsAtCutoff));
    }
  }

  return selected;
}
