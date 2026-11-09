'use client';

// Left side-navigation for the app shell (issue #29, FR-10) with i18n
// (issue #30, AD-07). A client component: it tracks the active route
// (usePathname), drives the mobile drawer, renders translated labels
// (useTranslations), and hosts the locale switcher. Icons come from
// lucide-react (plan §2.4).

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
// @/navigation (next-intl v4): Link auto-prefixes the locale, usePathname
// returns the locale-less path (so active-route matching works), and
// useRouter.replace switches locale while staying on the same page.
import { Link, usePathname, useRouter } from '@/navigation';
import { BookOpen, LayoutDashboard, Menu, NotebookPen, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { locales } from '@/i18n';

interface NavItem {
  href: string;
  /** The translation key under the "Nav" namespace. */
  labelKey: 'overview' | 'notebooks' | 'knowledge' | 'settings';
  icon: typeof LayoutDashboard;
}

// The four persistent nav entries (spec §5.2 Screen 1).
const NAV_ITEMS: NavItem[] = [
  { href: '/', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/notebooks', labelKey: 'notebooks', icon: NotebookPen },
  { href: '/knowledge', labelKey: 'knowledge', icon: BookOpen },
  { href: '/settings', labelKey: 'settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const t = useTranslations('Nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Switch locale while staying on the same page (next-intl router).
  function switchLocale(next: string) {
    router.replace(pathname, { locale: next });
  }

  const localeSwitcher = (
    <div className="flex items-center gap-1 px-3 pb-3">
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => {
            switchLocale(loc);
          }}
          aria-pressed={locale === loc}
          className={cn(
            'rounded-md px-2 py-1 text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            locale === loc
              ? 'bg-primary/15 text-primary'
              : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
          )}
        >
          {loc}
        </button>
      ))}
    </div>
  );

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
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop side-nav (≥768px). */}
      <aside className="hidden h-screen flex-col border-r border-border bg-bg-secondary md:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <span className="text-xl font-semibold text-primary">{t('brand')}</span>
        </div>
        {links}
        <div className="mt-auto">{localeSwitcher}</div>
      </aside>

      {/* Mobile top bar (<768px) with a hamburger that opens the drawer. */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-bg-secondary px-4 md:hidden">
        <span className="text-xl font-semibold text-primary">{t('brand')}</span>
        <button
          type="button"
          aria-label={t('openNav')}
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
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-bg-secondary shadow-lg">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="text-xl font-semibold text-primary">{t('brand')}</span>
              <button
                type="button"
                aria-label={t('closeNav')}
                onClick={() => {
                  setOpen(false);
                }}
                className="rounded-md p-2 text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-6" aria-hidden />
              </button>
            </div>
            {links}
            <div className="mt-auto">{localeSwitcher}</div>
          </div>
        </div>
      )}
    </>
  );
}
