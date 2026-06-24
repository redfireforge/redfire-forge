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
      // Demo hub coverage tests leave async timers — isolate from other files
      ['src/features/demo-player/useDemoHub.coverage*.ts', 'forks'],
    ],
    retry: 2,
    coverage: {
      reporter: ['text', 'json-summary', 'json'],
      clean: false,
      exclude: [
        '**/__test-utils__/**',
        '**/__mocks__/**',
        '**/test-helpers/**',
        '**/*.coverage-helpers.ts',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/shared/types/index.ts',
        // Demo lesson wrappers (thin step + copy) — see docs/guides/demo-lesson-done-checklist.md
        'src/features/demo-player/lessons/protocols/graphql-*.ts',
        'src/features/demo-player/lessons/protocols/ws-*.ts',
        'src/features/demo-player/lessons/protocols/sse-*.ts',
        'src/features/demo-player/lessons/protocols/kafka-*.ts',
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
