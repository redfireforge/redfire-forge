/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowDesignerInspectModals } from './WorkflowDesignerInspectModals';
import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';

vi.mock('./modals/WorkflowDetailModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="detail"><button data-testid="detail-close" onClick={onClose}>x</button></div> : null,
}));
vi.mock('./modals/WorkflowNodeConfigModal', () => ({
  default: ({ onClose }: { onClose: () => void }) =>
    <div data-testid="node-config"><button data-testid="cfg-close" onClick={onClose}>x</button></div>,
}));
vi.mock('./modals/WorkflowDefaultsModal', () => ({
  default: ({ open, onUpdateErrorConfig, onClose }: { open: boolean; onUpdateErrorConfig: (c: unknown) => void; onClose: () => void }) =>
    open ? <div data-testid="defaults"><button data-testid="def-err" onClick={() => onUpdateErrorConfig({ mode: 'stop' })}>e</button><button data-testid="def-close" onClick={onClose}>x</button></div> : null,
}));

function makeVm(over: Partial<WorkflowDesignerViewModel> = {}): WorkflowDesignerViewModel {
  return {
    detailModal: null,
    setDetailModal: vi.fn(),
    detailModalDerived: { title: 'T', subtitle: 'S', body: 'B' },
    variableDetailDraft: '',
    setVariableDetailDraft: vi.fn(),
    handleApplyVariableDetail: vi.fn(),
    configModalNode: null,
    configModalNodeId: null,
    setConfigModalNodeId: vi.fn(),
    workflowVariables: {},
    runVariableSnapshot: null,
    handleUpdateNode: vi.fn(),
    handleDeleteNode: vi.fn(),
    selected: { id: 'w1' },
    lastQuickTestRequestUrl: '',
    nodeStatuses: {},
    effectiveQuickTestBaseUrl: '',
    resolveHttpBaseUrlForGraph: vi.fn(),
    resolveHttpAuthForGraph: vi.fn(),
    resolvedBaseUrl: '',
    extractionSampleJson: '',
    handleExtractionFetchSample: vi.fn(),
    extractionFetching: false,
    extractionFetchError: null,
    conditionVariableHints: [],
    httpVariableHints: [],
    workflowServices: [],
    environments: [],
    selectedEnvId: 'env1',
    configModalWorkflows: [],
    showDefaultsModal: false,
    setShowDefaultsModal: vi.fn(),
    handleUpdateWorkflowVariables: vi.fn(),
    workflowErrorConfig: undefined,
    setWorkflowErrorConfig: vi.fn(),
    persistWorkflow: vi.fn(),
    nodes: [],
    ...over,
  } as unknown as WorkflowDesignerViewModel;
}

describe('WorkflowDesignerInspectModals', () => {
  it('does not render detail modal or node config when closed', () => {
    render(<WorkflowDesignerInspectModals vm={makeVm()} />);
    expect(screen.queryByTestId('detail')).toBeNull();
    expect(screen.queryByTestId('node-config')).toBeNull();
    expect(screen.queryByTestId('defaults')).toBeNull();
  });

  it('renders detail modal when detailModal set and closes', () => {
    const setDetailModal = vi.fn();
    render(<WorkflowDesignerInspectModals vm={makeVm({ detailModal: { type: 'variable' }, setDetailModal })} />);
    expect(screen.getByTestId('detail')).toBeTruthy();
    fireEvent.click(screen.getByTestId('detail-close'));
    expect(setDetailModal).toHaveBeenCalledWith(null);
  });

  it('renders node config modal when configModalNode truthy and closes', () => {
    const setConfigModalNodeId = vi.fn();
    render(
      <WorkflowDesignerInspectModals
        vm={makeVm({
          configModalNode: { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: {} },
          configModalNodeId: 'n1',
          setConfigModalNodeId,
          nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: {} }],
          nodeStatuses: { n1: { status: 'fail', error: 'boom' } },
        })}
      />,
    );
    expect(screen.getByTestId('node-config')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cfg-close'));
    expect(setConfigModalNodeId).toHaveBeenCalledWith(null);
  });

  it('renders defaults modal and forwards error config update', () => {
    const setWorkflowErrorConfig = vi.fn();
    const persistWorkflow = vi.fn();
    render(
      <WorkflowDesignerInspectModals
        vm={makeVm({ showDefaultsModal: true, setWorkflowErrorConfig, persistWorkflow, nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: {} }] })}
      />,
    );
    expect(screen.getByTestId('defaults')).toBeTruthy();
    fireEvent.click(screen.getByTestId('def-err'));
    expect(setWorkflowErrorConfig).toHaveBeenCalledWith({ mode: 'stop' });
    expect(persistWorkflow).toHaveBeenCalledWith({ errorConfig: { mode: 'stop' } });
  });

  it('closes defaults modal', () => {
    const setShowDefaultsModal = vi.fn();
    render(<WorkflowDesignerInspectModals vm={makeVm({ showDefaultsModal: true, setShowDefaultsModal })} />);
    fireEvent.click(screen.getByTestId('def-close'));
    expect(setShowDefaultsModal).toHaveBeenCalledWith(false);
  });
});
