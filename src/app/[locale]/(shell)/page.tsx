import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Flame, Target } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { buildDashboard } from '@/lib/dashboard';

// Overview / dashboard (issue #32, FR-10, FR-12). A server component that
// builds the dashboard payload in one pass (no client fan-out) and renders the
// Screen 1 header: the "Overview" title plus the gamification widget (gold
// flame + current streak) and the goal widget (target + today's progress
// against the configured daily goal). The notebook grid (#33) and the
// first-run state (#35) render below this header.
export default async function OverviewPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Overview');

  // V1 is single-user with no auth (AD-01): resolve the one bootstrap user and
  // build the dashboard. When no user is provisioned the widgets show zeros
  // rather than failing the page (the seed creates the bootstrap user).
  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  const dashboard = usuario ? await buildDashboard(usuario.id) : null;
  const ofensivaAtual = dashboard?.ofensivaAtual ?? 0;
  const revisadasHoje = dashboard?.revisadasHoje ?? 0;
  const metaDiaria = dashboard?.metaDiaria ?? 0;

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
    </div>
  );
}
