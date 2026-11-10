import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Plan §2.4 / NFR-07 (issue #48): security headers on every response. The CSP
// is self-only — no third-party origins are allowed in V1. `'unsafe-inline'`
// for scripts/styles is required because Next.js injects inline hydration
// scripts and Tailwind injects inline <style> tags; the security property that
// matters here (blocking third-party origins) is preserved because no external
// domain appears in any directive.
//
// Note: `upgrade-insecure-requests` is deliberately OMITTED. The V1 deployment
// is served over plain HTTP (http://host:3005); that directive would force the
// browser to load every http:// subresource over https://, which fails with
// ERR_SSL_PROTOCOL_ERROR and breaks the entire client bundle (no hydration, no
// data loading). It is only appropriate for an HTTPS-served origin.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Plan §2.4 / task 0.4: standalone output for a lean Docker runner image.
  output: 'standalone',
  // Ensure the Prisma query engine (native binary) is traced into the
  // standalone bundle once the app starts using the database (Phase 1+).
  outputFileTracingIncludes: {
    '*': ['**/node_modules/@prisma/engines/**', '**/node_modules/.prisma/**'],
  },
  // Issue #48: apply the security headers to every route. Next.js types this
  // as returning a Promise, so the method is async. Awaiting a real Promise
  // (Promise.resolve) satisfies both the require-await and await-thenable lint
  // rules without awaiting a non-thenable.
  async headers() {
    const headers = await Promise.resolve(securityHeaders);
    return [{ source: '/:path*', headers }];
  },
};

// next-intl (issue #30, AD-07): point the plugin at the i18n config so the
// server can resolve the active locale's messages. The config lives at
// src/i18n.ts (not the default ./i18n.ts) because the @/* alias maps to src/.
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

export default withNextIntl(nextConfig);
