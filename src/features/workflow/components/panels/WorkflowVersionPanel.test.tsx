/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowVersionPanel from './WorkflowVersionPanel';
import type { WorkflowVersion } from '../../types/workflow';

const makeVersion = (overrides: Partial<WorkflowVersion> = {}): WorkflowVersion => ({
  id: 'v1',
  timestamp: Date.now() - 60_000,
  fingerprint: 'fp1',
  nodeCount: 3,
  edgeCount: 2,
  nodes: [] as any,
  edges: [] as any,
  variables: {},
  ...overrides,
});

const defaultProps = () => ({
  versions: [
    makeVersion({ id: 'v1', timestamp: Date.now() - 60_000, label: 'First Save' }),
    makeVersion({ id: 'v2', timestamp: Date.now() - 120_000 }),
  ],
  onRestore: vi.fn(),
  onDelete: vi.fn(),
  onRename: vi.fn(),
  onCompare: vi.fn(),
  onClose: vi.fn(),
});

describe('WorkflowVersionPanel', () => {
  it('renders version list', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    expect(screen.getByText('First Save')).toBeTruthy();
    expect(screen.getByText('2 versions')).toBeTruthy();
  });

  it('shows empty state when no versions', () => {
    render(<WorkflowVersionPanel {...defaultProps()} versions={[]} />);
    expect(screen.getByText('No versions yet')).toBeTruthy();
    expect(screen.getByText('0 versions')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    fireEvent.click(screen.getByTitle('Close'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onRestore when restore button clicked', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    const restoreBtns = screen.getAllByTitle('Restore this version');
    fireEvent.click(restoreBtns[0]);
    expect(props.onRestore).toHaveBeenCalledWith(props.versions[0]);
  });

  it('calls onDelete when delete button clicked', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    const deleteBtns = screen.getAllByTitle('Delete this version');
    fireEvent.click(deleteBtns[0]);
    expect(props.onDelete).toHaveBeenCalledWith('v1');
  });

  it('enables Compare button when 2 versions selected', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    const compareBtn = screen.getByText('Compare');
    expect((compareBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('Compare button disabled by default', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const compareBtn = screen.getByText('Compare');
    expect((compareBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onCompare with older/newer order', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Compare'));
    expect(props.onCompare).toHaveBeenCalled();
    // Older (v2, earlier timestamp) should be first arg
    const [older, newer] = props.onCompare.mock.calls[0];
    expect(older.timestamp).toBeLessThanOrEqual(newer.timestamp);
  });

  it('shows node/edge counts in version items', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const metas = screen.getAllByText('3 nodes · 2 edges');
    expect(metas.length).toBeGreaterThan(0);
  });

  it('starts rename on Rename button click', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    const renameBtns = screen.getAllByTitle('Rename this version');
    fireEvent.click(renameBtns[0]);
    const input = screen.getByPlaceholderText('Version label…');
    expect(input).toBeTruthy();
  });

  it('finishes rename on Enter key', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    fireEvent.click(screen.getAllByTitle('Rename this version')[0]);
    const input = screen.getByPlaceholderText('Version label…');
    fireEvent.change(input, { target: { value: 'New Label' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('v1', 'New Label');
  });

  it('cancels rename on Escape key', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    fireEvent.click(screen.getAllByTitle('Rename this version')[0]);
    const input = screen.getByPlaceholderText('Version label…');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Version label…')).toBeNull();
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('shows clear selection button when versions selected', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    expect(screen.queryByText('Clear selection')).toBeNull();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText('Clear selection')).toBeTruthy();
  });

  it('clears selection on clear button click', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByText('Clear selection'));
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
  });

  it('singular version text for 1 version', () => {
    render(<WorkflowVersionPanel {...defaultProps()} versions={[makeVersion()]} />);
    expect(screen.getByText('1 version')).toBeTruthy();
  });

  it('toggles selection via row click', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const items = document.querySelectorAll('.wf-version-item');
    fireEvent.click(items[0]);
    expect(items[0].classList.contains('selected')).toBe(true);
    fireEvent.click(items[0]);
    expect(items[0].classList.contains('selected')).toBe(false);
  });

  it('starts rename on double-click of label', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const label = screen.getByText('First Save');
    fireEvent.doubleClick(label);
    expect(screen.getByPlaceholderText('Version label…')).toBeTruthy();
  });

  it('finishes rename on blur', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    fireEvent.click(screen.getAllByTitle('Rename this version')[0]);
    const input = screen.getByPlaceholderText('Version label…');
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.blur(input);
    expect(props.onRename).toHaveBeenCalledWith('v1', 'Blurred');
  });

  it('uses formatted timestamp when version has no label', () => {
    const ts = new Date(2026, 3, 15, 14, 30).getTime();
    const v = makeVersion({ id: 'nolabel', label: undefined, timestamp: ts });
    render(<WorkflowVersionPanel {...defaultProps()} versions={[v]} />);
    // Should show a date string, not "undefined"
    const label = document.querySelector('.wf-version-item-label')!;
    expect(label.textContent).not.toContain('undefined');
    expect(label.textContent!.length).toBeGreaterThan(0);
  });

  it('shows "just now" for very recent versions', () => {
    const v = makeVersion({ id: 'recent', timestamp: Date.now() - 5_000, label: 'Recent' });
    render(<WorkflowVersionPanel {...defaultProps()} versions={[v]} />);
    expect(screen.getByText('just now')).toBeTruthy();
  });

  it('shows minutes ago for versions within the hour', () => {
    const v = makeVersion({ id: 'min-ago', timestamp: Date.now() - 5 * 60_000, label: 'Minutes' });
    render(<WorkflowVersionPanel {...defaultProps()} versions={[v]} />);
    expect(screen.getByText('5m ago')).toBeTruthy();
  });

  it('shows hours ago for versions within the day', () => {
    const v = makeVersion({ id: 'hr-ago', timestamp: Date.now() - 3 * 3600_000, label: 'Hours' });
    render(<WorkflowVersionPanel {...defaultProps()} versions={[v]} />);
    expect(screen.getByText('3h ago')).toBeTruthy();
  });

  it('shows days ago for versions within a week', () => {
    const v = makeVersion({ id: 'day-ago', timestamp: Date.now() - 2 * 86400_000, label: 'Days' });
    render(<WorkflowVersionPanel {...defaultProps()} versions={[v]} />);
    expect(screen.getByText('2d ago')).toBeTruthy();
  });

  it('shows formatted date for versions older than a week', () => {
    const v = makeVersion({ id: 'old', timestamp: Date.now() - 10 * 86400_000, label: 'Old' });
    render(<WorkflowVersionPanel {...defaultProps()} versions={[v]} />);
    // Should fall back to formatted timestamp, not "Xd ago"
    const timeEl = document.querySelector('.wf-version-item-time')!;
    expect(timeEl.textContent).not.toContain('d ago');
  });

  it('deselects third checkbox if two are already selected', () => {
    const props = defaultProps();
    props.versions.push(makeVersion({ id: 'v3', timestamp: Date.now() - 180_000, label: 'Third' }));
    render(<WorkflowVersionPanel {...props} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    // Third click should deselect one (max 2 selected)
    fireEvent.click(checkboxes[2]);
    const checked = (screen.getAllByRole('checkbox') as HTMLInputElement[]).filter(c => c.checked);
    expect(checked.length).toBeLessThanOrEqual(2);
  });
});
