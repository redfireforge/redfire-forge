import { describe, it, expect, vi } from 'vitest';
import { toggleSetItem } from './setToggle';

describe('toggleSetItem', () => {
  it('adds an item not in the set', () => {
    const setter = vi.fn();
    toggleSetItem(setter, 'a');
    const updater = setter.mock.calls[0][0];
    const result = updater(new Set<string>());
    expect(result.has('a')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('removes an item already in the set', () => {
    const setter = vi.fn();
    toggleSetItem(setter, 'b');
    const updater = setter.mock.calls[0][0];
    const result = updater(new Set(['b', 'c']));
    expect(result.has('b')).toBe(false);
    expect(result.has('c')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('works with numeric items', () => {
    const setter = vi.fn();
    toggleSetItem(setter, 42);
    const updater = setter.mock.calls[0][0];
    expect(updater(new Set<number>()).has(42)).toBe(true);
    expect(updater(new Set([42])).has(42)).toBe(false);
  });

  it('does not mutate the original set', () => {
    const setter = vi.fn();
    const original = new Set(['x']);
    toggleSetItem(setter, 'x');
    const updater = setter.mock.calls[0][0];
    updater(original);
    expect(original.has('x')).toBe(true); // original unchanged
  });
});
