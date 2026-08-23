import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src-server/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src-tauri', 'e2e'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@graphql': path.resolve(__dirname, './src/features/graphql'),
      '@grpc': path.resolve(__dirname, './src/features/grpc'),
      '@workflow': path.resolve(__dirname, './src/features/workflow'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@engine/core': path.resolve(__dirname, './src/engine/core'),
      '@engine/grpc': path.resolve(__dirname, './src/engine/grpc'),
      '@engine/load': path.resolve(__dirname, './src/engine/load'),
      '@test-utils': path.resolve(__dirname, './src/test-utils'),
      '@app': path.resolve(__dirname, './src/app'),
    },
  },
});
