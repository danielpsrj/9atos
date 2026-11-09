'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ProgressRingProps {
  /** 0–100: the target fill percentage. */
  percentage: number;
  /** Diameter of the ring in px (default 72). */
  size?: number;
  /** Stroke width in px (default 8). */
  strokeWidth?: number;
  /** Accessible label describing what the ring measures. */
  label: string;
}

// Animated SVG progress ring (issue #33, spec §5.2). A client component: it
// sweeps from 0 to the target percentage on first render using a CSS transition
// on stroke-dashoffset. The sapphire token (--primary, #64ffda) is the binding
// ring color. The global prefers-reduced-motion rule (globals.css) collapses the
// transition to ~0ms, so reduced-motion users see the final value instantly.
export function ProgressRing({ percentage, size = 72, strokeWidth = 8, label }: ProgressRingProps) {
  const t = useTranslations('Overview');
  // Start empty (0%) and sweep to the target after mount.
  const [fill, setFill] = useState(0);
  useEffect(() => {
    // Double rAF so the initial 0% paints before the transition begins; a
    // single frame can be coalesced and skip the animation.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setFill(percentage);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [percentage]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fill / 100);
  const center = t('ringPercent', { percent: Math.round(percentage) });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      {/* Track: a faint full circle behind the progress arc. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--bg-primary)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc: sapphire, rotated -90deg so it starts at 12 o'clock. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
        style={{
          transition: 'stroke-dashoffset var(--duration-slow) var(--ease-entrance)',
        }}
      />
      {/* Center percentage readout. */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-text-primary text-sm font-semibold"
      >
        {center}
      </text>
    </svg>
  );
}
