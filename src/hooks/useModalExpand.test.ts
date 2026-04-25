/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalExpand } from './useModalExpand';

describe('useModalExpand', () => {
  it('defaults to collapsed', () => {
    const { result } = renderHook(() => useModalExpand());
    expect(result.current.expanded).toBe(false);
    expect(result.current.expandClass).toBe('');
  });

  it('accepts initial=true', () => {
    const { result } = renderHook(() => useModalExpand(true));
    expect(result.current.expanded).toBe(true);
    expect(result.current.expandClass).toBe('modal-expanded');
  });

  it('toggleExpand flips state', () => {
    const { result } = renderHook(() => useModalExpand());
    act(() => result.current.toggleExpand());
    expect(result.current.expanded).toBe(true);
    expect(result.current.expandClass).toBe('modal-expanded');
    act(() => result.current.toggleExpand());
    expect(result.current.expanded).toBe(false);
    expect(result.current.expandClass).toBe('');
  });

  it('setExpanded allows direct control', () => {
    const { result } = renderHook(() => useModalExpand());
    act(() => result.current.setExpanded(true));
    expect(result.current.expanded).toBe(true);
    act(() => result.current.setExpanded(false));
    expect(result.current.expanded).toBe(false);
  });

  it('fullscreen mode uses modal-fullscreen class', () => {
    const { result } = renderHook(() => useModalExpand(false, 'fullscreen'));
    expect(result.current.expandClass).toBe('');
    act(() => result.current.toggleExpand());
    expect(result.current.expandClass).toBe('modal-fullscreen');
  });

  it('expanded mode uses modal-expanded class', () => {
    const { result } = renderHook(() => useModalExpand(false, 'expanded'));
    act(() => result.current.toggleExpand());
    expect(result.current.expandClass).toBe('modal-expanded');
  });
});
