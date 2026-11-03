import Link from 'next/link';

// Placeholder home. The real dashboard (Phase 6) replaces this. For now it
// links to the design-token demo page so the theme can be verified.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-primary p-8 text-text-primary">
      <h1 className="text-2xl font-semibold text-primary">9Atos</h1>
      <p className="text-base text-text-secondary">Gamified spaced-repetition study app.</p>
      <Link
        href="/theme"
        className="rounded-md bg-primary px-4 py-2 text-bg-primary transition-colors hover:opacity-90"
      >
        View design tokens
      </Link>
    </main>
  );
}
