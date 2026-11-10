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
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HierarchyDialog, type HierarchyLevel } from '@/components/knowledge/hierarchy-dialog';
import { RuleEditor } from '@/components/knowledge/rule-editor';

// Knowledge tree browser (issue #46, FR-01). Renders the full hierarchy
// (Area → Disciplina → Topico → Regra) expandable at every level, with
// create/edit/delete at each of the four levels. The rule editor (with the
// distractor list editor) opens for Regra nodes. All operations round-trip
// through the 4.3 CRUD routes; the tree refetches after every mutation.

interface RegraNode {
  id: string;
  pergunta: string;
  respostaCerta: string;
  justificativa: string | null;
  dica: string | null;
  distratores: string[];
  nivelDificuldade: number;
  probabilidade: number | null;
}

interface TopicoNode {
  id: string;
  nome: string;
  regras: RegraNode[];
}

interface DisciplinaNode {
  id: string;
  nome: string;
  iconeUrl: string | null;
  corHex: string | null;
  topicos: TopicoNode[];
}

interface AreaNode {
  id: string;
  nome: string;
  disciplinas: DisciplinaNode[];
}

type DialogState =
  | {
      kind: 'hierarchy';
      level: HierarchyLevel;
      mode: 'create' | 'edit';
      existingId?: string;
      parentId?: string;
      initialNome?: string;
      initialIconeUrl?: string | null;
      initialCorHex?: string | null;
    }
  | {
      kind: 'regra';
      mode: 'create' | 'edit';
      existingId?: string;
      parentId?: string;
      initialPergunta?: string;
      initialRespostaCerta?: string;
      initialJustificativa?: string | null;
      initialDica?: string | null;
      initialDistratores?: string[];
      initialNivelDificuldade?: number;
      initialProbabilidade?: number | null;
    };

interface DeleteState {
  url: string;
  label: string;
  nome: string;
}

export function KnowledgeTree() {
  const t = useTranslations('Knowledge');

  const [tree, setTree] = useState<AreaNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/knowledge/tree');
      if (!res.ok) throw new Error();
      setTree((await res.json()) as AreaNode[]);
    } catch {
      setLoadError(t('treeError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = async (): Promise<void> => {
    if (deleteState === null) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(deleteState.url, { method: 'DELETE' });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        if (errBody?.error?.code === 'CONFLICT') {
          setDeleteError(t('deleteConflict'));
        } else {
          setDeleteError(t('deleteError', { message: errBody?.error?.message ?? '' }));
        }
        return;
      }
      setDeleteState(null);
      await loadTree();
    } catch {
      setDeleteError(t('deleteError', { message: '' }));
    } finally {
      setDeleting(false);
    }
  };

  // Render a single node row (icon, name, actions) plus its children when
  // expanded. `depth` controls the indentation.
  const renderNode = (
    id: string,
    nome: string,
    icon: React.ReactNode,
    depth: number,
    hasChildren: boolean,
    actions: React.ReactNode,
    children: React.ReactNode,
  ): React.ReactNode => {
    const isExpanded = expanded.has(id);
    return (
      <li key={id}>
        <div
          className="group flex items-center gap-1.5 rounded-md py-1 pr-2 hover:bg-muted/50"
          style={{ paddingLeft: `${String(depth * 1.25)}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => {
                toggle(id);
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
          ) : (
            <span className="size-5 shrink-0" aria-hidden />
          )}
          <span className="shrink-0 text-text-secondary">{icon}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{nome}</span>
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {actions}
          </span>
        </div>
        {hasChildren && isExpanded && <ul className="flex flex-col gap-0.5">{children}</ul>}
      </li>
    );
  };

  const actionButtons = (
    createAction: { label: string; onClick: () => void } | null,
    onEdit: () => void,
    onDelete: () => void,
  ): React.ReactNode => (
    <>
      {createAction !== null && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={createAction.onClick}
          aria-label={createAction.label}
        >
          <Plus aria-hidden />
        </Button>
      )}
      <Button type="button" variant="ghost" size="icon-xs" onClick={onEdit} aria-label={t('edit')}>
        <Pencil aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onDelete}
        aria-label={t('delete')}
      >
        <Trash2 aria-hidden />
      </Button>
    </>
  );

  const renderRegra = (regra: RegraNode): React.ReactNode =>
    renderNode(
      regra.id,
      regra.pergunta,
      <FileText aria-hidden className="size-4" />,
      3,
      false,
      actionButtons(
        null,
        () => {
          setDialog({
            kind: 'regra',
            mode: 'edit',
            existingId: regra.id,
            initialPergunta: regra.pergunta,
            initialRespostaCerta: regra.respostaCerta,
            initialJustificativa: regra.justificativa,
            initialDica: regra.dica,
            initialDistratores: regra.distratores,
            initialNivelDificuldade: regra.nivelDificuldade,
            initialProbabilidade: regra.probabilidade,
          });
        },
        () => {
          setDeleteState({
            url: `/api/regras/${regra.id}`,
            label: t('regraLabel'),
            nome: regra.pergunta,
          });
        },
      ),
      null,
    );

  const renderTopico = (topico: TopicoNode): React.ReactNode =>
    renderNode(
      topico.id,
      topico.nome,
      <Tags aria-hidden className="size-4" />,
      2,
      true,
      actionButtons(
        {
          label: t('newRegra'),
          onClick: () => {
            setDialog({
              kind: 'regra',
              mode: 'create',
              parentId: topico.id,
            });
          },
        },
        () => {
          setDialog({
            kind: 'hierarchy',
            level: 'topico',
            mode: 'edit',
            existingId: topico.id,
            initialNome: topico.nome,
          });
        },
        () => {
          setDeleteState({
            url: `/api/topicos/${topico.id}`,
            label: t('topicoLabel'),
            nome: topico.nome,
          });
        },
      ),
      topico.regras.length === 0 ? (
        <li className="py-1 text-sm text-text-secondary" style={{ paddingLeft: '3.75rem' }}>
          {t('noChildren')}
        </li>
      ) : (
        topico.regras.map((regra) => renderRegra(regra))
      ),
    );

  const renderDisciplina = (disciplina: DisciplinaNode): React.ReactNode =>
    renderNode(
      disciplina.id,
      disciplina.nome,
      <BookOpen aria-hidden className="size-4" />,
      1,
      true,
      actionButtons(
        {
          label: t('newTopico'),
          onClick: () => {
            setDialog({
              kind: 'hierarchy',
              level: 'topico',
              mode: 'create',
              parentId: disciplina.id,
            });
          },
        },
        () => {
          setDialog({
            kind: 'hierarchy',
            level: 'disciplina',
            mode: 'edit',
            existingId: disciplina.id,
            initialNome: disciplina.nome,
            initialIconeUrl: disciplina.iconeUrl,
            initialCorHex: disciplina.corHex,
          });
        },
        () => {
          setDeleteState({
            url: `/api/disciplinas/${disciplina.id}`,
            label: t('disciplinaLabel'),
            nome: disciplina.nome,
          });
        },
      ),
      disciplina.topicos.length === 0 ? (
        <li className="py-1 text-sm text-text-secondary" style={{ paddingLeft: '2.5rem' }}>
          {t('noChildren')}
        </li>
      ) : (
        disciplina.topicos.map((topico) => renderTopico(topico))
      ),
    );

  const renderArea = (area: AreaNode): React.ReactNode =>
    renderNode(
      area.id,
      area.nome,
      <FolderOpen aria-hidden className="size-4" />,
      0,
      true,
      actionButtons(
        {
          label: t('newDisciplina'),
          onClick: () => {
            setDialog({
              kind: 'hierarchy',
              level: 'disciplina',
              mode: 'create',
              parentId: area.id,
            });
          },
        },
        () => {
          setDialog({
            kind: 'hierarchy',
            level: 'area',
            mode: 'edit',
            existingId: area.id,
            initialNome: area.nome,
          });
        },
        () => {
          setDeleteState({
            url: `/api/areas/${area.id}`,
            label: t('areaLabel'),
            nome: area.nome,
          });
        },
      ),
      area.disciplinas.length === 0 ? (
        <li className="py-1 text-sm text-text-secondary" style={{ paddingLeft: '1.25rem' }}>
          {t('noChildren')}
        </li>
      ) : (
        area.disciplinas.map((disciplina) => renderDisciplina(disciplina))
      ),
    );

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">{t('treeTitle')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDialog({ kind: 'hierarchy', level: 'area', mode: 'create' });
          }}
        >
          <Plus aria-hidden />
          {t('newArea')}
        </Button>
      </div>

      {loading && <p className="text-sm text-text-secondary">{t('treeLoading')}</p>}
      {loadError !== null && (
        <p role="alert" className="text-sm text-error">
          {loadError}
        </p>
      )}
      {!loading && loadError === null && tree.length === 0 && (
        <p className="text-sm text-text-secondary">{t('treeEmpty')}</p>
      )}
      {!loading && loadError === null && tree.length > 0 && (
        <ul className="flex flex-col gap-0.5">{tree.map((area) => renderArea(area))}</ul>
      )}

      {dialog?.kind === 'hierarchy' && (
        <HierarchyDialog
          level={dialog.level}
          mode={dialog.mode}
          existingId={dialog.existingId}
          parentId={dialog.parentId}
          initialNome={dialog.initialNome}
          initialIconeUrl={dialog.initialIconeUrl}
          initialCorHex={dialog.initialCorHex}
          onClose={() => {
            setDialog(null);
          }}
          onSaved={() => void loadTree()}
        />
      )}
      {dialog?.kind === 'regra' && (
        <RuleEditor
          mode={dialog.mode}
          parentId={dialog.parentId}
          existingId={dialog.existingId}
          initialPergunta={dialog.initialPergunta}
          initialRespostaCerta={dialog.initialRespostaCerta}
          initialJustificativa={dialog.initialJustificativa}
          initialDica={dialog.initialDica}
          initialDistratores={dialog.initialDistratores}
          initialNivelDificuldade={dialog.initialNivelDificuldade}
          initialProbabilidade={dialog.initialProbabilidade}
          onClose={() => {
            setDialog(null);
          }}
          onSaved={() => void loadTree()}
        />
      )}

      {deleteState !== null && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteState(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('deleteConfirmTitle', { label: deleteState.label })}</DialogTitle>
              <DialogDescription>{t('deleteConfirmBody')}</DialogDescription>
            </DialogHeader>
            <p className="truncate rounded-md bg-muted px-3 py-2 text-sm text-text-secondary">
              {deleteState.nome}
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
                  setDeleteState(null);
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
