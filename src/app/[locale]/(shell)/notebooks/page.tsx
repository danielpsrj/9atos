import { getTranslations, setRequestLocale } from 'next-intl/server';

// Notebooks — placeholder. The notebook card grid with progress rings and the
// new-notebook flow land in Phase 6 (#33–#34).
export default async function NotebooksPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Notebooks');

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
      <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
    </div>
  );
}
