import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Plan §2.4 / task 0.4: standalone output for a lean Docker runner image.
  output: 'standalone',
  // Ensure the Prisma query engine (native binary) is traced into the
  // standalone bundle once the app starts using the database (Phase 1+).
  outputFileTracingIncludes: {
    '*': ['**/node_modules/@prisma/engines/**', '**/node_modules/.prisma/**'],
  },
};

// next-intl (issue #30, AD-07): point the plugin at the i18n config so the
// server can resolve the active locale's messages. The config lives at
// src/i18n.ts (not the default ./i18n.ts) because the @/* alias maps to src/.
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

export default withNextIntl(nextConfig);
