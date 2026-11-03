import type { ModoOfensiva } from '@prisma/client';

// Plan §2.4 / AD-10 / issue #26: the user-configurable tunables and their
// validation rules. Defaults match the ConfiguracaoUsuario schema.

export interface Settings {
  modoOfensiva: ModoOfensiva;
  limiarOfensiva: number;
  metaDiaria: number;
  segundosPorCartao: number;
  zenModePadrao: boolean;
  limiteSessao: number;
}

/** AD-10 defaults (also the schema column defaults). */
export const DEFAULT_SETTINGS: Settings = {
  modoOfensiva: 'regras',
  limiarOfensiva: 1,
  metaDiaria: 30,
  segundosPorCartao: 30,
  zenModePadrao: true,
  limiteSessao: 20,
};

/** A single field-level validation error. */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Validate a partial settings update. Only the provided fields are checked.
 * Returns a list of field errors (empty when the patch is fully valid).
 */
export function validateSettingsPatch(body: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];

  if (
    body.modoOfensiva !== undefined &&
    body.modoOfensiva !== 'sessoes' &&
    body.modoOfensiva !== 'regras'
  ) {
    errors.push({ field: 'modoOfensiva', message: 'modoOfensiva must be "sessoes" or "regras".' });
  }
  if (
    body.limiarOfensiva !== undefined &&
    (typeof body.limiarOfensiva !== 'number' ||
      !Number.isInteger(body.limiarOfensiva) ||
      body.limiarOfensiva < 1)
  ) {
    errors.push({ field: 'limiarOfensiva', message: 'limiarOfensiva must be an integer >= 1.' });
  }
  if (
    body.metaDiaria !== undefined &&
    (typeof body.metaDiaria !== 'number' ||
      !Number.isInteger(body.metaDiaria) ||
      body.metaDiaria < 1)
  ) {
    errors.push({ field: 'metaDiaria', message: 'metaDiaria must be an integer >= 1.' });
  }
  if (
    body.segundosPorCartao !== undefined &&
    (typeof body.segundosPorCartao !== 'number' ||
      !Number.isInteger(body.segundosPorCartao) ||
      body.segundosPorCartao < 5 ||
      body.segundosPorCartao > 120)
  ) {
    errors.push({
      field: 'segundosPorCartao',
      message: 'segundosPorCartao must be an integer between 5 and 120.',
    });
  }
  if (
    body.limiteSessao !== undefined &&
    (typeof body.limiteSessao !== 'number' ||
      !Number.isInteger(body.limiteSessao) ||
      body.limiteSessao < 5 ||
      body.limiteSessao > 50)
  ) {
    errors.push({
      field: 'limiteSessao',
      message: 'limiteSessao must be an integer between 5 and 50.',
    });
  }
  if (body.zenModePadrao !== undefined && typeof body.zenModePadrao !== 'boolean') {
    errors.push({ field: 'zenModePadrao', message: 'zenModePadrao must be a boolean.' });
  }

  return errors;
}
