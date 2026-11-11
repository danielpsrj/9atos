import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ImportScreen } from '@/components/knowledge/import-screen';
import { KnowledgeList } from '@/components/knowledge/knowledge-list';
import { KnowledgeTree } from '@/components/knowledge/knowledge-tree';

// Knowledge Base (Phase 8, issue #62). The unities of knowledge (each a named
// group of content created by a multi-content import) are listed first; below
// them the tree browser (#46) renders the full content hierarchy (Area →
// Disciplina → Topico → Regra) with create/edit/delete at every level and a rule
// editor with a distractor list editor. The import screen (#45) below that lets
// the user upload a CSV/JSON file and bulk-insert rules — a multi-content import
// creates one unity of knowledge.
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
      <KnowledgeList />
      <KnowledgeTree />
      <ImportScreen />
    </div>
  );
}
