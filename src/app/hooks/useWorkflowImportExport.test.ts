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
  stripWorkflowVersions: vi.fn((wf: import('../../features/workflow/types/workflow').Workflow) => ({
    ...wf,
    versions: undefined,
  })),
  countWorkflowVersions: vi.fn((wf: import('../../features/workflow/types/workflow').Workflow) =>
    wf.versions?.length ?? 0,
  ),
}));

vi.mock('../../shared/utils/fileSaver', () => ({
  saveJsonFile: (data: unknown, filename: string) => mockSaveJsonFile(data, filename),
  buildExportFilename: (parts: {
    env?: string;
    svc?: string;
    level: string;
    name?: string;
    date?: string;
    ext?: string;
  }) => mockBuildExportFilename(parts),
  openJsonFile: () => mockOpenJsonFile(),
}));

vi.mock('../../features/scenarios/utils/scenarioImportExport', () => ({
  pickJsonFile: (
    onLoad: (data: unknown) => void,
    onError?: (msg: string) => void,
  ) => mockPickJsonFile(onLoad, onError),
}));

vi.mock('../../shared/utils/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

vi.mock('../../features/workflow/utils/workflowFolderTree', () => ({
  getWorkflowsInFolderRecursive: vi.fn(
    (folderId: string, _folders: unknown[], workflows: { folderId?: string }[]) =>
      workflows.filter((wf) => wf.folderId === folderId),
  ),
}));

import type { WorkflowHook } from '@workflow/hooks/useWorkflows';
import type { WorkflowFolder } from '@workflow/types/workflow';
import { useWorkflowImportExport } from './useWorkflowImportExport';

describe('useWorkflowImportExport', () => {
  beforeEach(() => {
    resetAllMocks();
    mockPickJsonFile.mockReset();
  });

  it('handleWorkflowExport exports without version stripping when no versions', () => {
    const wf = { id: 'wf-1', name: 'Test WF', nodes: [], edges: [], variables: {} };
    const wfHook = { workflows: [wf], insert: vi.fn() } as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleWorkflowExport('wf-1'); });
    expect(mockSaveJsonFile).toHaveBeenCalledWith(wf, 'workflow-export.json');
  });

  it('handleWorkflowExport strips versions when present', () => {
    const wf = { id: 'wf-1', name: 'Test WF', nodes: [], edges: [], variables: {}, versions: ['v1'] };
    const wfHook = { workflows: [wf], insert: vi.fn() } as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleWorkflowExport('wf-1'); });
    expect(mockSaveJsonFile).toHaveBeenCalledWith(
      expect.objectContaining({ versions: undefined }),
      'workflow-export.json',
    );
  });

  it('handleWorkflowExport does nothing for missing workflow', () => {
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleWorkflowExport('nonexistent'); });
    expect(mockSaveJsonFile).not.toHaveBeenCalled();
  });

  it('handleWorkflowImport (non-Tauri) calls pickJsonFile', () => {
    mockIsTauri.mockReturnValue(false);
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const showToast = vi.fn();
    const setActiveTab = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab, showToast }),
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
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast }),
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
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const setActiveTab = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab, showToast: vi.fn() }),
    );
    await act(async () => { result.current.handleWorkflowImport(); });
    expect(mockOpenJsonFile).toHaveBeenCalled();
    expect(wfHook.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'TauriWF' }));
    expect(setActiveTab).toHaveBeenCalledWith('workflow');
  });

  it('handleWorkflowImport (Tauri) handles null result', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpenJsonFile.mockResolvedValue(null);
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    await act(async () => { result.current.handleWorkflowImport(); });
    expect(wfHook.insert).not.toHaveBeenCalled();
  });

  it('handleWorkflowImport (Tauri) shows error for invalid JSON', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpenJsonFile.mockResolvedValue({ content: 'not json' });
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast }),
    );
    await act(async () => { result.current.handleWorkflowImport(); });
    expect(showToast).toHaveBeenCalledWith('error', 'Invalid JSON file');
  });

  it('handleWorkflowImport shows error when nodes is not an array', () => {
    mockIsTauri.mockReturnValue(false);
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast }),
    );
    act(() => { result.current.handleWorkflowImport(); });
    const doImport = mockPickJsonFile.mock.calls[0][0];
    act(() => { doImport({ name: 'X', nodes: {} }); });
    expect(showToast).toHaveBeenCalledWith('error', 'Invalid workflow file');
  });

  it('handleWorkflowImport shows error when name is empty', () => {
    mockIsTauri.mockReturnValue(false);
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast }),
    );
    act(() => { result.current.handleWorkflowImport(); });
    mockPickJsonFile.mock.calls[0][0]({ name: '', nodes: [], edges: [] });
    expect(showToast).toHaveBeenCalledWith('error', 'Invalid workflow file');
  });

  it('handleWorkflowImport (Tauri) rejects invalid workflow shape after parse', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpenJsonFile.mockResolvedValue({ content: JSON.stringify({ nodes: [] }) });
    const showToast = vi.fn();
    const wfHook = { workflows: [], insert: vi.fn() } as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders: [], setActiveTab: vi.fn(), showToast }),
    );
    await act(async () => { result.current.handleWorkflowImport(); });
    expect(showToast).toHaveBeenCalledWith('error', 'Invalid workflow file');
    expect(wfHook.insert).not.toHaveBeenCalled();
  });

  it('handleWorkflowImport forwards pickJsonFile errors to toast', () => {
    mockIsTauri.mockReturnValue(false);
    mockPickJsonFile.mockImplementation((_cb: (raw: unknown) => void, onError: (msg: string) => void) => {
      onError('picker failed');
    });
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook: { workflows: [], insert: vi.fn() } as WorkflowHook, folders: [], setActiveTab: vi.fn(), showToast }),
    );
    act(() => { result.current.handleWorkflowImport(); });
    expect(showToast).toHaveBeenCalledWith('error', 'Import failed', 'picker failed');
  });

  // ─── handleExportFolder Tests ────────────────────────────────────────────────

  it('handleExportFolder exports workflows in the folder', () => {
    const wf1 = { id: 'wf-1', name: 'WF1', nodes: [], edges: [], variables: {}, folderId: 'folder-1' };
    const wf2 = { id: 'wf-2', name: 'WF2', nodes: [], edges: [], variables: {}, folderId: 'folder-1' };
    const folders: WorkflowFolder[] = [{ id: 'folder-1', name: 'My Folder' }];
    const wfHook = { workflows: [wf1, wf2], insert: vi.fn() } as unknown as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleExportFolder('folder-1'); });
    expect(mockSaveJsonFile).toHaveBeenCalledWith([wf1, wf2], 'workflow-export.json');
    expect(mockBuildExportFilename).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'workflow', name: 'My Folder-folder' }),
    );
  });

  it('handleExportFolder strips versions when present', () => {
    const wf = { id: 'wf-1', name: 'WF1', nodes: [], edges: [], variables: {}, folderId: 'folder-1', versions: ['v1'] };
    const folders: WorkflowFolder[] = [{ id: 'folder-1', name: 'Test Folder' }];
    const wfHook = { workflows: [wf], insert: vi.fn() } as unknown as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleExportFolder('folder-1'); });
    expect(mockSaveJsonFile).toHaveBeenCalledWith(
      [expect.objectContaining({ versions: undefined })],
      'workflow-export.json',
    );
  });

  it('handleExportFolder does nothing for missing folder', () => {
    const folders: WorkflowFolder[] = [{ id: 'folder-1', name: 'My Folder' }];
    const wfHook = { workflows: [], insert: vi.fn() } as unknown as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleExportFolder('nonexistent'); });
    expect(mockSaveJsonFile).not.toHaveBeenCalled();
  });

  it('handleExportFolder does nothing when folder has no workflows', () => {
    const folders: WorkflowFolder[] = [{ id: 'folder-1', name: 'Empty Folder' }];
    const wfHook = { workflows: [], insert: vi.fn() } as unknown as WorkflowHook;
    const { result } = renderHook(() =>
      useWorkflowImportExport({ wfHook, folders, setActiveTab: vi.fn(), showToast: vi.fn() }),
    );
    act(() => { result.current.handleExportFolder('folder-1'); });
    expect(mockSaveJsonFile).not.toHaveBeenCalled();
  });
});
