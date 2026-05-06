import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vitest/config';

const coverageTmp = path.resolve(__dirname, 'coverage', '.tmp');
fs.mkdirSync(coverageTmp, { recursive: true });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'src-server/**/*.test.{ts,tsx}', 'cli/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src-tauri', 'e2e'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
