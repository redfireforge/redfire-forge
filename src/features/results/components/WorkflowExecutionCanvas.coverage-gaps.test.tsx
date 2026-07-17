/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as XyflowReact from '@xyflow/react';
import WorkflowExecutionCanvas from './WorkflowExecutionCanvas';
import {
  createMockTrace,
  getLastReactFlowProps,
} from './__test-utils__/workflowExecutionCanvasTestHelpers';

const viewportState = vi.hoisted(() => ({ x: 0, y: 0, zoom: 1 }));

const { flowApi, applyNodeChangesStub } = vi.hoisted(() => {
  const api = { zoomIn: vi.fn(), zoomOut: vi.fn(), fitView: vi.fn() };
  function stub(
    changes: import('@xyflow/react').NodeChange[],
    nodes: import('@xyflow/react').Node[],
  ) {
    let next = [...nodes];
    for (const c of changes) {
      if (c.type === 'dimensions' && c.id) {
        next = next.map((n) =>
          n.id === c.id
            ? { ...n, measured: ('dimensions' in c && c.dimensions) ? c.dimensions : n.measured }
            : n,
        );
      }
    }
    return next;
  }
  return { flowApi: api, applyNodeChangesStub: stub };
});

vi.mock('@xyflow/react', async () => {
  const helpers = await import('./__test-utils__/workflowExecutionCanvasTestHelpers');
  return {
    ReactFlow: vi.fn(helpers.buildMockReactFlowRenderer(flowApi)),
    Background: helpers.MockBackground,
    MiniMap: helpers.MockMiniMap,
    Panel: helpers.MockPanel,
    MarkerType: helpers.xyflowMockStaticExports.MarkerType,
    useReactFlow: () => flowApi,
    useViewport: () => viewportState,
    applyNodeChanges: applyNodeChangesStub,
    getNodesBounds: helpers.mockGetNodesBounds,
  };
});

vi.mock('../../workflow/utils/workflowNodeFactory', () => ({ nodeTypes: {} }));
vi.mock('../utils/canvasScreenshot', () => ({
  captureCanvasScreenshot: vi.fn().mockResolvedValue('data:image/png;base64,x'),
  captureCanvasSvg: vi.fn().mockResolvedValue('<svg/>'),
}));

describe('WorkflowExecutionCanvas — coverage gaps', () => {
  beforeEach(() => {
    vi.mocked(XyflowReact.ReactFlow).mockClear();
    flowApi.fitView.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('invokes onNodeDoubleClick handler from ReactFlow props', () => {
    const onNodeDoubleClick = vi.fn();
    const trace = createMockTrace();
    render(<WorkflowExecutionCanvas trace={trace} onNodeDoubleClick={onNodeDoubleClick} />);
    const props = getLastReactFlowProps(XyflowReact);
    props.onNodeDoubleClick?.({} as never, { id: 'n2' } as never);
    expect(onNodeDoubleClick).toHaveBeenCalledWith('n2');
  });

  it('dims nodes for stateFilter=fail', () => {
    const trace = createMockTrace({ iterations: 3, passedIterations: 3 });
    const { getByTestId } = render(
      <WorkflowExecutionCanvas trace={trace} stateFilter="fail" />,
    );
    expect(getByTestId('node-n1').className).toContain('replay-node-dimmed');
  });

  it('uses data.name for search when label is absent', () => {
    const trace = createMockTrace();
    trace.workflowSnapshot.nodes = [
      { id: 'named', type: 'http', position: { x: 0, y: 0 }, data: { name: 'FetchOrders' } },
    ] as typeof trace.workflowSnapshot.nodes;
    const { getByTestId } = render(
      <WorkflowExecutionCanvas trace={trace} searchQuery="fetchorders" />,
    );
    expect(getByTestId('node-named').className).not.toContain('replay-node-dimmed');
  });

  it('calls fitView after the first dimensions measurement', () => {
    vi.useFakeTimers();
    const trace = createMockTrace();
    const { getByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
    fireEvent.click(getByTestId('trigger-dimensions-change'));
    vi.advanceTimersByTime(200);
    expect(flowApi.fitView).toHaveBeenCalled();
  });

  it('shows node tooltip on mouse enter and hides on leave', () => {
    const trace = createMockTrace({ iterations: 2, passedIterations: 2 });
    const { getByTestId, queryByTestId } = render(<WorkflowExecutionCanvas trace={trace} />);
    fireEvent.mouseEnter(getByTestId('node-n1'));
    expect(queryByTestId('node-tooltip')).toBeTruthy();
    fireEvent.mouseLeave(getByTestId('node-n1'));
    expect(queryByTestId('node-tooltip')).toBeNull();
  });

  it('invokes onNodeClick when a node is clicked', () => {
    const onNodeClick = vi.fn();
    const trace = createMockTrace();
    render(<WorkflowExecutionCanvas trace={trace} onNodeClick={onNodeClick} />);
    const props = getLastReactFlowProps(XyflowReact);
    props.onNodeClick?.({} as never, { id: 'n1' } as never);
    expect(onNodeClick).toHaveBeenCalledWith('n1');
  });

  it('dims nodes that do not match searchQuery', () => {
    const trace = createMockTrace();
    const { getByTestId } = render(
      <WorkflowExecutionCanvas trace={trace} searchQuery="nomatch" />,
    );
    expect(getByTestId('node-n1').className).toContain('replay-node-dimmed');
  });

  it('debounces fitView when ResizeObserver fires on the canvas container', () => {
    vi.useFakeTimers();
    class MockResizeObserver {
      static last: MockResizeObserver | null = null;
      private cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
        MockResizeObserver.last = this;
      }
      observe() {}
      disconnect() {}
      trigger() { this.cb(); }
    }
    const saved = globalThis.ResizeObserver;
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    const trace = createMockTrace();
    render(<WorkflowExecutionCanvas trace={trace} />);
    MockResizeObserver.last?.trigger();
    vi.advanceTimersByTime(200);
    expect(flowApi.fitView).toHaveBeenCalled();
    globalThis.ResizeObserver = saved;
  });
});
