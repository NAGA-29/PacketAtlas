// ESLint 9 の flat config。Next.js の推奨ルール(Core Web Vitals と TypeScript)を使う
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'prototype/**', 'next-env.d.ts', 'test-results/**', 'playwright-report/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // 不要になった eslint-disable のコメントも残さない
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // 使っていない変数は、先頭が _ のものだけ許す
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];

export default config;
