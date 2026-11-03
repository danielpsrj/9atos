// Demo page for the Sapphire & Gold Abyss design tokens (issue #27). Renders
// each of the seven tokens visibly so the palette can be verified by eye. This
// is a verification surface, not a feature screen.

interface TokenSwatch {
  name: string;
  hex: string;
  /** The Tailwind background utility for the token. */
  bgClass: string;
  /** Text color that reads on the swatch (light or dark). */
  labelClass: string;
}

const TOKENS: TokenSwatch[] = [
  { name: 'bg-primary', hex: '#0A192F', bgClass: 'bg-bg-primary', labelClass: 'text-text-primary' },
  {
    name: 'bg-secondary',
    hex: '#112240',
    bgClass: 'bg-bg-secondary',
    labelClass: 'text-text-primary',
  },
  { name: 'primary', hex: '#64FFDA', bgClass: 'bg-primary', labelClass: 'text-bg-primary' },
  { name: 'accent', hex: '#FBBF24', bgClass: 'bg-accent', labelClass: 'text-bg-primary' },
  {
    name: 'text-primary',
    hex: '#CCD6F6',
    bgClass: 'bg-text-primary',
    labelClass: 'text-bg-primary',
  },
  {
    name: 'text-secondary',
    hex: '#8892B0',
    bgClass: 'bg-text-secondary',
    labelClass: 'text-bg-primary',
  },
  { name: 'error', hex: '#F87171', bgClass: 'bg-error', labelClass: 'text-bg-primary' },
];

export default function ThemeDemoPage() {
  return (
    <main className="min-h-screen bg-bg-primary p-8 text-text-primary">
      <h1 className="text-2xl font-semibold text-primary">
        Sapphire &amp; Gold Abyss — token demo
      </h1>
      <p className="mt-2 max-w-prose text-base text-text-secondary">
        Each swatch shows a design token as a Tailwind utility. Hex values are binding (NFR-05).
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-text-primary">Color tokens</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {TOKENS.map((token) => (
            <div
              key={token.name}
              className={`h-28 rounded-lg ${token.bgClass} p-4 ${token.labelClass}`}
            >
              <div className="font-mono text-sm">{token.name}</div>
              <div className="mt-1 font-mono text-xs opacity-80">{token.hex}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-text-primary">Type scale (plan §2.4)</h2>
        <div className="mt-4 space-y-2">
          <p className="text-base">Body — text-base (16 px), line-height 1.5</p>
          <p className="text-lg">Questions — text-lg</p>
          <p className="text-xl">Card titles — text-xl</p>
          <p className="text-2xl">Dashboard headings — text-2xl</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-text-primary">Animation tokens</h2>
        <p className="mt-2 text-base text-text-secondary">
          fast 150 ms · base 250 ms · slow 300 ms; ease-out entrances, ease-in exits. Non-essential
          animation is disabled under <code className="text-primary">prefers-reduced-motion</code>.
        </p>
        <div className="mt-4 flex gap-4">
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-bg-primary">
            Primary button
          </button>
          <button type="button" className="rounded-md bg-accent px-4 py-2 text-bg-primary">
            Accent button
          </button>
        </div>
      </section>
    </main>
  );
}
