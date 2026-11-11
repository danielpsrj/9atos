'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NotebookPen, BookOpen } from 'lucide-react';

// Notebook list (issue #62). Notebooks are a selection of a Knowledge's
// contents — all of them by default, or a subselection. This list shows each
// notebook with the unity of knowledge it selects from and its rule count, so
// the Notebook → Knowledge relationship is visible. The builder below it is how
// the selection is made.

interface CadernoItem {
  id: string;
  nome: string;
  conhecimentoId: string | null;
  _count: { regras: number };
  conhecimento: { id: string; nome: string } | null;
}

export function NotebookList() {
  const t = useTranslations('Notebooks');
  const [items, setItems] = useState<CadernoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/cadernos');
      if (!res.ok) throw new Error();
      setItems((await res.json()) as CadernoItem[]);
    } catch {
      setLoadError(t('listError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
      <h2 className="text-base font-semibold text-text-primary">{t('listTitle')}</h2>
      <p className="text-sm text-text-secondary">{t('listDescription')}</p>

      {loading && <p className="text-sm text-text-secondary">{t('treeLoading')}</p>}
      {loadError !== null && (
        <p role="alert" className="text-sm text-error">
          {loadError}
        </p>
      )}
      {!loading && loadError === null && items.length === 0 && (
        <p className="text-sm text-text-secondary">{t('noNotebooks')}</p>
      )}
      {!loading && loadError === null && items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
            >
              <NotebookPen aria-hidden className="size-4 shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{item.nome}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                <BookOpen aria-hidden className="size-3.5" />
                {item.conhecimento?.nome ?? t('noKnowledge')}
              </span>
              <span className="shrink-0 text-xs text-text-secondary">
                {t('ruleCount', { count: item._count.regras })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
