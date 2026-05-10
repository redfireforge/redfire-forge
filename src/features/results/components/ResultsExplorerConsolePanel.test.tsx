/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import ResultsExplorerConsolePanel from './ResultsExplorerConsolePanel';
import type { WorkflowExecutionTrace, WorkflowIterationTrace, ExecutionEvent } from '../../../shared/types';
import * as reconstructLogLinesModule from '../utils/reconstructLogLines';

const RE_CONSOLE_MODE_KEY = 're-console-default-mode';

function makeEvent(overrides?: Partial<ExecutionEvent>): ExecutionEvent {
  return {
    nodeId: 'n1',
    nodeType: 'http',
    nodeLabel: 'Step 1',
    timestamp: 1000,
    state: 'pass',
    durationMs: 100,
    details: {
      method: 'GET',
      url: 'https://api.example.com',
      statusCode: 200,
      responseTimeMs: 50,
    },
    ...overrides,
  };
}

function makeIteration(overrides?: Partial<WorkflowIterationTrace>): WorkflowIterationTrace {
  return {
    index: 0,
    passed: true,
    durationMs: 500,
    events: [makeEvent()],
    finalVariables: {},
    traversedEdges: [],
    ...overrides,
  };
}

function makeTrace(overrides?: Partial<WorkflowExecutionTrace>): WorkflowExecutionTrace {
  return {
    workflowName: 'Test Workflow',
    totalIterations: 1,
    totalDurationMs: 1000,
    fullTraceCaptured: true,
    captureLevel: 'standard',
    iterations: [makeIteration()],
    traversedEdges: [],
    workflowSnapshot: {
      nodes: [{ id: 'n1', type: 'http', data: { label: 'Step 1' } }],
      edges: [],
    },
    ...overrides,
  } as WorkflowExecutionTrace;
}

describe('ResultsExplorerConsolePanel', () => {
  const defaultProps = {
    trace: makeTrace(),
    iteration: makeIteration(),
    onNodeSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(RE_CONSOLE_MODE_KEY);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the panel with console title', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    expect(screen.getByText('Console')).toBeTruthy();
  });

  it('shows disabled message when captureLevel is minimal', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} captureLevel="minimal" />);
    expect(screen.getByTestId('results-console-disabled')).toBeTruthy();
    expect(screen.getByText(/Standard/)).toBeTruthy();
  });

  it('shows aggregate summary when no iteration selected', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} iteration={undefined} />);
    expect(screen.getByText(/Run Overview/)).toBeTruthy();
    expect(screen.getByText(/1\/1 passed/)).toBeTruthy();
    expect(screen.getByText(/Select an iteration to see full console output/)).toBeTruthy();
  });

  it('renders log lines for iteration events', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    expect(screen.getByTestId('results-console-body')).toBeTruthy();
    expect(screen.getByText(/GET https:\/\/api\.example\.com/)).toBeTruthy();
  });

  it('shows line count', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const countEl = document.querySelector('.re-console-count');
    expect(countEl?.textContent).toMatch(/\d+ lines?/);
  });

  it('shows singular "line" when exactly one log line', () => {
    vi.spyOn(reconstructLogLinesModule, 'reconstructLogLines').mockReturnValue([
      { prefix: '*', text: 'Only line', ts: 0 },
    ]);
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    expect(document.querySelector('.re-console-count')?.textContent).toBe('1 line');
  });

  it('shows trace level badge', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} captureLevel="debug" />);
    expect(screen.getByTestId('console-level-badge').textContent).toBe('debug');
  });

  it('shows level hint for standard trace', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} captureLevel="standard" />);
    expect(screen.getByText(/Use Full or Debug/)).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const closeBtn = screen.getByTitle(/Close console/);
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onNodeSelect when a clickable line is clicked', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const clickableLine = buttons.find(b => b.classList.contains('wf-cl-line-clickable'));
    if (clickableLine) {
      fireEvent.click(clickableLine);
      expect(defaultProps.onNodeSelect).toHaveBeenCalledWith('n1');
    }
  });

  it('does not call onNodeSelect when callback omitted', () => {
    const { onNodeSelect, ...rest } = defaultProps;
    render(<ResultsExplorerConsolePanel {...rest} />);
    const clickable = screen.getAllByRole('button').find(b => b.classList.contains('wf-cl-line-clickable'));
    expect(clickable).toBeTruthy();
    fireEvent.click(clickable!);
  });

  it('filters by search query', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByTestId('console-search');
    fireEvent.change(searchInput, { target: { value: 'GET' } });
    const body = screen.getByTestId('results-console-body');
    expect(body.children.length).toBeGreaterThan(0);
  });

  it('shows no-matches message for unmatched search', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByTestId('console-search');
    fireEvent.change(searchInput, { target: { value: 'zzz_no_match_zzz' } });
    const count = screen.getByText('No matches');
    expect(count).toBeTruthy();
  });

  it('navigates next and previous match and wraps', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByTestId('console-search');
    fireEvent.change(searchInput, { target: { value: 'Iteration' } });
    const nextBtn = screen.getByTitle('Next match (Enter)') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);
    fireEvent.click(nextBtn);
    fireEvent.click(screen.getByTitle('Previous match (Shift+Enter)'));
    fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: false });
    fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: true });
  });

  it('Enter with no matches does not throw', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByTestId('console-search');
    fireEvent.keyDown(searchInput, { key: 'Enter', preventDefault: vi.fn() });
  });

  it('Shift+Enter with no matches does not throw', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByTestId('console-search');
    fireEvent.change(searchInput, { target: { value: '__no_such_string__' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: true, preventDefault: vi.fn() });
  });

  it('toggleSearch clears query when closing via Search button', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByTestId('console-search'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByText('Search'));
    fireEvent.click(screen.getByText('Search'));
    const input = screen.getByTestId('console-search') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('closes search bar from search bar close button', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const closeSearch = screen.getByTitle('Close search');
    fireEvent.click(closeSearch);
    expect(screen.queryByTestId('console-search')).toBeNull();
  });

  it('scrolls match into view when navigating', () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByTestId('console-search'), { target: { value: 'GET' } });
    fireEvent.click(screen.getByTitle('Next match (Enter)'));
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('renders node filter dropdown when multiple nodes exist', () => {
    const iter = makeIteration({
      events: [
        makeEvent({ nodeId: 'n1', nodeLabel: 'A' }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'B' }),
      ],
    });
    const trace = makeTrace({ iterations: [iter] });
    render(<ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={iter} />);
    expect(screen.getByTestId('console-node-filter')).toBeTruthy();
  });

  it('toggles node filter open and closed', () => {
    const iter = makeIteration({
      events: [
        makeEvent({ nodeId: 'n1', nodeLabel: 'A' }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'B' }),
      ],
    });
    const trace = makeTrace({
      iterations: [iter],
      workflowSnapshot: {
        nodes: [{ id: 'n1', type: 'http', data: {} }, { id: 'n2', type: 'http', data: {} }],
        edges: [],
      },
    });
    render(<ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={iter} />);
    const btn = screen.getByTestId('console-node-filter');
    act(() => { fireEvent.click(btn); });
    expect(screen.getByTestId('console-node-filter-menu')).toBeTruthy();
    act(() => { fireEvent.click(btn); });
    expect(screen.queryByTestId('console-node-filter-menu')).toBeNull();
  });

  it('closes node filter on click outside', () => {
    const iter = makeIteration({
      events: [
        makeEvent({ nodeId: 'n1', nodeLabel: 'A' }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'B' }),
      ],
    });
    const trace = makeTrace({
      iterations: [iter],
      workflowSnapshot: {
        nodes: [{ id: 'n1', type: 'http', data: {} }, { id: 'n2', type: 'http', data: {} }],
        edges: [],
      },
    });
    render(
      <div>
        <button type="button" data-testid="outside">
          Outside
        </button>
        <ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={iter} />
      </div>,
    );
    act(() => { fireEvent.click(screen.getByTestId('console-node-filter')); });
    expect(screen.getByTestId('console-node-filter-menu')).toBeTruthy();
    act(() => { fireEvent.mouseDown(screen.getByTestId('outside')); });
    expect(screen.queryByTestId('console-node-filter-menu')).toBeNull();
  });

  it('selects All nodes from filter menu', () => {
    const iter = makeIteration({
      events: [
        makeEvent({ nodeId: 'n1', nodeLabel: 'A', details: { method: 'GET', url: '/a', statusCode: 200 } }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'B', details: { method: 'POST', url: '/b', statusCode: 201 } }),
      ],
    });
    const trace = makeTrace({
      iterations: [iter],
      workflowSnapshot: {
        nodes: [{ id: 'n1', type: 'http', data: { label: 'A' } }, { id: 'n2', type: 'http', data: { label: 'B' } }],
        edges: [],
      },
    });
    render(<ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={iter} />);
    act(() => { fireEvent.click(screen.getByTestId('console-node-filter')); });
    const menu = screen.getByTestId('console-node-filter-menu');
    const allNodesBtn = within(menu).getByRole('button', { name: /^All nodes$/ });
    act(() => { fireEvent.click(allNodesBtn); });
    expect(screen.queryByTestId('console-node-filter-menu')).toBeNull();
    expect(screen.getByTestId('results-console-body').textContent).toContain('POST');
  });

  it('does not render node filter when only one node', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    expect(screen.queryByTestId('console-node-filter')).toBeNull();
  });

  it('filters lines by node when filter selected', () => {
    const iter = makeIteration({
      events: [
        makeEvent({ nodeId: 'n1', nodeLabel: 'A', details: { method: 'GET', url: '/a', statusCode: 200 } }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'B', details: { method: 'POST', url: '/b', statusCode: 201 } }),
      ],
    });
    const trace = makeTrace({
      iterations: [iter],
      workflowSnapshot: {
        nodes: [{ id: 'n1', type: 'http', data: { label: 'A' } }, { id: 'n2', type: 'http', data: { label: 'B' } }],
        edges: [],
      },
    });
    render(<ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={iter} />);
    const filterBtn = screen.getByTestId('console-node-filter');
    act(() => { fireEvent.click(filterBtn); });
    const menu = screen.getByTestId('console-node-filter-menu');
    const items = Array.from(menu.querySelectorAll('button'));
    const itemA = items.find(b => b.textContent?.replace(/^✓\s*/, '') === 'A');
    expect(itemA).toBeTruthy();
    act(() => { fireEvent.click(itemA!); });
    const body = screen.getByTestId('results-console-body');
    const textContent = body.textContent ?? '';
    expect(textContent).toContain('GET /a');
    expect(textContent).not.toContain('POST /b');
  });

  it('shows All nodes as filter label when stored filter id is no longer in options', () => {
    const iterThree = makeIteration({
      index: 0,
      events: [
        makeEvent({ nodeId: 'n1', nodeLabel: 'A', details: { method: 'GET', url: '/a', statusCode: 200 } }),
        makeEvent({ nodeId: 'n2', nodeLabel: 'B', details: { method: 'POST', url: '/b', statusCode: 201 } }),
        makeEvent({ nodeId: 'n3', nodeLabel: 'C', details: { method: 'PUT', url: '/c', statusCode: 200 } }),
      ],
    });
    const traceThree = makeTrace({
      iterations: [iterThree],
      workflowSnapshot: {
        nodes: [
          { id: 'n1', type: 'http', data: {} },
          { id: 'n2', type: 'http', data: {} },
          { id: 'n3', type: 'http', data: {} },
        ],
        edges: [],
      },
    });
    const { rerender } = render(
      <ResultsExplorerConsolePanel {...defaultProps} trace={traceThree} iteration={iterThree} />,
    );
    act(() => { fireEvent.click(screen.getByTestId('console-node-filter')); });
    const menu = screen.getByTestId('console-node-filter-menu');
    act(() => { fireEvent.click(within(menu).getByRole('button', { name: 'A' })); });

    const iterTwo = makeIteration({
      index: 0,
      events: [
        makeEvent({ nodeId: 'n2', nodeLabel: 'B', details: { method: 'POST', url: '/b', statusCode: 201 } }),
        makeEvent({ nodeId: 'n3', nodeLabel: 'C', details: { method: 'PUT', url: '/c', statusCode: 200 } }),
      ],
    });
    const traceTwo = makeTrace({
      iterations: [iterTwo],
      workflowSnapshot: {
        nodes: [
          { id: 'n1', type: 'http', data: {} },
          { id: 'n2', type: 'http', data: {} },
          { id: 'n3', type: 'http', data: {} },
        ],
        edges: [],
      },
    });
    rerender(<ResultsExplorerConsolePanel {...defaultProps} trace={traceTwo} iteration={iterTwo} />);
    const label = screen.getByTestId('console-node-filter').querySelector('.re-console-nf-label');
    expect(label?.textContent).toBe('All nodes');
  });

  it('uses includeHttpBodies when capture level is full', () => {
    const spy = vi.spyOn(reconstructLogLinesModule, 'reconstructLogLines');
    render(<ResultsExplorerConsolePanel {...defaultProps} captureLevel="full" />);
    expect(spy).toHaveBeenCalled();
    const opts = spy.mock.calls[spy.mock.calls.length - 1]?.[1];
    expect(opts?.includeHttpBodies).toBe(true);
  });

  it('renders mode selector with docked/floating/fullscreen options', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const modeSelect = screen.getByTitle('Console display mode (saved as default)') as HTMLSelectElement;
    expect(modeSelect).toBeTruthy();
    expect(modeSelect.value).toBe('docked');
  });

  it('loads default mode floating from localStorage', () => {
    localStorage.setItem(RE_CONSOLE_MODE_KEY, 'floating');
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const modeSelect = screen.getByTitle('Console display mode (saved as default)') as HTMLSelectElement;
    expect(modeSelect.value).toBe('floating');
    expect(screen.getByTestId('results-console-panel').className).toContain('re-console-floating');
  });

  it('loads default mode maximized from localStorage', () => {
    localStorage.setItem(RE_CONSOLE_MODE_KEY, 'maximized');
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const modeSelect = screen.getByTitle('Console display mode (saved as default)') as HTMLSelectElement;
    expect(modeSelect.value).toBe('maximized');
    expect(screen.getByTestId('results-console-panel').className).toContain('re-console-maximized');
  });

  it('falls back to docked when localStorage mode is invalid', () => {
    localStorage.setItem(RE_CONSOLE_MODE_KEY, 'invalid-mode');
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    expect((screen.getByTitle('Console display mode (saved as default)') as HTMLSelectElement).value).toBe('docked');
  });

  it('persists mode to localStorage when changed', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const modeSelect = screen.getByTitle('Console display mode (saved as default)');
    fireEvent.change(modeSelect, { target: { value: 'maximized' } });
    expect(localStorage.getItem(RE_CONSOLE_MODE_KEY)).toBe('maximized');
  });

  it('switches to maximized mode via mode selector', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const modeSelect = screen.getByTitle('Console display mode (saved as default)');
    fireEvent.change(modeSelect, { target: { value: 'maximized' } });
    const panel = screen.getByTestId('results-console-panel');
    expect(panel.className).toContain('re-console-maximized');
  });

  it('switches to floating mode and shows resize handles', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.change(screen.getByTitle('Console display mode (saved as default)'), { target: { value: 'floating' } });
    const panel = screen.getByTestId('results-console-panel');
    expect(panel.className).toContain('re-console-floating');
    expect(document.querySelector('.re-console-float-grip')).toBeTruthy();
    expect(document.querySelector('.re-console-float-edge-right')).toBeTruthy();
  });

  it('resizes docked panel via top handle', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    const handle = document.querySelector('.re-console-resize-handle');
    expect(handle).toBeTruthy();
    act(() => {
      fireEvent.mouseDown(handle!, { clientY: 300 });
      fireEvent.mouseMove(window, { clientY: 250 });
      fireEvent.mouseUp(window);
    });
    const panel = screen.getByTestId('results-console-panel') as HTMLElement;
    expect(panel.style.height).not.toBe('');
    expect(document.body.style.cursor).toBe('');
  });

  it('drags floating panel by header', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.change(screen.getByTitle('Console display mode (saved as default)'), { target: { value: 'floating' } });
    const header = document.querySelector('.re-console-header') as HTMLElement;
    act(() => {
      fireEvent.mouseDown(header, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(window, { clientX: 150, clientY: 120 });
      fireEvent.mouseUp(window);
    });
    const panel = screen.getByTestId('results-console-panel') as HTMLElement;
    expect(panel.style.left).toBeTruthy();
  });

  it('does not start float drag when mousedown on control inside header', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.change(screen.getByTitle('Console display mode (saved as default)'), { target: { value: 'floating' } });
    const panel = screen.getByTestId('results-console-panel') as HTMLElement;
    const leftBefore = panel.style.left;
    const searchBtn = screen.getByText('Search');
    act(() => {
      fireEvent.mouseDown(searchBtn, { clientX: 10, clientY: 10, button: 0 });
      fireEvent.mouseMove(window, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(window);
    });
    expect(panel.style.left).toBe(leftBefore);
  });

  it('resizes floating panel from corner grip', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.change(screen.getByTitle('Console display mode (saved as default)'), { target: { value: 'floating' } });
    const grip = document.querySelector('.re-console-float-grip') as HTMLElement;
    const startW = (screen.getByTestId('results-console-panel') as HTMLElement).style.width;
    act(() => {
      fireEvent.mouseDown(grip, { clientX: 400, clientY: 300 });
      fireEvent.mouseMove(window, { clientX: 450, clientY: 350 });
      fireEvent.mouseUp(window);
    });
    const after = (screen.getByTestId('results-console-panel') as HTMLElement).style;
    expect(after.width !== startW || after.height).toBeTruthy();
    expect(document.body.style.cursor).toBe('');
  });

  it('resizes floating panel from right edge', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.change(screen.getByTitle('Console display mode (saved as default)'), { target: { value: 'floating' } });
    const edge = document.querySelector('.re-console-float-edge-right') as HTMLElement;
    const panel = screen.getByTestId('results-console-panel') as HTMLElement;
    const wBefore = panel.style.width;
    act(() => {
      fireEvent.mouseDown(edge, { clientX: 500 });
      fireEvent.mouseMove(window, { clientX: 560 });
      fireEvent.mouseUp(window);
    });
    expect(panel.style.width).not.toBe(wBefore);
  });

  it('shows minimal floating handles when trace level minimal', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} captureLevel="minimal" />);
    fireEvent.change(screen.getByTitle('Console display mode (saved as default)'), { target: { value: 'floating' } });
    expect(document.querySelector('.re-console-float-grip')).toBeTruthy();
  });

  it('auto-scrolls to first error line on open', () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const iter = makeIteration({
      events: [
        makeEvent({
          details: {
            method: 'GET',
            url: 'https://x',
            statusCode: 500,
            responseTimeMs: 10,
            error: 'request failed',
          },
        }),
      ],
    });
    render(<ResultsExplorerConsolePanel {...defaultProps} iteration={iter} />);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('does not throw when error line has no scrollIntoView', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      const iter = makeIteration({
        events: [
          makeEvent({
            details: {
              method: 'GET',
              url: 'https://x',
              statusCode: 500,
              error: 'request failed',
            },
          }),
        ],
      });
      expect(() => render(<ResultsExplorerConsolePanel {...defaultProps} iteration={iter} />)).not.toThrow();
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }
  });

  it('resets auto-scroll when iteration index changes', () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    const iter0 = makeIteration({
      index: 0,
      events: [
        makeEvent({
          details: {
            method: 'GET',
            url: 'https://x',
            statusCode: 500,
            error: 'e0',
          },
        }),
      ],
    });
    const iter1 = makeIteration({
      index: 1,
      events: [
        makeEvent({
          details: {
            method: 'GET',
            url: 'https://y',
            statusCode: 500,
            error: 'e1',
          },
        }),
      ],
    });
    const trace = makeTrace({ iterations: [iter0, iter1] });
    const { rerender } = render(
      <ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={iter0} />,
    );
    scrollSpy.mockClear();
    rerender(<ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={iter1} />);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('shows aggregate empty when no iterations', () => {
    const trace = makeTrace({ iterations: [] });
    render(<ResultsExplorerConsolePanel {...defaultProps} trace={trace} iteration={undefined} />);
    expect(screen.getByText('No events recorded across iterations')).toBeTruthy();
  });

  it('shows iteration empty body when reconstruct returns no lines', () => {
    vi.spyOn(reconstructLogLinesModule, 'reconstructLogLines').mockReturnValue([]);
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    expect(screen.getByText('No events recorded for this iteration')).toBeTruthy();
  });

  it('matches search on node label', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByTestId('console-search'), { target: { value: 'Step 1' } });
    expect(screen.getByText(/\d+\/\d+/)).toBeTruthy();
  });

  it('infers capture level when omitted on trace', () => {
    const trace = makeTrace({ captureLevel: undefined });
    delete (trace as { captureLevel?: string }).captureLevel;
    render(<ResultsExplorerConsolePanel {...defaultProps} trace={trace} />);
    expect(screen.getByTestId('console-level-badge').textContent).toBe('standard');
  });

  it('closes search bar and clears query on Escape', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByTestId('console-search') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput.value).toBe('test');
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    expect(screen.queryByTestId('console-search')).toBeNull();
  });

  it('shows match count with prev/next navigation', () => {
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByTestId('console-search');
    fireEvent.change(searchInput, { target: { value: 'Iteration' } });
    const count = document.querySelector('.re-console-search-count');
    expect(count?.textContent).toMatch(/\d+\/\d+/);
    const nextBtn = screen.getByTitle('Next match (Enter)');
    expect(nextBtn).toBeTruthy();
    const prevBtn = screen.getByTitle('Previous match (Shift+Enter)');
    expect(prevBtn).toBeTruthy();
  });

  it('ignores localStorage errors when loading default mode', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => render(<ResultsExplorerConsolePanel {...defaultProps} />)).not.toThrow();
    const modeSelect = screen.getByTitle('Console display mode (saved as default)') as HTMLSelectElement;
    expect(modeSelect.value).toBe('docked');
    getItem.mockRestore();
  });

  it('ignores localStorage errors when saving default mode', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<ResultsExplorerConsolePanel {...defaultProps} />);
    expect(() =>
      fireEvent.change(screen.getByTitle('Console display mode (saved as default)'), {
        target: { value: 'floating' },
      }),
    ).not.toThrow();
    setItem.mockRestore();
  });
});
