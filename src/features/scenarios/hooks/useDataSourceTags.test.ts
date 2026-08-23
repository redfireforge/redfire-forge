// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataSourceTags } from './useDataSourceTags';
import type { Scenario, DataSource } from '@shared/types';
import { makeScenario as _makeScenario } from '@test-utils/factories';

function makeScenario(rows: DataSource['rows'] = [], subsets?: DataSource['subsets']): Scenario {
  const ds: DataSource = {
    columns: [{ id: 'col1', name: 'vin', type: 'param', mapping: 'vin' }],
    rows,
    subsets,
  };
  return _makeScenario({
    url: 'https://api.example.com/{{vin}}',
    dataSource: ds,
  });
}

describe('useDataSourceTags', () => {
  it('computes allTags from rows', () => {
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke', 'happy-path'] },
      { id: 'r2', values: {}, enabled: true, tags: ['smoke'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, vi.fn(), new Set()),
    );
    expect(result.current.allTags).toEqual(['happy-path', 'smoke']);
  });

  it('computes tagCounts correctly', () => {
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke', 'happy-path'] },
      { id: 'r2', values: {}, enabled: true, tags: ['smoke'] },
      { id: 'r3', values: {}, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, vi.fn(), new Set()),
    );
    expect(result.current.tagCounts).toEqual({ smoke: 2, 'happy-path': 1 });
    expect(result.current.untaggedCount).toBe(1);
  });

  it('addTagToRow adds a tag to the correct row', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: { col1: 'A' }, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.addTagToRow('r1', 'smoke'));
    expect(onDraftChange).toHaveBeenCalledTimes(1);
    const updatedDraft = onDraftChange.mock.calls[0][0];
    expect(updatedDraft.dataSource.rows[0].tags).toEqual(['smoke']);
  });

  it('addTagToRow normalizes to lowercase and trims', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.addTagToRow('r1', '  Smoke '));
    const tags = onDraftChange.mock.calls[0][0].dataSource.rows[0].tags;
    expect(tags).toEqual(['smoke']);
  });

  it('addTagToRow skips duplicate tags', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.addTagToRow('r1', 'smoke'));
    // Row unchanged — updateRows still fires but row is same ref
    const updatedRow = onDraftChange.mock.calls[0][0].dataSource.rows[0];
    expect(updatedRow.tags).toEqual(['smoke']);
  });

  it('addTagToRow ignores empty tag', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.addTagToRow('r1', '  '));
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('removeTagFromRow removes a tag', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke', 'edge-case'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.removeTagFromRow('r1', 'smoke'));
    const tags = onDraftChange.mock.calls[0][0].dataSource.rows[0].tags;
    expect(tags).toEqual(['edge-case']);
  });

  it('removeTagFromRow sets tags to undefined when last tag removed', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.removeTagFromRow('r1', 'smoke'));
    const tags = onDraftChange.mock.calls[0][0].dataSource.rows[0].tags;
    expect(tags).toBeUndefined();
  });

  it('bulkAddTag adds tag to all selected rows', () => {
    const onDraftChange = vi.fn();
    const selected = new Set(['r1', 'r3']);
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true },
      { id: 'r2', values: {}, enabled: true },
      { id: 'r3', values: {}, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, selected),
    );
    act(() => result.current.bulkAddTag('regression'));
    const rows = onDraftChange.mock.calls[0][0].dataSource.rows;
    expect(rows[0].tags).toEqual(['regression']);
    expect(rows[1].tags).toBeUndefined(); // not selected
    expect(rows[2].tags).toEqual(['regression']);
  });

  it('bulkAddTag does nothing when no rows selected', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.bulkAddTag('smoke'));
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('bulkRemoveTag removes tag from selected rows', () => {
    const onDraftChange = vi.fn();
    const selected = new Set(['r1', 'r2']);
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke', 'edge-case'] },
      { id: 'r2', values: {}, enabled: true, tags: ['smoke'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, selected),
    );
    act(() => result.current.bulkRemoveTag('smoke'));
    const rows = onDraftChange.mock.calls[0][0].dataSource.rows;
    expect(rows[0].tags).toEqual(['edge-case']);
    expect(rows[1].tags).toBeUndefined();
  });

  it('addSubset appends a named subset', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.addSubset({
      name: 'Smoke Tests',
      filter: { type: 'tags', tags: ['smoke'], mode: 'any' },
    }));
    const subsets = onDraftChange.mock.calls[0][0].dataSource.subsets;
    expect(subsets.length).toBe(1);
    expect(subsets[0].name).toBe('Smoke Tests');
  });

  it('removeSubset removes by name', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([], [
      { name: 'A', filter: { type: 'tags', tags: ['a'], mode: 'any' } },
      { name: 'B', filter: { type: 'tags', tags: ['b'], mode: 'any' } },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.removeSubset('A'));
    const subsets = onDraftChange.mock.calls[0][0].dataSource.subsets;
    expect(subsets.length).toBe(1);
    expect(subsets[0].name).toBe('B');
  });

  it('removeSubset sets subsets to undefined when last removed', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([], [
      { name: 'A', filter: { type: 'tags', tags: ['a'], mode: 'any' } },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.removeSubset('A'));
    const subsets = onDraftChange.mock.calls[0][0].dataSource.subsets;
    expect(subsets).toBeUndefined();
  });

  it('tagSuggestions includes existing tags plus built-in suggestions', () => {
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['custom-tag'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, vi.fn(), new Set()),
    );
    expect(result.current.tagSuggestions).toContain('custom-tag');
    expect(result.current.tagSuggestions).toContain('happy-path');
    expect(result.current.tagSuggestions).toContain('smoke');
    expect(result.current.tagSuggestions).toContain('edge-case');
  });

  it('handles undefined dataSource gracefully', () => {
    const draft: Scenario = {
      id: 'sc-1', name: 'Test', url: 'http://x', method: 'GET',
      headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
    };
    const { result } = renderHook(() =>
      useDataSourceTags(draft, undefined, vi.fn(), new Set()),
    );
    expect(result.current.allTags).toEqual([]);
    expect(result.current.tagCounts).toEqual({});
    expect(result.current.untaggedCount).toBe(0);
  });

  it('addTagToRow does nothing when dataSource is undefined', () => {
    const draft: Scenario = {
      id: 'sc-1', name: 'Test', url: 'http://x', method: 'GET',
      headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
    };
    const onDraftChange = vi.fn();
    const { result } = renderHook(() =>
      useDataSourceTags(draft, undefined, onDraftChange, new Set()),
    );
    act(() => result.current.addTagToRow('r1', 'x'));
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('bulkAddTag skips duplicate tags on selected rows', () => {
    const onDraftChange = vi.fn();
    const selected = new Set(['r1']);
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, selected),
    );
    act(() => result.current.bulkAddTag('smoke'));
    expect(onDraftChange).toHaveBeenCalled();
    expect(onDraftChange.mock.calls[0][0].dataSource.rows[0].tags).toEqual(['smoke']);
  });

  it('bulkAddTag ignores empty tag string', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([{ id: 'r1', values: {}, enabled: true }]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set(['r1'])),
    );
    act(() => result.current.bulkAddTag('   '));
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('bulkRemoveTag does nothing when no selection', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['a'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.bulkRemoveTag('a'));
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it('bulkRemoveTag clears tags only on rows that contained the tag', () => {
    const onDraftChange = vi.fn();
    const selected = new Set(['r1', 'r2']);
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['smoke'] },
      { id: 'r2', values: {}, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, selected),
    );
    act(() => result.current.bulkRemoveTag('smoke'));
    const rows = onDraftChange.mock.calls[0][0].dataSource.rows;
    expect(rows[0].tags).toBeUndefined();
    expect(rows[1].tags).toBeUndefined();
  });

  it('addTagToRow updates only the targeted row', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true },
      { id: 'r2', values: {}, enabled: true },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.addTagToRow('r2', 't'));
    const rows = onDraftChange.mock.calls[0][0].dataSource.rows;
    expect(rows[0].tags).toBeUndefined();
    expect(rows[1].tags).toEqual(['t']);
  });

  it('removeTagFromRow only touches the matching row', () => {
    const onDraftChange = vi.fn();
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['a'] },
      { id: 'r2', values: {}, enabled: true, tags: ['b'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, new Set()),
    );
    act(() => result.current.removeTagFromRow('r1', 'a'));
    const rows = onDraftChange.mock.calls[0][0].dataSource.rows;
    expect(rows[0].tags).toBeUndefined();
    expect(rows[1].tags).toEqual(['b']);
  });

  it('bulkRemoveTag skips unselected rows', () => {
    const onDraftChange = vi.fn();
    const selected = new Set(['r1']);
    const draft = makeScenario([
      { id: 'r1', values: {}, enabled: true, tags: ['x'] },
      { id: 'r2', values: {}, enabled: true, tags: ['x'] },
    ]);
    const { result } = renderHook(() =>
      useDataSourceTags(draft, draft.dataSource!, onDraftChange, selected),
    );
    act(() => result.current.bulkRemoveTag('x'));
    const rows = onDraftChange.mock.calls[0][0].dataSource.rows;
    expect(rows[0].tags).toBeUndefined();
    expect(rows[1].tags).toEqual(['x']);
  });

  it('addSubset and removeSubset no-op when dataSource is undefined', () => {
    const draft: Scenario = {
      id: 'sc-1', name: 'Test', url: 'http://x', method: 'GET',
      headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
    };
    const onDraftChange = vi.fn();
    const { result } = renderHook(() =>
      useDataSourceTags(draft, undefined, onDraftChange, new Set()),
    );
    act(() => result.current.addSubset({ name: 'N', filter: { type: 'tags', tags: ['x'], mode: 'any' } }));
    act(() => result.current.removeSubset('N'));
    expect(onDraftChange).not.toHaveBeenCalled();
  });
});
