/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowDesignerBody } from './WorkflowDesignerBody';
import type { Workflow } from '../types/workflow';
import type { WorkflowDesignerViewModel } from '../hooks/useWorkflowDesignerController';

vi.mock('./canvas/WorkflowPalette', () => ({ default: () => <div data-testid="palette" /> }));
vi.mock('./panels/WorkflowServicesPanelInline', () => ({
  default: ({ onExpand, onClose }: { onExpand: () => void; onClose: () => void }) => (
    <div data-testid="services-inline">
      <button data-testid="svc-expand" onClick={onExpand}>e</button>
      <button data-testid="svc-close" onClick={onClose}>c</button>
    </div>
  ),
}));
vi.mock('./panels/WorkflowVersionPanel', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="version-panel"><button data-testid="ver-close" onClick={onClose}>c</button></div>
  ),
}));
vi.mock('./WorkflowDesignerFlowCanvas', () => ({
  WorkflowDesignerFlowCanvas: () => <div data-testid="flow-canvas" />,
}));

const selected = { id: 'w1', name: 'WF', versions: [] } as unknown as Workflow;

function makeVm(over: Partial<WorkflowDesignerViewModel> = {}): WorkflowDesignerViewModel {
  return {
    paletteWidth: 200,
    configWidth: 300,
    startDrag: vi.fn(),
    collections: [],
    catalogEntries: [],
    handleAddNode: vi.fn(),
    handleAddFromRequest: vi.fn(),
    handleAddFromCatalog: vi.fn(),
    serviceRegistryMode: 'closed',
    setServiceRegistryMode: vi.fn(),
    versioning: {
      versionPanelOpen: false,
      handleVersionRestore: vi.fn(),
      handleVersionDelete: vi.fn(),
      handleVersionRename: vi.fn(),
      handleVersionCompare: vi.fn(),
      closeVersionPanel: vi.fn(),
    },
    workflowServices: [],
    environments: [],
    microservices: [],
    globalAuthProfiles: [],
    selectedEnvId: 'env1',
    ...over,
  } as unknown as WorkflowDesignerViewModel;
}

describe('WorkflowDesignerBody', () => {
  it('renders palette, canvas and resize handle; no side panels by default', () => {
    render(<WorkflowDesignerBody vm={makeVm()} selected={selected} />);
    expect(screen.getByTestId('palette')).toBeTruthy();
    expect(screen.getByTestId('flow-canvas')).toBeTruthy();
    expect(document.querySelector('.wf-resize-handle')).toBeTruthy();
    expect(screen.queryByTestId('services-inline')).toBeNull();
    expect(screen.queryByTestId('version-panel')).toBeNull();
  });

  it('startDrag fires on resize handle mousedown', () => {
    const startDrag = vi.fn();
    render(<WorkflowDesignerBody vm={makeVm({ startDrag })} selected={selected} />);
    fireEvent.mouseDown(document.querySelector('.wf-resize-handle') as Element);
    expect(startDrag).toHaveBeenCalledWith('left', expect.anything());
  });

  it('renders services inline panel when serviceRegistryMode is panel', () => {
    const setServiceRegistryMode = vi.fn();
    const startDrag = vi.fn();
    render(<WorkflowDesignerBody vm={makeVm({ serviceRegistryMode: 'panel', setServiceRegistryMode, startDrag })} selected={selected} />);
    expect(screen.getByTestId('services-inline')).toBeTruthy();
    const handles = document.querySelectorAll('.wf-resize-handle');
    fireEvent.mouseDown(handles[handles.length - 1]);
    expect(startDrag).toHaveBeenCalledWith('right', expect.anything());
    fireEvent.click(screen.getByTestId('svc-expand'));
    expect(setServiceRegistryMode).toHaveBeenCalledWith('fullscreen');
    fireEvent.click(screen.getByTestId('svc-close'));
    expect(setServiceRegistryMode).toHaveBeenCalledWith('closed');
  });

  it('renders version panel when versionPanelOpen', () => {
    const closeVersionPanel = vi.fn();
    const startDrag = vi.fn();
    render(
      <WorkflowDesignerBody
        vm={makeVm({
          startDrag,
          versioning: {
            versionPanelOpen: true,
            handleVersionRestore: vi.fn(),
            handleVersionDelete: vi.fn(),
            handleVersionRename: vi.fn(),
            handleVersionCompare: vi.fn(),
            closeVersionPanel,
          } as unknown as WorkflowDesignerViewModel['versioning'],
        })}
        selected={selected}
      />,
    );
    expect(screen.getByTestId('version-panel')).toBeTruthy();
    const handles = document.querySelectorAll('.wf-resize-handle');
    fireEvent.mouseDown(handles[handles.length - 1]);
    expect(startDrag).toHaveBeenCalledWith('right', expect.anything());
    fireEvent.click(screen.getByTestId('ver-close'));
    expect(closeVersionPanel).toHaveBeenCalled();
  });

  it('passes empty array when selected.versions is undefined (line 74 ??[] false branch)', () => {
    const selectedNoVersions = { id: 'w2', name: 'WF2' } as unknown as Workflow;
    render(
      <WorkflowDesignerBody
        vm={makeVm({
          versioning: {
            versionPanelOpen: true,
            handleVersionRestore: vi.fn(),
            handleVersionDelete: vi.fn(),
            handleVersionRename: vi.fn(),
            handleVersionCompare: vi.fn(),
            closeVersionPanel: vi.fn(),
          } as unknown as WorkflowDesignerViewModel['versioning'],
        })}
        selected={selectedNoVersions}
      />,
    );
    expect(screen.getByTestId('version-panel')).toBeTruthy();
  });
});
