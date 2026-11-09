import { notFound } from 'next/navigation';

// Catch-all for unknown routes within the [locale] segment (issue #30). Next.js
// only renders [locale]/not-found.tsx when notFound() is explicitly called, so
// this catch-all triggers the themed, localized 404 for any unmatched path
// (e.g. /pt-BR/no-such-page). Without it, unknown routes fall through to
// Next.js's default 404.
export default function CatchAllPage() {
  notFound();
}
