/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTemporarySourceOverride } from './useTemporarySourceOverride';
import type { MapperSource } from '../types';

const makeSources = (): MapperSource[] => [
  { id: 'src1', label: 'Source 1', sampleData: { foo: 1, bar: 'hello' } },
  { id: 'src2', label: 'Source 2', sampleData: { baz: true } },
];

describe('useTemporarySourceOverride', () => {
  it('returns original sources when editor is hidden', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'src1'),
    );
    expect(result.current.effectiveSources).toBe(sources);
    expect(result.current.showSourceEditor).toBe(false);
    expect(result.current.sourceJsonError).toBeNull();
  });

  it('toggles source editor and initializes tempSourceJson', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'src1'),
    );
    act(() => result.current.handleToggleSourceEditor());
    expect(result.current.showSourceEditor).toBe(true);
    expect(result.current.tempSourceJson).toBe(JSON.stringify({ foo: 1, bar: 'hello' }, null, 2));
  });

  it('overrides active source sampleData with valid JSON', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'src1'),
    );
    act(() => result.current.handleToggleSourceEditor());
    act(() => result.current.setTempSourceJson('{"foo": 999}'));
    expect(result.current.effectiveSources[0].sampleData).toEqual({ foo: 999 });
    expect(result.current.effectiveSources[1].sampleData).toEqual({ baz: true });
    expect(result.current.sourceJsonError).toBeNull();
  });

  it('sets error for invalid JSON and returns original sources', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'src1'),
    );
    act(() => result.current.handleToggleSourceEditor());
    act(() => result.current.setTempSourceJson('{invalid'));
    expect(result.current.sourceJsonError).toBe('Invalid JSON');
    expect(result.current.effectiveSources).toBe(sources);
  });

  it('returns original sources when tempSourceJson is empty', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'src1'),
    );
    act(() => result.current.handleToggleSourceEditor());
    act(() => result.current.setTempSourceJson(''));
    expect(result.current.effectiveSources).toBe(sources);
  });

  it('toggles editor off', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'src1'),
    );
    act(() => result.current.handleToggleSourceEditor());
    expect(result.current.showSourceEditor).toBe(true);
    act(() => result.current.handleToggleSourceEditor());
    expect(result.current.showSourceEditor).toBe(false);
  });

  it('initializes with data from the correct active source', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'src2'),
    );
    act(() => result.current.handleToggleSourceEditor());
    expect(result.current.tempSourceJson).toBe(JSON.stringify({ baz: true }, null, 2));
  });

  it('handles missing active source gracefully', () => {
    const sources = makeSources();
    const { result } = renderHook(() =>
      useTemporarySourceOverride(sources, 'nonexistent'),
    );
    act(() => result.current.handleToggleSourceEditor());
    expect(result.current.tempSourceJson).toBe('{}');
  });
});
