'use client';

// Left side-navigation for the app shell (issue #29, FR-10). A client
// component: it tracks the active route (usePathname) and drives the mobile
// drawer. Icons come from lucide-react (plan §2.4).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, LayoutDashboard, Menu, NotebookPen, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

// The four persistent nav entries (spec §5.2 Screen 1).
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/notebooks', label: 'Notebooks', icon: NotebookPen },
  { href: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              setOpen(false);
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-base transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary/15 text-primary'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop side-nav (≥768px). */}
      <aside className="hidden h-screen border-r border-border bg-bg-secondary md:block">
        <div className="flex h-16 items-center border-b border-border px-6">
          <span className="text-xl font-semibold text-primary">9Atos</span>
        </div>
        {links}
      </aside>

      {/* Mobile top bar (<768px) with a hamburger that opens the drawer. */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-bg-secondary px-4 md:hidden">
        <span className="text-xl font-semibold text-primary">9Atos</span>
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => {
            setOpen(true);
          }}
          className="rounded-md p-2 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="size-6" aria-hidden />
        </button>
      </header>

      {/* Mobile drawer. */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            aria-hidden
            onClick={() => {
              setOpen(false);
            }}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-bg-secondary shadow-lg">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="text-xl font-semibold text-primary">9Atos</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => {
                  setOpen(false);
                }}
                className="rounded-md p-2 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-6" aria-hidden />
              </button>
            </div>
            {links}
          </div>
        </div>
      )}
    </>
  );
}
