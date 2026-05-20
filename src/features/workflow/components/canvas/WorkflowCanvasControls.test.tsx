/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import WorkflowCanvasControls from './WorkflowCanvasControls';
import { ReactFlowProvider } from '@xyflow/react';

const mockZoomIn = vi.fn();
const mockZoomOut = vi.fn();
const mockFitView = vi.fn();
const mockSetViewport = vi.fn();

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      zoomIn: mockZoomIn,
      zoomOut: mockZoomOut,
      fitView: mockFitView,
      setViewport: mockSetViewport,
    }),
  };
});

function renderWithProvider(ui: React.ReactElement) {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
}

describe('WorkflowCanvasControls', () => {
  const baseProps = {
    showMinimap: true,
    onToggleMinimap: vi.fn(),
    onSaveLayout: vi.fn(),
  };

  it('renders zoom and layout controls', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} />,
    );
    expect(container.querySelector('.wf-pill-controls')).toBeTruthy();
    const buttons = container.querySelectorAll('.wf-pill-btn');
    // Zoom in, Zoom out, Fit, Save Layout, Minimap = 5
    expect(buttons.length).toBe(5);
  });

  it('calls onToggleMinimap when minimap button is clicked', () => {
    const onToggleMinimap = vi.fn();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} onToggleMinimap={onToggleMinimap} />,
    );
    const minimapBtn = container.querySelector('.wf-pill-btn[title="Toggle minimap"]');
    expect(minimapBtn).toBeTruthy();
    fireEvent.click(minimapBtn!);
    expect(onToggleMinimap).toHaveBeenCalledTimes(1);
  });

  it('minimap button has active class when minimap is shown', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} showMinimap={true} />,
    );
    const minimapBtn = container.querySelector('.wf-pill-btn[title="Toggle minimap"]');
    expect(minimapBtn?.classList.contains('wf-pill-btn-active')).toBe(true);
  });

  it('minimap button does not have active class when hidden', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} showMinimap={false} />,
    );
    const minimapBtn = container.querySelector('.wf-pill-btn[title="Toggle minimap"]');
    expect(minimapBtn?.classList.contains('wf-pill-btn-active')).toBe(false);
  });

  it('calls onSaveLayout when save layout button is clicked', () => {
    const onSaveLayout = vi.fn();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} onSaveLayout={onSaveLayout} />,
    );
    const btn = container.querySelector(
      '[data-testid="save-layout-btn"]',
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onSaveLayout).toHaveBeenCalledTimes(1);
  });

  it('applies save-flash class then clears it after timer', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWithProvider(
        <WorkflowCanvasControls {...baseProps} />,
      );
      const btn = container.querySelector(
        '[data-testid="save-layout-btn"]',
      ) as HTMLButtonElement;
      expect(btn.classList.contains('save-flash')).toBe(false);
      fireEvent.click(btn);
      expect(btn.classList.contains('save-flash')).toBe(true);
      act(() => {
        vi.advanceTimersByTime(1200);
      });
      expect(btn.classList.contains('save-flash')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('save layout button is disabled when disableLayout is true', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} disableLayout={true} />,
    );
    const btn = container.querySelector('.wf-pill-btn[title="Save current node layout"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders undo/redo buttons when callbacks provided', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls
        {...baseProps}
        canUndo={true}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    );
    const undoBtn = container.querySelector('.wf-pill-btn[title*="Undo"]');
    const redoBtn = container.querySelector('.wf-pill-btn[title*="Redo"]');
    expect(undoBtn).toBeTruthy();
    expect(redoBtn).toBeTruthy();
  });

  it('does not render undo/redo when callbacks not provided', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} />,
    );
    expect(container.querySelector('.wf-pill-btn[title*="Undo"]')).toBeNull();
    expect(container.querySelector('.wf-pill-btn[title*="Redo"]')).toBeNull();
  });

  it('undo button is disabled when canUndo is false', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls
        {...baseProps}
        canUndo={false}
        canRedo={true}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    );
    const undoBtn = container.querySelector('.wf-pill-btn[title*="Undo"]') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
  });

  it('redo button is disabled when canRedo is false', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls
        {...baseProps}
        canUndo={true}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    );
    const redoBtn = container.querySelector('.wf-pill-btn[title*="Redo"]') as HTMLButtonElement;
    expect(redoBtn.disabled).toBe(true);
  });

  it('calls onUndo when undo button clicked', () => {
    const onUndo = vi.fn();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls
        {...baseProps}
        canUndo={true}
        canRedo={false}
        onUndo={onUndo}
        onRedo={vi.fn()}
      />,
    );
    const undoBtn = container.querySelector('.wf-pill-btn[title*="Undo"]');
    fireEvent.click(undoBtn!);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('calls onRedo when redo button clicked', () => {
    const onRedo = vi.fn();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls
        {...baseProps}
        canUndo={false}
        canRedo={true}
        onUndo={vi.fn()}
        onRedo={onRedo}
      />,
    );
    const redoBtn = container.querySelector('.wf-pill-btn[title*="Redo"]');
    fireEvent.click(redoBtn!);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('renders separator between undo/redo and zoom', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls
        {...baseProps}
        canUndo={true}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    );
    const seps = container.querySelectorAll('.wf-pill-sep');
    expect(seps.length).toBeGreaterThanOrEqual(3); // undo/redo | zoom | layout | minimap
  });

  it('renders with correct total button count when undo/redo present', () => {
    const { container } = renderWithProvider(
      <WorkflowCanvasControls
        {...baseProps}
        canUndo={true}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    );
    const buttons = container.querySelectorAll('.wf-pill-btn');
    // Undo, Redo, Zoom in, Zoom out, Fit, Save Layout, Minimap = 7
    expect(buttons.length).toBe(7);
  });

  it('calls zoomIn when Zoom in button clicked', () => {
    mockZoomIn.mockClear();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} />,
    );
    const btn = container.querySelector('.wf-pill-btn[title="Zoom in"]');
    fireEvent.click(btn!);
    expect(mockZoomIn).toHaveBeenCalledWith({ duration: 200 });
  });

  it('calls zoomOut when Zoom out button clicked', () => {
    mockZoomOut.mockClear();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} />,
    );
    const btn = container.querySelector('.wf-pill-btn[title="Zoom out"]');
    fireEvent.click(btn!);
    expect(mockZoomOut).toHaveBeenCalledWith({ duration: 200 });
  });

  it('calls fitView when Fit view button clicked and no saved viewport', () => {
    mockFitView.mockClear();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} />,
    );
    const btn = container.querySelector('.wf-pill-btn[title="Fit view"]');
    fireEvent.click(btn!);
    expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2, maxZoom: 1.5, duration: 300, includeHiddenNodes: true });
  });

  it('always fits view even when savedViewport is provided', () => {
    mockSetViewport.mockClear();
    mockFitView.mockClear();
    const vp = { x: 100, y: 200, zoom: 1.5 };
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} savedViewport={vp} />,
    );
    const btn = container.querySelector('.wf-pill-btn[title="Fit view"]');
    fireEvent.click(btn!);
    expect(mockFitView).toHaveBeenCalledWith({ padding: 0.2, maxZoom: 1.5, duration: 300, includeHiddenNodes: true });
    expect(mockSetViewport).not.toHaveBeenCalled();
  });

  it('calls onAutoLayout before fitView when provided', () => {
    mockFitView.mockClear();
    const onAutoLayout = vi.fn();
    const { container } = renderWithProvider(
      <WorkflowCanvasControls {...baseProps} onAutoLayout={onAutoLayout} />,
    );
    const btn = container.querySelector('.wf-pill-btn[title="Fit view"]');
    fireEvent.click(btn!);
    expect(onAutoLayout).toHaveBeenCalledTimes(1);
  });
});
