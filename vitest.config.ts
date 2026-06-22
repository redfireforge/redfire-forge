import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    include: ['src/**/*.test.{ts,tsx}', 'src-server/**/*.test.{ts,tsx}', 'cli/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src-tauri', 'e2e'],
    poolMatchGlobs: [
      // Server tests share module-level state — run each file in its own fork
      ['src-server/**', 'forks'],
    ],
    retry: 2,
    coverage: {
      reporter: ['text', 'json-summary', 'json'],
      clean: false,
      exclude: [
        '**/__test-utils__/**',
        '**/__mocks__/**',
        '**/test-helpers/**',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/shared/types/index.ts',
        'node_modules',
        'dist',
        'src-tauri',
        'e2e',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
