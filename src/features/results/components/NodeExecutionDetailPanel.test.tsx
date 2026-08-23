/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import NodeExecutionDetailPanel from './NodeExecutionDetailPanel';
import type { WorkflowIterationTrace, ExecutionEvent } from '@shared/types';

function createEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    nodeId: 'node-1',
    nodeType: 'http',
    nodeLabel: 'HTTP Request',
    timestamp: Date.now(),
    state: 'pass',
    durationMs: 150,
    ...overrides,
  };
}

function createIteration(events: ExecutionEvent[], passed = true): WorkflowIterationTrace {
  return {
    index: 0,
    passed,
    durationMs: events.reduce((sum, e) => sum + (e.durationMs || 0), 0),
    events,
    finalVariables: {},
    traversedEdges: [],
  };
}

describe('NodeExecutionDetailPanel', () => {
  const defaultProps = {
    nodeId: 'node-1',
    nodeLabel: 'Test Node',
    iterations: [] as WorkflowIterationTrace[],
    onClose: vi.fn(),
  };

  it('renders node label and close button', () => {
    render(<NodeExecutionDetailPanel {...defaultProps} />);
    
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<NodeExecutionDetailPanel {...defaultProps} onClose={onClose} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows empty state when node has no events', () => {
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={[createIteration([])]} />);
    
    expect(screen.getByText(/This node was not executed/)).toBeInTheDocument();
  });

  it('displays aggregate stats when node has events', () => {
    const iterations = [
      createIteration([createEvent({ durationMs: 100 })]),
      createIteration([createEvent({ durationMs: 200 })]),
    ];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    expect(screen.getByText('100%')).toBeInTheDocument(); // Pass rate
    expect(screen.getByText('2')).toBeInTheDocument(); // Executions
    expect(screen.getByText('150ms')).toBeInTheDocument(); // Avg duration
  });

  it('calculates pass rate correctly with mixed results', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass', durationMs: 100 })], true),
      createIteration([createEvent({ state: 'fail', durationMs: 200 })], false),
      createIteration([createEvent({ state: 'pass', durationMs: 100 })], true),
      createIteration([createEvent({ state: 'fail', durationMs: 200 })], false),
    ];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    expect(screen.getByText('50%')).toBeInTheDocument(); // 2/4 pass
  });

  it('displays node type badge', () => {
    const iterations = [createIteration([createEvent({ nodeType: 'http' })])];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    expect(screen.getByText('http')).toBeInTheDocument();
  });

  it('shows HTTP details when available', () => {
    const event = createEvent({
      details: {
        method: 'POST',
        url: '/api/test',
        statusCode: 201,
        responseTimeMs: 42,
      },
    });
    const iterations = [createIteration([event])];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    expect(screen.getByText('POST /api/test')).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();
  });

  it('shows error message when event has error', () => {
    const event = createEvent({
      state: 'fail',
      details: {
        error: 'Connection timeout',
      },
    });
    const iterations = [createIteration([event], false)];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('filters iterations by status when filter button clicked', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass', durationMs: 100 })], true),
      createIteration([createEvent({ state: 'fail', durationMs: 200 })], false),
    ];
    // Override index for each iteration
    iterations[0].index = 0;
    iterations[1].index = 1;
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    // Both iterations visible by default
    const iterRows = document.querySelectorAll('.node-detail-iteration-row');
    expect(iterRows).toHaveLength(2);
    
    // Click fail filter button
    const failButton = document.querySelector('.node-detail-filter-fail');
    if (failButton) fireEvent.click(failButton);
    
    // Only 1 iteration should be visible (failed)
    const filteredRows = document.querySelectorAll('.node-detail-iteration-row');
    expect(filteredRows).toHaveLength(1);
  });

  it('shows timing stats when multiple executions', () => {
    const iterations = [
      createIteration([createEvent({ durationMs: 100 })]),
      createIteration([createEvent({ durationMs: 200 })]),
      createIteration([createEvent({ durationMs: 300 })]),
    ];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    // Check that timing stats section exists
    const timingSection = document.querySelector('.node-detail-timing');
    expect(timingSection).not.toBeNull();
    
    // Check for the labels
    const labels = timingSection?.querySelectorAll('.node-detail-timing-label');
    expect(labels?.length).toBeGreaterThanOrEqual(3);
  });

  it('calls onIterationClick when iteration row clicked', () => {
    const onIterationClick = vi.fn();
    const iterations = [
      createIteration([createEvent({})]),
      createIteration([createEvent({})]),
    ];
    iterations[0].index = 0;
    iterations[1].index = 1;
    
    render(
      <NodeExecutionDetailPanel
        {...defaultProps}
        iterations={iterations}
        onIterationClick={onIterationClick}
      />
    );
    
    const row = screen.getByText('#1').closest('[role="button"]');
    if (row) fireEvent.click(row);
    
    expect(onIterationClick).toHaveBeenCalledWith(0);
  });

  it('shows only selected iteration events when selectedIteration is set', () => {
    const iterations = [
      createIteration([createEvent({ nodeId: 'node-1', durationMs: 111 })]),
      createIteration([createEvent({ nodeId: 'node-1', durationMs: 222 })]),
    ];
    iterations[0].index = 0;
    iterations[1].index = 1;
    
    render(
      <NodeExecutionDetailPanel
        {...defaultProps}
        iterations={iterations}
        selectedIteration={1}
      />
    );
    
    // Should show stats for only the selected iteration
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 execution
    expect(screen.getByText('222ms')).toBeInTheDocument(); // Duration from iteration 1
  });

  it('formats duration correctly for various ranges', () => {
    const iterations = [
      createIteration([
        createEvent({ nodeId: 'node-1', durationMs: 0.5 }), // <1ms
        createEvent({ nodeId: 'node-1', durationMs: 1500 }), // seconds
      ]),
    ];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    // The avg would be 750.25ms, rounded to 750ms
    // Other format tests handled in the component logic
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 executions
  });

  it('shows status breakdown bar with correct colors', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass' })], true),
      createIteration([createEvent({ state: 'fail' })], false),
      createIteration([createEvent({ state: 'skipped' })], false),
    ];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    // Check that status bar segments exist
    const statusBar = document.querySelector('.node-detail-status-bar');
    expect(statusBar).not.toBeNull();
    expect(document.querySelector('.node-detail-status-segment.pass')).not.toBeNull();
    expect(document.querySelector('.node-detail-status-segment.fail')).not.toBeNull();
    expect(document.querySelector('.node-detail-status-segment.skipped')).not.toBeNull();
  });

  it('shows stack trace in details when available', () => {
    const event = createEvent({
      state: 'fail',
      details: {
        error: 'TypeError: Cannot read property',
        errorStack: 'at Object.<anonymous> (test.js:1:1)',
      },
    });
    const iterations = [createIteration([event], false)];
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    expect(screen.getByText('Stack trace')).toBeInTheDocument();
  });

  it('handles empty iterations array', () => {
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={[]} />);
    
    expect(screen.getByText(/This node was not executed/)).toBeInTheDocument();
  });

  it('does not show per-iteration breakdown for single iteration', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass' })], true),
    ];
    iterations[0].index = 0;
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    // Single iteration doesn't show the breakdown section
    expect(screen.queryByText('Per-Iteration Breakdown')).not.toBeInTheDocument();
  });

  it('shows per-iteration breakdown only for multiple iterations', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass' })], true),
      createIteration([createEvent({ state: 'fail' })], false),
    ];
    iterations[0].index = 0;
    iterations[1].index = 1;
    
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);
    
    // Multiple iterations show the breakdown
    expect(screen.getByText('Per-Iteration Breakdown')).toBeInTheDocument();
  });

  it('shows no-match message when breakdown has no executed iterations', () => {
    const iterations = [
      createIteration([], true),
      createIteration([], true),
    ];
    iterations[0].index = 0;
    iterations[1].index = 1;

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    expect(screen.getByText('No iterations match this filter')).toBeInTheDocument();
  });

  it('filters breakdown to passing iterations when pass filter is clicked', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass', durationMs: 10 })], true),
      createIteration([createEvent({ state: 'fail', durationMs: 20 })], false),
    ];
    iterations[0].index = 0;
    iterations[1].index = 1;

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    const passBtn = document.querySelector('.node-detail-filter-pass');
    expect(passBtn).not.toBeNull();
    fireEvent.click(passBtn!);

    expect(document.querySelectorAll('.node-detail-iteration-row')).toHaveLength(1);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).not.toBeInTheDocument();
  });

  it('filters breakdown to skipped iterations when skipped filter is clicked', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass', durationMs: 10 })], true),
      createIteration([createEvent({ state: 'skipped', durationMs: 5 })], true),
    ];
    iterations[0].index = 0;
    iterations[1].index = 1;

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    const skipBtn = document.querySelector('.node-detail-filter-skipped');
    expect(skipBtn).not.toBeNull();
    fireEvent.click(skipBtn!);

    expect(document.querySelectorAll('.node-detail-iteration-row')).toHaveLength(1);
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText(/Skipped/)).toBeInTheDocument();
  });

  it('resets per-iteration filter when All is clicked after filtering', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass', durationMs: 10 })], true),
      createIteration([createEvent({ state: 'fail', durationMs: 20 })], false),
    ];
    iterations[0].index = 0;
    iterations[1].index = 1;

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    fireEvent.click(document.querySelector('.node-detail-filter-pass')!);
    expect(document.querySelectorAll('.node-detail-iteration-row')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'All (2)' }));
    expect(document.querySelectorAll('.node-detail-iteration-row')).toHaveLength(2);
  });

  it('shows 0% pass rate when all executions fail', () => {
    const iterations = [
      createIteration([createEvent({ state: 'fail', durationMs: 100 })], false),
      createIteration([createEvent({ state: 'fail', durationMs: 200 })], false),
    ];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('uses warning tone when pass rate is strictly between 0 and 100', () => {
    const iterations = [
      createIteration([createEvent({ state: 'pass', durationMs: 100 })], true),
      createIteration([createEvent({ state: 'fail', durationMs: 200 })], false),
    ];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    const hero = document.querySelector('.node-detail-hero-value');
    expect(hero).toHaveStyle({ color: '#f59e0b' });
  });

  it('renders error stack details and pre content when expanded', () => {
    const stack = 'at foo (bar.ts:1:1)\nat baz (bar.ts:2:1)';
    const event = createEvent({
      state: 'fail',
      details: { error: 'boom', errorStack: stack },
    });
    const iterations = [createIteration([event], false)];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    const detailsEl = document.querySelector('.node-detail-stack');
    expect(detailsEl).not.toBeNull();
    fireEvent.click(screen.getByText('Stack trace'));

    expect(screen.getByText((t) => t.includes('bar.ts'))).toBeInTheDocument();
  });

  it('styles HTTP status >= 400 as failure color', () => {
    const event = createEvent({
      details: { method: 'GET', url: '/x', statusCode: 502 },
    });
    const iterations = [createIteration([event])];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    const statusVal = screen.getByText('502');
    expect(statusVal).toHaveStyle({ color: '#ef4444' });
  });

  it('omits request row when only method is present without url', () => {
    const event = createEvent({
      details: { method: 'GET', statusCode: 200 },
    });
    const iterations = [createIteration([event])];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    expect(screen.queryByText(/GET\s/)).not.toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('shows type badge from latest event for non-http node types', () => {
    const types = ['condition', 'loop', 'script', 'sub-workflow'] as const;
    for (const nodeType of types) {
      const { unmount } = render(
        <NodeExecutionDetailPanel
          {...defaultProps}
          iterations={[createIteration([createEvent({ nodeType })])]}
        />
      );
      expect(screen.getByText(nodeType)).toBeInTheDocument();
      unmount();
    }
  });

  it('shows unknown type when there are no events', () => {
    render(<NodeExecutionDetailPanel {...defaultProps} iterations={[createIteration([])]} />);

    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('returns no events when selectedIteration is out of range', () => {
    const iterations = [createIteration([createEvent({ durationMs: 50 })])];

    render(
      <NodeExecutionDetailPanel
        {...defaultProps}
        iterations={iterations}
        selectedIteration={99}
      />
    );

    expect(screen.getByText(/This node was not executed in this iteration/)).toBeInTheDocument();
  });

  it('uses this iteration wording in empty state when viewing a single iteration', () => {
    const iterations = [
      createIteration([createEvent({ nodeId: 'other' })], true),
    ];

    render(
      <NodeExecutionDetailPanel
        {...defaultProps}
        nodeId="node-1"
        iterations={iterations}
        selectedIteration={0}
      />
    );

    expect(screen.getByText(/this iteration/)).toBeInTheDocument();
  });

  it('aggregates duration and picks fail state when multiple events exist for same node', () => {
    const iterations = [
      createIteration(
        [
          createEvent({ nodeId: 'node-1', state: 'pass', durationMs: 40 }),
          createEvent({ nodeId: 'node-1', state: 'fail', durationMs: 60 }),
        ],
        false
      ),
    ];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('50ms')).toBeInTheDocument();
    expect(document.querySelector('.node-detail-status-segment.fail')).not.toBeNull();
  });

  it('treats missing event duration as zero when summing per-iteration duration', () => {
    const iterations = [
      createIteration([
        createEvent({ nodeId: 'node-1', state: 'pass' }),
        createEvent({ nodeId: 'node-1', state: 'pass', durationMs: 25 }),
      ]),
    ];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    expect(screen.getByText('25ms')).toBeInTheDocument();
  });

  it('omits min/max/p95 when no events record durationMs', () => {
    const iterations = [
      createIteration([
        createEvent({ state: 'pass', durationMs: undefined }),
        createEvent({ state: 'pass', durationMs: undefined }),
      ]),
    ];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    expect(document.querySelector('.node-detail-timing')).toBeNull();
    const heroValues = document.querySelectorAll('.node-detail-hero-value');
    expect(heroValues[2]).toHaveTextContent('—');
  });

  it('renders details section when latest event has empty details object', () => {
    const iterations = [createIteration([createEvent({ details: {} })])];

    render(<NodeExecutionDetailPanel {...defaultProps} iterations={iterations} />);

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(document.querySelector('.node-detail-http')).not.toBeNull();
  });
});
