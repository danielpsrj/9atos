import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Plan §2.4 / task 0.4: standalone output for a lean Docker runner image.
  output: 'standalone',
  // Ensure the Prisma query engine (native binary) is traced into the
  // standalone bundle once the app starts using the database (Phase 1+).
  outputFileTracingIncludes: {
    '*': ['**/node_modules/@prisma/engines/**', '**/node_modules/.prisma/**'],
  },
};

export default nextConfig;
