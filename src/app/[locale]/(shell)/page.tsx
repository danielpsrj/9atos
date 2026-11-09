import { getTranslations, setRequestLocale } from 'next-intl/server';

// Overview (dashboard) — placeholder. The live dashboard (streak, goal,
// notebook rings) lands in Phase 6 (#32–#36).
export default async function OverviewPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Overview');

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
      <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
    </div>
  );
}
