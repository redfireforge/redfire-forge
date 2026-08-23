/**
 * Reusable mock for `@xyflow/react` used by all `WorkflowResultsExplorerModal`
 * test files. Replaces the heavy ReactFlow runtime with trivial stub
 * components so test suites that only care about parent-level orchestration
 * can render quickly under jsdom.
 *
 * Usage: register this module with the Vitest mock API, passing an async
 * factory that imports and calls buildReactFlowMock().
 */
/* v8 ignore start */
// This is a test-only mock harness — components/hooks are wired up by vi.mock
// and only some are rendered by any given test suite. Coverage of unused
// stubs is irrelevant; the file exists purely to deduplicate test boilerplate.
import { vi } from 'vitest';

export async function buildReactFlowMock() {
  const React = await import('react');
  return {
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'mock-flow-provider' }, children),
    ReactFlow: () => React.createElement('div', { 'data-testid': 'mock-reactflow' }),
    Controls: () => React.createElement('div', { 'data-testid': 'mock-controls' }),
    MiniMap: () => React.createElement('div', { 'data-testid': 'mock-minimap' }),
    Background: () => React.createElement('div', { 'data-testid': 'mock-background' }),
    useReactFlow: () => ({ fitView: vi.fn(), getViewport: () => ({ x: 0, y: 0, zoom: 1 }) }),
    useNodesState: <T,>(initial: T) => [initial, vi.fn(), vi.fn()],
    useEdgesState: <T,>(initial: T) => [initial, vi.fn()],
    MarkerType: { ArrowClosed: 'arrowclosed' },
  };
}
/* v8 ignore stop */
