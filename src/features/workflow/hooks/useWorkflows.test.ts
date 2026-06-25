/**
 * @vitest-environment jsdom
 */
import type { Workflow } from '../types/workflow';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid') }));

const mockLoadWorkflows = vi.fn<() => Promise<Workflow[]>>().mockResolvedValue([]);
const mockSaveWorkflows = vi.fn<(wfs: Workflow[]) => Promise<void>>().mockResolvedValue(undefined);
const mockLoadSelectedId = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
const mockSaveSelectedId = vi.fn<(id: string | null) => Promise<void>>().mockResolvedValue(undefined);
const mockCompactWorkflowStorage = vi.fn().mockResolvedValue({ beforeKB: 0, afterKB: 0 });

vi.mock('../../../shared/utils/storage', () => ({
  loadWorkflows: () => mockLoadWorkflows(),
  saveWorkflows: (workflows: Workflow[]) => mockSaveWorkflows(workflows),
  loadSelectedWorkflowId: () => mockLoadSelectedId(),
  saveSelectedWorkflowId: (id: string | null) => mockSaveSelectedId(id),
  compactWorkflowStorage: (maxVersions: number) => mockCompactWorkflowStorage(maxVersions),
}));

const mockMigrateWorkflow = vi.hoisted(() =>
  vi.fn((wf: Workflow) => ({ ...wf, schemaVersion: 5 })),
);

vi.mock('../utils/workflowMigrations', () => ({
  migrateWorkflowSchema: (wf: unknown) => mockMigrateWorkflow(wf as Workflow),
}));

import { useWorkflows } from './useWorkflows';
import { makeWorkflow as _makeWorkflow } from '../../../test-utils/factories';

const makeWorkflow = (overrides: Partial<Workflow> = {}): Workflow =>
  _makeWorkflow({
    id: 'wf-1',
    name: 'Test Workflow',
    schemaVersion: 5,
    hostProfiles: [],
    authProfiles: [],
    services: [],
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  });

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useWorkflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMigrateWorkflow.mockImplementation((wf: Workflow) => ({ ...wf, schemaVersion: 5 }));
    mockLoadWorkflows.mockResolvedValue([]);
    mockLoadSelectedId.mockResolvedValue(null);
    mockCompactWorkflowStorage.mockResolvedValue({ beforeKB: 0, afterKB: 0 });
  });

  it('clears stored selection when id is missing but workflows exist', async () => {
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ id: 'wf-1' })]);
    mockLoadSelectedId.mockResolvedValue('stale-id');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockSaveSelectedId).toHaveBeenCalledWith(null);
    expect(result.current.selectedId).toBe('wf-1');
  });

  it('skips persisting when load finishes after unmount', async () => {
    let resolveWf!: (v: Workflow[]) => void;
    let resolveId!: (v: string | null) => void;
    mockLoadWorkflows.mockImplementation(
      () => new Promise<Workflow[]>((r) => { resolveWf = r; }),
    );
    mockLoadSelectedId.mockImplementation(
      () => new Promise<string | null>((r) => { resolveId = r; }),
    );
    const { unmount } = renderHook(() => useWorkflows());
    unmount();
    resolveWf([makeWorkflow()]);
    resolveId(null);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSaveWorkflows).not.toHaveBeenCalled();
  });

  it('skips persisting migrations when migrate returns an identical payload', async () => {
    mockMigrateWorkflow.mockImplementation((wf) => wf);
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ schemaVersion: 5 })]);
    renderHook(() => useWorkflows());
    await waitFor(() => expect(mockSaveWorkflows).not.toHaveBeenCalled());
  });

  it('keeps current selection when deleting another workflow', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflow({ id: 'wf-1', name: 'A' }),
      makeWorkflow({ id: 'wf-2', name: 'B' }),
    ]);
    mockLoadSelectedId.mockResolvedValue('wf-1');
    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.remove('wf-2'));
    expect(result.current.selectedId).toBe('wf-1');
  });

  it('starts with empty state before loading', async () => {
    const { result } = renderHook(() => useWorkflows());
    expect(result.current.workflows).toEqual([]);
    expect(result.current.selected).toBeNull();
    expect(result.current.loaded).toBe(false);
    // Flush pending async state updates to avoid act() warnings
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });

  it('loads and migrates workflows on mount', async () => {
    const wf = makeWorkflow({ schemaVersion: 3 });
    mockLoadWorkflows.mockResolvedValue([wf]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.workflows).toHaveLength(1);
    expect(result.current.workflows[0].schemaVersion).toBe(5);
    expect(result.current.selectedId).toBe('wf-1');
  });

  it('clears selectedId from storage when id does not match any workflow', async () => {
    mockLoadWorkflows.mockResolvedValue([]);
    mockLoadSelectedId.mockResolvedValue('non-existent');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(mockSaveSelectedId).toHaveBeenCalledWith(null);
  });

  it('auto-selects most recently updated workflow when selectedId is null', async () => {
    const wf1 = makeWorkflow({ id: 'wf-1', updatedAt: 1000 });
    const wf2 = makeWorkflow({ id: 'wf-2', updatedAt: 3000 });
    mockLoadWorkflows.mockResolvedValue([wf1, wf2]);

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.selectedId).toBe('wf-2');
  });

  it('creates a new workflow with start node', async () => {
    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    let created: Workflow | undefined;
    act(() => { created = result.current.create('New WF'); });

    expect(created).toBeDefined();
    expect(created.name).toBe('New WF');
    expect(created.nodes).toHaveLength(1);
    expect(created.nodes[0].type).toBe('start');
    expect(result.current.workflows).toContainEqual(expect.objectContaining({ name: 'New WF' }));
    expect(mockSaveWorkflows).toHaveBeenCalled();
  });

  it('updates a workflow with partial patch', async () => {
    mockLoadWorkflows.mockResolvedValue([makeWorkflow()]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.update('wf-1', { name: 'Renamed' }));

    expect(result.current.workflows[0].name).toBe('Renamed');
    expect(mockSaveWorkflows).toHaveBeenCalled();
  });

  it('update does not touch other workflows', async () => {
    const wf1 = makeWorkflow({ id: 'wf-1', name: 'A' });
    const wf2 = makeWorkflow({ id: 'wf-2', name: 'B' });
    mockLoadWorkflows.mockResolvedValue([wf1, wf2]);

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.update('wf-1', { name: 'Changed' }));
    expect(result.current.workflows.find(w => w.id === 'wf-2')?.name).toBe('B');
  });

  it('removes a workflow', async () => {
    const wf1 = makeWorkflow({ id: 'wf-1' });
    const wf2 = makeWorkflow({ id: 'wf-2' });
    mockLoadWorkflows.mockResolvedValue([wf1, wf2]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.remove('wf-1'));

    expect(result.current.workflows).toHaveLength(1);
    expect(result.current.workflows[0].id).toBe('wf-2');
  });

  it('clears selection when removing the selected workflow', async () => {
    mockLoadWorkflows.mockResolvedValue([makeWorkflow()]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.remove('wf-1'));

    // After removing selected, selectedId is null (then auto-select kicks in if there are remaining)
    // Since all workflows are removed, selectedId stays null
    expect(result.current.workflows).toHaveLength(0);
  });

  it('inserts a workflow and selects it', async () => {
    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    const wf = makeWorkflow({ id: 'imported-1' });
    act(() => result.current.insert(wf));

    expect(result.current.workflows).toContainEqual(expect.objectContaining({ id: 'imported-1' }));
    expect(result.current.selectedId).toBe('imported-1');
  });

  it('insert does not duplicate existing workflow', async () => {
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ id: 'wf-1' })]);

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.insert(makeWorkflow({ id: 'wf-1' })));

    expect(result.current.workflows).toHaveLength(1);
  });

  it('duplicates a workflow with (copy) suffix', async () => {
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ id: 'wf-1', name: 'Original' })]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.duplicate('wf-1'));

    expect(result.current.workflows).toHaveLength(2);
    const copy = result.current.workflows.find(w => w.id !== 'wf-1');
    expect(copy?.name).toBe('Original (copy)');
  });

  it('duplicate does nothing for non-existent id', async () => {
    mockLoadWorkflows.mockResolvedValue([makeWorkflow()]);

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.duplicate('non-existent'));

    expect(result.current.workflows).toHaveLength(1);
  });

  it('select changes the selectedId', async () => {
    const wf1 = makeWorkflow({ id: 'wf-1' });
    const wf2 = makeWorkflow({ id: 'wf-2' });
    mockLoadWorkflows.mockResolvedValue([wf1, wf2]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.select('wf-2'));

    expect(result.current.selectedId).toBe('wf-2');
    expect(result.current.selected?.id).toBe('wf-2');
  });

  it('selected returns the matching workflow', async () => {
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ id: 'wf-1', name: 'My WF' })]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.selected?.name).toBe('My WF');
  });

  it('saves migrated workflows when schema changed', async () => {
    const oldWf = makeWorkflow({ schemaVersion: 2 });
    mockLoadWorkflows.mockResolvedValue([oldWf]);

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    // migrateWorkflowSchema mock changes schemaVersion → 5, so JSON differs
    expect(mockSaveWorkflows).toHaveBeenCalled();
  });

  it('auto-compacts when loaded workflows exceed 2 MB', async () => {
    mockCompactWorkflowStorage.mockResolvedValue({ beforeKB: 3000, afterKB: 1500 });
    const bigPayload = 'x'.repeat(1_100_000);
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ id: 'wf-big', name: bigPayload })]);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    renderHook(() => useWorkflows());
    await waitFor(() => expect(mockCompactWorkflowStorage).toHaveBeenCalledWith(5));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Workflows] Auto-compacted versions:'),
    );
    consoleSpy.mockRestore();
  });

  it('auto-compact skips log when storage size unchanged', async () => {
    mockCompactWorkflowStorage.mockResolvedValue({ beforeKB: 3000, afterKB: 3000 });
    const bigPayload = 'x'.repeat(1_100_000);
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ name: bigPayload })]);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    renderHook(() => useWorkflows());
    await waitFor(() => expect(mockCompactWorkflowStorage).toHaveBeenCalled());

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('auto-selects when selectedId points to a missing workflow', async () => {
    mockLoadWorkflows.mockResolvedValue([
      makeWorkflow({ id: 'wf-1', updatedAt: 1000 }),
      makeWorkflow({ id: 'wf-2', updatedAt: 3000 }),
    ]);
    mockLoadSelectedId.mockResolvedValue('wf-1');

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.select('ghost-id'));

    await waitFor(() => expect(result.current.selectedId).toBe('wf-2'));
    expect(mockSaveSelectedId).toHaveBeenCalledWith('wf-2');
  });

  it('skips state updates when unmounted during auto-compact', async () => {
    let resolveCompact!: (v: { beforeKB: number; afterKB: number }) => void;
    mockCompactWorkflowStorage.mockImplementation(
      () => new Promise<{ beforeKB: number; afterKB: number }>((r) => { resolveCompact = r; }),
    );
    const bigPayload = 'x'.repeat(1_100_000);
    mockLoadWorkflows.mockResolvedValue([makeWorkflow({ name: bigPayload })]);

    const { unmount } = renderHook(() => useWorkflows());
    await waitFor(() => expect(mockCompactWorkflowStorage).toHaveBeenCalled());
    unmount();
    resolveCompact({ beforeKB: 3000, afterKB: 1500 });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSaveSelectedId).not.toHaveBeenCalled();
  });

  it('reorder calls saveWorkflows with reordered list', async () => {
    const wf1 = makeWorkflow({ id: 'wf-1', order: 0, folderId: null });
    const wf2 = makeWorkflow({ id: 'wf-2', order: 1, folderId: null });
    mockLoadWorkflows.mockResolvedValue([wf1, wf2]);

    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.reorder('wf-1', null, 2));

    await waitFor(() => expect(mockSaveWorkflows).toHaveBeenCalled());
    const saved = mockSaveWorkflows.mock.calls.at(-1)![0] as Workflow[];
    expect(saved.map((w) => w.id)).toContain('wf-1');
  });

  it('preserves demo-seeded workflow when storage hydration completes after insert', async () => {
    const stored = makeWorkflow({ id: 'wf-latency', name: 'GraphQL Latency Demo', updatedAt: 5000 });
    const seeded = makeWorkflow({ id: 'wf-crud', name: 'GraphQL User CRUD Demo', updatedAt: 1000 });

    let resolveLoad!: (value: Workflow[]) => void;
    mockLoadWorkflows.mockImplementation(
      () => new Promise<Workflow[]>((resolve) => { resolveLoad = resolve; }),
    );
    mockLoadSelectedId.mockResolvedValue('wf-latency');

    const { result } = renderHook(() => useWorkflows());

    act(() => result.current.insert(seeded));

    expect(result.current.selectedId).toBe('wf-crud');
    expect(result.current.workflows).toContainEqual(expect.objectContaining({ id: 'wf-crud' }));

    await act(async () => {
      resolveLoad([stored]);
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.workflows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wf-latency' }),
        expect.objectContaining({ id: 'wf-crud' }),
      ]),
    );
    expect(result.current.selectedId).toBe('wf-crud');
  });
});
