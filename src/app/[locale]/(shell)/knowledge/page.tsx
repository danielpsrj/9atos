import { getTranslations, setRequestLocale } from 'next-intl/server';

// Knowledge Base — placeholder. The tree browser, full CRUD, rule editor, and
// import UI land in Phase 8 (#45–#47).
export default async function KnowledgeBasePage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Knowledge');

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
      <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
    </div>
  );
}
