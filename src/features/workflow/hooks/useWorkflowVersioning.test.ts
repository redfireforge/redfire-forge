/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowVersioning } from './useWorkflowVersioning';
import type { WorkflowVersion } from '../types/workflow';

const makeVersion = (overrides: Partial<WorkflowVersion> = {}): WorkflowVersion => ({
  id: 'v1',
  timestamp: 1000,
  fingerprint: 'fp1',
  nodeCount: 1,
  edgeCount: 0,
  nodes: [] as any,
  edges: [] as any,
  variables: { key: 'val' },
  ...overrides,
});

const defaultParams = () => ({
  selectedId: 'wf-1',
  versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })],
  update: vi.fn(),
  takeSnapshot: vi.fn(),
  applyToCanvas: vi.fn(),
  persistRestore: vi.fn(),
  showToast: vi.fn(),
  isPreview: false,
  closeServicePanel: vi.fn(),
  deselectNode: vi.fn(),
});

describe('useWorkflowVersioning', () => {
  it('handleVersionRestore uses formatted timestamp when version has no label', () => {
    const params = defaultParams();
    const { result } = renderHook(() => useWorkflowVersioning(params));
    const v = makeVersion({ id: 'v1', label: undefined, timestamp: 946684800000 });
    act(() => result.current.handleVersionRestore(v));
    expect(params.showToast).toHaveBeenCalledWith(
      'success',
      'Version restored',
      new Date(946684800000).toLocaleString(),
    );
  });

  it('handleVersionRename does nothing without selectedId', () => {
    const params = { ...defaultParams(), selectedId: null };
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.handleVersionRename('v1', 'X'));
    expect(params.update).not.toHaveBeenCalled();
  });

  it('openVersionPanel toggles closed on second call', () => {
    const params = defaultParams();
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.openVersionPanel());
    expect(result.current.versionPanelOpen).toBe(true);
    act(() => result.current.openVersionPanel());
    expect(result.current.versionPanelOpen).toBe(false);
  });

  it('returns correct versionCount', () => {
    const params = defaultParams();
    const { result } = renderHook(() => useWorkflowVersioning(params));
    expect(result.current.versionCount).toBe(2);
  });

  it('starts with panel closed', () => {
    const { result } = renderHook(() => useWorkflowVersioning(defaultParams()));
    expect(result.current.versionPanelOpen).toBe(false);
    expect(result.current.versionDiffState).toBeNull();
  });

  it('toggles version panel', () => {
    const params = defaultParams();
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.openVersionPanel());
    expect(result.current.versionPanelOpen).toBe(true);
    expect(params.closeServicePanel).toHaveBeenCalled();
    expect(params.deselectNode).toHaveBeenCalled();
  });

  it('closes version panel', () => {
    const { result } = renderHook(() => useWorkflowVersioning(defaultParams()));
    act(() => result.current.openVersionPanel());
    act(() => result.current.closeVersionPanel());
    expect(result.current.versionPanelOpen).toBe(false);
  });

  it('handleVersionRestore calls applyToCanvas and persistRestore', () => {
    const params = defaultParams();
    const { result } = renderHook(() => useWorkflowVersioning(params));
    const v = makeVersion({ id: 'v1', label: 'My Save' });
    act(() => result.current.handleVersionRestore(v));
    expect(params.takeSnapshot).toHaveBeenCalledWith('Restore version');
    expect(params.applyToCanvas).toHaveBeenCalledWith(v);
    expect(params.persistRestore).toHaveBeenCalledWith(v);
    expect(params.showToast).toHaveBeenCalledWith('success', 'Version restored', 'My Save');
  });

  it('handleVersionRestore does nothing in preview mode', () => {
    const params = { ...defaultParams(), isPreview: true };
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.handleVersionRestore(makeVersion()));
    expect(params.applyToCanvas).not.toHaveBeenCalled();
  });

  it('handleVersionRestore does nothing without selectedId', () => {
    const params = { ...defaultParams(), selectedId: null };
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.handleVersionRestore(makeVersion()));
    expect(params.applyToCanvas).not.toHaveBeenCalled();
  });

  it('handleVersionDelete removes version from list', () => {
    const params = defaultParams();
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.handleVersionDelete('v1'));
    expect(params.update).toHaveBeenCalledWith('wf-1', {
      versions: [expect.objectContaining({ id: 'v2' })],
    });
  });

  it('handleVersionDelete does nothing without selectedId', () => {
    const params = { ...defaultParams(), selectedId: null };
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.handleVersionDelete('v1'));
    expect(params.update).not.toHaveBeenCalled();
  });

  it('handleVersionRename updates version label', () => {
    const params = defaultParams();
    const { result } = renderHook(() => useWorkflowVersioning(params));
    act(() => result.current.handleVersionRename('v1', 'New Label'));
    expect(params.update).toHaveBeenCalledWith('wf-1', {
      versions: expect.arrayContaining([expect.objectContaining({ id: 'v1', label: 'New Label' })]),
    });
  });

  it('handleVersionCompare sets diff state', () => {
    const { result } = renderHook(() => useWorkflowVersioning(defaultParams()));
    const older = makeVersion({ id: 'v1' });
    const newer = makeVersion({ id: 'v2' });
    act(() => result.current.handleVersionCompare(older, newer));
    expect(result.current.versionDiffState).toEqual({ older, newer });
  });

  it('closeVersionDiff clears diff state', () => {
    const { result } = renderHook(() => useWorkflowVersioning(defaultParams()));
    act(() => result.current.handleVersionCompare(makeVersion(), makeVersion()));
    act(() => result.current.closeVersionDiff());
    expect(result.current.versionDiffState).toBeNull();
  });
});
