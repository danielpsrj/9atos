import { Nav } from '@/components/shell/nav';

// App shell (issue #29, FR-10): CSS Grid with a left side-navigation and a
// main column that holds a top header slot (filled in Phase 6) plus the page
// content. Responsive down to 768 px; below that the nav collapses to a
// hamburger/drawer (handled inside <Nav />, which also provides the mobile
// top chrome). The header slot is desktop-only; on mobile the Nav's top bar
// is the top chrome and page widgets render inline with the content.
export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-bg-primary md:grid md:grid-cols-[240px_1fr]">
      <Nav />
      <div className="flex min-h-screen flex-col">
        {/* Header slot: page-level widgets (streak, goal) land here in Phase 6. */}
        <header className="hidden h-16 items-center border-b border-border px-6 md:flex">
          <span className="text-base text-text-secondary">Header slot</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
