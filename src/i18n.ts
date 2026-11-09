import { getRequestConfig } from 'next-intl/server';
import ptMessages from '../messages/pt.json';
import enMessages from '../messages/en.json';

// Plan §2.4 / AD-07 / issue #30: next-intl configuration. Default locale is
// pt-BR (the spec targets Brazilian exam prep); fallback is en-US. The locale
// is detected by the middleware (which also persists it in a cookie); this
// config resolves the messages for the active locale.

export const locales = ['pt-BR', 'en-US'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pt-BR';

// Static message map keyed by locale. Static imports (rather than a dynamic
// `import(`../messages/${locale}.json`)`) keep the dictionaries typed and avoid
// an `any` from an unresolvable dynamic import.
const messagesByLocale = {
  'pt-BR': ptMessages,
  'en-US': enMessages,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` corresponds to the [locale] segment. (Deprecated in
  // next-intl 4.14.x in favor of `next/root-params`, which only exists in
  // Next.js 16.3 — this project is pinned to Next.js 15, so this remains the
  // correct API. See the ESLint no-deprecated allow-list.)
  const requested = await requestLocale;
  const locale: Locale =
    requested !== undefined && (locales as readonly string[]).includes(requested)
      ? (requested as Locale)
      : defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
