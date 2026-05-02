// ESLint flat config (ESLint 9+).
// Минимальный набор: TS правила + проверка React хуков + неиспользуемые импорты.
// Не запускаем тяжёлый type-checking рулсет — для типов есть `npm run lint` (tsc).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  // Игнорируем сборки и зависимости
  {
    ignores: ['dist/**', 'node_modules/**', 'android/**', 'build/**', '.git/**'],
  },
  // Базовые JS правила
  js.configs.recommended,
  // TS правила без type-checking (быстро, не нужен tsconfig project)
  ...tseslint.configs.recommended,
  // React Hooks правила (rules-of-hooks, exhaustive-deps)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Запрет any — наше требование из CLAUDE.md
      '@typescript-eslint/no-explicit-any': 'error',

      // Неиспользуемые переменные — warning, разрешаем _-префикс
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // Разрешаем @ts-expect-error с пояснением
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],

      // Vite/HMR — fast refresh: компоненты должны быть единственным экспортом
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Разрешаем console — у нас есть ожидаемые console.warn/error
      'no-console': 'off',

      // Запрет debugger в коммитах
      'no-debugger': 'error',

      // Разрешаем пустые функции (заглушки в callback'ах)
      '@typescript-eslint/no-empty-function': 'off',

      // Разрешаем require в JS (для конфигов)
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Серверные файлы — Node глобалы
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // На сервере нет React, отключаем
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  // Service Worker — собственные глобалы
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
  }
);
