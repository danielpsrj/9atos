import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';

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
          allowDefaultProject: ['*.mjs'],
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
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
