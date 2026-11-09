'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';

// First-run / onboarding screen (issue #35, FR-13, FR-14, spec §5.2). Shown
// instead of the notebook grid when the user has zero notebooks. Explains what
// 9Atos is and offers two paths forward: import your own data (CSV/JSON — the
// import flow lands in Phase 8, so this CTA links to the Knowledge Base where
// it will live) or use the seeded sample notebook (creates it via
// /api/cadernos/from-seed and refreshes so the grid appears). A client
// component because the "use sample data" action POSTs and refreshes.
export function OnboardingScreen() {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createSampleNotebook() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/cadernos/from-seed', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? t('seedError'));
        return;
      }
      // Success: re-run the server component so the new notebook appears in the
      // grid and this onboarding screen disappears.
      router.refresh();
    } catch {
      setError(t('seedError'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-border bg-bg-secondary/40 px-6 py-16 text-center">
      <h2 className="text-xl font-semibold text-text-primary">{t('title')}</h2>
      <p className="max-w-xl text-base text-text-secondary">{t('description')}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Import CTA: links to the Knowledge Base, where the CSV/JSON import
            flow will land in Phase 8 (#45–#47). */}
        <Button asChild variant="outline">
          <Link href="/knowledge">
            <Upload aria-hidden />
            {t('importCta')}
          </Link>
        </Button>
        <span className="self-center text-xs text-text-secondary sm:self-auto">
          {t('importHint')}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button onClick={() => void createSampleNotebook()} disabled={working}>
          <Sparkles aria-hidden />
          {working ? t('seedWorking') : t('seedCta')}
        </Button>
        {error !== null && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
