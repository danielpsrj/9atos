import type { Regra } from '@prisma/client';
import type { GameRule } from './types';

// Convert a Prisma Regra (distratores stored as a JSON array) into the engine's
// GameRule. The JSON is narrowed with Array.isArray before the cast, so a
// malformed value degrades to an empty distractor list rather than crashing.
export function toGameRule(regra: Regra): GameRule {
  const distratores = Array.isArray(regra.distratores) ? (regra.distratores as string[]) : [];
  return {
    id: regra.id,
    pergunta: regra.pergunta,
    respostaCerta: regra.respostaCerta,
    justificativa: regra.justificativa,
    dica: regra.dica,
    distratores,
    topicoId: regra.topicoId,
  };
}
