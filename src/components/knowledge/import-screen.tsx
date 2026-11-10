'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, FileWarning, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ParsedRegra, LineError } from '@/lib/ingestion/parser';

// Import screen (issue #45, FR-13, plan §2.4). The user-facing import flow:
// upload a CSV/JSON file, preview the parsed rows (flagging rejected rows with
// their line-level errors), choose a target Topico, and confirm the bulk
// insert. Enforces the import limits (max 5 MB, max 10,000 rows) — the size
// limit is checked client-side before sending, and both limits are re-checked
// server-side. Progress feedback (an indeterminate indicator) is shown during
// the preview and the insert so the UI never freezes on large files.
interface PreviewResult {
  regras: ParsedRegra[];
  errors: LineError[];
  warnings: string[];
  rowCount: number;
}

interface ImportResult {
  inserted: number;
  errors: LineError[];
  warnings: string[];
  rowCount: number;
}

interface TopicoOption {
  id: string;
  nome: string;
  disciplina: string;
  area: string;
}

// The import size limit (plan §2.4), mirrored client-side so an oversized file
// is rejected before it is sent to the server.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function ImportScreen() {
  const t = useTranslations('Import');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [topicos, setTopicos] = useState<TopicoOption[]>([]);
  const [topicoId, setTopicoId] = useState('');

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Load the available topicos for the target selector.
  useEffect(() => {
    let cancelled = false;
    async function loadTopicos() {
      try {
        const res = await fetch('/api/topicos');
        if (!res.ok) return;
        const data = (await res.json()) as TopicoOption[];
        if (!cancelled) {
          setTopicos(data);
          if (data.length > 0) setTopicoId((prev) => prev || (data[0]?.id ?? ''));
        }
      } catch {
        // No topicos available; the selector will be empty.
      }
    }
    void loadTopicos();
    return () => {
      cancelled = true;
    };
  }, []);

  // Read the selected file, check its size, and request the preview.
  const handleFileChange = useCallback(
    async (file: File) => {
      setPreviewError(null);
      setImportResult(null);
      setImportError(null);
      setPreview(null);
      setFileName(file.name);

      // Import limit: max file size (plan §2.4). Checked before sending.
      if (file.size > MAX_IMPORT_BYTES) {
        setPreviewError(t('fileTooLarge'));
        setContent(null);
        return;
      }

      const detectedFormat = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
      setFormat(detectedFormat);

      const text = await file.text();
      setContent(text);
      setParsing(true);
      try {
        const res = await fetch('/api/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text, format: detectedFormat }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          setPreviewError(body?.error?.message ?? t('previewError'));
          return;
        }
        setPreview((await res.json()) as PreviewResult);
      } catch {
        setPreviewError(t('previewError'));
      } finally {
        setParsing(false);
      }
    },
    [t],
  );

  // Confirm the import: bulk-insert the valid rows under the chosen topico.
  const handleConfirm = useCallback(async () => {
    if (content === null || topicoId === '') return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, format, topicoId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setImportError(body?.error?.message ?? t('importError'));
        return;
      }
      setImportResult((await res.json()) as ImportResult);
    } catch {
      setImportError(t('importError'));
    } finally {
      setImporting(false);
    }
  }, [content, format, topicoId, t]);

  return (
    <div className="flex flex-col gap-6">
      {/* Step 1: file upload. */}
      <section className="flex flex-col gap-3 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
        <h2 className="text-base font-semibold text-text-primary">{t('uploadTitle')}</h2>
        <p className="text-sm text-text-secondary">{t('uploadHint')}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            className="sr-only"
            aria-label={t('uploadCta')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file !== undefined) void handleFileChange(file);
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload aria-hidden />
            {t('uploadCta')}
          </Button>
          {fileName !== null && <span className="text-sm text-text-secondary">{fileName}</span>}
        </div>
        {previewError !== null && (
          <p role="alert" className="flex items-center gap-2 text-sm text-error">
            <FileWarning aria-hidden className="size-4" />
            {previewError}
          </p>
        )}
        {parsing && <p className="text-sm text-text-secondary">{t('previewLoading')}</p>}
      </section>

      {/* Step 2: preview (shown once the file is parsed). */}
      {preview !== null && (
        <section className="flex flex-col gap-4 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
          <h2 className="text-base font-semibold text-text-primary">{t('previewTitle')}</h2>

          {/* Warnings (e.g. the distractor-shortage warning). */}
          {preview.warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-sm text-accent"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {warning}
            </p>
          ))}

          {/* Rejected rows with their line-level errors. */}
          {preview.errors.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-error">
                {t('rejectedRows', { count: preview.errors.length })}
              </h3>
              <ul className="flex flex-col gap-1">
                {preview.errors.map((err) => (
                  <li
                    key={`${String(err.line)}-${err.message}`}
                    className="rounded-md bg-error/10 px-3 py-2 text-sm text-error"
                  >
                    {t('lineError', { line: err.line, message: err.message })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The valid rows to be imported. */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-text-primary">
              {t('validRows', { count: preview.regras.length })}
            </h3>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {preview.regras.map((regra, index) => (
                <li
                  key={`${regra.pergunta}-${String(index)}`}
                  className="flex flex-col gap-0.5 rounded-md bg-bg-primary px-3 py-2 text-sm"
                >
                  <span className="text-text-primary">{regra.pergunta}</span>
                  <span className="text-text-secondary">{regra.respostaCerta}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Step 3: choose the target topico and confirm. */}
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              {t('targetTopico')}
              <select
                value={topicoId}
                onChange={(e) => {
                  setTopicoId(e.target.value);
                }}
                className="h-9 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none"
              >
                {topicos.map((topico) => (
                  <option key={topico.id} value={topico.id}>
                    {[topico.area, topico.disciplina, topico.nome].join(t('topicoSeparator'))}
                  </option>
                ))}
              </select>
            </label>
            <Button
              onClick={() => void handleConfirm()}
              disabled={importing || preview.regras.length === 0 || topicoId === ''}
            >
              {importing ? t('importing') : t('confirmImport')}
            </Button>
          </div>
        </section>
      )}

      {/* Step 4: the import result. */}
      {importResult !== null && (
        <section className="flex flex-col gap-3 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10">
          <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
            <CheckCircle2 aria-hidden className="size-5" />
            {t('importComplete', { count: importResult.inserted })}
          </h2>
          {importResult.warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 rounded-lg bg-accent/10 p-3 text-sm text-accent"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {warning}
            </p>
          ))}
          {importResult.errors.length > 0 && (
            <p className="text-sm text-text-secondary">
              {t('skippedRows', { count: importResult.errors.length })}
            </p>
          )}
        </section>
      )}
      {importError !== null && (
        <p role="alert" className="text-sm text-error">
          {importError}
        </p>
      )}
    </div>
  );
}
