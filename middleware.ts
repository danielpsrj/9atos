import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './src/i18n';

// Plan §2.4 / issue #30: detects the locale (from the path, the NEXT_LOCALE
// cookie, or Accept-Language) and persists the choice in the NEXT_LOCALE
// cookie. Absent cookie defaults to pt-BR. API routes and static files are
// excluded from locale routing.
export default createMiddleware({
  locales,
  defaultLocale,
  localeCookie: {
    name: 'NEXT_LOCALE',
  },
});

export const config = {
  // Match all paths except API routes, Next.js internals, and static files
  // (anything containing a dot, e.g. /icon.svg). The /theme and /components
  // verification pages now live under the [locale] segment, so they are routed
  // through the middleware like every other page.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
