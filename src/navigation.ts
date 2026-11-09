import { createNavigation } from 'next-intl/navigation';

// next-intl v4 navigation helpers (issue #30, AD-07). `createNavigation`
// returns a locale-aware Link (auto-prefixes the active locale), usePathname
// (returns the locale-less path), and useRouter (replace with { locale } to
// switch language on the same page). Import these from @/navigation rather than
// next/link or next/navigation so locale routing stays consistent.
export const { Link, redirect, usePathname, useRouter } = createNavigation();
