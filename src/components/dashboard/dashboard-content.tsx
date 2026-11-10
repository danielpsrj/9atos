import { getTranslations } from 'next-intl/server';
import { Flame, Target } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { buildDashboard } from '@/lib/dashboard';
import { NotebookGrid } from '@/components/dashboard/notebook-grid';
import { NewNotebookDialog } from '@/components/dashboard/new-notebook-dialog';
import { OnboardingScreen } from '@/components/dashboard/onboarding-screen';

// Dashboard content (issue #49, NFR-07). The data-dependent part of the
// Overview page, split out from page.tsx so it can suspend inside a <Suspense>
// boundary: while the Prisma queries are in flight, page.tsx shows the
// DashboardSkeleton (matching dimensions, zero layout shift); when the data
// resolves, this component streams in the real header + notebook grid.
// V1 is single-user with no auth (AD-01): resolve the one bootstrap user and
// build the dashboard. When no user is provisioned the widgets show zeros
// rather than failing the page (the seed creates the bootstrap user).
export async function DashboardContent() {
  const t = await getTranslations('Overview');

  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  const dashboard = usuario ? await buildDashboard(usuario.id) : null;
  const ofensivaAtual = dashboard?.ofensivaAtual ?? 0;
  const revisadasHoje = dashboard?.revisadasHoje ?? 0;
  const metaDiaria = dashboard?.metaDiaria ?? 0;
  const cadernos = dashboard?.cadernos ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Screen 1 header (spec §5.2): title left, gamification + goal widgets
          right. Wraps on narrow screens so the widgets stay reachable. */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold text-text-primary">{t('title')}</h1>
        <div className="flex items-center gap-6">
          {/* Gamification widget: gold flame + current streak (AD-05). */}
          <div
            className="flex items-center gap-2"
            role="img"
            aria-label={t('streakAria', { days: ofensivaAtual })}
          >
            <Flame className="size-6 shrink-0 text-accent" aria-hidden />
            <span className="text-base font-semibold text-text-primary">
              {t('streakDays', { days: ofensivaAtual })}
            </span>
          </div>
          {/* Goal widget: target + today's progress vs. the daily goal (AD-06). */}
          <div
            className="flex items-center gap-2"
            role="img"
            aria-label={t('goalAria', { done: revisadasHoje, goal: metaDiaria })}
          >
            <Target className="size-6 shrink-0 text-primary" aria-hidden />
            <span className="text-base font-semibold text-text-primary">
              {t('goalProgress', { done: revisadasHoje, goal: metaDiaria })}
            </span>
          </div>
        </div>
      </header>

      {/* First run (0 notebooks): the onboarding screen replaces the grid
          (issue #35). It explains 9Atos and offers import / sample-data CTAs.
          Once a notebook exists, the "Your Notebooks" grid + New Notebook
          dialog take over (issues #33/#34). */}
      {cadernos.length === 0 ? (
        <OnboardingScreen />
      ) : (
        <section aria-labelledby="notebooks-heading" className="flex flex-col gap-4">
          {/* Section header: title left, "New Notebook" dialog trigger right. */}
          <div className="flex items-center justify-between gap-4">
            <h2 id="notebooks-heading" className="text-lg font-semibold text-text-primary">
              {t('notebooksTitle')}
            </h2>
            <NewNotebookDialog />
          </div>
          <NotebookGrid cadernos={cadernos} />
        </section>
      )}
    </div>
  );
}
