'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Knowledge list (issue #62). The unities of knowledge — each a named group of
// content created by a multi-content import. Shows each knowledge with its rule
// count, and offers create/delete. The content hierarchy (Area → … → Regra) and
// the import screen live below this list on the Knowledge page.

interface ConhecimentoItem {
  id: string;
  nome: string;
  descricao: string | null;
  _count: { regras: number };
}

export function KnowledgeList() {
  const t = useTranslations('Knowledge');
  const [items, setItems] = useState<ConhecimentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteNome, setDeleteNome] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/conhecimentos');
      if (!res.ok) throw new Error();
      setItems((await res.json()) as ConhecimentoItem[]);
    } catch {
      setLoadError(t('listError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (): Promise<void> => {
    if (nome.length === 0) {
      setCreateError(t('nameRequired'));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/conhecimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome }),
      });
      if (!res.ok) {
        setCreateError(t('createError'));
        return;
      }
      setCreateOpen(false);
      setNome('');
      await load();
    } catch {
      setCreateError(t('createError'));
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (deleteId === null) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/conhecimentos/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        setDeleteError(t('deleteError', { message: '' }));
        return;
      }
      setDeleteId(null);
      await load();
    } catch {
      setDeleteError(t('deleteError', { message: '' }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">{t('listTitle')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          <Plus aria-hidden />
          {t('newConhecimento')}
        </Button>
      </div>
      <p className="text-sm text-text-secondary">{t('listDescription')}</p>

      {loading && <p className="text-sm text-text-secondary">{t('treeLoading')}</p>}
      {loadError !== null && (
        <p role="alert" className="text-sm text-error">
          {loadError}
        </p>
      )}
      {!loading && loadError === null && items.length === 0 && (
        <p className="text-sm text-text-secondary">{t('listEmpty')}</p>
      )}
      {!loading && loadError === null && items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
            >
              <BookOpen aria-hidden className="size-4 shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{item.nome}</span>
              <span className="shrink-0 text-xs text-text-secondary">
                {t('ruleCount', { count: item._count.regras })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t('delete')}
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => {
                  setDeleteId(item.id);
                  setDeleteNome(item.nome);
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Create dialog. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialogCreateConhecimento')}</DialogTitle>
            <DialogDescription>{t('createConhecimentoDescription')}</DialogDescription>
          </DialogHeader>
          <label htmlFor="conhecimento-nome" className="text-sm text-text-secondary">
            {t('nameLabel')}
          </label>
          <input
            id="conhecimento-nome"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
            }}
            placeholder={t('namePlaceholder')}
            className="h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
          />
          {createError !== null && (
            <p role="alert" className="text-sm text-error">
              {createError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
              }}
            >
              {t('deleteCancel')}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation. */}
      {deleteId !== null && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteId(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t('deleteConfirmTitle', { label: t('conhecimentoLabel') })}
              </DialogTitle>
              <DialogDescription>{t('deleteConfirmBody')}</DialogDescription>
            </DialogHeader>
            <p className="truncate rounded-md bg-muted px-3 py-2 text-sm text-text-secondary">
              {deleteNome}
            </p>
            {deleteError !== null && (
              <p role="alert" className="text-sm text-error">
                {deleteError}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteId(null);
                }}
              >
                {t('deleteCancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {t('deleteConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
