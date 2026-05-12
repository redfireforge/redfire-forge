/** @vitest-environment jsdom */
import React, { useLayoutEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTargetFields } from './useTargetFields';
import type { Mapping, MapperAdapter, TargetField } from '../types';

const makeAdapter = (overrides?: Partial<MapperAdapter>): MapperAdapter => ({
  contextId: 'ctx',
  title: 'Test Adapter',
  sources: [{ id: 'src1', label: 'Source 1', sampleData: '{"a":1}' }],
  target: {
    label: 'Target',
    sampleData: null,
    fields: [],
    allowCustomFields: true,
    ...overrides?.target,
  },
  serialize: (mappings) => mappings as unknown,
  deserialize: (data) => data as unknown as Mapping[],
  ...overrides,
});

const baseMapping = (partial: Partial<Mapping> = {}): Mapping => ({
  id: 'm1',
  sourcePath: 'a',
  sourceId: 'src1',
  targetPath: 'out.path',
  ...partial,
});

function LayoutRunner({ onRun }: { onRun: () => void }) {
  const fn = useRef(onRun);
  fn.current = onRun;
  useLayoutEffect(() => {
    fn.current();
  }, []);
  return null;
}

describe('useTargetFields', () => {
  let removeMappings: ReturnType<typeof vi.fn>;
  let updateMapping: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    removeMappings = vi.fn();
    updateMapping = vi.fn();
  });

  it('handleReorderTargetField uses effectiveTarget.fields when targetFieldOrder is still empty (before useEffect)', () => {
    const withFields = makeAdapter({
      target: {
        label: 'T',
        allowCustomFields: true,
        fields: [
          { path: 'a', label: 'A' },
          { path: 'b', label: 'B' },
        ],
      },
    });

    const reorderAfterPaint = { current: null as null | (() => void) };

    const { result } = renderHook(
      () => {
        const r = useTargetFields({
          adapter: withFields,
          mappings: [],
          removeMappings,
          updateMapping,
        });
        reorderAfterPaint.current = () => r.handleReorderTargetField('b', 'a');
        return r;
      },
      {
        wrapper: ({ children }) =>
          React.createElement(
            React.Fragment,
            null,
            children,
            React.createElement(LayoutRunner, {
              onRun: () => {
                reorderAfterPaint.current?.();
              },
            }),
          ),
      },
    );

    expect(result.current.effectiveTarget.fields?.map((f) => f.path)).toEqual(['b', 'a']);
  });

  it('initial state: effectiveTarget is adapter.target when no custom/fetched/override/hydration', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    expect(result.current.effectiveTarget).toBe(adapter.target);
    expect(result.current.customTargetFields).toEqual([]);
    expect(result.current.fetchedTargetFields).toEqual([]);
    expect(result.current.targetFetchError).toBeNull();
  });

  it('handleAddCustomField adds field to effectiveTarget.fields and ignores duplicate path', () => {
    const adapter = makeAdapter();
    const field: TargetField = { path: 'custom.x', label: 'Custom X', type: 'string' };

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handleAddCustomField(field);
    });
    expect(result.current.customTargetFields).toEqual([
      { ...field, origin: 'custom' },
    ]);
    expect(result.current.effectiveTarget.fields).toContainEqual({
      ...field,
      origin: 'custom',
    });

    act(() => {
      result.current.handleAddCustomField({ ...field, label: 'Duplicate' });
    });
    expect(result.current.customTargetFields).toHaveLength(1);
  });

  it('handleRemoveCustomField removes custom field and calls removeMappings for matching targetPath', () => {
    const adapter = makeAdapter();
    const mappings: Mapping[] = [
      baseMapping({ id: 'a', targetPath: 'keep' }),
      baseMapping({ id: 'b', targetPath: 'gone' }),
    ];

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings, removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handleAddCustomField({
        path: 'gone',
        label: 'Gone',
        type: 'string',
      });
    });

    act(() => {
      result.current.handleRemoveCustomField('gone');
    });

    expect(result.current.customTargetFields).toEqual([]);
    expect(removeMappings).toHaveBeenCalledWith(['b']);
  });

  it('handleUpdateCustomField updates in place; path change calls updateMapping', () => {
    const adapter = makeAdapter();
    const mappings: Mapping[] = [baseMapping({ id: 'x', targetPath: 'old.p' })];

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings, removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handleAddCustomField({
        path: 'old.p',
        label: 'Old',
        type: 'string',
      });
    });

    act(() => {
      result.current.handleUpdateCustomField('old.p', {
        path: 'old.p',
        label: 'Renamed label',
        type: 'number',
      });
    });
    expect(updateMapping).not.toHaveBeenCalled();
    expect(result.current.customTargetFields[0]).toMatchObject({
      path: 'old.p',
      label: 'Renamed label',
      origin: 'custom',
    });

    act(() => {
      result.current.handleUpdateCustomField('old.p', {
        path: 'new.p',
        label: 'Moved',
        type: 'string',
      });
    });
    expect(updateMapping).toHaveBeenCalledWith('x', { targetPath: 'new.p' });
    expect(result.current.customTargetFields[0].path).toBe('new.p');
  });

  it('merges adapter fields, fetched, mapped hydration, and custom with deduping by path', async () => {
    const adapter = makeAdapter({
      target: {
        label: 'Target',
        allowCustomFields: true,
        sampleData: null,
        fields: [
          { path: 'a', label: 'A', type: 'string', origin: 'adapter' },
          { path: 'dup', label: 'From adapter', type: 'string' },
        ],
      },
    });

    const fetchFields: TargetField[] = [
      { path: 'b', label: 'Fetched B', type: 'string' },
      { path: 'dup', label: 'Dup from fetch', type: 'string' },
      { path: 'c', label: 'Fetched C', type: 'string' },
    ];

    const { result, rerender } = renderHook(
      ({ maps, ad }) =>
        useTargetFields({ adapter: ad, mappings: maps, removeMappings, updateMapping }),
      {
        initialProps: {
          maps: [],
          ad: {
            ...adapter,
            fetchTargetSchema: async () => ({
              fields: fetchFields,
            }),
          },
        },
      },
    );

    await act(async () => {
      await result.current.handleFetchTargetSchema();
    });

    act(() => {
      result.current.handleAddCustomField({
        path: 'd',
        label: 'Custom D',
        type: 'string',
      });
    });

    const paths = result.current.effectiveTarget.fields?.map((f) => f.path) ?? [];
    expect(paths).toContain('a');
    expect(paths).toContain('dup');
    expect(paths).toContain('b');
    expect(paths).toContain('c');
    expect(paths).toContain('d');
    expect(paths.filter((p) => p === 'dup')).toHaveLength(1);

    const adapterField = result.current.effectiveTarget.fields?.find((f) => f.path === 'a');
    expect(adapterField?.origin).toBe('adapter');

    const fetchedField = result.current.effectiveTarget.fields?.find((f) => f.path === 'b');
    expect(fetchedField?.origin).toBe('fetched');

    const fromFetchC = result.current.effectiveTarget.fields?.find((f) => f.path === 'c');
    expect(fromFetchC).toMatchObject({
      path: 'c',
      label: 'Fetched C',
      type: 'string',
      origin: 'fetched',
    });

    const dup = adapter.target.fields?.find((f) => f.path === 'dup');
    expect(dup?.origin).toBeUndefined();
    const effectiveDup = result.current.effectiveTarget.fields?.find((f) => f.path === 'dup');
    expect(effectiveDup?.origin).toBe('adapter');

    const adapter2 = makeAdapter({
      target: {
        label: 'Target',
        allowCustomFields: true,
        sampleData: '{"x":1}',
        fields: [],
      },
    });
    rerender({ maps: [baseMapping({ targetPath: 'only.from.map' })], ad: adapter2 });
    expect(
      result.current.effectiveTarget.fields?.some((f) => f.path === 'only.from.map'),
    ).toBe(false);
  });

  it('clears field order when paths become empty after removing the only custom field', async () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handleAddCustomField({ path: 'solo', label: 'Solo' });
    });
    expect(result.current.effectiveTarget.fields?.map((f) => f.path)).toEqual(['solo']);

    act(() => {
      result.current.handleRemoveCustomField('solo');
    });
    expect(result.current.effectiveTarget).toBe(adapter.target);

    await act(async () => {
      await Promise.resolve();
    });
  });

  it('mappingTargetFields skips empty and whitespace-only targetPath', () => {
    const adapter = makeAdapter();
    const mappings: Mapping[] = [
      baseMapping({ id: '1', targetPath: '' }),
      baseMapping({ id: '2', targetPath: '   ' }),
      baseMapping({ id: '3', targetPath: 'ok' }),
    ];
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings, removeMappings, updateMapping }),
    );
    expect(result.current.effectiveTarget.fields?.map((f) => f.path)).toEqual(['ok']);
  });

  it('hydrates effectiveTarget.fields from mappings when adapter has no sample and no fields', () => {
    const adapter = makeAdapter();
    const mappings: Mapping[] = [
      baseMapping({ id: '1', targetPath: '  z1  ' }),
      baseMapping({ id: '2', targetPath: 'z2' }),
    ];

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings, removeMappings, updateMapping }),
    );

    const paths = result.current.effectiveTarget.fields?.map((f) => f.path) ?? [];
    expect(paths).toEqual(['z1', 'z2']);
    expect(
      result.current.effectiveTarget.fields?.find((f) => f.path === 'z1'),
    ).toMatchObject({ label: 'z1', type: 'string', origin: 'adapter' });
  });

  it('handleReorderTargetField moves path; no-op for missing paths, empty, or same path', () => {
    const adapter = makeAdapter({
      target: {
        label: 'T',
        allowCustomFields: true,
        fields: [
          { path: 'x', label: 'X' },
          { path: 'y', label: 'Y' },
          { path: 'z', label: 'Z' },
        ],
      },
    });

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    const initial = result.current.effectiveTarget.fields?.map((f) => f.path) ?? [];

    act(() => {
      result.current.handleReorderTargetField('', 'y');
      result.current.handleReorderTargetField('x', '');
      result.current.handleReorderTargetField('x', 'x');
      result.current.handleReorderTargetField('nope', 'y');
      result.current.handleReorderTargetField('x', 'nope');
    });
    expect(result.current.effectiveTarget.fields?.map((f) => f.path)).toEqual(initial);

    act(() => {
      result.current.handleReorderTargetField('z', 'x');
    });
    expect(result.current.effectiveTarget.fields?.map((f) => f.path)).toEqual(['z', 'x', 'y']);
  });

  it('handleFetchTargetSchema applies sampleData + fields; skips when fetchTargetSchema missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      sampleData: { ok: true },
      fields: [{ path: 'f1', label: 'F1', type: 'string' }],
    });
    const adapter = makeAdapter({ fetchTargetSchema: fetchFn });

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    await act(async () => {
      await result.current.handleFetchTargetSchema();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.current.targetFetchError).toBeNull();
    expect(result.current.effectiveTarget.sampleData).toEqual({ ok: true });
    expect(result.current.fetchedTargetFields).toEqual([
      { path: 'f1', label: 'F1', type: 'string', origin: 'fetched' },
    ]);
    expect(result.current.effectiveTarget.fields?.some((f) => f.path === 'f1')).toBe(true);

    const bare = makeAdapter();
    const { result: r2 } = renderHook(() =>
      useTargetFields({ adapter: bare, mappings: [], removeMappings, updateMapping }),
    );
    await act(async () => {
      await r2.current.handleFetchTargetSchema();
    });
    expect(r2.current.effectiveTarget).toBe(bare.target);
  });

  it('handleFetchTargetSchema sets targetFetchError on Error and on non-Error throw', async () => {
    const adapterErr = makeAdapter({
      fetchTargetSchema: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const { result: r1 } = renderHook(() =>
      useTargetFields({ adapter: adapterErr, mappings: [], removeMappings, updateMapping }),
    );

    await act(async () => {
      await r1.current.handleFetchTargetSchema();
    });
    expect(r1.current.targetFetchError).toBe('network down');

    const adapterStr = makeAdapter({
      fetchTargetSchema: vi.fn().mockRejectedValue('boom'),
    });
    const { result: r2 } = renderHook(() =>
      useTargetFields({ adapter: adapterStr, mappings: [], removeMappings, updateMapping }),
    );
    await act(async () => {
      await r2.current.handleFetchTargetSchema();
    });
    expect(r2.current.targetFetchError).toBe('Failed to fetch target schema');
  });

  it('handleFetchTargetSchema clears prior error when starting a successful fetch', async () => {
    const adapter = makeAdapter({
      fetchTargetSchema: vi
        .fn()
        .mockRejectedValueOnce(new Error('first'))
        .mockResolvedValueOnce({ fields: [{ path: 'ok', label: 'OK' }] }),
    });

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    await act(async () => {
      await result.current.handleFetchTargetSchema();
    });
    expect(result.current.targetFetchError).toBe('first');

    await act(async () => {
      await result.current.handleFetchTargetSchema();
    });
    expect(result.current.targetFetchError).toBeNull();
  });

  it('handleFetchTargetSchema does not set sample override when sampleData is null', async () => {
    const adapter = makeAdapter({
      fetchTargetSchema: vi.fn().mockResolvedValue({
        sampleData: null,
        fields: [{ path: 'f', label: 'F' }],
      }),
    });
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );
    await act(async () => {
      await result.current.handleFetchTargetSchema();
    });
    expect(result.current.effectiveTarget.sampleData).toBeNull();
    expect(result.current.fetchedTargetFields.map((f) => f.path)).toEqual(['f']);
  });

  it('handleUpdateCustomField is a no-op when oldPath does not match a custom field', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handleUpdateCustomField('missing', {
        path: 'x',
        label: 'X',
        type: 'string',
      });
    });
    expect(result.current.customTargetFields).toEqual([]);
    expect(updateMapping).not.toHaveBeenCalled();
  });

  it('handleFetchTargetSchema does not set sample override when sampleData is absent; empty fields ignored', async () => {
    const adapter = makeAdapter({
      fetchTargetSchema: vi.fn().mockResolvedValue({ fields: [] }),
    });
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    await act(async () => {
      await result.current.handleFetchTargetSchema();
    });
    expect(result.current.effectiveTarget.sampleData).toBeNull();
    expect(result.current.fetchedTargetFields).toEqual([]);
  });

  it('effectiveTarget is a new object when only sample override is applied (no merged field rows)', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handlePasteTargetSample({ shape: 'sample-only' });
    });
    expect(result.current.effectiveTarget.sampleData).toEqual({ shape: 'sample-only' });
    expect(result.current.effectiveTarget).not.toBe(adapter.target);
  });

  it('handlePasteTargetSample sets sampleData on effectiveTarget and clears targetFetchError', async () => {
    const adapter = makeAdapter({
      fetchTargetSchema: vi.fn().mockRejectedValue(new Error('bad')),
    });

    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    await act(async () => {
      await result.current.handleFetchTargetSchema();
    });
    expect(result.current.targetFetchError).toBe('bad');

    act(() => {
      result.current.handlePasteTargetSample({ pasted: 1 });
    });
    expect(result.current.effectiveTarget.sampleData).toEqual({ pasted: 1 });
    expect(result.current.targetFetchError).toBeNull();
  });

  it('target field drag ref: start, read, end', () => {
    const { result } = renderHook(() =>
      useTargetFields({ adapter: makeAdapter(), mappings: [], removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handleTargetFieldDragStart('path.a');
    });
    expect(result.current.getDraggedTargetFieldPath()).toBe('path.a');
    expect(result.current.draggedTargetFieldPathRef.current).toBe('path.a');

    act(() => {
      result.current.handleTargetFieldDragEnd();
    });
    expect(result.current.getDraggedTargetFieldPath()).toBeNull();
  });

  it('handleReorderTargetField clears draggedTargetFieldPathRef', () => {
    const adapter = makeAdapter({
      target: {
        label: 'T',
        allowCustomFields: true,
        fields: [
          { path: 'a', label: 'A' },
          { path: 'b', label: 'B' },
        ],
      },
    });
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    act(() => {
      result.current.handleTargetFieldDragStart('a');
      result.current.handleReorderTargetField('b', 'a');
    });
    expect(result.current.draggedTargetFieldPathRef.current).toBeNull();
  });

  it('sort stable tie: fields missing from targetFieldOrder stay relative (both null index)', async () => {
    const adapter = makeAdapter({
      target: {
        label: 'T',
        allowCustomFields: true,
        fields: [
          { path: 'p1', label: 'P1' },
          { path: 'p2', label: 'P2' },
        ],
      },
    });
    const { result } = renderHook(() =>
      useTargetFields({ adapter, mappings: [], removeMappings, updateMapping }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.handleReorderTargetField('p2', 'p1');
    });
    expect(result.current.effectiveTarget.fields?.map((f) => f.path)).toEqual(['p2', 'p1']);
  });
});
