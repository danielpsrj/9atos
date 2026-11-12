import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import noHardcodedStrings from './eslint-rules/no-hardcoded-strings.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Plan §2.4: typescript-eslint in strict-type-checked mode
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root .mjs config files and the local ESLint rule definitions are not
          // part of the app's tsconfig project; lint them with the default
          // project instead of failing to resolve them.
          allowDefaultProject: ['*.mjs', 'eslint-rules/*.mjs'],
          defaultProject: './tsconfig.json',
        },
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    rules: {
      // Plan §2.4: zero `any` leakage (NFR-01)
      '@typescript-eslint/no-explicit-any': 'error',
      // next-intl 4.14.x deprecates setRequestLocale / requestLocale in favor of
      // `next/root-params`, but that API only exists in Next.js 16.3. This project
      // is pinned to Next.js 15 (plan §2.4), where `next/root-params` is a throwing
      // placeholder — so setRequestLocale/requestLocale remain the correct API here.
      // Allow these two specific deprecated members rather than pinning back or
      // scattering inline disables.
      '@typescript-eslint/no-deprecated': [
        'error',
        {
          allow: [
            { from: 'file', name: 'setRequestLocale', path: 'next-intl/server' },
            { from: 'file', name: 'requestLocale', path: 'next-intl/server' },
          ],
        },
      ],
      // #10: only src/lib/prisma.ts may import the PrismaClient class. Every
      // other file (API routes, services, repositories) must use the prisma
      // singleton. Type-only imports from @prisma/client remain allowed.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              importNames: ['PrismaClient'],
              message:
                'Import the `prisma` singleton from @/lib/prisma instead of instantiating PrismaClient directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // The singleton and the standalone seed script are the only files allowed
    // to instantiate PrismaClient directly.
    files: ['src/lib/prisma.ts', 'prisma/seed.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // #30 / FR-14 / AD-07: no hardcoded user-facing strings in JSX. Every
    // visible text node in a feature screen must come from a next-intl
    // dictionary. The rule is a local plugin (eslint-rules/).
    plugins: { local: { rules: { 'no-hardcoded-strings': noHardcodedStrings } } },
    rules: { 'local/no-hardcoded-strings': 'error' },
  },
  {
    // Excluded from the no-hardcoded-strings rule:
    //  - The design-verification pages are throwaway surfaces for eyeballing
    //    tokens and primitives, not feature screens. (The directory is literally
    //    named "[locale]", so the brackets are escaped to match it literally.)
    //  - The Shadcn UI primitives (src/components/ui) are vendored library
    //    components; their internal strings (e.g. the dialog's "Close"
    //    aria-label) are part of the component API, not the app's user-facing
    //    copy. Feature screens that use them supply their own translated text.
    files: [
      'src/app/\\[locale\\]/theme/**',
      'src/app/\\[locale\\]/components/**',
      'src/components/ui/**',
    ],
    rules: { 'local/no-hardcoded-strings': 'off' },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      // Local QA-play artifacts (issue #65): throwaway Playwright scripts and
      // screenshots, not app code. Excluded from linting so they don't break the
      // build (their .mjs files are outside the tsconfig project).
      'qa-evidence/**',
    ],
  },
];

export default eslintConfig;
