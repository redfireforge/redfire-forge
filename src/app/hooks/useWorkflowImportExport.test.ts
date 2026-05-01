/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockSaveJsonFile = vi.fn();
const mockBuildExportFilename = vi.fn(() => 'workflow-export.json');
const mockOpenJsonFile = vi.fn();
const mockPickJsonFile = vi.fn();
const mockIsTauri = vi.fn(() => false);

vi.mock('../../features/workflow/utils/workflowVersioning', () => ({
  stripWorkflowVersions: vi.fn((wf: any) => ({ ...wf, versions: undefined })),
  countWorkflowVersions: vi.fn((wf: any) => (wf.versions?.length ?? 0)),
}));

vi.mock('../../shared/utils/fileSaver', () => ({
  saveJsonFile: (...args: any[]) => mockSaveJsonFile(...args),
  buildExportFilename: (...args: any[]) => mockBuildExportFilename(...args),
  openJsonFile: (...args: any[]) => mockOpenJsonFile(...args),
}));

vi.mock('../../features/scenarios/utils/scenarioImportExport', () => ({
  pickJsonFile: (...args: any[]) => mockPickJsonFile(...args),
}));

vi.mock('../../shared/utils/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

import { useWorkflowImportExport } from './useWorkflowImportExport';

describe('useWorkflowImportExport', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handleWorkflowExport exports without version stripping when no versions', () => {
    const wf = { id: 'wf-1', name: 'Test WF', nodes: [], edges: [], variables: {} };
    const wfHook = { workflows: [wf], insert: vi.fn() } as any;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleWorkflowExport('wf-1'); });
    expect(mockSaveJsonFile).toHaveBeenCalledWith(wf, 'workflow-export.json');
  });

  it('handleWorkflowExport strips versions when present', () => {
    const wf = { id: 'wf-1', name: 'Test WF', nodes: [], edges: [], variables: {}, versions: ['v1'] };
    const wfHook = { workflows: [wf], insert: vi.fn() } as any;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleWorkflowExport('wf-1'); });
    expect(mockSaveJsonFile).toHaveBeenCalledWith(
      expect.objectContaining({ versions: undefined }),
      'workflow-export.json',
    );
  });

  it('handleWorkflowExport does nothing for missing workflow', () => {
    const wfHook = { workflows: [], insert: vi.fn() } as any;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleWorkflowExport('nonexistent'); });
    expect(mockSaveJsonFile).not.toHaveBeenCalled();
  });

  it('handleWorkflowImport (non-Tauri) calls pickJsonFile', () => {
    mockIsTauri.mockReturnValue(false);
    const wfHook = { workflows: [], insert: vi.fn() } as any;
    const showToast = vi.fn();
    const setActiveTab = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab, showToast }),
    );
    act(() => { result.current.handleWorkflowImport(); });
    expect(mockPickJsonFile).toHaveBeenCalled();
    // Simulate successful import via the callback
    const doImport = mockPickJsonFile.mock.calls[0][0];
    act(() => { doImport({ name: 'Imported', nodes: [], edges: [] }); });
    expect(wfHook.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Imported' }));
    expect(setActiveTab).toHaveBeenCalledWith('workflow');
  });

  it('handleWorkflowImport shows error for invalid data', () => {
    mockIsTauri.mockReturnValue(false);
    const wfHook = { workflows: [], insert: vi.fn() } as any;
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab: vi.fn(), showToast }),
    );
    act(() => { result.current.handleWorkflowImport(); });
    const doImport = mockPickJsonFile.mock.calls[0][0];
    act(() => { doImport({ invalid: true }); });
    expect(showToast).toHaveBeenCalledWith('error', 'Invalid workflow file');
    expect(wfHook.insert).not.toHaveBeenCalled();
  });

  it('handleWorkflowImport (Tauri) calls openJsonFile', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpenJsonFile.mockResolvedValue({ content: JSON.stringify({ name: 'TauriWF', nodes: [], edges: [] }) });
    const wfHook = { workflows: [], insert: vi.fn() } as any;
    const setActiveTab = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab, showToast: vi.fn() }),
    );
    await act(async () => { result.current.handleWorkflowImport(); });
    expect(mockOpenJsonFile).toHaveBeenCalled();
    expect(wfHook.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'TauriWF' }));
    expect(setActiveTab).toHaveBeenCalledWith('workflow');
  });

  it('handleWorkflowImport (Tauri) handles null result', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpenJsonFile.mockResolvedValue(null);
    const wfHook = { workflows: [], insert: vi.fn() } as any;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    await act(async () => { result.current.handleWorkflowImport(); });
    expect(wfHook.insert).not.toHaveBeenCalled();
  });

  it('handleWorkflowImport (Tauri) shows error for invalid JSON', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpenJsonFile.mockResolvedValue({ content: 'not json' });
    const wfHook = { workflows: [], insert: vi.fn() } as any;
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, setActiveTab: vi.fn(), showToast }),
    );
    await act(async () => { result.current.handleWorkflowImport(); });
    expect(showToast).toHaveBeenCalledWith('error', 'Invalid JSON file');
  });
});
