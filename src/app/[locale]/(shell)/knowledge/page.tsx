import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ImportScreen } from '@/components/knowledge/import-screen';

// Knowledge Base (Phase 8). The import screen (#45) lets the user upload a
// CSV/JSON file, preview the parsed rows, and bulk-insert them under a chosen
// Topico. The tree browser, full CRUD, and rule editor land in #46.
export default async function KnowledgeBasePage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Knowledge');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
        <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
      </div>
      <ImportScreen />
    </div>
  );
}
