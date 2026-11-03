import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_SETTINGS, validateSettingsPatch, type Settings } from '@/lib/settings';
import { errorResponse, ErrorCode } from '@/lib/api/error';

// V1 is single-user with no auth (AD-01): resolve the one bootstrap user.
async function resolveUser() {
  return prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
}

// ── GET /api/settings ────────────────────────────────────────────────────────
// Returns the user's six configurable settings (AD-10). A fresh user with no
// ConfiguracaoUsuario row gets the documented defaults.
// Params: none. Body: none.
// Response 200: { modoOfensiva, limiarOfensiva, metaDiaria, segundosPorCartao,
//   zenModePadrao, limiteSessao }. 500 INTERNAL_ERROR if no user is provisioned.

export async function GET() {
  const usuario = await resolveUser();
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
    });
  }
  const config = await prisma.configuracaoUsuario.findUnique({ where: { usuarioId: usuario.id } });
  if (config === null) {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
  const settings: Settings = {
    modoOfensiva: config.modoOfensiva,
    limiarOfensiva: config.limiarOfensiva,
    metaDiaria: config.metaDiaria,
    segundosPorCartao: config.segundosPorCartao,
    zenModePadrao: config.zenModePadrao,
    limiteSessao: config.limiteSessao,
  };
  return NextResponse.json(settings);
}

// ── PATCH /api/settings ──────────────────────────────────────────────────────
// Partially updates the user's settings. Omitted fields keep their current
// value. Creates the ConfiguracaoUsuario row on first write.
// Body: any subset of { modoOfensiva, limiarOfensiva, metaDiaria,
//   segundosPorCartao, zenModePadrao, limiteSessao }.
// Response 200: the updated settings. 400 VALIDATION_ERROR with field-level
// details when any value is out of range.

export async function PATCH(req: NextRequest) {
  const usuario = await resolveUser();
  if (usuario === null) {
    return errorResponse(500, {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'No user is provisioned. Run the seed to create the bootstrap user.',
    });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Body must be valid JSON.',
    });
  }
  if (raw === null || typeof raw !== 'object') {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Body must be a JSON object.',
    });
  }
  const body = raw as Record<string, unknown>;

  const fieldErrors = validateSettingsPatch(body);
  if (fieldErrors.length > 0) {
    return errorResponse(400, {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'One or more settings values are invalid.',
      details: { fields: fieldErrors },
    });
  }

  // Merge the patch over the current values (defaults when no row exists yet).
  const existing = await prisma.configuracaoUsuario.findUnique({
    where: { usuarioId: usuario.id },
  });
  const base: Settings =
    existing === null
      ? DEFAULT_SETTINGS
      : {
          modoOfensiva: existing.modoOfensiva,
          limiarOfensiva: existing.limiarOfensiva,
          metaDiaria: existing.metaDiaria,
          segundosPorCartao: existing.segundosPorCartao,
          zenModePadrao: existing.zenModePadrao,
          limiteSessao: existing.limiteSessao,
        };

  const merged: Settings = {
    modoOfensiva: (body.modoOfensiva as Settings['modoOfensiva'] | undefined) ?? base.modoOfensiva,
    limiarOfensiva: (body.limiarOfensiva as number | undefined) ?? base.limiarOfensiva,
    metaDiaria: (body.metaDiaria as number | undefined) ?? base.metaDiaria,
    segundosPorCartao: (body.segundosPorCartao as number | undefined) ?? base.segundosPorCartao,
    zenModePadrao: (body.zenModePadrao as boolean | undefined) ?? base.zenModePadrao,
    limiteSessao: (body.limiteSessao as number | undefined) ?? base.limiteSessao,
  };

  await prisma.configuracaoUsuario.upsert({
    where: { usuarioId: usuario.id },
    update: merged,
    create: { usuarioId: usuario.id, ...merged },
  });

  return NextResponse.json(merged);
}
