/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowVersionPanel from './WorkflowVersionPanel';
import type { WorkflowVersion, WorkflowNode, WorkflowEdge } from '../../types/workflow';
import * as workflowVersioning from '../../utils/workflowVersioning';

const makeVersion = (overrides: Partial<WorkflowVersion> = {}): WorkflowVersion => ({
  id: 'v1',
  timestamp: Date.now() - 60_000,
  fingerprint: 'fp1',
  nodeCount: 3,
  edgeCount: 2,
  nodes: [] as WorkflowNode[],
  edges: [] as WorkflowEdge[],
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

const getCheckboxes = () => document.querySelectorAll('.wfv-checkbox') as NodeListOf<HTMLElement>;

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
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
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
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    const compareBtn = screen.getByText('Compare').closest('button')!;
    expect(compareBtn.disabled).toBe(false);
  });

  it('Compare button disabled by default', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const compareBtn = screen.getByText('Compare').closest('button')!;
    expect(compareBtn.disabled).toBe(true);
  });

  it('calls onCompare with older/newer order', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Compare'));
    expect(props.onCompare).toHaveBeenCalled();
    const [older, newer] = props.onCompare.mock.calls[0];
    expect(older.timestamp).toBeLessThanOrEqual(newer.timestamp);
  });

  it('calls onCompare with older first when user selects newer timestamp before older', () => {
    const tOld = Date.now() - 200_000;
    const tNew = Date.now() - 100_000;
    const older = makeVersion({ id: 'old', timestamp: tOld, label: 'Old' });
    const newer = makeVersion({ id: 'new', timestamp: tNew, label: 'New' });
    const props = { ...defaultProps(), versions: [newer, older] };
    render(<WorkflowVersionPanel {...props} />);
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Compare'));
    const [a, b] = props.onCompare.mock.calls[0];
    expect(a.id).toBe('old');
    expect(b.id).toBe('new');
    expect(a.timestamp).toBeLessThanOrEqual(b.timestamp);
  });

  it('shows node/edge counts in version items', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    expect(screen.getAllByText('3 nodes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 edges').length).toBeGreaterThan(0);
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
    expect(screen.queryByText('Clear')).toBeNull();
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  it('clears selection on clear button click', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0].classList.contains('wfv-checkbox-checked')).toBe(true);
    fireEvent.click(screen.getByText('Clear'));
    expect(checkboxes[0].classList.contains('wfv-checkbox-checked')).toBe(false);
  });

  it('singular version text for 1 version', () => {
    render(<WorkflowVersionPanel {...defaultProps()} versions={[makeVersion()]} />);
    expect(screen.getByText('1 version')).toBeTruthy();
  });

  it('starts rename with empty input when version label omitted', () => {
    const v = makeVersion({ id: 'nl', label: undefined, timestamp: Date.now() });
    render(<WorkflowVersionPanel {...defaultProps()} versions={[v, makeVersion({ id: 'v2', timestamp: Date.now() - 1 })]} />);
    fireEvent.click(screen.getAllByTitle('Rename this version')[0]);
    const input = screen.getByPlaceholderText('Version label…') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('renders no summary element when change summary is null', () => {
    const spy = vi.spyOn(workflowVersioning, 'generateChangeSummary').mockReturnValue(null as unknown as string);
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const summaries = document.querySelectorAll('.wfv-item-summary');
    expect(summaries.length).toBe(1);
    spy.mockRestore();
  });

  it('toggles selection via row click', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const items = document.querySelectorAll('.wfv-item');
    fireEvent.click(items[0]);
    expect(items[0].classList.contains('wfv-item-selected')).toBe(true);
    fireEvent.click(items[0]);
    expect(items[0].classList.contains('wfv-item-selected')).toBe(false);
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
    const label = document.querySelector('.wfv-item-label')!;
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
    const timeEl = document.querySelector('.wfv-item-time')!;
    expect(timeEl.textContent).not.toContain('d ago');
  });

  it('compare does nothing when Compare clicked while disabled', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    const btn = screen.getByText('Compare').closest('button')!;
    btn.disabled = false;
    fireEvent.click(btn);
    expect(props.onCompare).not.toHaveBeenCalled();
  });

  it('compare does nothing when a selected version id is stale', () => {
    const props = defaultProps();
    const { rerender } = render(<WorkflowVersionPanel {...props} />);
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    rerender(<WorkflowVersionPanel {...props} versions={[props.versions[0]]} />);
    fireEvent.click(screen.getByText('Compare'));
    expect(props.onCompare).not.toHaveBeenCalled();
  });

  it('compare button shows enabled title when two versions selected', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByTitle('Compare selected versions')).toBeTruthy();
  });

  it('compare button shows helper title when selection incomplete', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    expect(screen.getByTitle('Select 2 versions to compare')).toBeTruthy();
  });

  it('renders empty change summary when generator returns blank', () => {
    const spy = vi.spyOn(workflowVersioning, 'generateChangeSummary').mockReturnValue('');
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const summaries = document.querySelectorAll('.wfv-item-summary');
    expect(summaries.length).toBe(1);
    spy.mockRestore();
  });

  it('deselects third checkbox if two are already selected', () => {
    const props = defaultProps();
    props.versions.push(makeVersion({ id: 'v3', timestamp: Date.now() - 180_000, label: 'Third' }));
    render(<WorkflowVersionPanel {...props} />);
    const checkboxes = getCheckboxes();
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    const checked = Array.from(getCheckboxes()).filter(c => c.classList.contains('wfv-checkbox-checked'));
    expect(checked.length).toBeLessThanOrEqual(2);
  });

  it('rename input stops click propagation', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    fireEvent.click(screen.getAllByTitle('Rename this version')[0]);
    const input = screen.getByPlaceholderText('Version label…');
    fireEvent.click(input);
    expect(document.body.contains(input)).toBe(true);
  });

  it('renders change summary row for each version in a chain', () => {
    const t = Date.now();
    const versions = [
      makeVersion({ id: 'va', timestamp: t - 300_000 }),
      makeVersion({ id: 'vb', timestamp: t - 200_000 }),
      makeVersion({ id: 'vc', timestamp: t - 100_000 }),
    ];
    render(<WorkflowVersionPanel {...defaultProps()} versions={versions} />);
    expect(document.querySelectorAll('.wfv-item-summary').length).toBe(3);
  });

  it('rename commits trimmed label', () => {
    const props = defaultProps();
    render(<WorkflowVersionPanel {...props} />);
    fireEvent.click(screen.getAllByTitle('Rename this version')[0]);
    const input = screen.getByPlaceholderText('Version label…');
    fireEvent.change(input, { target: { value: '  spaced  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('v1', 'spaced');
  });

  it('checkbox toggles selection off on second click', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const cb = getCheckboxes()[0];
    fireEvent.click(cb);
    expect(cb.classList.contains('wfv-checkbox-checked')).toBe(true);
    fireEvent.click(cb);
    expect(cb.classList.contains('wfv-checkbox-checked')).toBe(false);
  });

  it('shows Latest badge for first version', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    expect(screen.getByText('Latest')).toBeTruthy();
  });

  it('shows selection bar when versions selected', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    expect(screen.queryByText('1 selected')).toBeNull();
    fireEvent.click(getCheckboxes()[0]);
    expect(screen.getByText('1 selected')).toBeTruthy();
    fireEvent.click(getCheckboxes()[1]);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('shows hint in footer when can compare', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    expect(screen.queryByText('Click Compare to view differences')).toBeNull();
    fireEvent.click(getCheckboxes()[0]);
    fireEvent.click(getCheckboxes()[1]);
    expect(screen.getByText('Click Compare to view differences')).toBeTruthy();
  });

  it('highlights item on hover', () => {
    render(<WorkflowVersionPanel {...defaultProps()} />);
    const items = document.querySelectorAll('.wfv-item');
    fireEvent.mouseEnter(items[0]);
    expect(items[0].classList.contains('wfv-item-hovered')).toBe(true);
    fireEvent.mouseLeave(items[0]);
    expect(items[0].classList.contains('wfv-item-hovered')).toBe(false);
  });
});
