import { useTranslations } from 'next-intl';
import type { NotebookStats } from '@/lib/notebook-stats';

// Memory-stage donut graph (issue #61). A pure-SVG donut showing the share of
// the notebook's rules in long-term memory, recent memory, and not-learned. No
// external chart library — a single <svg> with three arc segments, the colors
// from the design tokens (sapphire / gold / muted). A presentational component:
// the data comes from the NotebookStatsContent server component.
interface MemoryStageGraphProps {
  stats: NotebookStats;
}

const SEGMENTS = [
  { key: 'longTerm' as const, color: 'var(--primary)', labelKey: 'stageLongTerm' },
  { key: 'recent' as const, color: 'var(--accent)', labelKey: 'stageRecent' },
  { key: 'notLearned' as const, color: 'var(--text-secondary)', labelKey: 'stageNotLearned' },
] as const;

export function MemoryStageGraph({ stats }: MemoryStageGraphProps) {
  const t = useTranslations('Statistics');
  const { longTerm, recent, notLearned, total } = stats.memoryStages;
  const values = [longTerm, recent, notLearned];
  const sum = values.reduce((a, b) => a + b, 0);

  // Build the donut arcs. Each segment is a stroke on a circle; the dasharray
  // controls the arc length. We accumulate the offset as we go.
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = SEGMENTS.map((segment, i) => {
    const value = values[i] ?? 0;
    const fraction = sum === 0 ? 0 : value / sum;
    const dash = fraction * circumference;
    const arc = { ...segment, dash, gap: circumference - dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        role="img"
        aria-label={t('donutAria', {
          longTerm: String(longTerm),
          recent: String(recent),
          notLearned: String(notLearned),
        })}
      >
        <g transform="rotate(-90 80 80)">
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth="24"
              strokeDasharray={`${String(arc.dash)} ${String(arc.gap)}`}
              strokeDashoffset={String(-arc.offset)}
            />
          ))}
        </g>
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="fill-text-primary text-2xl font-semibold"
        >
          {String(total)}
        </text>
        <text x="80" y="96" textAnchor="middle" className="fill-text-secondary text-xs">
          {t('totalRules', { count: total })}
        </text>
      </svg>
      <ul className="flex flex-col gap-2">
        {SEGMENTS.map((segment, i) => (
          <li key={segment.key} className="flex items-center gap-2 text-sm">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden
            />
            <span className="text-text-secondary">{t(segment.labelKey)}</span>
            <span className="font-semibold text-text-primary">{String(values[i] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
