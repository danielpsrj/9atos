import { getTranslations } from 'next-intl/server';
import { Brain, Clock, CircleDashed, BarChart3 } from 'lucide-react';
import { buildNotebookStats, type NotebookStats } from '@/lib/notebook-stats';
import { MemoryStageGraph } from '@/components/statistics/memory-stage-graph';
import { GamePlaysGraph } from '@/components/statistics/game-plays-graph';
import { GameUsageGraph } from '@/components/statistics/game-usage-graph';

// Notebook statistics content (issue #61). The data-dependent part of the
// per-notebook statistics screen, split out so it can suspend inside a
// <Suspense> boundary: while the statistics query is in flight, the page shows
// the NotebookStatsSkeleton; when the data resolves, this streams in the
// dashboard. The dashboard is a layout with a slot per graph: the memory-stage
// breakdown (the headline graph) first, then the per-game graphs (correct/wrong
// per play, and usage with a selectable day window).
export async function NotebookStatsContent({ cadernoId }: Readonly<{ cadernoId: string }>) {
  const t = await getTranslations('Statistics');
  let stats: NotebookStats;
  try {
    stats = await buildNotebookStats(cadernoId);
  } catch {
    return (
      <p role="alert" className="py-16 text-center text-base text-error">
        {t('loadError')}
      </p>
    );
  }

  const stages = [
    {
      key: 'longTerm' as const,
      label: t('stageLongTerm'),
      value: stats.memoryStages.longTerm,
      icon: Brain,
      tone: 'text-primary',
    },
    {
      key: 'recent' as const,
      label: t('stageRecent'),
      value: stats.memoryStages.recent,
      icon: Clock,
      tone: 'text-accent',
    },
    {
      key: 'notLearned' as const,
      label: t('stageNotLearned'),
      value: stats.memoryStages.notLearned,
      icon: CircleDashed,
      tone: 'text-text-secondary',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Headline graph: the memory-stage breakdown. */}
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
        <MemoryStageGraph stats={stats} />
      </section>

      {/* Per-game graphs: correct/wrong per play, and usage with a day window. */}
      <section aria-labelledby="games-heading" className="flex flex-col gap-4">
        <h2
          id="games-heading"
          className="flex items-center gap-2 text-lg font-semibold text-text-primary"
        >
          <BarChart3 aria-hidden className="size-5 text-primary" />
          {t('gamesTitle')}
        </h2>
        <GamePlaysGraph games={stats.games} />
        <GameUsageGraph games={stats.games} />
      </section>
    </div>
  );
}
