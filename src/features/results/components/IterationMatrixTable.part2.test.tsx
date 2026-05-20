/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup} from '@testing-library/react';
import '@testing-library/jest-dom';
import IterationMatrixTable from './IterationMatrixTable';
import type { WorkflowIterationTrace } from '../../../shared/types';

const mockNodes = [
  { id: 'n1', type: 'start', data: { label: 'Start' } },
  { id: 'n2', type: 'http', data: { label: 'Get Users' } },
  { id: 'n3', type: 'http', data: { label: 'Create Order' } },
  { id: 'n4', type: 'end', data: { label: 'End' } },
];

const mockIterations: WorkflowIterationTrace[] = [
  {
    index: 0,
    passed: true,
    durationMs: 250,
    traversedEdges: [],
    events: [
      { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 1000, state: 'pass', durationMs: 100 },
      { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Create Order', timestamp: 1100, state: 'pass', durationMs: 80 },
    ],
  },
  {
    index: 1,
    passed: false,
    durationMs: 300,
    traversedEdges: [],
    events: [
      { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 2000, state: 'pass', durationMs: 120 },
      { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Create Order', timestamp: 2120, state: 'fail', durationMs: 50, details: { error: 'Server Error' } },
    ],
  },
  {
    index: 2,
    passed: true,
    durationMs: 200,
    traversedEdges: [],
    events: [
      { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 3000, state: 'pass', durationMs: 90 },
      { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Create Order', timestamp: 3090, state: 'pass', durationMs: 60 },
    ],
  },
];

describe('IterationMatrixTable', () => {
  const mockOnIterationSelect = vi.fn();
  const mockOnCellSelect = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('marks selected node column header when selectedNodeId matches', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        selectedNodeId="n2"
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const headers = screen.getAllByText('Get Users');
    const th = headers[0].closest('th');
    expect(th).toHaveClass('selected');
  });

  it('applies selected-cell when iteration and node match selection', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        selectedIteration={0}
        selectedNodeId="n2"
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const row = screen.getByText('#1').closest('tr');
    expect(row).not.toBeNull();
    const cell = row!.querySelector('.selected-cell');
    expect(cell).not.toBeNull();
    expect(cell).toHaveClass('cell-pass');
  });

  it('marks unsampled iterations with row class, title, and indicator', () => {
    const sampled: WorkflowIterationTrace = {
      ...mockIterations[0],
      sampled: false,
    };

    render(
      <IterationMatrixTable
        iterations={[sampled]}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const row = screen.getByText(/#1/).closest('tr');
    expect(row).toHaveClass('not-sampled-row');
    expect(row).toHaveAttribute('title', 'Trace not captured (sampled run)');
    expect(screen.getByText(/#1 ○/)).toBeInTheDocument();
  });

  it('shows overhead hint when non-HTTP overhead exceeds 50ms', () => {
    const iterations: WorkflowIterationTrace[] = [
      {
        index: 0,
        passed: true,
        durationMs: 200,
        traversedEdges: [],
        events: [
          { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 1, state: 'pass', durationMs: 50 },
          { nodeId: 'n3', nodeType: 'http', nodeLabel: 'Create Order', timestamp: 2, state: 'pass', durationMs: 40 },
        ],
      },
    ];

    render(
      <IterationMatrixTable
        iterations={iterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const totalCell = document.querySelector('.total-col');
    expect(totalCell).not.toBeNull();
    expect(totalCell).toHaveAttribute('title', expect.stringContaining('Other nodes'));
    expect(document.querySelector('.overhead-hint')).not.toBeNull();
  });

  it('shows em dash in error column when iteration failed without error detail', () => {
    const iterations: WorkflowIterationTrace[] = [
      {
        index: 0,
        passed: false,
        durationMs: 50,
        traversedEdges: [],
        events: [
          { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 1, state: 'fail', durationMs: 50 },
        ],
      },
    ];

    render(
      <IterationMatrixTable
        iterations={iterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const errCell = document.querySelector('.error-col');
    expect(errCell).toHaveTextContent('—');
  });

  it('shows descending arrow on node column after second header click', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const headers = screen.getAllByText('Get Users');
    fireEvent.click(headers[0]);
    fireEvent.click(headers[0]);

    expect(headers[0].textContent).toContain('↓');
  });
});
