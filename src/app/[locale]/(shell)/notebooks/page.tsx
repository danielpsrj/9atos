import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NotebookBuilder } from '@/components/notebooks/notebook-builder';

// Notebooks (Phase 8). The notebook builder (#47) lets the user browse the
// knowledge tree, select rules, and add them to a target notebook. The
// selection persists across navigation via localStorage.
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
      <NotebookBuilder />
    </div>
  );
}
