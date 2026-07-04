/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StrictMode } from 'react';
import type { Node } from '@xyflow/react';
import {
  buildMockReactFlowRenderer,
  applyNodeChangesImpl,
  mockGetNodesBounds,
  createMockTrace,
  createEmptyWorkflowTrace,
  createBranchingTrace,
  getLastReactFlowProps,
  MockBackground,
  MockControls,
  MockMiniMap,
  MockPanel,
  xyflowMockStaticExports,
} from './workflowExecutionCanvasTestHelpers';

describe('workflowExecutionCanvasTestHelpers coverage gaps', () => {
  it('renders mock react-flow and triggers interaction callbacks', () => {
    const flowApi = { zoomIn: vi.fn(), zoomOut: vi.fn(), fitView: vi.fn() };
    const MockReactFlow = buildMockReactFlowRenderer(flowApi);

    const onInit = vi.fn();
    const onNodeClick = vi.fn();
    const onPaneClick = vi.fn();
    const onNodesChange = vi.fn();
    const onNodeMouseEnter = vi.fn();
    const onNodeMouseLeave = vi.fn();

    const nodes = [
      {
        id: 'n1',
        type: 'http',
        position: { x: 1, y: 2 },
        data: { label: 'N1' },
        className: 'node-c1',
        style: { opacity: 0.7 },
      },
    ] as unknown as Node[];
    const edges = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        className: 'edge-c1',
        animated: true,
        style: { stroke: '#0f0', strokeDasharray: '2 2' },
        label: 'edge1',
      },
    ];

    const { getByTestId } = render(
      <StrictMode>
        <MockReactFlow
          nodes={nodes}
          edges={edges as any}
          onInit={onInit}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodesChange={onNodesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
        >
          <div data-testid="child-slot">child</div>
        </MockReactFlow>
      </StrictMode>,
    );

    expect(getByTestId('child-slot')).toBeInTheDocument();

    fireEvent.click(getByTestId('flow-pane'));
    expect(onPaneClick).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId('node-n1'));
    expect(onNodeClick).toHaveBeenCalledTimes(1);

    fireEvent.mouseEnter(getByTestId('node-n1'));
    fireEvent.mouseLeave(getByTestId('node-n1'));
    expect(onNodeMouseEnter).toHaveBeenCalledTimes(1);
    expect(onNodeMouseLeave).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId('trigger-nodes-change'));
    fireEvent.click(getByTestId('trigger-dimensions-change'));
    fireEvent.click(getByTestId('trigger-add-orphan-node'));
    expect(onNodesChange).toHaveBeenCalledTimes(3);

    expect(onInit.mock.calls.length).toBeGreaterThanOrEqual(1);
    const instance = onInit.mock.calls[0][0];
    expect(typeof instance.fitView).toBe('function');
    expect(instance.getNodes()).toHaveLength(1);

    // Render without optional handlers/nodes/edges to cover no-op branches.
    const noOpRender = render(<MockReactFlow />);
    const noOpQueries = within(noOpRender.container);
    fireEvent.click(noOpQueries.getByTestId('flow-pane'));
    fireEvent.click(noOpQueries.getByTestId('trigger-nodes-change'));
    fireEvent.click(noOpQueries.getByTestId('trigger-dimensions-change'));
    fireEvent.click(noOpQueries.getByTestId('trigger-add-orphan-node'));
  });

  it('covers utility branches and static exports', () => {
    const updated = applyNodeChangesImpl(
      [
        { type: 'position', id: 'n1', position: { x: 10, y: 20 } } as any,
        { type: 'dimensions', id: 'n1', dimensions: { width: 100, height: 60 } } as any,
        {
          type: 'add',
          item: {
            id: 'n2',
            type: 'http',
            position: { x: 0, y: 0 },
            data: { label: 'N2' },
          },
        } as any,
      ],
      [
        {
          id: 'n1',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { label: 'N1' },
          measured: { width: 1, height: 1 },
        } as any,
        {
          id: 'n3',
          type: 'http',
          position: { x: 4, y: 4 },
          data: { label: 'N3' },
          measured: { width: 7, height: 7 },
        } as any,
      ],
    );

    expect(updated).toHaveLength(3);
    expect(updated[0].position).toEqual({ x: 10, y: 20 });
    expect(updated[0].measured).toEqual({ width: 100, height: 60 });
    expect(updated[1].id).toBe('n3');

    const fallbackUpdated = applyNodeChangesImpl(
      [
        { type: 'position', id: 'n1', position: { x: undefined, y: undefined } } as any,
        { type: 'dimensions', id: 'n1' } as any,
        { type: 'add' } as any,
      ],
      [
        {
          id: 'n1',
          type: 'http',
          position: { x: 5, y: 6 },
          data: { label: 'N1' },
          measured: { width: 2, height: 3 },
        } as any,
      ],
    );
    expect(fallbackUpdated).toHaveLength(1);
    expect(fallbackUpdated[0].position).toEqual({ x: 0, y: 0 });
    expect(fallbackUpdated[0].measured).toEqual({ width: 2, height: 3 });

    expect(mockGetNodesBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(mockGetNodesBounds([{ width: 10, height: 5 }])).toEqual({ x: 0, y: 0, width: 220, height: 80 });

    expect(xyflowMockStaticExports.MarkerType.ArrowClosed).toBe('arrowclosed');
    expect(xyflowMockStaticExports.Position.Left).toBe('left');

    const traceDefault = createMockTrace();
    expect(traceDefault.totalIterations).toBe(1);
    expect(traceDefault.iterations[0].passed).toBe(true);

    const traceCustom = createMockTrace({ iterations: 3, passedIterations: 1 });
    expect(traceCustom.totalIterations).toBe(3);
    expect(traceCustom.iterations[2].passed).toBe(false);

    expect(createEmptyWorkflowTrace().iterations).toHaveLength(0);
    expect(createBranchingTrace().iterations).toHaveLength(4);
  });

  it('covers small mock components and getLastReactFlowProps helper', () => {
    const { getByTestId } = render(
      <>
        <MockBackground />
        <MockControls />
        <MockMiniMap nodeColor={({ id }) => (id === 'n1' ? '#f00' : '#0f0')} />
        <MockPanel>
          <span data-testid="panel-child">x</span>
        </MockPanel>
      </>,
    );

    expect(getByTestId('background')).toBeInTheDocument();
    expect(getByTestId('controls')).toBeInTheDocument();
    expect(getByTestId('minimap')).toHaveAttribute('data-color-n1', '#f00');
    expect(getByTestId('minimap')).toHaveAttribute('data-color-unknown', '#0f0');
    expect(getByTestId('react-flow-panel')).toContainElement(getByTestId('panel-child'));

    const noColorRender = render(<MockMiniMap />);
    const noColor = within(noColorRender.container).getByTestId('minimap');
    expect(noColor).toHaveAttribute('data-color-n1', '');

    const ReactFlow = vi.fn();
    ReactFlow({ foo: 1 });
    const last = getLastReactFlowProps({ ReactFlow } as any);
    expect(last).toEqual({ foo: 1 });
  });
});
