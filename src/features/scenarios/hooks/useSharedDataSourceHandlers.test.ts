/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Scenario, FeatureGroup, SharedDataSource, DataSource } from '@shared/types';
import { useSharedDataSourceHandlers } from './useSharedDataSourceHandlers';

function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1', name: 'FG One',
    scenarios: [{ id: 'sc-1', name: 'SC One', tests: [] }],
    ...overrides,
  } as unknown as FeatureGroup;
}

function makeDraft(): Scenario {
  return { id: 't-1', name: 'Draft', url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } as Scenario;
}

function setup(params: Partial<Parameters<typeof useSharedDataSourceHandlers>[0]> = {}) {
  const featureGroups = params.featureGroups ?? [makeFg()];
  const base = {
    featureGroups,
    setFeatureGroups: vi.fn(),
    setSharedDataSources: vi.fn(),
    editingTest: null,
    draft: null,
    setDraft: vi.fn(),
    setEditingTest: vi.fn(),
    setInputMode: vi.fn(),
    setActiveTab: vi.fn(),
    ...params,
  } as Parameters<typeof useSharedDataSourceHandlers>[0];
  const hook = renderHook(() => useSharedDataSourceHandlers(base));
  return { hook, params: base };
}

describe('useSharedDataSourceHandlers', () => {
  it('exposes default modal state', () => {
    const { hook } = setup();
    expect(hook.result.current.showSharedDsModal).toBe(false);
    expect(hook.result.current.sharedDsModalSelectedId).toBeUndefined();
    expect(hook.result.current.showFromSharedDsPicker).toBeNull();
  });

  it('returns undefined currentEditingDraft when not editing', () => {
    const { hook } = setup();
    expect(hook.result.current.currentEditingDraft).toBeUndefined();
  });

  it('resolves currentEditingDraft when editing a found test', () => {
    const { hook } = setup({
      editingTest: { featureId: 'fg-1', scenarioId: 'sc-1', testId: 't-1' },
      draft: makeDraft(),
    });
    expect(hook.result.current.currentEditingDraft).toEqual({
      fgName: 'FG One', scenarioName: 'SC One', test: expect.objectContaining({ id: 't-1' }),
    });
  });

  it('returns undefined currentEditingDraft when feature/scenario not found', () => {
    const { hook } = setup({
      editingTest: { featureId: 'missing', scenarioId: 'sc-1', testId: 't-1' },
      draft: makeDraft(),
    });
    expect(hook.result.current.currentEditingDraft).toBeUndefined();
  });

  it('warns and returns empty id when setSharedDataSources is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { hook } = setup({ setSharedDataSources: undefined });
    let id = 'unset';
    act(() => { id = hook.result.current.handlePromoteToShared({} as DataSource, 'Name'); });
    expect(id).toBe('');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('creates a shared data source and returns its id', () => {
    const setSharedDataSources = vi.fn();
    const { hook } = setup({ setSharedDataSources });
    let id = '';
    act(() => {
      id = hook.result.current.handlePromoteToShared(
        { rows: [] } as unknown as DataSource,
        'Promoted',
        ['tag'],
        { url: '/x', method: 'POST', headers: [] },
      );
    });
    expect(id).toBeTruthy();
    expect(setSharedDataSources).toHaveBeenCalledWith(expect.any(Function));
    const updater = setSharedDataSources.mock.calls[0][0] as (prev: SharedDataSource[]) => SharedDataSource[];
    const next = updater([]);
    expect(next[0].name).toBe('Promoted');
    expect(next[0].fetchConfig?.method).toBe('POST');
  });

  it('creates a test from a shared data source and switches into builder/data view', () => {
    const setFeatureGroups = vi.fn();
    const setDraft = vi.fn();
    const setEditingTest = vi.fn();
    const setInputMode = vi.fn();
    const setActiveTab = vi.fn();
    const { hook } = setup({ setFeatureGroups, setDraft, setEditingTest, setInputMode, setActiveTab });
    const sharedDs = {
      id: 'sds-1', name: 'Shared',
      fetchConfig: { url: '/api', method: 'GET', headers: [] },
    } as unknown as SharedDataSource;
    act(() => hook.result.current.handleCreateTestFromSharedDs(sharedDs, 'fg-1', 'sc-1', 'New Test'));
    expect(setFeatureGroups).toHaveBeenCalledWith(expect.any(Function));
    expect(setDraft).toHaveBeenCalled();
    expect(setEditingTest).toHaveBeenCalledWith(expect.objectContaining({ featureId: 'fg-1', parameterized: true }));
    expect(setInputMode).toHaveBeenCalledWith('builder');
    expect(setActiveTab).toHaveBeenCalledWith('data');

    const updater = setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
    const next = updater([makeFg()]);
    expect(next[0].scenarios[0].tests).toHaveLength(1);
    expect(next[0].scenarios[0].tests[0].name).toBe('New Test');
  });

  it('toggles modal state setters', () => {
    const { hook } = setup();
    act(() => hook.result.current.setShowSharedDsModal(true));
    expect(hook.result.current.showSharedDsModal).toBe(true);
    act(() => hook.result.current.setSharedDsModalSelectedId('sds-9'));
    expect(hook.result.current.sharedDsModalSelectedId).toBe('sds-9');
    act(() => hook.result.current.setShowFromSharedDsPicker({ fgId: 'fg-1', scId: 'sc-1' }));
    expect(hook.result.current.showFromSharedDsPicker).toEqual({ fgId: 'fg-1', scId: 'sc-1' });
  });

  it('promotes with no fetchConfig — uses defaults for method/headers', () => {
    const setSharedDataSources = vi.fn();
    const { hook } = setup({ setSharedDataSources });
    let id = '';
    act(() => {
      id = hook.result.current.handlePromoteToShared({ rows: [] } as unknown as DataSource, 'NoConfig');
    });
    expect(id).toBeTruthy();
    const updater = setSharedDataSources.mock.calls[0][0] as (prev: SharedDataSource[]) => SharedDataSource[];
    const next = updater([]);
    expect(next[0].fetchConfig).toBeUndefined();
  });

  it('promotes with fetchConfig missing method — defaults to GET', () => {
    const setSharedDataSources = vi.fn();
    const { hook } = setup({ setSharedDataSources });
    act(() => {
      hook.result.current.handlePromoteToShared(
        { rows: [] } as unknown as DataSource,
        'NoMethod',
        [],
        { url: '/y', method: '', headers: [] },
      );
    });
    const updater = setSharedDataSources.mock.calls[0][0] as (prev: SharedDataSource[]) => SharedDataSource[];
    const next = updater([]);
    expect(next[0].fetchConfig?.method).toBe('GET');
  });

  it('creates test from shared DS with no fetchConfig — uses empty defaults', () => {
    const setFeatureGroups = vi.fn();
    const setDraft = vi.fn();
    const setEditingTest = vi.fn();
    const setInputMode = vi.fn();
    const setActiveTab = vi.fn();
    const { hook } = setup({ setFeatureGroups, setDraft, setEditingTest, setInputMode, setActiveTab });
    const sharedDs = { id: 'sds-2', name: 'NoConfig' } as unknown as SharedDataSource;
    act(() => hook.result.current.handleCreateTestFromSharedDs(sharedDs, 'fg-1', 'sc-1', 'FromEmpty'));
    const draft = setDraft.mock.calls[0][0] as Scenario;
    expect(draft.url).toBe('');
    expect(draft.method).toBe('GET');
    expect(draft.headers).toEqual([]);
    expect(draft.auth).toEqual({ type: 'none' });
  });

  it('returns undefined currentEditingDraft when scenario not found', () => {
    const { hook } = setup({
      featureGroups: [makeFg({ id: 'fg-1', scenarios: [] })],
      editingTest: { featureId: 'fg-1', scenarioId: 'missing', testId: 't-1' },
      draft: makeDraft(),
    });
    expect(hook.result.current.currentEditingDraft).toBeUndefined();
  });

  it('promotes with fetchConfig headers omitted', () => {
    const setSharedDataSources = vi.fn();
    const { hook } = setup({ setSharedDataSources });
    act(() => {
      hook.result.current.handlePromoteToShared(
        { rows: [] } as unknown as DataSource,
        'NoHeaders',
        [],
        { url: '/z', method: 'GET', headers: undefined as unknown as [] },
      );
    });
    const updater = setSharedDataSources.mock.calls[0][0] as (prev: SharedDataSource[]) => SharedDataSource[];
    expect(updater([])[0].fetchConfig?.headers).toEqual([]);
  });

  it('only adds test to matching feature group and scenario', () => {
    const setFeatureGroups = vi.fn();
    const { hook } = setup({
      setFeatureGroups,
      featureGroups: [
        makeFg({ id: 'fg-1', scenarios: [{ id: 'sc-1', name: 'A', tests: [] }] }),
        makeFg({ id: 'fg-2', scenarios: [{ id: 'sc-2', name: 'B', tests: [] }] }),
      ],
    });
    const sharedDs = { id: 'sds-3', name: 'Shared' } as unknown as SharedDataSource;
    act(() => hook.result.current.handleCreateTestFromSharedDs(sharedDs, 'fg-2', 'sc-2', 'Targeted'));
    const updater = setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
    const next = updater([
      makeFg({ id: 'fg-1', scenarios: [{ id: 'sc-1', name: 'A', tests: [] }] }),
      makeFg({ id: 'fg-2', scenarios: [{ id: 'sc-2', name: 'B', tests: [] }] }),
    ]);
    expect(next[0].scenarios[0].tests).toHaveLength(0);
    expect(next[1].scenarios[0].tests).toHaveLength(1);
  });

  it('returns undefined currentEditingDraft when editingTest is set but draft is null', () => {
    // !draft branch (right side of || operator)
    const { hook } = setup({
      editingTest: { featureId: 'fg-1', scenarioId: 'sc-1', testId: 't-1' },
      draft: null,
    });
    expect(hook.result.current.currentEditingDraft).toBeUndefined();
  });

  it('uses auth from fetchConfig when provided (true branch of auth || default)', () => {
    const setFeatureGroups = vi.fn();
    const setDraft = vi.fn();
    const { hook } = setup({ setFeatureGroups, setDraft });
    const sharedDs = {
      id: 'sds-4',
      name: 'WithAuth',
      fetchConfig: {
        url: '/secure',
        method: 'POST',
        headers: [],
        auth: { type: 'bearer', token: 'tok' },
      },
    } as unknown as SharedDataSource;
    act(() => hook.result.current.handleCreateTestFromSharedDs(sharedDs, 'fg-1', 'sc-1', 'Auth Test'));
    const draft = setDraft.mock.calls[0][0] as typeof import('../../../shared/types').Scenario;
    expect((draft as Record<string, unknown>).auth).toEqual({ type: 'bearer', token: 'tok' });
  });

  it('skips non-matching scenario when creating test (sc.id !== targetScenarioId true branch)', () => {
    const setFeatureGroups = vi.fn();
    const { hook } = setup({ setFeatureGroups });
    const sharedDs = { id: 'sds-5', name: 'Shared' } as unknown as SharedDataSource;
    act(() => hook.result.current.handleCreateTestFromSharedDs(sharedDs, 'fg-1', 'sc-2', 'Only sc-2'));
    const updater = setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
    // fg-1 has sc-1, target is sc-2 → sc-1 should be unchanged
    const next = updater([
      makeFg({ id: 'fg-1', scenarios: [{ id: 'sc-1', name: 'A', tests: [] }, { id: 'sc-2', name: 'B', tests: [] }] }),
    ]);
    expect(next[0].scenarios[0].tests).toHaveLength(0); // sc-1 unchanged
    expect(next[0].scenarios[1].tests).toHaveLength(1); // sc-2 got the new test
  });
});
