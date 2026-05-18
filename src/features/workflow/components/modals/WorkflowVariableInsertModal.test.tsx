/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import type { WorkflowVariableHintSource } from '../../utils/workflowVariableHints';

vi.mock('../expression/ExpressionBuilderView', () => ({
  __esModule: true,
  default: ({ onInsert }: { onInsert: (t: string) => void }) => (
    <div data-testid="mock-expression-builder">
      <button type="button" onClick={() => onInsert('{{$upper(x)}}')}>InsertExpr</button>
    </div>
  ),
}));

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
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const sourceItems = document.body.querySelectorAll('.wf-var-insert-source-item');
    expect(sourceItems.length).toBe(3); // Step A, Step B, Workflow Defaults
    // Sorted by category: HTTP Steps first, then Workflow
    expect(sourceItems[0].textContent).toContain('Step A');
    expect(sourceItems[1].textContent).toContain('Step B');
    expect(sourceItems[2].textContent).toContain('Workflow Defaults');
  });

  it('shows category headers in source list', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const catHeaders = document.body.querySelectorAll('.wf-var-insert-category-header');
    expect(catHeaders.length).toBe(2); // HTTP Steps, Workflow
    expect(catHeaders[0].textContent).toBe('HTTP Steps');
    expect(catHeaders[1].textContent).toBe('Workflow');
  });

  it('shows source counts', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const counts = document.body.querySelectorAll('.wf-var-insert-source-count');
    expect(counts[0].textContent).toBe('2'); // Step A
    expect(counts[1].textContent).toBe('1'); // Step B
    expect(counts[2].textContent).toBe('2'); // workflow hints
  });

  it('shows variables for the first group by default', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(2); // Step A hints
    expect(varRows[0].textContent).toContain('token');
    expect(varRows[1].textContent).toContain('status');
  });

  it('switches group on source click', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const sourceItems = document.body.querySelectorAll('.wf-var-insert-source-item');
    fireEvent.click(sourceItems[2]); // Workflow Defaults
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(2);
    expect(varRows[0].textContent).toContain('baseUrl');
    expect(varRows[1].textContent).toContain('apiKey');
  });

  it('calls onPick with full scoped ref by default', () => {
    const onPick = vi.fn();
    render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} />,
    );
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token (scoped)
    expect(onPick).toHaveBeenCalledWith('{{node:"Step A".token}}');
  });

  it('calls onPick with short ref when shortRef=true', () => {
    const onPick = vi.fn();
    render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} shortRef />,
    );
    // First group is Step A, first var is token
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token
    expect(onPick).toHaveBeenCalledWith('{{token}}');
  });

  it('filters variables by search', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search all variables…');
    fireEvent.change(searchInput, { target: { value: 'token' } });
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(1);
    expect(varRows[0].textContent).toContain('token');
  });

  it('shows "No variables match" when search has no results', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search all variables…');
    fireEvent.change(searchInput, { target: { value: 'nonexistent_xyz' } });
    expect(screen.getByText(/No variables match/)).toBeTruthy();
  });

  it('does not close when overlay is clicked (consistent with other workflow modals)', () => {
    const onClose = vi.fn();
    render(
      <WorkflowVariableInsertModal {...defaultProps} onClose={onClose} />,
    );
    const overlay = document.body.querySelector('.wf-var-insert-modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <WorkflowVariableInsertModal {...defaultProps} onClose={onClose} />,
    );
    const overlay = document.body.querySelector('.wf-var-insert-modal-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when modal body is clicked', () => {
    const onClose = vi.fn();
    render(
      <WorkflowVariableInsertModal {...defaultProps} onClose={onClose} />,
    );
    const modal = document.body.querySelector('.wf-var-insert-modal')!;
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
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.mouseEnter(varRows[0]); // token
    expect(screen.getByText('Auth token')).toBeTruthy();
    expect(document.body.querySelector('.wf-var-insert-detail-type')?.textContent).toBe('string');
  });

  it('reverts to placeholder on mouse leave', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.mouseEnter(varRows[0]);
    fireEvent.mouseLeave(varRows[0]);
    expect(screen.getByText('Hover a variable to see details')).toBeTruthy();
  });

  it('shows type badge on variable row when type is present', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const typeBadges = document.body.querySelectorAll('.wf-var-insert-var-type');
    expect(typeBadges.length).toBe(2); // Step A has 2 hints with type
    expect(typeBadges[0].textContent).toBe('string');
  });

  it('does not show type badge when type is absent', () => {
    const hintsNoType: WorkflowVariableHint[] = [{ ref: 'x', label: 'x (w)' }];
    render(
      <WorkflowVariableInsertModal {...defaultProps} hints={hintsNoType} />,
    );
    expect(document.body.querySelector('.wf-var-insert-var-type')).toBeNull();
  });

  it('renders category filter toolbar when multiple categories present', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const catBtns = document.body.querySelectorAll('.wf-var-insert-cat-btn');
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
    render(
      <WorkflowVariableInsertModal {...defaultProps} hints={singleCatHints} />,
    );
    expect(document.body.querySelector('.wf-var-insert-category-toolbar')).toBeNull();
  });

  it('filters sources when category button is clicked', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const catBtns = document.body.querySelectorAll('.wf-var-insert-cat-btn');
    fireEvent.click(catBtns[2]); // Workflow
    const sourceItems = document.body.querySelectorAll('.wf-var-insert-source-item');
    expect(sourceItems.length).toBe(1);
    expect(sourceItems[0].textContent).toContain('Workflow Defaults');
  });

  it('shows source info in detail bar on hover', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.mouseEnter(varRows[0]); // token from Step A
    expect(document.body.querySelector('.wf-var-insert-detail-source')?.textContent).toBe('Step A');
  });

  it('shows source pills on variable rows during search', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search all variables…');
    fireEvent.change(searchInput, { target: { value: 'token' } });
    const pills = document.body.querySelectorAll('.wf-var-insert-source-pill');
    expect(pills.length).toBe(1);
    expect(pills[0].textContent).toContain('Step A');
  });

  it('does not show source pills when not searching', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(document.body.querySelector('.wf-var-insert-source-pill')).toBeNull();
  });

  it('groups hints by source.nodeId for same-type nodes', () => {
    const src1: WorkflowVariableHintSource = { nodeId: 'n1', nodeLabel: 'Login', nodeType: 'http', category: 'HTTP Steps' };
    const src2: WorkflowVariableHintSource = { nodeId: 'n2', nodeLabel: 'Logout', nodeType: 'http', category: 'HTTP Steps' };
    const hints: WorkflowVariableHint[] = [
      { ref: 'a', label: 'a', source: src1 },
      { ref: 'b', label: 'b', source: src2 },
    ];
    render(
      <WorkflowVariableInsertModal {...defaultProps} hints={hints} />,
    );
    const sourceItems = document.body.querySelectorAll('.wf-var-insert-source-item');
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
    render(
      <WorkflowVariableInsertModal {...defaultProps} hints={hints} />,
    );
    const icons = document.body.querySelectorAll('.wf-var-insert-source-icon');
    expect(icons[0].textContent).toBe('▶'); // start
    expect(icons[1].textContent).toBe('⚡'); // workflow
  });

  // ── Compose mode tests ──

  it('shows compose toggle checkbox', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(screen.getByLabelText('Compose mode')).toBeTruthy();
  });

  it('does not show compose strip in quick insert mode', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(document.body.querySelector('.wf-compose-strip')).toBeNull();
  });

  it('shows compose strip when compose mode is enabled', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    expect(document.body.querySelector('.wf-compose-strip')).toBeTruthy();
  });

  it('shows checkboxes on variable rows in compose mode', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const checkboxes = document.body.querySelectorAll('.wf-compose-checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('clicking a variable in compose mode adds it to compose strip', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token from Step A
    // Compose strip should now show 1 token
    expect(screen.getByText('1 token')).toBeTruthy();
  });

  it('clicking a checked variable in compose mode removes it', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // add
    expect(screen.getByText('1 token')).toBeTruthy();
    // Re-query since DOM may have updated
    const updatedRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(updatedRows[0]); // remove
    expect(screen.getByText('0 tokens')).toBeTruthy();
  });

  it('does not call onPick when clicking variable in compose mode', () => {
    const onPick = vi.fn();
    render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} />,
    );
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('Insert All calls onPick with composed template', () => {
    const onPick = vi.fn();
    render(
      <WorkflowVariableInsertModal {...defaultProps} onPick={onPick} />,
    );
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]); // token
    fireEvent.click(varRows[1]); // status
    fireEvent.click(document.body.querySelector('.wf-var-insert-action-insert')!);
    expect(onPick).toHaveBeenCalledTimes(1);
    // Both Step A vars: token and status
    const template = onPick.mock.calls[0][0];
    expect(template).toContain('{{');
    expect(template).toContain('}}');
  });

  it('compose strip resets when modal closes and reopens', () => {
    const { rerender } = render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.click(varRows[0]);
    // Close and reopen
    rerender(<WorkflowVariableInsertModal {...defaultProps} open={false} />);
    rerender(<WorkflowVariableInsertModal {...defaultProps} open={true} />);
    expect(document.body.querySelector('.wf-compose-strip')).toBeNull(); // compose mode off
  });

  it('deduplicates variables with same name in a group, preferring scoped refs', () => {
    const dedupHints: WorkflowVariableHint[] = [
      { ref: 'token', label: 'token (latest)', type: 'string', description: 'Latest', source: stepASource },
      { ref: 'node:"Step A".token', label: 'token ← "Step A" (scoped)', type: 'string', description: 'Scoped', source: stepASource },
    ];
    render(
      <WorkflowVariableInsertModal {...defaultProps} hints={dedupHints} />,
    );
    // Should show only one row for "token", not two (dedup happens at group level)
    const varRows = document.body.querySelectorAll('.wf-var-insert-var-row');
    expect(varRows.length).toBe(1);
    expect(varRows[0].textContent).toContain('token');
    // Source count should also reflect deduplicated count
    const counts = document.body.querySelectorAll('.wf-var-insert-source-count');
    expect(counts[0].textContent).toBe('1');
  });

  // ── Footer Close button ──

  it('renders Close button in the footer', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const closeBtn = document.body.querySelector('.wf-var-insert-close-btn');
    expect(closeBtn).toBeTruthy();
    expect(closeBtn!.textContent).toBe('Close');
  });

  it('footer Close button calls onClose', () => {
    const onClose = vi.fn();
    render(<WorkflowVariableInsertModal {...defaultProps} onClose={onClose} />);
    const closeBtn = document.body.querySelector('.wf-var-insert-close-btn')!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render expand buttons', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    expect(document.body.querySelector('.modal-expand-btn')).toBeNull();
    expect(document.body.querySelector('.modal-expand-btn-bottom')).toBeNull();
  });

  it('expression tab calls onPick when compose mode is off', () => {
    const onPick = vi.fn();
    render(<WorkflowVariableInsertModal {...defaultProps} onPick={onPick} />);
    fireEvent.click(screen.getByText('Expression'));
    fireEvent.click(screen.getByText('InsertExpr'));
    expect(onPick).toHaveBeenCalledWith('{{$upper(x)}}');
  });

  it('expression tab adds compose token when compose mode is on', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Compose mode'));
    fireEvent.click(screen.getByText('Expression'));
    fireEvent.click(screen.getByText('InsertExpr'));
    expect(document.querySelector('.wf-compose-token-expression')).toBeTruthy();
    expect(document.querySelector('.wf-compose-strip-preview-value')?.textContent).toContain('$upper(x)');
  });

  it('parses node refs without quotes in varName', () => {
    const src: WorkflowVariableHintSource = { nodeId: 'step1', nodeLabel: 'Step X', nodeType: 'http', category: 'HTTP Steps' };
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:step1.foo', label: 'foo', source: src },
    ];
    render(<WorkflowVariableInsertModal {...defaultProps} hints={hints} />);
    const rows = document.body.querySelectorAll('.wf-var-insert-var-row');
    expect(rows[0].textContent).toContain('foo');
  });

  it('keeps hover details when leaving a row that is not the active hover target', () => {
    render(<WorkflowVariableInsertModal {...defaultProps} />);
    const rows = document.body.querySelectorAll('.wf-var-insert-var-row');
    fireEvent.mouseEnter(rows[0]);
    fireEvent.mouseEnter(rows[1]);
    fireEvent.mouseLeave(rows[0]);
    expect(screen.getByText('HTTP status')).toBeTruthy();
  });

  it('replaces unscoped hint with scoped when both share a name', () => {
    const dedupHints: WorkflowVariableHint[] = [
      { ref: 'token', label: 'latest', source: stepASource },
      { ref: 'node:"Step A".token', label: 'scoped', source: stepASource },
    ];
    render(<WorkflowVariableInsertModal {...defaultProps} hints={dedupHints} />);
    const rows = document.body.querySelectorAll('.wf-var-insert-var-row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('node:"Step A".token');
  });
});
