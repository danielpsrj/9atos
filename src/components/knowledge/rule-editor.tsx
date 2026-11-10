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
import { DistractorListEditor } from '@/components/knowledge/distractor-list-editor';

// Rule editor (issue #46, FR-01). A create/edit dialog for a Regra, with the
// distractor list editor (add/remove/reorder the incorrect options). All fields
// round-trip through the 4.3 CRUD routes: create posts to
// /api/topicos/:id/regras, edit patches /api/regras/:id.
interface RuleEditorProps {
  mode: 'create' | 'edit';
  /** The topico's id (create mode only). */
  parentId?: string;
  /** The existing regra's id (edit mode only). */
  existingId?: string;
  initialPergunta?: string;
  initialRespostaCerta?: string;
  initialJustificativa?: string | null;
  initialDica?: string | null;
  initialDistratores?: string[];
  initialNivelDificuldade?: number;
  initialProbabilidade?: number | null;
  onClose: () => void;
  /** Called after a successful create/update so the tree can refetch. */
  onSaved: () => void;
}

export function RuleEditor({
  mode,
  parentId,
  existingId,
  initialPergunta,
  initialRespostaCerta,
  initialJustificativa,
  initialDica,
  initialDistratores,
  initialNivelDificuldade,
  initialProbabilidade,
  onClose,
  onSaved,
}: RuleEditorProps) {
  const t = useTranslations('Knowledge');

  const [pergunta, setPergunta] = useState(initialPergunta ?? '');
  const [respostaCerta, setRespostaCerta] = useState(initialRespostaCerta ?? '');
  const [justificativa, setJustificativa] = useState(initialJustificativa ?? '');
  const [dica, setDica] = useState(initialDica ?? '');
  const [distratores, setDistratores] = useState<string[]>(initialDistratores ?? []);
  const [nivelDificuldade, setNivelDificuldade] = useState(initialNivelDificuldade ?? 1);
  const [probabilidade, setProbabilidade] = useState(
    initialProbabilidade === null || initialProbabilidade === undefined
      ? ''
      : String(initialProbabilidade),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (pergunta.trim().length === 0) {
      setError(t('perguntaRequired'));
      return;
    }
    if (respostaCerta.trim().length === 0) {
      setError(t('respostaCertaRequired'));
      return;
    }
    // Validate the probability (0..1) if present.
    let probabilidadeValue: number | null = null;
    if (probabilidade.trim().length > 0) {
      const parsed = Number(probabilidade);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
        setError(t('probabilidadeRange'));
        return;
      }
      probabilidadeValue = parsed;
    }
    setError(null);
    setSaving(true);

    // Drop empty-string distractors (the user may have added a blank row).
    const cleanDistratores = distratores.map((d) => d.trim()).filter((d) => d.length > 0);

    const body: Record<string, unknown> = {
      pergunta: pergunta.trim(),
      respostaCerta: respostaCerta.trim(),
      justificativa: justificativa.trim().length > 0 ? justificativa.trim() : null,
      dica: dica.trim().length > 0 ? dica.trim() : null,
      distratores: cleanDistratores,
      nivelDificuldade,
      probabilidade: probabilidadeValue,
    };

    // The id required by the request: the topico's id when creating, the
    // existing regra's id when editing. Guarded so the template literal only
    // ever interpolates a defined string.
    const id = mode === 'create' ? parentId : existingId;
    if (id === undefined) return;
    const url = mode === 'create' ? `/api/topicos/${id}/regras` : `/api/regras/${id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('ruleCreateTitle') : t('ruleEditTitle')}</DialogTitle>
          <DialogDescription>{t('perguntaLabel')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            {t('perguntaLabel')}
            <input
              type="text"
              value={pergunta}
              onChange={(e) => {
                setPergunta(e.target.value);
              }}
              placeholder={t('perguntaPlaceholder')}
              className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            {t('respostaCertaLabel')}
            <input
              type="text"
              value={respostaCerta}
              onChange={(e) => {
                setRespostaCerta(e.target.value);
              }}
              placeholder={t('respostaCertaPlaceholder')}
              className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            {t('justificativaLabel')}
            <textarea
              value={justificativa}
              onChange={(e) => {
                setJustificativa(e.target.value);
              }}
              placeholder={t('justificativaPlaceholder')}
              rows={2}
              className="rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus-visible:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            {t('dicaLabel')}
            <input
              type="text"
              value={dica}
              onChange={(e) => {
                setDica(e.target.value);
              }}
              placeholder={t('dicaPlaceholder')}
              className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-text-secondary">{t('distratoresLabel')}</span>
            <p className="text-xs text-text-secondary">{t('distratoresHint')}</p>
            <DistractorListEditor value={distratores} onChange={setDistratores} />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              {t('nivelDificuldadeLabel')}
              <input
                type="number"
                min={1}
                max={5}
                value={nivelDificuldade}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  if (!Number.isNaN(parsed))
                    setNivelDificuldade(Math.min(5, Math.max(1, Math.round(parsed))));
                }}
                className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              {t('probabilidadeLabel')}
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={probabilidade}
                onChange={(e) => {
                  setProbabilidade(e.target.value);
                }}
                placeholder={t('probabilidadeHint')}
                className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
              />
            </label>
          </div>
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
