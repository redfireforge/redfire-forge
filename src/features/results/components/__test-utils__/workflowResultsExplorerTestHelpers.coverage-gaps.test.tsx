/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  mockTrace,
  makeMockConsolePanel,
  makeMockCanvas,
  makeMockDetailPanel,
  makeMockIterationMatrix,
  createCaptureHandles,
  createFileSaverMocks,
  openExportMenu,
} from './workflowResultsExplorerTestHelpers';

describe('workflowResultsExplorerTestHelpers coverage gaps', () => {
  it('console panel mock triggers callbacks and reflects props', () => {
    const onNodeSelect = vi.fn();
    const onClose = vi.fn();
    const Console = makeMockConsolePanel();

    const view = render(
      <Console
        captureLevel="all"
        iteration={{ index: 1 }}
        onNodeSelect={onNodeSelect}
        onClose={onClose}
      />,
    );

    expect(view.getByTestId('mock-console-panel')).toHaveAttribute('data-capture-level', 'all');
    expect(view.getByTestId('mock-console-panel')).toHaveAttribute('data-has-iteration', '1');

    fireEvent.click(view.getByTestId('mock-console-select-node'));
    fireEvent.click(view.getByTestId('mock-console-close'));
    expect(onNodeSelect).toHaveBeenCalledWith('n2');
    expect(onClose).toHaveBeenCalledTimes(1);

    // Optional callback branches.
    const noOps = render(<Console />);
    const noOpQueries = within(noOps.container);
    fireEvent.click(noOpQueries.getByTestId('mock-console-select-node'));
    fireEvent.click(noOpQueries.getByTestId('mock-console-close'));
    expect(noOpQueries.getByTestId('mock-console-panel')).toHaveAttribute('data-capture-level', '');
    expect(noOpQueries.getByTestId('mock-console-panel')).toHaveAttribute('data-has-iteration', '0');
  });

  it('canvas/detail/matrix mocks wire callback branches and helper factories', async () => {
    const canvasTraceRef = { current: null as any };
    const bottleneckCallbackRef = { current: null as any };
    const handles = createCaptureHandles();

    const onNodeClick = vi.fn();
    const onNodeDoubleClick = vi.fn();
    const onToggleMinimap = vi.fn();
    const onBottlenecksComputed = vi.fn();
    const onForkJoinDetected = vi.fn();
    const onScreenshotReady = vi.fn();
    const onSvgReady = vi.fn();

    const Canvas = makeMockCanvas(canvasTraceRef, bottleneckCallbackRef, handles);
    const view = render(
      <Canvas
        trace={mockTrace}
        fitViewTrigger={4}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onToggleMinimap={onToggleMinimap}
        onBottlenecksComputed={onBottlenecksComputed}
        onForkJoinDetected={onForkJoinDetected}
        onScreenshotReady={onScreenshotReady}
        onSvgReady={onSvgReady}
      />,
    );

    expect(view.getByTestId('canvas-fit-trigger')).toHaveTextContent('4');
    expect(canvasTraceRef.current).toEqual(mockTrace);
    expect(bottleneckCallbackRef.current).toBe(onBottlenecksComputed);
    expect(onForkJoinDetected).toHaveBeenCalledTimes(1);
    expect(onScreenshotReady).toHaveBeenCalledWith(handles.mockCaptureScreenshot);
    expect(onSvgReady).toHaveBeenCalledWith(handles.mockCaptureSvg);

    fireEvent.click(view.getByTestId('canvas-pick-sub1'));
    fireEvent.click(view.getByTestId('canvas-pick-n-name'));
    fireEvent.click(view.getByTestId('canvas-pick-bare'));
    fireEvent.click(view.getByTestId('canvas-pick-n2'));
    fireEvent.click(view.getByTestId('canvas-pick-missing'));
    fireEvent.click(view.getByTestId('canvas-pick-empty'));
    fireEvent.click(view.getByTestId('canvas-toggle-minimap'));
    fireEvent.click(view.getByTestId('canvas-dbl-sub1'));
    fireEvent.click(view.getByTestId('canvas-dbl-n2'));
    fireEvent.click(view.getByTestId('canvas-dbl-empty'));

    expect(onNodeClick).toHaveBeenCalledTimes(6);
    expect(onNodeDoubleClick).toHaveBeenCalledTimes(3);
    expect(onToggleMinimap).toHaveBeenCalledTimes(1);

    // Optional callback branches for canvas.
    render(<Canvas trace={mockTrace} />);

    const Detail = makeMockDetailPanel();
    const onClose = vi.fn();
    const onIterationChange = vi.fn();
    const onDrillDown = vi.fn();
    const onOpenMapper = vi.fn();

    const detailEvents = [
      {
        details: { subWorkflowTrace: { workflowId: 'sub', iterations: [] } as any },
      },
    ];

    const detailView = render(
      <Detail
        nodeLabel="Node A"
        nodeId="n1"
        events={detailEvents as any}
        onClose={onClose}
        onIterationChange={onIterationChange}
        onDrillDown={onDrillDown}
        onOpenMapper={onOpenMapper}
      />,
    );

    fireEvent.click(detailView.getByTestId('detail-close'));
    fireEvent.click(detailView.getByTestId('detail-iter-one'));
    fireEvent.click(detailView.getByTestId('mock-drilldown-btn'));
    fireEvent.click(detailView.getByTestId('mock-open-mapper-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onIterationChange).toHaveBeenCalledWith(1);
    expect(onDrillDown).toHaveBeenCalledTimes(1);
    expect(onOpenMapper).toHaveBeenCalledTimes(1);

    // Detail panel branches without drilldown/openMapper.
    const detailNoOptional = render(<Detail nodeLabel="B" events={[]} />);
    const detailNoOptionalQueries = within(detailNoOptional.container);
    expect(detailNoOptionalQueries.queryByTestId('mock-drilldown-btn')).toBeNull();
    expect(detailNoOptionalQueries.queryByTestId('mock-open-mapper-btn')).toBeNull();

    // Fallback branches: events undefined, nodeId empty fallback, nodeLabel default fallback.
    const onDrillDownFallback = vi.fn();
    const onOpenMapperFallback = vi.fn();
    const detailFallback = render(
      <Detail
        events={detailEvents as any}
        onDrillDown={onDrillDownFallback}
        onOpenMapper={onOpenMapperFallback}
      />,
    );
    const detailFallbackQueries = within(detailFallback.container);
    expect(detailFallbackQueries.getByTestId('detail-events-count')).toHaveAttribute('data-count', '1');
    fireEvent.click(detailFallbackQueries.getByTestId('mock-drilldown-btn'));
    fireEvent.click(detailFallbackQueries.getByTestId('mock-open-mapper-btn'));
    expect(onDrillDownFallback).toHaveBeenCalledWith(expect.any(Object), '');
    expect(onOpenMapperFallback).toHaveBeenCalledWith(expect.any(Array), 'Test Node');

    const detailEventsUndefined = render(<Detail />);
    expect(within(detailEventsUndefined.container).getByTestId('detail-events-count')).toHaveAttribute('data-count', '0');

    const Matrix = makeMockIterationMatrix();
    const onIterationSelect = vi.fn();
    const onCellSelect = vi.fn();
    const matrixView = render(
      <Matrix onIterationSelect={onIterationSelect} onCellSelect={onCellSelect} />,
    );
    fireEvent.click(matrixView.getByTestId('matrix-select-iter-0'));
    fireEvent.click(matrixView.getByTestId('matrix-cell-select'));
    expect(onIterationSelect).toHaveBeenCalledWith(0);
    expect(onCellSelect).toHaveBeenCalledWith(1, 'n3');

    // Matrix no-op optional callbacks.
    const matrixNoOps = render(<Matrix />);
    const matrixNoOpsQueries = within(matrixNoOps.container);
    fireEvent.click(matrixNoOpsQueries.getByTestId('matrix-select-iter-0'));
    fireEvent.click(matrixNoOpsQueries.getByTestId('matrix-cell-select'));

    const saver = createFileSaverMocks();
    expect(saver.mockBuildExportFilename({ level: 'all', name: 'wf', ext: 'csv' })).toBe('all-wf.csv');
    expect(saver.mockBuildExportFilename({ level: 'all' } as any)).toBe('all-unknown.json');

    await expect(handles.mockCaptureScreenshot()).resolves.toContain('data:image/png;base64');
    await expect(handles.mockCaptureSvg()).resolves.toContain('data:image/svg+xml');
  });

  it('openExportMenu clicks dropdown trigger', () => {
    const onClick = vi.fn();
    render(<button type="button" data-testid="export-dropdown-trigger" onClick={onClick}>open</button>);
    openExportMenu();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
