/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkflowVersionDiff from './WorkflowVersionDiff';
import type { WorkflowVersion } from '../../types/workflow';

/* ── helpers ── */

function makeVersion(overrides: Partial<WorkflowVersion> = {}): WorkflowVersion {
  return {
    id: 'v1',
    timestamp: Date.now() - 60_000,
    nodeCount: 2,
    edgeCount: 1,
    fingerprint: 'fp1',
    nodes: [
      { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Fetch' } },
      { id: 'n2', type: 'script', position: { x: 200, y: 0 }, data: { label: 'Transform' } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    variables: { baseUrl: 'https://api.example.com', token: 'abc' },
    services: [{ id: 's1', name: 'API', endpoints: {}, defaultAuth: 'inherit' }],
    ...overrides,
  } as WorkflowVersion;
}

const olderVersion = makeVersion({ id: 'older', label: 'Baseline', timestamp: Date.now() - 120_000 });
const newerVersion = makeVersion({
  id: 'newer',
  label: 'Updated',
  timestamp: Date.now() - 30_000,
  fingerprint: 'fp2',
  nodeCount: 3,
  edgeCount: 2,
  nodes: [
    { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Fetch (v2)', url: '/v2' } },
    { id: 'n2', type: 'script', position: { x: 200, y: 0 }, data: { label: 'Transform' } },
    { id: 'n3', type: 'delay', position: { x: 400, y: 0 }, data: { label: 'Wait' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
  ],
  variables: { baseUrl: 'https://api.example.com/v2', newVar: 'hello' },
  services: [
    { id: 's1', name: 'API v2', endpoints: {}, defaultAuth: 'inherit' },
    { id: 's2', name: 'Webhook', endpoints: {}, defaultAuth: 'inherit' },
  ],
});

/* ── identical versions for "no changes" ── */
const identicalOlder = makeVersion({ id: 'id-old' });
const identicalNewer = makeVersion({ id: 'id-new' });

describe('WorkflowVersionDiff', () => {
  const onClose = vi.fn();

  beforeEach(() => { onClose.mockClear(); });

  it('returns null when not open', () => {
    const { container } = render(
      <WorkflowVersionDiff open={false} older={olderVersion} newer={newerVersion} onClose={onClose} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders header with version labels', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    expect(screen.getByText('Version Comparison')).toBeTruthy();
    expect(screen.getByText(/Baseline.*→.*Updated/)).toBeTruthy();
  });

  it('renders 4 tabs', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    expect(screen.getByText('Nodes')).toBeTruthy();
    expect(screen.getByText('Edges')).toBeTruthy();
    expect(screen.getByText('Variables')).toBeTruthy();
    expect(screen.getByText('Services')).toBeTruthy();
  });

  it('shows tab counts as badges', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    // Nodes: 1 added + 1 modified = 2
    const nodesTab = screen.getByText('Nodes').closest('button')!;
    expect(nodesTab.querySelector('.wf-version-diff-tab-count')?.textContent).toBe('2');
  });

  it('calls onClose when × clicked', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    fireEvent.click(document.querySelector('.wf-version-diff-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when modal body clicked', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    fireEvent.click(document.querySelector('.wf-version-diff-modal')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Nodes tab ──

  it('shows added nodes', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    expect(screen.getByText('Wait')).toBeTruthy();
    expect(screen.getByText('delay')).toBeTruthy();
  });

  it('shows modified nodes', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    expect(screen.getByText('Fetch (v2)')).toBeTruthy();
  });

  it('expands modified node to show inline diff', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const modifiedRow = screen.getByText('Fetch (v2)').closest('button')!;
    fireEvent.click(modifiedRow);
    expect(document.querySelector('.wf-version-diff-inline')).toBeTruthy();
  });

  it('collapses expanded node on second click', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const modifiedRow = screen.getByText('Fetch (v2)').closest('button')!;
    fireEvent.click(modifiedRow);
    expect(document.querySelector('.wf-version-diff-inline')).toBeTruthy();
    fireEvent.click(modifiedRow);
    expect(document.querySelector('.wf-version-diff-inline')).not.toBeTruthy();
  });

  // ── Edges tab ──

  it('shows edge changes on Edges tab', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    fireEvent.click(screen.getByText('Edges'));
    expect(screen.getByText(/n2 → n3/)).toBeTruthy();
  });

  // ── Variables tab ──

  it('shows variable changes on Variables tab', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    fireEvent.click(screen.getByText('Variables'));
    // Added var
    expect(screen.getByText('{{newVar}}')).toBeTruthy();
    // Removed var
    expect(screen.getByText('{{token}}')).toBeTruthy();
    // Modified var
    expect(screen.getByText('{{baseUrl}}')).toBeTruthy();
  });

  // ── Services tab ──

  it('shows service changes on Services tab', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    fireEvent.click(screen.getByText('Services'));
    // Added service
    expect(screen.getByText('Webhook')).toBeTruthy();
    // Modified service (name changed API → API v2)
    expect(screen.getByText('API v2')).toBeTruthy();
  });

  // ── Empty states ──

  it('shows "No node changes" for identical versions on Nodes tab', () => {
    render(<WorkflowVersionDiff open older={identicalOlder} newer={identicalNewer} onClose={onClose} />);
    expect(screen.getByText('No node changes')).toBeTruthy();
  });

  it('shows "No edge changes" for identical versions on Edges tab', () => {
    render(<WorkflowVersionDiff open older={identicalOlder} newer={identicalNewer} onClose={onClose} />);
    fireEvent.click(screen.getByText('Edges'));
    expect(screen.getByText('No edge changes')).toBeTruthy();
  });

  it('shows "No variable changes" for identical versions on Variables tab', () => {
    render(<WorkflowVersionDiff open older={identicalOlder} newer={identicalNewer} onClose={onClose} />);
    fireEvent.click(screen.getByText('Variables'));
    expect(screen.getByText('No variable changes')).toBeTruthy();
  });

  it('shows "No service changes" for identical versions on Services tab', () => {
    render(<WorkflowVersionDiff open older={identicalOlder} newer={identicalNewer} onClose={onClose} />);
    fireEvent.click(screen.getByText('Services'));
    expect(screen.getByText('No service changes')).toBeTruthy();
  });

  // ── Removed nodes ──

  it('shows removed nodes when newer has fewer', () => {
    const fewer = makeVersion({
      id: 'fewer',
      nodeCount: 1,
      nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Fetch' } }],
    });
    render(<WorkflowVersionDiff open older={olderVersion} newer={fewer} onClose={onClose} />);
    // n2 "Transform" was removed
    expect(screen.getByText('Transform')).toBeTruthy();
  });

  // ── Edge labels ──

  it('renders edge labels when present', () => {
    const withLabels = makeVersion({
      id: 'labeled',
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', label: 'success' },
        { id: 'e-new', source: 'n2', target: 'n3', label: 'fail' },
      ],
      edgeCount: 2,
    });
    render(<WorkflowVersionDiff open older={olderVersion} newer={withLabels} onClose={onClose} />);
    fireEvent.click(screen.getByText('Edges'));
    expect(screen.getByText('fail')).toBeTruthy();
  });

  // ── Timestamp fallback for unlabelled versions ──

  it('uses formatted timestamp when version has no label', () => {
    const noLabel = makeVersion({ id: 'no-label', label: undefined, timestamp: new Date(2026, 3, 15, 14, 30).getTime() });
    render(<WorkflowVersionDiff open older={noLabel} newer={newerVersion} onClose={onClose} />);
    // Should render a date string, not "undefined"
    const range = screen.getByText(/→.*Updated/);
    expect(range.textContent).not.toContain('undefined');
  });

  // ── Removed services ──

  it('shows removed services', () => {
    const noServices = makeVersion({ id: 'no-svc', services: [] });
    render(<WorkflowVersionDiff open older={olderVersion} newer={noServices} onClose={onClose} />);
    fireEvent.click(screen.getByText('Services'));
    expect(screen.getByText('API')).toBeTruthy();
  });
});
