/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Workflow } from '../../features/workflow/types/workflow';
import type { WorkflowHook } from '../../features/workflow/hooks/useWorkflows';

const mockLoadPreviewSampleId = vi.fn();
const mockSavePreviewSampleId = vi.fn();
const mockGetAutoLayoutNodes = vi.fn();
const mockCompanionFactory = vi.fn();

vi.mock('../../shared/utils/storage', () => ({
  loadPreviewSampleId: (...a: unknown[]) => mockLoadPreviewSampleId(...a),
  savePreviewSampleId: (...a: unknown[]) => mockSavePreviewSampleId(...a),
}));

vi.mock('../../features/workflow/utils/workflowAutoLayout', () => ({
  getAutoLayoutNodes: (...a: unknown[]) => mockGetAutoLayoutNodes(...a),
}));

vi.mock('../../data/galleries/workflows', () => ({
  sampleWorkflowCatalog: [
    {
      id: 'sample-1',
      factory: () => ({ id: 'sample-1', name: 'Sample: One', nodes: [{ id: 'n1' }], edges: [] }),
      companionFactories: [() => mockCompanionFactory()],
    },
  ],
}));

import { useGalleryWorkflowPreviewState } from './useGalleryWorkflowPreviewState';

function makeWfHook(): WorkflowHook {
  return { insert: vi.fn() } as unknown as WorkflowHook;
}

function wf(overrides: Partial<Workflow> = {}): Workflow {
  return { id: 'wf-1', name: 'My WF', nodes: [], edges: [], createdAt: 1, updatedAt: 1, ...overrides } as Workflow;
}

describe('useGalleryWorkflowPreviewState', () => {
  beforeEach(() => {
    mockLoadPreviewSampleId.mockReset();
    mockSavePreviewSampleId.mockReset();
    mockGetAutoLayoutNodes.mockReset();
    mockCompanionFactory.mockReset();
    mockGetAutoLayoutNodes.mockImplementation((nodes) => nodes);
    mockCompanionFactory.mockReturnValue({ id: 'comp-1', name: 'Sample: Companion', nodes: [], edges: [] });
  });

  it('starts with no preview workflow when nothing is saved', () => {
    mockLoadPreviewSampleId.mockReturnValue(null);
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(makeWfHook()));
    expect(result.current.previewWorkflow).toBeNull();
  });

  it('builds an initial preview workflow from the saved sample id', () => {
    mockLoadPreviewSampleId.mockReturnValue('sample-1');
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(makeWfHook()));
    expect(result.current.previewWorkflow?.id).toBe('sample-1');
    expect(mockGetAutoLayoutNodes).toHaveBeenCalled();
  });

  it('returns null preview when the saved id is unknown', () => {
    mockLoadPreviewSampleId.mockReturnValue('does-not-exist');
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(makeWfHook()));
    expect(result.current.previewWorkflow).toBeNull();
  });

  it('prepares a template import and stores the gallery sample id', () => {
    mockLoadPreviewSampleId.mockReturnValue(null);
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(makeWfHook()));
    act(() => result.current.handleUseWorkflowAsTemplate(wf({ id: 'sample-1', name: 'Sample: One' })));
    expect(result.current.pendingTemplateImport?.gallerySampleId).toBe('sample-1');
    expect(result.current.pendingTemplateImport?.name).toBe('One');
  });

  it('inserts companion workflows and the copy when picking a folder', () => {
    mockLoadPreviewSampleId.mockReturnValue(null);
    const wfHook = makeWfHook();
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(wfHook));
    act(() => result.current.handleUseWorkflowAsTemplate(wf({ id: 'sample-1', name: 'Sample: One' })));
    act(() => result.current.handleTemplatePickFolder('folder-9'));
    expect(wfHook.insert).toHaveBeenCalledTimes(2); // companion + copy
    expect(result.current.pendingTemplateImport).toBeNull();
    expect(mockSavePreviewSampleId).toHaveBeenCalledWith(null);
  });

  it('does nothing when picking a folder with no pending import', () => {
    mockLoadPreviewSampleId.mockReturnValue(null);
    const wfHook = makeWfHook();
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(wfHook));
    act(() => result.current.handleTemplatePickFolder('folder-9'));
    expect(wfHook.insert).not.toHaveBeenCalled();
  });

  it('clears the preview workflow', () => {
    mockLoadPreviewSampleId.mockReturnValue('sample-1');
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(makeWfHook()));
    act(() => result.current.clearPreviewWorkflow());
    expect(result.current.previewWorkflow).toBeNull();
    expect(mockSavePreviewSampleId).toHaveBeenCalledWith(null);
  });

  it('supports manual preview workflow assignment', () => {
    mockLoadPreviewSampleId.mockReturnValue(null);
    const { result } = renderHook(() => useGalleryWorkflowPreviewState(makeWfHook()));
    act(() => result.current.setPreviewWorkflow(wf()));
    expect(result.current.previewWorkflow?.id).toBe('wf-1');
  });
});
