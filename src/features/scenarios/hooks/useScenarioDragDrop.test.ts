/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenarioDragDrop } from './useScenarioDragDrop';
import type { FeatureGroup } from '../../../shared/types';

const fg = (id: string, scenarios: { id: string; name: string; tests: { id: string; name: string }[] }[] = []): FeatureGroup => ({
  id,
  name: `Feature ${id}`,
  scenarios: scenarios.map(s => ({ ...s, tests: s.tests.map(t => ({ ...t, url: '', method: 'GET' as const, headers: [], body: '', auth: { type: 'none' as const }, validation: { mode: 'none' as const } })) })),
});

describe('useScenarioDragDrop', () => {
  let setFeatureGroups: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setFeatureGroups = vi.fn((updater) => {
      if (typeof updater === 'function') return updater([]);
      return updater;
    });
  });

  it('initializes with null drag/drop state', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    expect(result.current.dragScenario).toBeNull();
    expect(result.current.dragTest).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it('sets and clears drag scenario state', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.setDragScenario({ scenarioId: 's1', fromFeatureId: 'f1' }));
    expect(result.current.dragScenario).toEqual({ scenarioId: 's1', fromFeatureId: 'f1' });
    act(() => result.current.setDragScenario(null));
    expect(result.current.dragScenario).toBeNull();
  });

  it('sets and clears drag test state', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.setDragTest({ testId: 't1', fromFeatureId: 'f1', fromScenarioId: 's1' }));
    expect(result.current.dragTest).toEqual({ testId: 't1', fromFeatureId: 'f1', fromScenarioId: 's1' });
  });

  it('sets drop target', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.setDropTarget({ type: 'scenario', featureId: 'f2', targetId: 's2' }));
    expect(result.current.dropTarget).toEqual({ type: 'scenario', featureId: 'f2', targetId: 's2' });
  });

  it('handleDragEnd clears all drag state', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => {
      result.current.setDragScenario({ scenarioId: 's1', fromFeatureId: 'f1' });
      result.current.setDropTarget({ type: 'scenario', featureId: 'f2' });
    });
    act(() => result.current.handleDragEnd());
    expect(result.current.dragScenario).toBeNull();
    expect(result.current.dragTest).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it('moveScenario moves scenario between feature groups', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [{ id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }] }]),
      fg('f2', []),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveScenario('s1', 'f1', 'f2'));

    expect(setFeatureGroups).toHaveBeenCalled();
    const updatedFgs = setFeatureGroups.mock.results[0].value;
    expect(updatedFgs[0].scenarios).toHaveLength(0);
    expect(updatedFgs[1].scenarios).toHaveLength(1);
    expect(updatedFgs[1].scenarios[0].id).toBe('s1');
  });

  it('moveScenario with beforeScId inserts at correct position', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [{ id: 's1', name: 'Scenario 1', tests: [] }]),
      fg('f2', [{ id: 's2', name: 'Scenario 2', tests: [] }, { id: 's3', name: 'Scenario 3', tests: [] }]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveScenario('s1', 'f1', 'f2', 's3'));

    const updatedFgs = setFeatureGroups.mock.results[0].value;
    expect(updatedFgs[1].scenarios.map((s: { id: string }) => s.id)).toEqual(['s2', 's1', 's3']);
  });

  it('moveScenario does nothing for same group without beforeScId', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveScenario('s1', 'f1', 'f1'));
    expect(setFeatureGroups).not.toHaveBeenCalled();
  });

  it('moveScenario returns prev when scenario not found', () => {
    const fgs: FeatureGroup[] = [fg('f1', []), fg('f2', [])];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveScenario('nonexistent', 'f1', 'f2'));

    expect(setFeatureGroups.mock.results[0].value).toBe(fgs);
  });

  it('moveScenario aborts cross-feature moves when scenario is missing from populated source', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [{ id: 's1', name: 'Scenario 1', tests: [] }]),
      fg('f2', []),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveScenario('missing-id', 'f1', 'f2'));

    expect(setFeatureGroups.mock.results[0].value).toBe(fgs);
  });

  it('moveTest moves test between scenarios', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }, { id: 't2', name: 'Test 2' }] },
        { id: 's2', name: 'Scenario 2', tests: [] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('t1', 'f1', 's1', 'f1', 's2'));

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[0].scenarios[0].tests).toHaveLength(1);
    expect(updated[0].scenarios[1].tests).toHaveLength(1);
    expect(updated[0].scenarios[1].tests[0].id).toBe('t1');
  });

  it('moveTest with beforeTestId inserts at correct position', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }] },
        { id: 's2', name: 'Scenario 2', tests: [{ id: 't2', name: 'Test 2' }, { id: 't3', name: 'Test 3' }] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('t1', 'f1', 's1', 'f1', 's2', 't3'));

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[0].scenarios[1].tests.map((t: { id: string }) => t.id)).toEqual(['t2', 't1', 't3']);
  });

  it('moveTest returns prev when test id not found on cross-feature attempt', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [{ id: 's1', name: 'S1', tests: [{ id: 't1', name: 'T1' }] }]),
      fg('f2', [{ id: 's2', name: 'S2', tests: [] }]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('missing-t', 'f1', 's1', 'f2', 's2'));

    expect(setFeatureGroups.mock.results[0].value).toBe(fgs);
  });

  it('moveTest does nothing when same location without beforeTestId', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('t1', 'f1', 's1', 'f1', 's1'));
    expect(setFeatureGroups).not.toHaveBeenCalled();
  });

  it('moveTest returns prev when test not found', () => {
    const fgs: FeatureGroup[] = [fg('f1', [{ id: 's1', name: 'Scenario 1', tests: [] }])];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('nonexistent', 'f1', 's1', 'f1', 's1', 'before'));

    expect(setFeatureGroups.mock.results[0].value).toBe(fgs);
  });

  it('moveScenario with beforeScId not found appends to end', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [{ id: 's1', name: 'Scenario 1', tests: [] }]),
      fg('f2', [{ id: 's2', name: 'Scenario 2', tests: [] }]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveScenario('s1', 'f1', 'f2', 'nonexistent'));

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[1].scenarios.map((s: { id: string }) => s.id)).toEqual(['s2', 's1']);
  });

  it('moveTest with beforeTestId not found appends to end', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }] },
        { id: 's2', name: 'Scenario 2', tests: [{ id: 't2', name: 'Test 2' }] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('t1', 'f1', 's1', 'f1', 's2', 'nonexistent'));

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[0].scenarios[1].tests.map((t: { id: string }) => t.id)).toEqual(['t2', 't1']);
  });

  it('moveScenario within same group with beforeScId reorders', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 's1', name: 'Scenario 1', tests: [] },
        { id: 's2', name: 'Scenario 2', tests: [] },
        { id: 's3', name: 'Scenario 3', tests: [] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveScenario('s3', 'f1', 'f1', 's1'));

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[0].scenarios.map((s: { id: string }) => s.id)).toEqual(['s3', 's1', 's2']);
  });

  it('handleDragEnd calls moveScenario when dragScenario + scenario dropTarget', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [{ id: 's1', name: 'Scenario 1', tests: [] }]),
      fg('f2', []),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => {
      result.current.setDragScenario({ scenarioId: 's1', fromFeatureId: 'f1' });
      result.current.setDropTarget({ type: 'scenario', featureId: 'f2' });
    });
    act(() => result.current.handleDragEnd());
    expect(setFeatureGroups).toHaveBeenCalled();
  });

  it('handleDragEnd calls moveTest when dragTest + test dropTarget', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }] },
        { id: 's2', name: 'Scenario 2', tests: [] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => {
      result.current.setDragTest({ testId: 't1', fromFeatureId: 'f1', fromScenarioId: 's1' });
      result.current.setDropTarget({ type: 'test', featureId: 'f1', scenarioId: 's2' });
    });
    act(() => result.current.handleDragEnd());
    expect(setFeatureGroups).toHaveBeenCalled();
  });

  it('handleDragEnd does not move test when drop target omits scenarioId', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => {
      result.current.setDragTest({ testId: 't1', fromFeatureId: 'f1', fromScenarioId: 's1' });
      result.current.setDropTarget({ type: 'test', featureId: 'f1' });
    });
    act(() => result.current.handleDragEnd());
    expect(setFeatureGroups).not.toHaveBeenCalled();
  });

  it('handleDragEnd clears state when drop target type does not match drag', () => {
    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => {
      result.current.setDragScenario({ scenarioId: 's1', fromFeatureId: 'f1' });
      result.current.setDropTarget({ type: 'test', featureId: 'f1', scenarioId: 's1' });
    });
    act(() => result.current.handleDragEnd());
    expect(result.current.dragScenario).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it('moveTest reorders within same scenario when beforeTestId is set', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }, { id: 't2', name: 'Test 2' }] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => typeof updater === 'function' ? updater(fgs) : updater);

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('t2', 'f1', 's1', 'f1', 's1', 't1'));

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[0].scenarios[0].tests.map((t: { id: string }) => t.id)).toEqual(['t2', 't1']);
  });

  it('moveTest moves a test across feature groups', () => {
    const fgs: FeatureGroup[] = [
      fg('fa', [{ id: 's1', name: 'Scenario 1', tests: [{ id: 't1', name: 'Test 1' }] }]),
      fg('fb', [{ id: 's2', name: 'Scenario 2', tests: [] }]),
    ];
    setFeatureGroups = vi.fn((updater) => (typeof updater === 'function' ? updater(fgs) : updater));

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => result.current.moveTest('t1', 'fa', 's1', 'fb', 's2'));

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[0].scenarios[0].tests).toHaveLength(0);
    expect(updated[1].scenarios[0].tests.map((t: { id: string }) => t.id)).toEqual(['t1']);
  });

  it('handleDragEnd passes scenario target anchor to moveScenario', () => {
    const fgs: FeatureGroup[] = [
      fg('f1', [
        { id: 'sx', name: 'A', tests: [] },
        { id: 'sy', name: 'B', tests: [] },
      ]),
    ];
    setFeatureGroups = vi.fn((updater) => (typeof updater === 'function' ? updater(fgs) : updater));

    const { result } = renderHook(() => useScenarioDragDrop({ setFeatureGroups }));
    act(() => {
      result.current.setDragScenario({ scenarioId: 'sx', fromFeatureId: 'f1' });
      result.current.setDropTarget({ type: 'scenario', featureId: 'f1', targetId: 'sy' });
    });
    act(() => result.current.handleDragEnd());

    const updated = setFeatureGroups.mock.results[0].value;
    expect(updated[0].scenarios.map((s: { id: string }) => s.id)).toEqual(['sx', 'sy']);
  });
});
