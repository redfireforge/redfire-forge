/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlStudioQueryComplexity } from './useGraphqlStudioQueryComplexity';

const loadedSchema = {
  sdl: 'type Query { hello: String }',
  types: [],
  queryType: 'Query',
  mutationType: null,
  subscriptionType: null,
} as const;

describe('useGraphqlStudioQueryComplexity', () => {
  it('returns null when schema is not loaded', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioQueryComplexity('idle', null, 'query { x }', undefined),
    );
    expect(result.current.complexityResult).toBeNull();
    expect(result.current.complexityWarningPending).toBe(false);
  });

  it('returns null when query is blank even if schema is loaded', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioQueryComplexity('loaded', loadedSchema as never, '   ', undefined),
    );
    expect(result.current.complexityResult).toBeNull();
  });

  it('computes complexity when schema is loaded and query is non-empty', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioQueryComplexity('loaded', loadedSchema as never, 'query { hello }', undefined),
    );
    expect(result.current.complexityResult).not.toBeNull();
  });

  it('clears complexityWarningPending when query changes', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useGraphqlStudioQueryComplexity('loaded', loadedSchema as never, query, undefined),
      { initialProps: { query: 'query { a }' } },
    );

    act(() => { result.current.setComplexityWarningPending(true); });
    expect(result.current.complexityWarningPending).toBe(true);

    rerender({ query: 'query { b }' });
    expect(result.current.complexityWarningPending).toBe(false);
  });
});
