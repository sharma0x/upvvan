import nextPlugin from '@next/eslint-plugin-next'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

/**
 * ESLint flat config.
 *
 * Written natively rather than through `FlatCompat` + `next/core-web-vitals`.
 * The compat bridge chokes on Next 16's own plugin object graph ("property
 * 'react' closes the circle") because it tries to JSON-stringify a circular
 * structure while validating the legacy config. Importing the plugins directly
 * sidesteps that and is the supported shape for ESLint 9.
 *
 * `@next/eslint-plugin-next` arrives transitively via `eslint-config-next`; it is
 * imported directly so the rules this project enforces are explicit here.
 */
export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      // GENERATED — regenerate with `pnpm payload generate:types`.
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      // GENERATED — regenerate with `make design-export`.
      'src/app/theme.css',
      'src/migrations/*.json',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Underscore-prefixed args are intentional — Payload access signatures
      // must keep their parameter shape even when a handler ignores one.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      // Money crosses this boundary as integer paise. A float literal in a price
      // expression is a rounding bug waiting for a large enough number, so this
      // is an error rather than a warning.
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message: 'Money is integer paise. Use Number.parseInt, or a value already in paise.',
        },
        {
          name: 'parseInt',
          message: 'Use Number.parseInt — the global parses a leading-zero string as octal.',
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      'no-undef': 'off',
    },
  },
]
