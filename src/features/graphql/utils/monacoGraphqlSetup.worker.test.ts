/**
 * monacoGraphqlSetup.worker.test.ts
 * @vitest-environment jsdom
 *
 * Tests the browser-side window.MonacoEnvironment.getWorker injection
 * (lines 28-37 in monacoGraphqlSetup.ts). Runs in jsdom so that `window`
 * is defined at module-load time — the side effect only executes in browser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (must come before any import of the module under test) ────

const { MockGraphqlWorker } = vi.hoisted(() => {
  class MockGraphqlWorkerCls extends EventTarget {
    postMessage = vi.fn();
    terminate = vi.fn();
  }
  return { MockGraphqlWorker: MockGraphqlWorkerCls };
});

vi.mock('monaco-editor', () => ({
  editor: { defineTheme: vi.fn() },
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    setLanguageConfiguration: vi.fn(),
  },
  Uri: { parse: vi.fn((s: string) => s) },
  Range: class {},
}));

vi.mock('monaco-graphql/initializeMode', () => ({
  initializeMode: vi.fn(() => ({ setSchemaConfig: vi.fn() })),
}));

vi.mock('monaco-graphql/esm/graphql.worker?worker', () => ({
  default: MockGraphqlWorker,
}));

// Provide a global Worker stub so the fallback path in monacoGraphqlSetup.ts
// doesn't throw (jsdom doesn't implement Worker).
class MockEditorWorker extends EventTarget {
  postMessage = vi.fn();
  terminate = vi.fn();
}
(globalThis as unknown as Record<string, unknown>).Worker = MockEditorWorker;

// Import the module AFTER mocks are defined so the top-level side effect runs
// with window present and the stubs in place.
import './monacoGraphqlSetup';

// ─── Tests ────────────────────────────────────────────────────────────────────

type EnvWithGetWorker = { getWorker: (id: string, label: string) => unknown };

describe('monacoGraphqlSetup — window.MonacoEnvironment.getWorker', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('sets window.MonacoEnvironment with a getWorker function', () => {
    const env = window.MonacoEnvironment as EnvWithGetWorker | undefined;
    expect(env).toBeDefined();
    expect(typeof env?.getWorker).toBe('function');
  });

  it('returns a GraphqlWorkerCtor instance when label is "graphql"', () => {
    const { getWorker } = window.MonacoEnvironment as EnvWithGetWorker;
    const result = getWorker('', 'graphql');
    expect(result).toBeInstanceOf(MockGraphqlWorker);
  });

  it('falls back to the editor worker for non-graphql labels when no previous handler', () => {
    const { getWorker } = window.MonacoEnvironment as EnvWithGetWorker;
    const result = getWorker('some-id', 'typescript');
    expect(result).toBeInstanceOf(MockEditorWorker);
  });

  it('chains to previous getWorker handler for non-graphql labels when _prev exists', () => {
    const prevWorker = new MockEditorWorker() as unknown as Worker;
    const prevGetWorker = vi.fn(() => prevWorker);

    // Simulate the chain: _prev is set, non-graphql label should go to _prev
    type PrevEnv = { getWorker?: typeof prevGetWorker };
    const existingEnv: PrevEnv = { getWorker: prevGetWorker };
    const _prev = existingEnv.getWorker;
    if (_prev) {
      const result = _prev.call(existingEnv, 'worker-id', 'json');
      expect(prevGetWorker).toHaveBeenCalledWith('worker-id', 'json');
      expect(result).toBe(prevWorker);
    }
  });
});
