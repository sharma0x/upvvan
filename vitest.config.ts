import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'tests/e2e/**'],
    // Integration suites talk to a real Postgres 18 (schema-layer proofs) and
    // real Payload (Local API). Give them room; the pure unit suites are fast.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.config.{ts,js,mjs}',
        '**/payload-types.ts',
        '**/importMap.js',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
      // Vitest runs suites in a DOM environment where `server-only` throws by
      // design. Neutralise it so server modules remain unit-testable; the real
      // protection is the build-time error Next raises if one reaches a client
      // component.
      'server-only': path.resolve(__dirname, './vitest.server-only-stub.ts'),
    },
  },
})
