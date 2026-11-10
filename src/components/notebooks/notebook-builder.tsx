'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  BookOpen,
  Tags,
  FileText,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Notebook builder (issue #47, FR-03). Browse the knowledge tree, select rules,
// and add them to a target notebook. The selection (a set of regra ids) and the
// target notebook persist across navigation via localStorage — leaving and
// returning to the builder keeps the selection. Rules already in the target
// notebook are marked and not double-added (the add route is idempotent).
interface RegraNode {
  id: string;
  pergunta: string;
}

interface TopicoNode {
  id: string;
  nome: string;
  regras: RegraNode[];
}

interface DisciplinaNode {
  id: string;
  nome: string;
  topicos: TopicoNode[];
}

interface AreaNode {
  id: string;
  nome: string;
  disciplinas: DisciplinaNode[];
}

interface Caderno {
  id: string;
  nome: string;
}

// The localStorage keys for the persisted selection and target notebook.
const SELECTION_KEY = 'notebook-builder-selection';
const TARGET_KEY = 'notebook-builder-target';

export function NotebookBuilder() {
  const t = useTranslations('Notebooks');

  const [tree, setTree] = useState<AreaNode[]>([]);
  const [cadernos, setCadernos] = useState<Caderno[]>([]);
  const [targetCadernoId, setTargetCadernoId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alreadyInNotebook, setAlreadyInNotebook] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<number | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Load the tree and the cadernos, and restore the persisted selection and
  // target notebook from localStorage.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [treeRes, cadernosRes] = await Promise.all([
          fetch('/api/knowledge/tree'),
          fetch('/api/cadernos'),
        ]);
        if (!treeRes.ok || !cadernosRes.ok) throw new Error();
        const treeData = (await treeRes.json()) as AreaNode[];
        const cadernosData = (await cadernosRes.json()) as Caderno[];
        if (cancelled) return;
        setTree(treeData);
        setCadernos(cadernosData);

        // Restore the persisted selection and target notebook.
        const storedSelection = localStorage.getItem(SELECTION_KEY);
        if (storedSelection !== null) {
          const ids = JSON.parse(storedSelection) as string[];
          setSelected(new Set(ids));
        }
        const storedTarget = localStorage.getItem(TARGET_KEY);
        if (storedTarget !== null && cadernosData.some((c) => c.id === storedTarget)) {
          setTargetCadernoId(storedTarget);
        } else if (cadernosData.length > 0) {
          setTargetCadernoId(cadernosData[0]?.id ?? '');
        }
      } catch {
        if (!cancelled) setLoadError(t('treeError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // When the target notebook changes, fetch its rules to mark the ones already
  // present (they are not selectable and not double-added).
  useEffect(() => {
    if (targetCadernoId === '') {
      setAlreadyInNotebook(new Set());
      return;
    }
    let cancelled = false;
    async function loadNotebookRules() {
      try {
        const res = await fetch(`/api/cadernos/${targetCadernoId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          regras: { regra: { id: string } }[];
        };
        if (!cancelled) {
          setAlreadyInNotebook(new Set(data.regras.map((r) => r.regra.id)));
        }
      } catch {
        // The notebook's rules could not be loaded; treat none as present.
      }
    }
    void loadNotebookRules();
    return () => {
      cancelled = true;
    };
  }, [targetCadernoId]);

  // Persist the selection to localStorage whenever it changes.
  useEffect(() => {
    localStorage.setItem(SELECTION_KEY, JSON.stringify([...selected]));
  }, [selected]);

  // Persist the target notebook to localStorage whenever it changes.
  useEffect(() => {
    if (targetCadernoId !== '') {
      localStorage.setItem(TARGET_KEY, targetCadernoId);
    }
  }, [targetCadernoId]);

  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRegra = (regraId: string): void => {
    if (alreadyInNotebook.has(regraId)) return; // already in the notebook
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(regraId)) next.delete(regraId);
      else next.add(regraId);
      return next;
    });
  };

  const handleAdd = useCallback(async () => {
    if (targetCadernoId === '' || selected.size === 0) return;
    setAdding(true);
    setAddError(null);
    setAddResult(null);
    let added = 0;
    try {
      for (const regraId of selected) {
        const res = await fetch(`/api/cadernos/${targetCadernoId}/regras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regraId }),
        });
        if (res.ok) added += 1;
      }
      setAddResult(added);
      // Clear the selection (the rules are now in the notebook).
      setSelected(new Set());
      // Refresh the "already in notebook" set.
      const res = await fetch(`/api/cadernos/${targetCadernoId}`);
      if (res.ok) {
        const data = (await res.json()) as { regras: { regra: { id: string } }[] };
        setAlreadyInNotebook(new Set(data.regras.map((r) => r.regra.id)));
      }
    } catch {
      setAddError(t('addError'));
    } finally {
      setAdding(false);
    }
  }, [targetCadernoId, selected, t]);

  const renderRegra = (regra: RegraNode): React.ReactNode => {
    const isSelected = selected.has(regra.id);
    const isAlreadyIn = alreadyInNotebook.has(regra.id);
    return (
      <li key={regra.id}>
        <div
          className="group flex items-center gap-1.5 rounded-md py-1 pr-2 hover:bg-muted/50"
          style={{ paddingLeft: '3.75rem' }}
        >
          <span className="size-5 shrink-0" aria-hidden />
          <span className="shrink-0 text-text-secondary">
            <FileText aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
            {regra.pergunta}
          </span>
          {isAlreadyIn ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
              <Check aria-hidden className="size-3.5" />
              {t('alreadyInNotebook')}
            </span>
          ) : (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {
                toggleRegra(regra.id);
              }}
              aria-label={regra.pergunta}
              className="size-4 shrink-0 rounded border-border text-primary focus-visible:outline-none"
            />
          )}
        </div>
      </li>
    );
  };

  const renderTopico = (topico: TopicoNode): React.ReactNode => {
    const isExpanded = expanded.has(topico.id);
    return (
      <li key={topico.id}>
        <div
          className="group flex items-center gap-1.5 rounded-md py-1 pr-2 hover:bg-muted/50"
          style={{ paddingLeft: '2.5rem' }}
        >
          <button
            type="button"
            onClick={() => {
              toggle(topico.id);
            }}
            aria-label={isExpanded ? t('collapse') : t('expand')}
            aria-expanded={isExpanded}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden className="size-4" />
            ) : (
              <ChevronRight aria-hidden className="size-4" />
            )}
          </button>
          <span className="shrink-0 text-text-secondary">
            <Tags aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{topico.nome}</span>
        </div>
        {isExpanded && (
          <ul className="flex flex-col gap-0.5">
            {topico.regras.length === 0 ? (
              <li className="py-1 text-sm text-text-secondary" style={{ paddingLeft: '3.75rem' }}>
                {t('noChildren')}
              </li>
            ) : (
              topico.regras.map((regra) => renderRegra(regra))
            )}
          </ul>
        )}
      </li>
    );
  };

  const renderDisciplina = (disciplina: DisciplinaNode): React.ReactNode => {
    const isExpanded = expanded.has(disciplina.id);
    return (
      <li key={disciplina.id}>
        <div
          className="group flex items-center gap-1.5 rounded-md py-1 pr-2 hover:bg-muted/50"
          style={{ paddingLeft: '1.25rem' }}
        >
          <button
            type="button"
            onClick={() => {
              toggle(disciplina.id);
            }}
            aria-label={isExpanded ? t('collapse') : t('expand')}
            aria-expanded={isExpanded}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden className="size-4" />
            ) : (
              <ChevronRight aria-hidden className="size-4" />
            )}
          </button>
          <span className="shrink-0 text-text-secondary">
            <BookOpen aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
            {disciplina.nome}
          </span>
        </div>
        {isExpanded && (
          <ul className="flex flex-col gap-0.5">
            {disciplina.topicos.length === 0 ? (
              <li className="py-1 text-sm text-text-secondary" style={{ paddingLeft: '2.5rem' }}>
                {t('noChildren')}
              </li>
            ) : (
              disciplina.topicos.map((topico) => renderTopico(topico))
            )}
          </ul>
        )}
      </li>
    );
  };

  const renderArea = (area: AreaNode): React.ReactNode => {
    const isExpanded = expanded.has(area.id);
    return (
      <li key={area.id}>
        <div className="group flex items-center gap-1.5 rounded-md py-1 pr-2 hover:bg-muted/50">
          <button
            type="button"
            onClick={() => {
              toggle(area.id);
            }}
            aria-label={isExpanded ? t('collapse') : t('expand')}
            aria-expanded={isExpanded}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden className="size-4" />
            ) : (
              <ChevronRight aria-hidden className="size-4" />
            )}
          </button>
          <span className="shrink-0 text-text-secondary">
            <FolderOpen aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{area.nome}</span>
        </div>
        {isExpanded && (
          <ul className="flex flex-col gap-0.5">
            {area.disciplinas.length === 0 ? (
              <li className="py-1 text-sm text-text-secondary" style={{ paddingLeft: '1.25rem' }}>
                {t('noChildren')}
              </li>
            ) : (
              area.disciplinas.map((disciplina) => renderDisciplina(disciplina))
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
      <h2 className="text-base font-semibold text-text-primary">{t('builderTitle')}</h2>
      <p className="text-sm text-text-secondary">{t('builderDescription')}</p>

      {/* Target notebook selector. */}
      <label className="flex flex-col gap-1 text-sm text-text-secondary">
        {t('targetNotebook')}
        <select
          value={targetCadernoId}
          onChange={(e) => {
            setTargetCadernoId(e.target.value);
          }}
          className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
        >
          {cadernos.length === 0 && <option value="">{t('noNotebooks')}</option>}
          {cadernos.map((caderno) => (
            <option key={caderno.id} value={caderno.id}>
              {caderno.nome}
            </option>
          ))}
        </select>
      </label>

      {/* The selection summary and the add button. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-text-secondary">
          {t('selectedCount', { count: selected.size })}
        </span>
        <Button
          onClick={() => void handleAdd()}
          disabled={adding || selected.size === 0 || targetCadernoId === ''}
        >
          {adding ? t('adding') : t('addToNotebook')}
        </Button>
      </div>

      {addResult !== null && (
        <p className="text-sm text-primary">{t('addComplete', { count: addResult })}</p>
      )}
      {addError !== null && (
        <p role="alert" className="text-sm text-error">
          {addError}
        </p>
      )}

      {/* The knowledge tree with checkboxes on the regras. */}
      {loading && <p className="text-sm text-text-secondary">{t('treeLoading')}</p>}
      {loadError !== null && (
        <p role="alert" className="text-sm text-error">
          {loadError}
        </p>
      )}
      {!loading && loadError === null && tree.length > 0 && (
        <ul className="flex flex-col gap-0.5">{tree.map((area) => renderArea(area))}</ul>
      )}
    </section>
  );
}
