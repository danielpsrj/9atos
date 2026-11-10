import { getTranslations, setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings';
import { SettingsForm } from '@/components/settings/settings-form';

// Settings screen (issue #36, FR-16, AD-10). A server component that reads the
// user's six configurable tunables (or the documented defaults when no row
// exists yet) and renders the client SettingsForm seeded with them. Saving
// PATCHes /api/settings; the values round-trip because this page re-reads them
// on every load. Changes take effect on the next session, not mid-session.
export default async function SettingsPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Settings');

  // V1 is single-user with no auth (AD-01): resolve the one bootstrap user.
  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  const config =
    usuario === null
      ? null
      : await prisma.configuracaoUsuario.findUnique({ where: { usuarioId: usuario.id } });
  const settings: Settings =
    config === null
      ? DEFAULT_SETTINGS
      : {
          modoOfensiva: config.modoOfensiva,
          limiarOfensiva: config.limiarOfensiva,
          metaDiaria: config.metaDiaria,
          segundosPorCartao: config.segundosPorCartao,
          zenModePadrao: config.zenModePadrao,
          limiteSessao: config.limiteSessao,
        };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
        <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
      </header>
      <SettingsForm initial={settings} />
    </div>
  );
}
