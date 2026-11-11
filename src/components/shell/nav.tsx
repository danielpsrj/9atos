'use client';

// Left side-navigation for the app shell (issue #29, FR-10) with i18n
// (issue #30, AD-07). A client component: it tracks the active route
// (usePathname), drives the mobile drawer, renders translated labels
// (useTranslations), and hosts the locale switcher. Icons come from
// lucide-react (plan §2.4).

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
// @/navigation (next-intl v4): Link auto-prefixes the locale, usePathname
// returns the locale-less path (so active-route matching works), and
// useRouter.replace switches locale while staying on the same page.
import { Link, usePathname, useRouter } from '@/navigation';
import { BookOpen, LayoutDashboard, Menu, NotebookPen, Settings, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { locales } from '@/i18n';

interface NavItem {
  href: string;
  /** The translation key under the "Nav" namespace. */
  labelKey: 'overview' | 'user' | 'knowledge' | 'notebooks' | 'settings';
  icon: typeof LayoutDashboard;
}

// The persistent nav entries, ordered per the semantic model (issue #62):
// Overview → User → Knowledge → Notebooks → Settings.
const NAV_ITEMS: NavItem[] = [
  { href: '/', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/user', labelKey: 'user', icon: User },
  { href: '/knowledge', labelKey: 'knowledge', icon: BookOpen },
  { href: '/notebooks', labelKey: 'notebooks', icon: NotebookPen },
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
  const navRef = useRef<HTMLElement>(null);

  // Switch locale while staying on the same page (next-intl router).
  function switchLocale(next: string) {
    router.replace(pathname, { locale: next });
  }

  // Arrow-key navigation for the nav (issue #31): ArrowDown/ArrowUp move between
  // links (wrapping), Home/End jump to the first/last. Tab/Shift+Tab and
  // Enter/Space still work natively, so the nav is fully operable by keyboard.
  function handleNavKeyDown(e: React.KeyboardEvent) {
    const nav = navRef.current;
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (current === -1) return;

    let next = current;
    switch (e.key) {
      case 'ArrowDown':
        next = (current + 1) % links.length;
        break;
      case 'ArrowUp':
        next = (current - 1 + links.length) % links.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = links.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    links[next]?.focus();
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
    <nav
      ref={navRef}
      aria-label="Primary"
      className="flex flex-col gap-1 p-3"
      onKeyDown={handleNavKeyDown}
    >
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
          className="rounded-md p-2 text-text-primary"
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
                className="rounded-md p-2 text-text-primary"
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
