// WCAG AA contrast verification (issue #31, NFR-05, spec §5.1).
//
// The seven binding tokens are fixed hex values (NFR-05). This test computes
// the WCAG 2.x contrast ratio for every foreground/background pair the shell
// actually uses and asserts each text pair meets AA (>= 4.5:1). It is the
// living documentation of the contrast ratios: if a token ever changes and a
// pair drops below AA, this test fails and the regression is caught at CI time
// rather than discovered by a screen-reader user.
//
// Ratios (computed, all AA-passing as of #31):
//   text-primary   on bg-primary    12.17:1
//   text-primary   on bg-secondary  10.94:1
//   text-secondary on bg-primary     5.69:1
//   text-secondary on bg-secondary   5.11:1
//   primary        on bg-primary    14.13:1
//   primary        on bg-secondary  12.71:1
//   accent         on bg-primary    10.54:1
//   accent         on bg-secondary   9.48:1
//   error          on bg-secondary   5.72:1
//   bg-primary     on primary       14.13:1  (primary-foreground)
//   bg-primary     on accent        10.54:1  (accent-foreground)

import { describe, expect, it } from 'vitest';

/** The seven binding tokens (spec §5.1). Single source of truth for the test. */
const TOKENS = {
  'bg-primary': '#0a192f',
  'bg-secondary': '#112240',
  primary: '#64ffda',
  accent: '#fbbf24',
  'text-primary': '#ccd6f6',
  'text-secondary': '#8892b0',
  error: '#f87171',
} as const;

type TokenName = keyof typeof TOKENS;

/** Linearize a single srgb channel (0-255) per the WCAG 2.x definition. */
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a #rrggbb color (WCAG 2.x). */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colors, always >= 1. */
function contrast(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [light, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

// Every foreground/background pair the shell renders. `aa` is the threshold:
// 4.5:1 for normal text (AA), 3.0:1 for large text / UI components.
const PAIRS: { fg: TokenName; bg: TokenName; aa: number; note: string }[] = [
  { fg: 'text-primary', bg: 'bg-primary', aa: 4.5, note: 'body text on app background' },
  { fg: 'text-primary', bg: 'bg-secondary', aa: 4.5, note: 'body text on cards/panels' },
  { fg: 'text-secondary', bg: 'bg-primary', aa: 4.5, note: 'hints/labels on app background' },
  { fg: 'text-secondary', bg: 'bg-secondary', aa: 4.5, note: 'hints/labels on cards/panels' },
  { fg: 'primary', bg: 'bg-primary', aa: 4.5, note: 'sapphire links/buttons on app background' },
  { fg: 'primary', bg: 'bg-secondary', aa: 4.5, note: 'sapphire links/buttons on cards/panels' },
  { fg: 'accent', bg: 'bg-primary', aa: 4.5, note: 'gold timers/badges on app background' },
  { fg: 'accent', bg: 'bg-secondary', aa: 4.5, note: 'gold timers/badges on cards/panels' },
  { fg: 'error', bg: 'bg-secondary', aa: 4.5, note: 'error highlights on cards/panels' },
  { fg: 'bg-primary', bg: 'primary', aa: 4.5, note: 'primary-foreground (text on sapphire)' },
  { fg: 'bg-primary', bg: 'accent', aa: 4.5, note: 'accent-foreground (text on gold)' },
];

describe('WCAG AA contrast (issue #31, NFR-05)', () => {
  it.each(PAIRS)('$fg on $bg ($note) meets AA', ({ fg, bg, aa }) => {
    const ratio = contrast(TOKENS[fg], TOKENS[bg]);
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(aa);
  });

  it('documents the exact ratios for the record', () => {
    // Snapshot the ratios so a token change is visible in the diff even when it
    // still passes AA. Values must match the table in the file header.
    const documented: Record<string, number> = {};
    for (const { fg, bg } of PAIRS) {
      documented[`${fg} on ${bg}`] = Number(contrast(TOKENS[fg], TOKENS[bg]).toFixed(2));
    }
    expect(documented).toEqual({
      'text-primary on bg-primary': 12.17,
      'text-primary on bg-secondary': 10.94,
      'text-secondary on bg-primary': 5.69,
      'text-secondary on bg-secondary': 5.11,
      'primary on bg-primary': 14.13,
      'primary on bg-secondary': 12.71,
      'accent on bg-primary': 10.54,
      'accent on bg-secondary': 9.48,
      'error on bg-secondary': 5.72,
      'bg-primary on primary': 14.13,
      'bg-primary on accent': 10.54,
    });
  });
});
