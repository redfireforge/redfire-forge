/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePublishPermission } from './usePublishPermission';

describe('usePublishPermission', () => {
  it('returns all-true for any entry ID', () => {
    const { result } = renderHook(() => usePublishPermission('entry-1'));
    expect(result.current.canPublish).toBe(true);
    expect(result.current.canUnpublish).toBe(true);
    expect(result.current.canRepublish).toBe(true);
    expect(result.current.reason).toBeUndefined();
  });

  it('returns same reference on re-render (stable identity)', () => {
    const { result, rerender } = renderHook(
      ({ id }) => usePublishPermission(id),
      { initialProps: { id: 'a' } },
    );
    const first = result.current;
    rerender({ id: 'b' });
    expect(result.current).toBe(first);
  });

  it('returns all-true for empty entry ID', () => {
    const { result } = renderHook(() => usePublishPermission(''));
    expect(result.current.canPublish).toBe(true);
    expect(result.current.canUnpublish).toBe(true);
    expect(result.current.canRepublish).toBe(true);
  });
});
