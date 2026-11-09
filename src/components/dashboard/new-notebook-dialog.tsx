'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// "New Notebook" dialog (issue #34, FR-03, spec §5.2). A client component: the
// trigger button opens a Radix dialog (focus trap + Escape-to-close for free)
// with a required name and an optional description. On submit it POSTs to
// /api/cadernos; on success it calls router.refresh() so the server component
// rebuilds the dashboard and the new notebook appears in the grid immediately.
// Empty/whitespace names are blocked client-side (and re-checked server-side).
export function NewNotebookDialog() {
  const t = useTranslations('Overview');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setName('');
    setDescription('');
    setError(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    // Client-side validation: block empty/whitespace names.
    if (name.trim().length === 0) {
      setError(t('nameRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cadernos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: name.trim(),
          descricao: description.trim().length > 0 ? description.trim() : null,
        }),
      });
      if (!res.ok) {
        // Surface the server's error message when present.
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? t('createError'));
        return;
      }
      // Success: refetch the dashboard (re-runs the server component) and close.
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      setError(t('createError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus aria-hidden />
          {t('newNotebook')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notebook-name" className="text-sm font-medium text-text-primary">
              {t('nameLabel')}
            </label>
            <input
              id="notebook-name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder={t('namePlaceholder')}
              required
              aria-invalid={error !== null}
              aria-describedby={error !== null ? 'notebook-name-error' : undefined}
              className="h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none"
            />
            {error !== null && (
              <p id="notebook-name-error" role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notebook-description" className="text-sm font-medium text-text-primary">
              {t('descriptionLabel')}
            </label>
            <input
              id="notebook-description"
              name="description"
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              placeholder={t('descriptionPlaceholder')}
              className="h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('creating') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
