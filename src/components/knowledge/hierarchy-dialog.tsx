'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Hierarchy dialog (issue #46, FR-01). A single reusable create/edit dialog for
// the three non-leaf levels of the knowledge hierarchy (Area, Disciplina,
// Topico). The level determines which fields are shown (Disciplina also has an
// icon and a color) and which API route is called. The parent (the tree) owns
// the dialog's open state and passes the existing node's values when editing.
export type HierarchyLevel = 'area' | 'disciplina' | 'topico';

interface HierarchyDialogProps {
  level: HierarchyLevel;
  mode: 'create' | 'edit';
  /** The existing node's id (edit mode only). */
  existingId?: string;
  /** The parent's id (create mode only): areaId for a disciplina, disciplinaId
   *  for a topico. */
  parentId?: string;
  initialNome?: string;
  initialIconeUrl?: string | null;
  initialCorHex?: string | null;
  onClose: () => void;
  /** Called after a successful create/update so the tree can refetch. */
  onSaved: () => void;
}

export function HierarchyDialog({
  level,
  mode,
  existingId,
  parentId,
  initialNome,
  initialIconeUrl,
  initialCorHex,
  onClose,
  onSaved,
}: HierarchyDialogProps) {
  const t = useTranslations('Knowledge');

  const [nome, setNome] = useState(initialNome ?? '');
  const [iconeUrl, setIconeUrl] = useState(initialIconeUrl ?? '');
  const [corHex, setCorHex] = useState(initialCorHex ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const title =
    mode === 'create'
      ? t(`dialogCreate${level.charAt(0).toUpperCase() + level.slice(1)}`)
      : t(`dialogEdit${level.charAt(0).toUpperCase() + level.slice(1)}`);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (nome.trim().length === 0) {
      setError(t('nameRequired'));
      return;
    }
    setError(null);
    setSaving(true);

    // Build the request per level and mode. An id is only required when it is
    // actually used in the URL (a disciplina/topico needs its parent when
    // created; every edit needs the existing node's id). An area creation needs
    // no id at all. Each guard narrows the optional prop to a defined string
    // before it is interpolated into the URL.
    let url: string;
    let method: string;
    let body: Record<string, unknown>;
    if (level === 'area') {
      if (mode === 'create') {
        url = '/api/areas';
        method = 'POST';
        body = { nome: nome.trim() };
      } else {
        if (existingId === undefined) return;
        url = `/api/areas/${existingId}`;
        method = 'PATCH';
        body = { nome: nome.trim() };
      }
    } else if (level === 'disciplina') {
      const payload: Record<string, unknown> = { nome: nome.trim() };
      if (iconeUrl.trim().length > 0) payload.iconeUrl = iconeUrl.trim();
      if (corHex.trim().length > 0) payload.corHex = corHex.trim();
      if (mode === 'create') {
        if (parentId === undefined) return;
        url = `/api/areas/${parentId}/disciplinas`;
        method = 'POST';
        body = payload;
      } else {
        if (existingId === undefined) return;
        url = `/api/disciplinas/${existingId}`;
        method = 'PATCH';
        body = payload;
      }
    } else {
      // topico
      if (mode === 'create') {
        if (parentId === undefined) return;
        url = `/api/disciplinas/${parentId}/topicos`;
        method = 'POST';
        body = { nome: nome.trim() };
      } else {
        if (existingId === undefined) return;
        url = `/api/topicos/${existingId}`;
        method = 'PATCH';
        body = { nome: nome.trim() };
      }
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(
          errBody?.error?.message ?? (mode === 'create' ? t('createError') : t('updateError')),
        );
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError(mode === 'create' ? t('createError') : t('updateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('nameLabel')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            {t('nameLabel')}
            <input
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
              }}
              placeholder={t('namePlaceholder')}
              className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
            />
          </label>
          {level === 'disciplina' && (
            <>
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                {t('iconeUrlLabel')}
                <input
                  type="text"
                  value={iconeUrl}
                  onChange={(e) => {
                    setIconeUrl(e.target.value);
                  }}
                  placeholder={t('iconeUrlPlaceholder')}
                  className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                {t('corHexLabel')}
                <input
                  type="text"
                  value={corHex}
                  onChange={(e) => {
                    setCorHex(e.target.value);
                  }}
                  placeholder={t('corHexPlaceholder')}
                  className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
                />
              </label>
            </>
          )}
          {error !== null && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('deleteCancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? mode === 'create'
                  ? t('creating')
                  : t('updating')
                : mode === 'create'
                  ? t('create')
                  : t('update')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
