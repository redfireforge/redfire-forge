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
    expect(screen.getByText('Baseline')).toBeTruthy();
    expect(screen.getByText('Updated')).toBeTruthy();
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

  it('calls onClose when close button clicked', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
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
    // Edge n2 → n3 is shown (source and target in separate spans now)
    expect(screen.getByText('n2')).toBeTruthy();
    expect(screen.getByText('n3')).toBeTruthy();
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
    // Should render a date string in the old label span, not "undefined"
    const oldLabel = document.querySelector('.wf-version-diff-label-old')!;
    expect(oldLabel.textContent).not.toContain('undefined');
    expect(oldLabel.textContent!.length).toBeGreaterThan(0);
  });

  // ── Removed services ──

  it('shows removed services', () => {
    const noServices = makeVersion({ id: 'no-svc', services: [] });
    render(<WorkflowVersionDiff open older={olderVersion} newer={noServices} onClose={onClose} />);
    fireEvent.click(screen.getByText('Services'));
    expect(screen.getByText('API')).toBeTruthy();
  });

  // ── Removed edges ──

  it('shows removed edges on Edges tab', () => {
    const fewerEdges = makeVersion({
      id: 'fewer-edges',
      edges: [],
      edgeCount: 0,
    });
    render(<WorkflowVersionDiff open older={olderVersion} newer={fewerEdges} onClose={onClose} />);
    fireEvent.click(screen.getByText('Edges'));
    // e1 (n1 → n2) was removed
    expect(screen.getByText('n1')).toBeTruthy();
    expect(screen.getByText('n2')).toBeTruthy();
  });

  it('shows removed edge labels', () => {
    const withLabel = makeVersion({
      id: 'with-lbl',
      edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'ok' }],
    });
    const fewerEdges = makeVersion({
      id: 'fewer-lbl',
      edges: [],
      edgeCount: 0,
    });
    render(<WorkflowVersionDiff open older={withLabel} newer={fewerEdges} onClose={onClose} />);
    fireEvent.click(screen.getByText('Edges'));
    expect(screen.getByText('ok')).toBeTruthy();
  });

  // ── Drag interaction ──

  it('drags the modal via header mousedown + mousemove + mouseup', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const header = document.querySelector('.wf-version-diff-header')!;
    fireEvent.mouseDown(header, { clientX: 100, clientY: 50 });
    fireEvent.mouseMove(document, { clientX: 120, clientY: 70 });
    // Modal should now have fixed positioning
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.classList.contains('wf-version-diff-modal--positioned')).toBe(true);
    fireEvent.mouseUp(document);
    // After mouseup, further moves don't change position
    expect(onClose).not.toHaveBeenCalled();
  });

  it('drag skips when mousedown target is a button', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.mouseDown(closeBtn, { clientX: 100, clientY: 50 });
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.classList.contains('wf-version-diff-modal--positioned')).toBe(false);
  });

  // ── Resize interaction ──

  it('resizes via SE handle', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const handle = document.querySelector('.wf-vd-resize-se')!;
    fireEvent.mouseDown(handle, { clientX: 500, clientY: 400 });
    fireEvent.mouseMove(document, { clientX: 600, clientY: 500 });
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.style.width).toBeTruthy();
    expect(modal.style.height).toBeTruthy();
    fireEvent.mouseUp(document);
  });

  it('resizes via NW handle (north + west)', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const handle = document.querySelector('.wf-vd-resize-nw')!;
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 80, clientY: 80 });
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.style.width).toBeTruthy();
    fireEvent.mouseUp(document);
  });

  it('resizes via E handle', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const handle = document.querySelector('.wf-vd-resize-e')!;
    fireEvent.mouseDown(handle, { clientX: 500, clientY: 300 });
    fireEvent.mouseMove(document, { clientX: 600, clientY: 300 });
    fireEvent.mouseUp(document);
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.classList.contains('wf-version-diff-modal--positioned')).toBe(true);
  });

  it('resizes via N handle', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const handle = document.querySelector('.wf-vd-resize-n')!;
    fireEvent.mouseDown(handle, { clientX: 300, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 80 });
    fireEvent.mouseUp(document);
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.style.top).toBeTruthy();
  });

  it('resizes via W handle', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const handle = document.querySelector('.wf-vd-resize-w')!;
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 300 });
    fireEvent.mouseMove(document, { clientX: 80, clientY: 300 });
    fireEvent.mouseUp(document);
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.style.width).toBeTruthy();
  });

  it('resizes via S handle', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const handle = document.querySelector('.wf-vd-resize-s')!;
    fireEvent.mouseDown(handle, { clientX: 300, clientY: 400 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 500 });
    fireEvent.mouseUp(document);
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.style.height).toBeTruthy();
  });

  // ── Positioned modal style ──

  it('applies positioned styles after drag', () => {
    render(<WorkflowVersionDiff open older={olderVersion} newer={newerVersion} onClose={onClose} />);
    const header = document.querySelector('.wf-version-diff-header')!;
    fireEvent.mouseDown(header, { clientX: 100, clientY: 50 });
    fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
    fireEvent.mouseUp(document);
    const modal = document.querySelector('.wf-version-diff-modal') as HTMLElement;
    expect(modal.style.position).toBe('fixed');
    expect(modal.style.left).toBeTruthy();
    expect(modal.style.top).toBeTruthy();
    expect(modal.style.maxWidth).toBe('none');
    expect(modal.style.maxHeight).toBe('none');
  });

  // ── Total changes singular ──

  it('shows "change" (singular) when only 1 change', () => {
    const oneDiff = makeVersion({
      id: 'one-diff',
      nodes: [
        { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Fetch' } },
        { id: 'n2', type: 'script', position: { x: 200, y: 0 }, data: { label: 'Transform' } },
        { id: 'n3', type: 'delay', position: { x: 400, y: 0 }, data: { label: 'New' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      variables: { baseUrl: 'https://api.example.com', token: 'abc' },
      services: [{ id: 's1', name: 'API', endpoints: {}, defaultAuth: 'inherit' }],
    });
    render(<WorkflowVersionDiff open older={olderVersion} newer={oneDiff} onClose={onClose} />);
    expect(document.querySelector('.wf-version-diff-summary-text')?.textContent).toBe('change');
  });
});
