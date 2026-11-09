import { setRequestLocale } from 'next-intl/server';
import { Nav } from '@/components/shell/nav';

// App shell (issue #29, FR-10): CSS Grid with a left side-navigation and a
// main column that holds the page content. Responsive down to 768 px; below
// that the nav collapses to a hamburger/drawer (handled inside <Nav />, which
// also provides the mobile top chrome). Each page renders its own header
// (the Overview dashboard header lands in #32); there is no shared header
// slot.
export default async function ShellLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen bg-bg-primary md:grid md:grid-cols-[240px_1fr]">
      <Nav />
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
