import { getTranslations } from 'next-intl/server';
import { Flame, Target, Brain, Clock, CircleDashed } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { buildUserStats } from '@/lib/user-stats';

// User content (issue #62). The data-dependent part of the User page, split out
// so it can suspend inside a <Suspense> boundary: while the Prisma queries are
// in flight, the page shows the UserSkeleton; when the data resolves, this
// streams in the learner's profile + their own statistics. V1 is single-user
// with no auth (AD-01): resolve the one bootstrap user. The per-graph statistics
// dashboard is added in #61 on top of this base.
export async function UserContent() {
  const t = await getTranslations('User');

  const usuario = await prisma.usuario.findFirst({ orderBy: { id: 'asc' } });
  const stats = usuario ? await buildUserStats(usuario.id) : null;

  if (stats === null) {
    return <p className="text-base text-text-secondary">{t('noUser')}</p>;
  }

  const stages = [
    {
      key: 'longTerm' as const,
      label: t('stageLongTerm'),
      value: stats.longTerm,
      icon: Brain,
      tone: 'text-primary',
    },
    {
      key: 'recent' as const,
      label: t('stageRecent'),
      value: stats.recent,
      icon: Clock,
      tone: 'text-accent',
    },
    {
      key: 'notLearned' as const,
      label: t('stageNotLearned'),
      value: stats.notLearned,
      icon: CircleDashed,
      tone: 'text-text-secondary',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Learner profile + gamification widgets. */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-text-primary">{stats.nome}</span>
        </div>
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-2"
            role="img"
            aria-label={t('streakAria', { days: stats.ofensivaAtual })}
          >
            <Flame className="size-6 shrink-0 text-accent" aria-hidden />
            <span className="text-base font-semibold text-text-primary">
              {t('streakDays', { days: stats.ofensivaAtual })}
            </span>
          </div>
          <div
            className="flex items-center gap-2"
            role="img"
            aria-label={t('goalAria', { done: stats.revisadasHoje, goal: stats.metaDiaria })}
          >
            <Target className="size-6 shrink-0 text-primary" aria-hidden />
            <span className="text-base font-semibold text-text-primary">
              {t('goalProgress', { done: stats.revisadasHoje, goal: stats.metaDiaria })}
            </span>
          </div>
        </div>
      </header>

      {/* Memory-stage breakdown: how much of the learner's content is in
          long-term memory, recent memory, or not yet learned. */}
      <section aria-labelledby="memory-stages-heading" className="flex flex-col gap-4">
        <h2 id="memory-stages-heading" className="text-lg font-semibold text-text-primary">
          {t('memoryStagesTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <article
                key={stage.key}
                className="flex flex-col gap-2 rounded-xl bg-bg-secondary p-5 ring-1 ring-foreground/10"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`size-5 shrink-0 ${stage.tone}`} aria-hidden />
                  <span className="text-sm font-medium text-text-secondary">{stage.label}</span>
                </div>
                <span className="text-3xl font-semibold text-text-primary">
                  {String(stage.value)}
                </span>
              </article>
            );
          })}
        </div>
        <p className="text-sm text-text-secondary">
          {t('totalRules', { count: stats.totalRegras })}
        </p>
      </section>
    </div>
  );
}
