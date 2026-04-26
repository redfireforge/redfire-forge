/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useListCrud } from './useListCrud';

describe('useListCrud', () => {
  const initial = [
    { id: 'a', value: 1 },
    { id: 'b', value: 2 },
    { id: 'c', value: 3 },
  ];

  function setup(items = initial) {
    const setter = vi.fn();
    return { setter, ...renderHook(() => useListCrud(items, setter)) };
  }

  it('update patches an item at the given index', () => {
    const { result, setter } = setup();
    act(() => result.current.update(1, { value: 99 }));
    expect(setter).toHaveBeenCalledWith([
      { id: 'a', value: 1 },
      { id: 'b', value: 99 },
      { id: 'c', value: 3 },
    ]);
  });

  it('remove deletes item at the given index', () => {
    const { result, setter } = setup();
    act(() => result.current.remove(0));
    expect(setter).toHaveBeenCalledWith([
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ]);
  });

  it('move swaps items down', () => {
    const { result, setter } = setup();
    act(() => result.current.move(0, 1));
    expect(setter).toHaveBeenCalledWith([
      { id: 'b', value: 2 },
      { id: 'a', value: 1 },
      { id: 'c', value: 3 },
    ]);
  });

  it('move swaps items up', () => {
    const { result, setter } = setup();
    act(() => result.current.move(2, -1));
    expect(setter).toHaveBeenCalledWith([
      { id: 'a', value: 1 },
      { id: 'c', value: 3 },
      { id: 'b', value: 2 },
    ]);
  });

  it('move does nothing when target is out of bounds (below 0)', () => {
    const { result, setter } = setup();
    act(() => result.current.move(0, -1));
    expect(setter).not.toHaveBeenCalled();
  });

  it('move does nothing when target is beyond length', () => {
    const { result, setter } = setup();
    act(() => result.current.move(2, 1));
    expect(setter).not.toHaveBeenCalled();
  });

  it('works with empty list', () => {
    const { result, setter } = setup([]);
    act(() => result.current.remove(0));
    expect(setter).toHaveBeenCalledWith([]);
  });
});
