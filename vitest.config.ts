import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  test: {
    // Use jsdom to simulate a browser environment for React Testing Library
    environment: 'jsdom',

    // Make Vitest globals (describe, it, expect, etc.) available without imports
    globals: true,

    // Run this setup file before each test suite
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration — minimum 80% across all metrics
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: {
        lines:      80,
        functions:  80,
        branches:   80,
        statements: 80,
      },
      include: [
        'lib/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.config.*',
        '**/*.d.ts',
        'lib/database.types.ts',
        'app/layout.tsx',
        'app/globals.css',
      ],
    },

    // Individual test timeout
    testTimeout: 10_000,

    // Exclude Playwright e2e tests
    exclude: ['node_modules', 'tests/e2e', '.next'],
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
