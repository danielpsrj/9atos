import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { tz } from '@date-fns/tz';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { applyReview, type SrsState } from './engine';

// Plan §2.4 / spec §4, §6: applies a finished session's grades atomically and
// updates the streak. One Prisma transaction (NFR-08). Streak day boundaries
// are America/Sao_Paulo (the V1 exam timezone); ultimoAcesso is stored UTC.

export interface GradeEntry {
  regraId: string;
  /** Response quality: 1 (Missed), 3 (Hard), 4 (Good), 5 (Easy). */
  qualidade: number;
}

/** The updated schedule for one rule after a session is applied. */
export interface SyncResult {
  regraId: string;
  proximaRevisao: Date;
}

/** The shape persisted in SessaoEstudo.resultados (ISO strings, JSON-safe). */
interface StoredResult {
  regraId: string;
  proximaRevisao: string;
}

export interface SyncSessionOptions {
  /** The "now" instant (UTC). Injected for testability. */
  now?: Date;
}

const EXAM_TIMEZONE = 'America/Sao_Paulo';
const saoPaulo = tz(EXAM_TIMEZONE);

/** Calendar-day key (YYYY-MM-DD) in the exam timezone. */
function dayKey(instant: Date): string {
  // TZDate's getters return Sao Paulo wall-clock values, so format yields the
  // Sao Paulo calendar date regardless of the server's local timezone.
  return format(saoPaulo(instant), 'yyyy-MM-dd');
}

/** Parse a YYYY-MM-DD day key back to a Date (UTC midnight of that day). */
function dayKeyToDate(key: string): Date {
  return parseISO(key);
}

/**
 * Apply a batch of grades for a user in a single transaction and update the
 * streak fields per AD-05. Idempotent per sessionId (issue #22): a replay of an
 * already-applied sessionId returns the stored result without re-applying SRS.
 *
 * - Each grade runs applyReview and persists the new SRS state + historico.
 * - The streak (ofensivaAtual) counts consecutive qualifying days in
 *   America/Sao_Paulo. A day qualifies when activity meets the user's
 *   configurable mode/threshold (ConfiguracaoUsuario). A skipped day resets the
 *   streak to 0; maiorOfensiva is the historical max.
 * - Usuario.ultimoAcesso is set to `now` (FR-15).
 * - Returns the updated proximaRevisao for every submitted rule.
 */
export async function syncSession(
  usuarioId: string,
  sessionId: string,
  batch: GradeEntry[],
  options: SyncSessionOptions = {},
): Promise<SyncResult[]> {
  const now = options.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    // Idempotency: if this session was already applied, return the stored
    // result and skip all SRS/streak work (prevents double-apply on retry).
    const existing = await tx.sessaoEstudo.findUnique({
      where: { usuarioId_id: { usuarioId, id: sessionId } },
    });
    if (existing !== null) {
      const stored = existing.resultados as unknown as StoredResult[];
      return stored.map((r) => ({
        regraId: r.regraId,
        proximaRevisao: new Date(r.proximaRevisao),
      }));
    }

    // Load the user's config (AD-10 defaults if missing).
    const config = await tx.configuracaoUsuario.findUnique({ where: { usuarioId } });
    const modoOfensiva = config?.modoOfensiva ?? 'regras';
    const limiarOfensiva = config?.limiarOfensiva ?? 1;

    // Apply each grade, collecting the new proximaRevisao per rule.
    const results: SyncResult[] = [];
    for (const { regraId, qualidade } of batch) {
      const progress = await tx.progressoUsuario.upsert({
        where: { usuarioId_regraId: { usuarioId, regraId } },
        update: {},
        create: { usuarioId, regraId },
      });

      const state: SrsState = {
        reps: progress.reps,
        easeFactor: progress.easeFactor,
        intervaloDias: progress.intervaloDias,
        proximaRevisao: progress.proximaRevisao,
        historico: progress.historico as unknown as SrsState['historico'],
      };
      const next = applyReview(state, qualidade, now);

      await tx.progressoUsuario.update({
        where: { id: progress.id },
        data: {
          reps: next.reps,
          easeFactor: next.easeFactor,
          intervaloDias: next.intervaloDias,
          proximaRevisao: next.proximaRevisao,
          historico: next.historico as unknown as Prisma.InputJsonValue,
        },
      });
      results.push({ regraId, proximaRevisao: next.proximaRevisao });
    }

    // Streak update (AD-05).
    const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    const todayKey = dayKey(now);

    // Count today's qualifying activity. In 'regras' mode the batch size is the
    // rules-reviewed count; in 'sessoes' mode one sync = one session.
    const activityToday = modoOfensiva === 'regras' ? batch.length : 1;
    const qualifies = activityToday >= limiarOfensiva;

    let ofensivaAtual: number;
    if (!qualifies) {
      ofensivaAtual = 0;
    } else {
      // Determine the last day the user was active (from historico or ultimoAcesso).
      const lastActiveKey = dayKey(usuario.ultimoAcesso);
      if (lastActiveKey === todayKey) {
        // Already counted today — keep the current streak.
        ofensivaAtual = usuario.ofensivaAtual;
      } else {
        const gap = differenceInCalendarDays(dayKeyToDate(todayKey), dayKeyToDate(lastActiveKey));
        if (gap === 1) {
          // Consecutive day — increment.
          ofensivaAtual = usuario.ofensivaAtual + 1;
        } else {
          // Skipped day(s) or first day — start a new streak.
          ofensivaAtual = 1;
        }
      }
    }

    const maiorOfensiva = Math.max(usuario.maiorOfensiva, ofensivaAtual);

    await tx.usuario.update({
      where: { id: usuarioId },
      data: { ofensivaAtual, maiorOfensiva, ultimoAcesso: now },
    });

    // Persist the session outcome for idempotent replay.
    const stored: StoredResult[] = results.map((r) => ({
      regraId: r.regraId,
      proximaRevisao: r.proximaRevisao.toISOString(),
    }));
    await tx.sessaoEstudo.create({
      data: { id: sessionId, usuarioId, resultados: stored as unknown as Prisma.InputJsonValue },
    });

    return results;
  });
}
