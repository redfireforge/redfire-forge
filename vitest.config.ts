import path from 'path';
import { defineConfig, coverageConfigDefaults } from 'vitest/config';
import {
  ALL_TEST_GLOBS,
  COMMON_TEST_EXCLUDE,
  DEMO_TEST_GLOBS,
  PRODUCT_COVERAGE_EXCLUDE,
  PRODUCT_TEST_EXCLUDE,
} from './vitest.projectPatterns';

const productCoverageExclude = [
  ...PRODUCT_COVERAGE_EXCLUDE,
  ...coverageConfigDefaults.exclude,
];

const demoCoverageExclude = [
  ...coverageConfigDefaults.exclude,
];

const sharedTestOptions = {
  globals: true,
  environment: 'node' as const,
  setupFiles: ['./src/test-utils/vitest-setup.ts'],
  testTimeout: 15000,
  hookTimeout: 15000,
  exclude: [...COMMON_TEST_EXCLUDE],
  retry: 2,
  env: {
    VITE_ENABLE_DEMO_HUB: 'true',
  },
};

const resolveAlias = {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
};

export default defineConfig({
  test: {
    poolMatchGlobs: [
      ['src-server/**', 'forks'],
      ['src/features/demo-player/useDemoHub.coverage*.ts', 'forks'],
    ],
    projects: [
      {
        resolve: resolveAlias,
        test: {
          ...sharedTestOptions,
          name: 'product',
          include: [...ALL_TEST_GLOBS],
          exclude: [...COMMON_TEST_EXCLUDE, ...PRODUCT_TEST_EXCLUDE],
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json'],
            clean: true,
            excludeAfterRemap: true,
            exclude: productCoverageExclude,
          },
        },
      },
      {
        resolve: resolveAlias,
        test: {
          ...sharedTestOptions,
          name: 'demo',
          include: [...DEMO_TEST_GLOBS],
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'json'],
            clean: true,
            excludeAfterRemap: true,
            exclude: demoCoverageExclude,
          },
        },
      },
    ],
  },
});
