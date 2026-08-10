/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { UseRequestsReturn } from '../../features/requests/hooks/useRequests';
import { useDemoRequestsBridge } from './useDemoRequestsBridge';

describe('useDemoRequestsBridge', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName;
  });

  it('registers bridge function when enabled=true', () => {
    const mockRequests: UseRequestsReturn = {
      collections: [],
      removeCollection: vi.fn(),
    } as unknown as UseRequestsReturn;

    renderHook(() => useDemoRequestsBridge(mockRequests, true));

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeTypeOf('function');
  });

  it('does not register bridge function when enabled=false', () => {
    const mockRequests: UseRequestsReturn = {
      collections: [],
      removeCollection: vi.fn(),
    } as unknown as UseRequestsReturn;

    renderHook(() => useDemoRequestsBridge(mockRequests, false));

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeUndefined();
  });

  it('unregisters bridge function on unmount', () => {
    const mockRequests: UseRequestsReturn = {
      collections: [],
      removeCollection: vi.fn(),
    } as unknown as UseRequestsReturn;

    const { unmount } = renderHook(() => useDemoRequestsBridge(mockRequests, true));

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeTypeOf('function');

    unmount();

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeUndefined();
  });

  it('deletes collections by exact name match (case-insensitive)', () => {
    const removeCollectionSpy = vi.fn();
    const mockRequests: UseRequestsReturn = {
      collections: [
        { id: 'col-1', name: 'MyCollection' },
        { id: 'col-2', name: 'OtherCollection' },
        { id: 'col-3', name: 'mycollection' },
      ] as UseRequestsReturn['collections'],
      removeCollection: removeCollectionSpy,
    } as unknown as UseRequestsReturn;

    renderHook(() => useDemoRequestsBridge(mockRequests, true));

    const bridge = (window as unknown as {
      __demoDeleteCollectionsByName?: (name: string) => number;
    }).__demoDeleteCollectionsByName;

    const deleted = bridge?.('MyCollection');

    expect(deleted).toBe(2);
    expect(removeCollectionSpy).toHaveBeenCalledWith('col-1');
    expect(removeCollectionSpy).toHaveBeenCalledWith('col-3');
    expect(removeCollectionSpy).toHaveBeenCalledTimes(2);
  });

  it('returns 0 when no collections match the name', () => {
    const removeCollectionSpy = vi.fn();
    const mockRequests: UseRequestsReturn = {
      collections: [
        { id: 'col-1', name: 'MyCollection' },
        { id: 'col-2', name: 'OtherCollection' },
      ] as UseRequestsReturn['collections'],
      removeCollection: removeCollectionSpy,
    } as unknown as UseRequestsReturn;

    renderHook(() => useDemoRequestsBridge(mockRequests, true));

    const bridge = (window as unknown as {
      __demoDeleteCollectionsByName?: (name: string) => number;
    }).__demoDeleteCollectionsByName;

    const deleted = bridge?.('NonExistent');

    expect(deleted).toBe(0);
    expect(removeCollectionSpy).not.toHaveBeenCalled();
  });

  it('handles empty collections array', () => {
    const removeCollectionSpy = vi.fn();
    const mockRequests: UseRequestsReturn = {
      collections: [],
      removeCollection: removeCollectionSpy,
    } as unknown as UseRequestsReturn;

    renderHook(() => useDemoRequestsBridge(mockRequests, true));

    const bridge = (window as unknown as {
      __demoDeleteCollectionsByName?: (name: string) => number;
    }).__demoDeleteCollectionsByName;

    const deleted = bridge?.('AnyName');

    expect(deleted).toBe(0);
    expect(removeCollectionSpy).not.toHaveBeenCalled();
  });

  it('switches from disabled to enabled correctly', () => {
    const mockRequests: UseRequestsReturn = {
      collections: [],
      removeCollection: vi.fn(),
    } as unknown as UseRequestsReturn;

    const { rerender } = renderHook(
      ({ enabled }) => useDemoRequestsBridge(mockRequests, enabled),
      { initialProps: { enabled: false } },
    );

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeUndefined();

    rerender({ enabled: true });

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeTypeOf('function');
  });

  it('switches from enabled to disabled correctly', () => {
    const mockRequests: UseRequestsReturn = {
      collections: [],
      removeCollection: vi.fn(),
    } as unknown as UseRequestsReturn;

    const { rerender } = renderHook(
      ({ enabled }) => useDemoRequestsBridge(mockRequests, enabled),
      { initialProps: { enabled: true } },
    );

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeTypeOf('function');

    rerender({ enabled: false });

    expect((window as unknown as Record<string, unknown>).__demoDeleteCollectionsByName).toBeUndefined();
  });

  it('reflects updated collections from current ref', () => {
    let mockRequests: UseRequestsReturn = {
      collections: [
        { id: 'col-1', name: 'Collection1' },
      ] as UseRequestsReturn['collections'],
      removeCollection: vi.fn(),
    } as unknown as UseRequestsReturn;

    const { rerender } = renderHook(
      ({ requests }) => useDemoRequestsBridge(requests, true),
      { initialProps: { requests: mockRequests } },
    );

    // Update collections
    mockRequests = {
      collections: [
        { id: 'col-1', name: 'Collection1' },
        { id: 'col-2', name: 'Collection2' },
      ] as UseRequestsReturn['collections'],
      removeCollection: mockRequests.removeCollection,
    };

    rerender({ requests: mockRequests });

    const bridge = (window as unknown as {
      __demoDeleteCollectionsByName?: (name: string) => number;
    }).__demoDeleteCollectionsByName;

    const deleted = bridge?.('Collection2');

    expect(deleted).toBe(1);
  });
});
