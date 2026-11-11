import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NotebookBuilder } from '@/components/notebooks/notebook-builder';
import { NotebookList } from '@/components/notebooks/notebook-list';

// Notebooks (Phase 8, issue #62). A notebook is a selection of a Knowledge's
// contents — all of them by default, or a subselection. The list above shows
// each notebook with the unity of knowledge it selects from; the builder below
// (#47) is how the selection is made (browse the knowledge tree, select rules,
// add them to a target notebook). The selection persists across navigation via
// localStorage.
export default async function NotebooksPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Notebooks');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
        <p className="mt-2 text-base text-text-secondary">{t('description')}</p>
      </div>
      <NotebookList />
      <NotebookBuilder />
    </div>
  );
}
