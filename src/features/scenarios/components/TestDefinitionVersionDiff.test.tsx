/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestDefinitionVersionDiff from './TestDefinitionVersionDiff';
import type { TestDefinitionVersion, TestDefinitionSnapshot } from '../../../shared/types';

vi.mock('json-diff-kit', () => ({
  Differ: class {
    diff(a: unknown, b: unknown) { return [[{ type: 0, text: JSON.stringify(a) }, { type: 0, text: JSON.stringify(b) }]]; }
  },
  Viewer: ({ diff }: { diff: unknown }) => <div data-testid="json-diff-viewer">diff viewer</div>,
}));

vi.mock('json-diff-kit/dist/viewer.css', () => ({}));
vi.mock('json-diff-kit/dist/viewer-monokai.css', () => ({}));

const mkSnapshot = (overrides?: Partial<TestDefinitionSnapshot>): TestDefinitionSnapshot => ({
  name: 'Test API',
  url: 'https://api.example.com',
  method: 'GET',
  headers: [],
  body: '',
  auth: { type: 'none' },
  ...overrides,
});

const mkVersion = (id: string, ts: number, snapshot: TestDefinitionSnapshot, label?: string): TestDefinitionVersion => ({
  id,
  timestamp: ts,
  snapshot,
  label,
});

describe('TestDefinitionVersionDiff', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('renders nothing when not open', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    const { container } = render(<TestDefinitionVersionDiff open={false} older={v1} newer={v2} onClose={onClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal when open', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    expect(screen.getByText('Definition Comparison')).toBeTruthy();
  });

  it('renders all 5 tabs', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Headers')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Auth')).toBeTruthy();
    expect(screen.getByText('Extractions')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay clicked', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    const overlay = document.querySelector('.test-def-diff-overlay');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows overview changes when URL is different', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot({ url: 'https://old.com' }));
    const v2 = mkVersion('v2', 2000, mkSnapshot({ url: 'https://new.com' }));
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    expect(screen.getByText('URL')).toBeTruthy();
    expect(screen.getByText('https://old.com')).toBeTruthy();
    expect(screen.getByText('https://new.com')).toBeTruthy();
  });

  it('shows "No overview changes" when snapshots are identical', () => {
    const snap = mkSnapshot();
    const v1 = mkVersion('v1', 1000, snap);
    const v2 = mkVersion('v2', 2000, snap);
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    expect(screen.getByText('No overview changes')).toBeTruthy();
  });

  it('switches to Headers tab', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    fireEvent.click(screen.getByText('Headers'));
    expect(screen.getByText('No header changes')).toBeTruthy();
  });

  it('shows header changes when present', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot({ headers: [] }));
    const v2 = mkVersion('v2', 2000, mkSnapshot({
      headers: [{ key: 'X-New', value: 'val', enabled: true }],
    }));
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    fireEvent.click(screen.getByText('Headers'));
    expect(screen.getByText('X-New')).toBeTruthy();
  });

  it('switches to Body tab', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    fireEvent.click(screen.getByText('Body'));
    expect(screen.getByText('No body changes')).toBeTruthy();
  });

  it('switches to Auth tab', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    fireEvent.click(screen.getByText('Auth'));
    expect(screen.getByText('No auth changes')).toBeTruthy();
  });

  it('switches to Extractions tab', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot());
    const v2 = mkVersion('v2', 2000, mkSnapshot());
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    fireEvent.click(screen.getByText('Extractions'));
    expect(screen.getByText('No extraction changes')).toBeTruthy();
  });

  it('uses version label when available', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot(), 'Before refactor');
    const v2 = mkVersion('v2', 2000, mkSnapshot(), 'After refactor');
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    expect(screen.getByText(/Before refactor.*→.*After refactor/)).toBeTruthy();
  });

  it('shows method change in overview', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot({ method: 'GET' }));
    const v2 = mkVersion('v2', 2000, mkSnapshot({ method: 'POST' }));
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    expect(screen.getByText('Method')).toBeTruthy();
  });

  it('shows body diff when body changed', () => {
    const v1 = mkVersion('v1', 1000, mkSnapshot({ body: '{"old": true}' }));
    const v2 = mkVersion('v2', 2000, mkSnapshot({ body: '{"new": true}' }));
    render(<TestDefinitionVersionDiff open older={v1} newer={v2} onClose={onClose} />);
    // Click Body tab (it's a button element)
    const bodyTab = screen.getAllByText('Body').find(el => el.tagName === 'BUTTON')!;
    fireEvent.click(bodyTab);
    expect(screen.getByTestId('json-diff-viewer')).toBeTruthy();
  });
});
