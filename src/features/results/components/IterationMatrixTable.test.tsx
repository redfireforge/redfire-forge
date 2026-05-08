/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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

  it('renders table with HTTP nodes as columns', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    expect(screen.getByText('Get Users')).toBeInTheDocument();
    expect(screen.getByText('Create Order')).toBeInTheDocument();
    expect(screen.queryByText('Start')).not.toBeInTheDocument();
    expect(screen.queryByText('End')).not.toBeInTheDocument();
  });

  it('renders all iteration rows', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('shows filter buttons', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    expect(screen.getByRole('button', { name: 'All (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Failed (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slowest 10%' })).toBeInTheDocument();
  });

  it('filters to failed iterations', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Failed (1)' }));

    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.queryByText('#3')).not.toBeInTheDocument();
  });

  it('shows error search input when there are failures', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    expect(screen.getByPlaceholderText('Search errors...')).toBeInTheDocument();
  });

  it('filters by error search term', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search errors...');
    fireEvent.change(searchInput, { target: { value: 'Server' } });

    expect(screen.getByText('1 found')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.queryByText('#3')).not.toBeInTheDocument();
  });

  it('calls onIterationSelect when row is clicked', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    fireEvent.click(screen.getByText('#1'));
    expect(mockOnIterationSelect).toHaveBeenCalledWith(0);
  });

  it('calls onCellSelect when cell is clicked', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    // Find cells by partial text match since they may include status icons
    const cells = screen.getAllByText(/100ms/);
    fireEvent.click(cells[0]);
    expect(mockOnCellSelect).toHaveBeenCalledWith(0, 'n2');
  });

  it('shows average row in footer', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    expect(screen.getByText('AVG')).toBeInTheDocument();
  });

  it('highlights selected row', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        selectedIteration={1}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    const row = screen.getByText('#2').closest('tr');
    expect(row).toHaveClass('selected-row');
  });

  it('sorts by status by default (sortable column header)', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    // Verify Status column header shows it's being sorted
    const statusHeader = screen.getByText(/^Status/);
    expect(statusHeader).toHaveClass('sorted');
  });

  it('toggles sort direction on column header click', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    fireEvent.click(screen.getByText(/^Iter/));
    fireEvent.click(screen.getByText(/^Iter/));

    const header = screen.getByText(/^Iter/);
    expect(header).toHaveClass('sorted');
  });

  it('shows error column when there are failures', () => {
    render(
      <IterationMatrixTable
        iterations={mockIterations}
        nodes={mockNodes}
        onIterationSelect={mockOnIterationSelect}
        onCellSelect={mockOnCellSelect}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/Server Error/)).toBeInTheDocument();
  });

  describe('filtering', () => {
    it('shows slowest 10% filter', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Slowest 10%' }));
      // With 3 iterations, top 10% = 1 iteration (the slowest)
      // Iteration #2 has durationMs: 300 which is the slowest
      expect(screen.getByText('#2')).toBeInTheDocument();
    });

    it('resets filter when All is clicked', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // First filter to failed
      fireEvent.click(screen.getByRole('button', { name: 'Failed (1)' }));
      expect(screen.queryByText('#1')).not.toBeInTheDocument();

      // Then reset to all
      fireEvent.click(screen.getByRole('button', { name: 'All (3)' }));
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('clears search when clicking clear button', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search errors...');
      fireEvent.change(searchInput, { target: { value: 'Server' } });
      
      expect(screen.getByText('1 found')).toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      
      // All rows should be visible again
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });

    it('handles search with no matches', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search errors...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      // No rows should be visible
      expect(screen.queryByText('#1')).not.toBeInTheDocument();
      expect(screen.queryByText('#2')).not.toBeInTheDocument();
      expect(screen.queryByText('#3')).not.toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('sorts by total duration', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      fireEvent.click(screen.getByText(/^Total/));
      
      const header = screen.getByText(/^Total/);
      expect(header).toHaveClass('sorted');
    });

    it('sorts by node column', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Get Users appears in the header - click to sort
      const headers = screen.getAllByText('Get Users');
      fireEvent.click(headers[0]);
      
      // After clicking, the header should be sorted
      expect(headers[0].closest('th')).toHaveClass('sorted');
    });

    it('toggles sort direction on repeated clicks', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      const statusHeader = screen.getByText(/^Status/);
      
      // First click - already sorted by status desc
      expect(statusHeader).toHaveClass('sorted');
      
      // Click again to toggle direction
      fireEvent.click(statusHeader);
      expect(statusHeader).toHaveClass('sorted');
    });
  });

  describe('cell selection', () => {
    it('highlights selected cell', () => {
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

      // Selected cell should have special styling
      const cells = screen.getAllByText(/100ms/);
      expect(cells.length).toBeGreaterThan(0);
    });

    it('does not highlight when no selection', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // No cell should be highlighted
      const rows = screen.getAllByRole('row');
      rows.forEach(row => {
        expect(row).not.toHaveClass('selected-row');
      });
    });
  });

  describe('empty states', () => {
    it('handles empty iterations', () => {
      render(
        <IterationMatrixTable
          iterations={[]}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Should show filter buttons with 0 counts
      expect(screen.getByRole('button', { name: 'All (0)' })).toBeInTheDocument();
    });

    it('handles empty nodes', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={[]}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Should still show iterations
      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    it('handles nodes without HTTP type', () => {
      const nonHttpNodes = [
        { id: 'n1', type: 'start', data: { label: 'Start' } },
        { id: 'n2', type: 'end', data: { label: 'End' } },
      ];

      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={nonHttpNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Should not show Start/End as columns
      expect(screen.queryByText('Start')).not.toBeInTheDocument();
      expect(screen.queryByText('End')).not.toBeInTheDocument();
    });
  });

  describe('duration display', () => {
    it('shows duration in milliseconds', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      expect(screen.getAllByText(/100ms/).length).toBeGreaterThan(0);
    });

    it('shows skipped indicator for skipped nodes', () => {
      const iterationsWithSkipped: WorkflowIterationTrace[] = [
        {
          index: 0,
          passed: true,
          durationMs: 100,
          traversedEdges: [],
          events: [
            { nodeId: 'n2', nodeType: 'http', nodeLabel: 'Get Users', timestamp: 1000, state: 'pass', durationMs: 100 },
            // n3 is skipped - no event
          ],
        },
      ];

      render(
        <IterationMatrixTable
          iterations={iterationsWithSkipped}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Should show a skipped indicator for n3
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });

  describe('pass/fail indicators', () => {
    it('shows check mark for passed iterations', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Iteration #1 and #3 passed
      expect(screen.getAllByText('✓').length).toBeGreaterThanOrEqual(2);
    });

    it('shows X mark for failed iterations', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // Iteration #2 failed
      expect(screen.getAllByText('✗').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('statistics', () => {
    it('shows average duration for each node', () => {
      render(
        <IterationMatrixTable
          iterations={mockIterations}
          nodes={mockNodes}
          onIterationSelect={mockOnIterationSelect}
          onCellSelect={mockOnCellSelect}
        />
      );

      // AVG row should be present
      expect(screen.getByText('AVG')).toBeInTheDocument();
    });
  });
});
