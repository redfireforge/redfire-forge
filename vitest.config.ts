import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'src-server/**/*.test.{ts,tsx}', 'cli/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src-tauri', 'e2e'],
    coverage: {
      exclude: [
        '**/__test-utils__/**',
        '**/__mocks__/**',
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
