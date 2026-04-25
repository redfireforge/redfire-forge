/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import type { WorkflowVariableHintSource } from '../../utils/workflowVariableHints';

const wfSource: WorkflowVariableHintSource = { nodeLabel: 'Workflow Defaults', nodeType: 'workflow', category: 'Workflow' };
const stepASource: WorkflowVariableHintSource = { nodeId: 'a1', nodeLabel: 'Step A', nodeType: 'http', category: 'HTTP Steps' };
const stepBSource: WorkflowVariableHintSource = { nodeId: 'b1', nodeLabel: 'Step B', nodeType: 'http', category: 'HTTP Steps' };

const workflowHints: WorkflowVariableHint[] = [
  { ref: 'baseUrl', label: 'baseUrl (workflow)', type: 'string', description: 'Base URL for all requests', source: wfSource },
  { ref: 'apiKey', label: 'apiKey (workflow)', type: 'string', description: 'API key', source: wfSource },
];

const stepHints: WorkflowVariableHint[] = [
  { ref: 'node:"Step A".token', label: 'token (Step A)', type: 'string', description: 'Auth token', source: stepASource },
  { ref: 'node:"Step A".status', label: 'status (Step A)', type: 'number', description: 'HTTP status', source: stepASource },
  { ref: 'node:"Step B".userId', label: 'userId (Step B)', type: 'string', description: 'User ID', source: stepBSource },
];

const allHints = [...workflowHints, ...stepHints];

describe('WorkflowVariableInsertModal', () => {
  const defaultProps = {
    open: true,
    hints: allHints,
    onClose: vi.fn(),
    onPick: vi.fn(),
  };

  it('renders nothing when open is false', () => {
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the modal with title when open', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(screen.getByText('Insert variable')).toBeTruthy();
  });

  it('renders empty state when hints is empty', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} hints={[]} />);
    expect(screen.getByText('No variables available yet.')).toBeTruthy();
  });

  it('groups hints by source — workflow defaults and steps', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const sourceItems = container.querySelectorAll('.wf-var-insert-source-item');
    expect(sourceItems.length).toBe(3); // Step A, Step B, Workflow Defaults
    // Sorted by category: HTTP Steps first, then Workflow
    expect(sourceItems[0].textContent).toContain('Step A');
    expect(sourceItems[1].textContent).toContain('Step B');
    expect(sourceItems[2].textContent).toContain('Workflow Defaults');
  });

  it('shows category headers in source list', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const catHeaders = container.querySelectorAll('.wf-var-insert-category-header');
    expect(catHeaders.length).toBe(2); // HTTP Steps, Workflow
    expect(catHeaders[0].textContent).toBe('HTTP Steps');
    expect(catHeaders[1].textContent).toBe('Workflow');
  });

  it('shows source counts', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const counts = container.querySelectorAll('.wf-var-insert-source-count');
    expect(counts[0].textContent).toBe('2'); // Step A
    expect(counts[1].textContent).toBe('1'); // Step B
    expect(counts[2].textContent).toBe('2'); // workflow hints
  });

  it('shows variables for the first group by default', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(2); // Step A hints
    expect(varRows[0].textContent).toContain('token');
    expect(varRows[1].textContent).toContain('status');
  });

  it('switches group on source click', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const sourceItems = container.querySelectorAll('.wf-var-insert-source-item');
    fireEvent.click(sourceItems[2]); // Workflow Defaults
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(2);
    expect(varRows[0].textContent).toContain('baseUrl');
    expect(varRows[1].textContent).toContain('apiKey');
  });

  it('calls onPick with full scoped ref by default', () => {
    const onPick = vi.fn();
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} />,
    );
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token (scoped)
    expect(onPick).toHaveBeenCalledWith('{{node:"Step A".token}}');
  });

  it('calls onPick with short ref when shortRef=true', () => {
    const onPick = vi.fn();
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} shortRef />,
    );
    // First group is Step A, first var is token
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token
    expect(onPick).toHaveBeenCalledWith('{{token}}');
  });

  it('filters variables by search', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search all variables…');
    fireEvent.change(searchInput, { target: { value: 'token' } });
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(1);
    expect(varRows[0].textContent).toContain('token');
  });

  it('shows "No variables match" when search has no results', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search all variables…');
    fireEvent.change(searchInput, { target: { value: 'nonexistent_xyz' } });
    expect(screen.getByText(/No variables match/)).toBeTruthy();
  });

  it('closes when overlay is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} onClose={onClose} />,
    );
    const overlay = container.querySelector('.wf-var-insert-modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} onClose={onClose} />,
    );
    const overlay = container.querySelector('.wf-var-insert-modal-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when modal body is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} onClose={onClose} />,
    );
    const modal = container.querySelector('.wf-var-insert-modal')!;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows context hint when initialSearch is provided', () => {
    render(
      <WorkflowVariableInsertModal {...defaultProps} initialSearch="myVar" />,
    );
    expect(screen.getByText(/Setting value for/)).toBeTruthy();
  });

  it('shows detail bar with hover placeholder by default', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(screen.getByText('Hover a variable to see details')).toBeTruthy();
  });

  it('shows variable details on hover', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.mouseEnter(varRows[0]); // token
    expect(screen.getByText('Auth token')).toBeTruthy();
    expect(container.querySelector('.wf-var-insert-detail-type')?.textContent).toBe('string');
  });

  it('reverts to placeholder on mouse leave', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.mouseEnter(varRows[0]);
    fireEvent.mouseLeave(varRows[0]);
    expect(screen.getByText('Hover a variable to see details')).toBeTruthy();
  });

  it('shows type badge on variable row when type is present', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const typeBadges = container.querySelectorAll('.wf-var-insert-var-type');
    expect(typeBadges.length).toBe(2); // Step A has 2 hints with type
    expect(typeBadges[0].textContent).toBe('string');
  });

  it('does not show type badge when type is absent', () => {
    const hintsNoType: WorkflowVariableHint[] = [{ ref: 'x', label: 'x (w)' }];
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} hints={hintsNoType} />,
    );
    expect(container.querySelector('.wf-var-insert-var-type')).toBeNull();
  });

  it('renders category filter toolbar when multiple categories present', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const catBtns = container.querySelectorAll('.wf-var-insert-cat-btn');
    expect(catBtns.length).toBe(3); // All, HTTP Steps, Workflow
    expect(catBtns[0].textContent).toBe('All');
    expect(catBtns[1].textContent).toBe('HTTP Steps');
    expect(catBtns[2].textContent).toBe('Workflow');
  });

  it('does not render category toolbar with single category', () => {
    const singleCatHints: WorkflowVariableHint[] = [
      { ref: 'a', label: 'a', source: wfSource },
      { ref: 'b', label: 'b', source: wfSource },
    ];
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} hints={singleCatHints} />,
    );
    expect(container.querySelector('.wf-var-insert-category-toolbar')).toBeNull();
  });

  it('filters sources when category button is clicked', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const catBtns = container.querySelectorAll('.wf-var-insert-cat-btn');
    fireEvent.click(catBtns[2]); // Workflow
    const sourceItems = container.querySelectorAll('.wf-var-insert-source-item');
    expect(sourceItems.length).toBe(1);
    expect(sourceItems[0].textContent).toContain('Workflow Defaults');
  });

  it('shows source info in detail bar on hover', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.mouseEnter(varRows[0]); // token from Step A
    expect(container.querySelector('.wf-var-insert-detail-source')?.textContent).toBe('Step A');
  });

  it('shows source pills on variable rows during search', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search all variables…');
    fireEvent.change(searchInput, { target: { value: 'token' } });
    const pills = container.querySelectorAll('.wf-var-insert-source-pill');
    expect(pills.length).toBe(1);
    expect(pills[0].textContent).toContain('Step A');
  });

  it('does not show source pills when not searching', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(container.querySelector('.wf-var-insert-source-pill')).toBeNull();
  });

  it('groups hints by source.nodeId for same-type nodes', () => {
    const src1: WorkflowVariableHintSource = { nodeId: 'n1', nodeLabel: 'Login', nodeType: 'http', category: 'HTTP Steps' };
    const src2: WorkflowVariableHintSource = { nodeId: 'n2', nodeLabel: 'Logout', nodeType: 'http', category: 'HTTP Steps' };
    const hints: WorkflowVariableHint[] = [
      { ref: 'a', label: 'a', source: src1 },
      { ref: 'b', label: 'b', source: src2 },
    ];
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} hints={hints} />,
    );
    const sourceItems = container.querySelectorAll('.wf-var-insert-source-item');
    expect(sourceItems.length).toBe(2);
    expect(sourceItems[0].textContent).toContain('Login');
    expect(sourceItems[1].textContent).toContain('Logout');
  });

  it('uses correct node-type icons from NODE_TYPE_DISPLAY', () => {
    const startSource: WorkflowVariableHintSource = { nodeId: 's1', nodeLabel: 'Start', nodeType: 'start', category: 'Triggers' };
    const hints: WorkflowVariableHint[] = [
      { ref: 'x', label: 'x', source: startSource },
      { ref: 'y', label: 'y', source: wfSource },
    ];
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} hints={hints} />,
    );
    const icons = container.querySelectorAll('.wf-var-insert-source-icon');
    expect(icons[0].textContent).toBe('▶'); // start
    expect(icons[1].textContent).toBe('⚡'); // workflow
  });

  // ── Compose mode tests ──

  it('shows compose toggle checkbox', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(screen.getByLabelText('Compose mode')).toBeTruthy();
  });

  it('does not show compose strip in quick insert mode', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(container.querySelector('.wf-compose-strip')).toBeNull();
  });

  it('shows compose strip when compose mode is enabled', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    expect(container.querySelector('.wf-compose-strip')).toBeTruthy();
  });

  it('shows checkboxes on variable rows in compose mode', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const checkboxes = container.querySelectorAll('.wf-compose-checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('clicking a variable in compose mode adds it to compose strip', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token from Step A
    // Compose strip should now show 1 token
    expect(screen.getByText('1 token')).toBeTruthy();
  });

  it('clicking a checked variable in compose mode removes it', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // add
    expect(screen.getByText('1 token')).toBeTruthy();
    // Re-query since DOM may have updated
    const updatedRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(updatedRows[0]); // remove
    expect(screen.getByText('0 tokens')).toBeTruthy();
  });

  it('does not call onPick when clicking variable in compose mode', () => {
    const onPick = vi.fn();
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} />,
    );
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Insert All calls onPick with composed template', () => {
    const onPick = vi.fn();
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} />,
    );
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token
    fireEvent.click(varRows[1]); // status
    fireEvent.click(screen.getByText('Insert All (2)'));
    expect(onPick).toHaveBeenCalledTimes(1);
    // Both Step A vars: token and status
    const template = onPick.mock.calls[0][0];
    expect(template).toContain('{{');
    expect(template).toContain('}}');
  });

  it('compose strip resets when modal closes and reopens', () => {
    const { container, rerender } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]);
    // Close and reopen
    rerender(<WorkflowVariableInsertModal {...defaultProps} open={false} />);
    rerender(<WorkflowVariableInsertModal {...defaultProps} open={true} />);
    expect(container.querySelector('.wf-compose-strip')).toBeNull(); // compose mode off
  });

  it('deduplicates variables with same name in a group, preferring scoped refs', () => {
    const dedupHints: WorkflowVariableHint[] = [
      { ref: 'token', label: 'token (latest)', type: 'string', description: 'Latest', source: stepASource },
      { ref: 'node:"Step A".token', label: 'token ← "Step A" (scoped)', type: 'string', description: 'Scoped', source: stepASource },
    ];
    const { container } = render(
      <WorkflowVariableInsertModal {...defaultProps} hints={dedupHints} />,
    );
    // Should show only one row for "token", not two (dedup happens at group level)
    const varRows = container.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(1);
    expect(varRows[0].textContent).toContain('token');
    // Source count should also reflect deduplicated count
    const counts = container.querySelectorAll('.wf-var-insert-source-count');
    expect(counts[0].textContent).toBe('1');
  });

  // ── Expand / Shrink tests ──

  it('renders expand button in header', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const expandBtn = container.querySelector('.modal-expand-btn');
    expect(expandBtn).toBeTruthy();
    expect(expandBtn!.getAttribute('aria-label')).toBe('Expand modal');
  });

  it('toggles expanded class on modal when expand button is clicked', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const modal = container.querySelector('.wf-var-insert-modal')!;
    expect(modal.classList.contains('modal-expanded')).toBe(false);
    const expandBtn = container.querySelector('.modal-expand-btn')!;
    fireEvent.click(expandBtn);
    expect(modal.classList.contains('modal-expanded')).toBe(true);
    // aria-label should change to Shrink
    expect(expandBtn.getAttribute('aria-label')).toBe('Shrink modal');
  });

  it('shrinks back when expand button is clicked twice', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const modal = container.querySelector('.wf-var-insert-modal')!;
    const expandBtn = container.querySelector('.modal-expand-btn')!;
    fireEvent.click(expandBtn); // expand
    fireEvent.click(expandBtn); // shrink
    expect(modal.classList.contains('modal-expanded')).toBe(false);
    expect(expandBtn.getAttribute('aria-label')).toBe('Expand modal');
  });

  it('renders expand button in detail bar (bottom-right)', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const bottomBtn = container.querySelector('.modal-expand-btn-bottom');
    expect(bottomBtn).toBeTruthy();
    expect(bottomBtn!.getAttribute('aria-label')).toBe('Expand modal');
  });

  it('bottom expand button also toggles expanded state', () => {
    const { container } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    const modal = container.querySelector('.wf-var-insert-modal')!;
    const bottomBtn = container.querySelector('.modal-expand-btn-bottom')!;
    fireEvent.click(bottomBtn);
    expect(modal.classList.contains('modal-expanded')).toBe(true);
    expect(bottomBtn.getAttribute('aria-label')).toBe('Shrink modal');
  });

  it('resets expanded state when modal closes and reopens', () => {
    const { container, rerender } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(container.querySelector('.modal-expand-btn')!);
    rerender(<WorkflowVariableInsertModal {...defaultProps} open={false} />);
    rerender(<WorkflowVariableInsertModal {...defaultProps} open={true} />);
    const modal = container.querySelector('.wf-var-insert-modal')!;
    expect(modal.classList.contains('modal-expanded')).toBe(false);
  });
});
