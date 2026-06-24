import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEMO_TEST_GLOBS,
  isDemoCoveragePath,
  isDemoTestFile,
  isProductTestFile,
  PRODUCT_TEST_EXCLUDE,
} from '../../vitest.projectPatterns';

const ROOT = join(import.meta.dirname, '../..');

function collectTestFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectTestFiles(full, acc);
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(relative(ROOT, full).replace(/\\/g, '/'));
    }
  }
  return acc;
}

function collectUnder(relativeDir: string): string[] {
  const abs = join(ROOT, relativeDir);
  try {
    return collectTestFiles(abs);
  } catch {
    return [];
  }
}

function collectAllRepoTestFiles(): string[] {
  return [
    ...collectUnder('src'),
    ...collectUnder('src-server'),
    ...collectUnder('cli'),
  ];
}

describe('vitest project split (Phase 1)', () => {
  it('classifies demo-player tests as demo-only', () => {
    expect(isDemoTestFile('src/features/demo-player/useDemoHub.test.ts')).toBe(true);
    expect(isProductTestFile('src/features/demo-player/useDemoHub.test.ts')).toBe(false);
  });

  it('classifies useDemoShortcuts.test.ts as demo-only', () => {
    expect(isDemoTestFile('src/app/hooks/useDemoShortcuts.test.ts')).toBe(true);
    expect(isProductTestFile('src/app/hooks/useDemoShortcuts.test.ts')).toBe(false);
  });

  it('classifies gqlDemoWorkspace.test.ts as product (demo support in GraphQL Studio)', () => {
    expect(isDemoTestFile('src/features/graphql/utils/gqlDemoWorkspace.test.ts')).toBe(false);
    expect(isProductTestFile('src/features/graphql/utils/gqlDemoWorkspace.test.ts')).toBe(true);
  });

  it('classifies AppActivityBar.test.tsx as product (mixed demo-hub assertions)', () => {
    expect(isDemoTestFile('src/app/components/AppActivityBar.test.tsx')).toBe(false);
    expect(isProductTestFile('src/app/components/AppActivityBar.test.tsx')).toBe(true);
  });

  it('classifies AppLiveDemoOverlay.test.tsx as demo-only', () => {
    expect(isDemoTestFile('src/app/components/AppLiveDemoOverlay.test.tsx')).toBe(true);
  });

  it('classifies all bridge hook tests as demo-only', () => {
    for (const file of [
      'src/app/hooks/useDemoWorkflowBridge.test.ts',
      'src/app/hooks/useDemoWorkflowCanvasBridge.test.ts',
      'src/app/hooks/useDemoGlobalAuthBridge.test.ts',
      'src/features/graphql/hooks/useDemoGqlTlsBridge.test.ts',
      'src/features/graphql/hooks/useDemoGqlEnvBridge.test.ts',
    ]) {
      expect(isDemoTestFile(file), file).toBe(true);
      expect(isProductTestFile(file), file).toBe(false);
    }
  });

  it('has no overlap between product exclude globs and product-eligible demo-player paths', () => {
    const demoPlayerTests = collectUnder('src/features/demo-player');
    expect(demoPlayerTests.length).toBeGreaterThan(50);
    for (const file of demoPlayerTests) {
      expect(isProductTestFile(file), `${file} should not be in product project`).toBe(false);
      expect(isDemoTestFile(file), `${file} should be in demo project`).toBe(true);
    }
  });

  it('documents expected glob patterns for CI audit', () => {
    expect(DEMO_TEST_GLOBS).toContain('src/features/demo-player/**/*.test.{ts,tsx}');
    expect(PRODUCT_TEST_EXCLUDE).toContain('src/features/demo-player/**');
  });

  it('partitions every repo test file into exactly one project (demo xor product)', () => {
    const all = collectAllRepoTestFiles();
    expect(all.length).toBeGreaterThan(1400);

    const neither: string[] = [];
    const both: string[] = [];

    for (const file of all) {
      const demo = isDemoTestFile(file);
      const product = isProductTestFile(file);
      if (demo && product) both.push(file);
      if (!demo && !product) neither.push(file);
    }

    expect(both, `files in both projects: ${both.join(', ')}`).toEqual([]);
    expect(neither, `unclassified files: ${neither.join(', ')}`).toEqual([]);
    expect(all.filter(isDemoTestFile).length).toBeGreaterThan(90);
  });

  it('classifies every useDemo*.test.ts file as demo-only', () => {
    function collectUseDemoTests(dir: string, acc: string[] = []): string[] {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          if (entry === 'node_modules' || entry === 'dist') continue;
          collectUseDemoTests(full, acc);
        } else if (/^useDemo.*\.test\.ts$/.test(entry)) {
          acc.push(relative(ROOT, full).replace(/\\/g, '/'));
        }
      }
      return acc;
    }

    const useDemoTests = collectUseDemoTests(join(ROOT, 'src'));
    expect(useDemoTests.length).toBe(14);
    for (const file of useDemoTests) {
      expect(isDemoTestFile(file), file).toBe(true);
      expect(isProductTestFile(file), file).toBe(false);
    }
  });

  it('classifies demo coverage paths for Istanbul filter', () => {
    expect(isDemoCoveragePath('/repo/src/features/demo-player/DemoHub.tsx')).toBe(true);
    expect(isDemoCoveragePath('/repo/src/app/hooks/useDemoWorkflowBridge.ts')).toBe(true);
    expect(isDemoCoveragePath('/repo/src/app/demo/DemoShellHost.tsx')).toBe(true);
    expect(isDemoCoveragePath('/repo/src/app/demo/demoHubRuntimeRef.ts')).toBe(true);
    expect(isDemoCoveragePath('/repo/src/features/graphql/hooks/useDemoGqlTlsBridge.ts')).toBe(true);
    expect(isDemoCoveragePath('/repo/src/styles/demo-player.css')).toBe(true);
    expect(isDemoCoveragePath('/repo/src/styles/demo-hub.css')).toBe(true);
    expect(isDemoCoveragePath('C:\\repo\\src\\features\\demo-player\\DemoHub.tsx')).toBe(true);
    expect(isDemoCoveragePath('/repo/src/features/graphql/utils/gqlDemoWorkspace.ts')).toBe(false);
  });
});
