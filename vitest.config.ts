import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'src-server/**/*.test.{ts,tsx}', 'cli/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src-tauri', 'e2e'],
    poolMatchGlobs: [
      // Server tests share module-level state — run each file in its own fork
      ['src-server/**', 'forks'],
    ],
    coverage: {
      reporter: ['text', 'json-summary'],
      clean: false,
      exclude: [
        '**/__test-utils__/**',
        '**/__mocks__/**',
        '**/test-helpers/**',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
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
