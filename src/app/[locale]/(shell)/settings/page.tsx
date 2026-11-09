import { getTranslations, setRequestLocale } from 'next-intl/server';

// Settings — placeholder. The full settings screen (streak mode + threshold,
// daily goal, timer, Zen Mode default, session size) lands in Phase 6 (#36),
// persisted via the settings API (Phase 4, #26).
export default async function SettingsPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Settings');

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
      <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
    </div>
  );
}
