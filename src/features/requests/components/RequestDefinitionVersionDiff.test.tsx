/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestDefinitionVersionDiff from './RequestDefinitionVersionDiff';
import type { RequestDefinitionVersion, RequestDefinitionSnapshot } from '@shared/types';
import { formatTimestamp } from '@shared/utils/formatRelativeTime';

vi.mock('json-diff-kit', () => ({
  Differ: class {
    diff() {
      return [];
    }
  },
  Viewer: () => <div data-testid="json-viewer" />,
}));

function snap(overrides: Partial<RequestDefinitionSnapshot> = {}): RequestDefinitionSnapshot {
  return {
    name: 'A',
    url: '/a',
    method: 'GET',
    headers: [{ key: 'H', value: '1' }],
    body: '{}',
    bodyType: 'json',
    auth: { type: 'none' },
    ...overrides,
  };
}

describe('RequestDefinitionVersionDiff', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <RequestDefinitionVersionDiff
        open={false}
        older={{ id: 'o', timestamp: 1, snapshot: snap() }}
        newer={{ id: 'n', timestamp: 2, snapshot: snap({ name: 'B' }) }}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows overview rows and switches tabs', () => {
    const olderSnap = snap({ name: 'Old', url: '/x', method: 'GET', body: '{}', headers: [{ key: 'H', value: '1' }] });
    const newerSnap = snap({
      name: 'New',
      url: '/y',
      method: 'POST',
      body: '{"k":1}',
      headers: [{ key: 'H', value: '2' }],
      auth: { type: 'bearer', token: 't' },
    });
    const older: RequestDefinitionVersion = { id: 'o', timestamp: 1, label: 'L1', snapshot: olderSnap };
    const newer: RequestDefinitionVersion = { id: 'n', timestamp: 2, label: 'L2', snapshot: newerSnap };

    render(
      <RequestDefinitionVersionDiff open older={older} newer={newer} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Request Definition Comparison')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Headers/ }));
    expect(screen.getByText('H')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Body/ }));
    expect(screen.getByTestId('json-viewer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Auth/ }));
    expect(screen.getAllByTestId('json-viewer').length).toBeGreaterThan(0);
  });

  it('shows empty overview when snapshots match on overview fields', () => {
    const s = snap();
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: 1, snapshot: s }}
        newer={{ id: 'n', timestamp: 2, snapshot: { ...s } }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('No overview changes')).toBeInTheDocument();
  });

  it('overlay mousedown target on backdrop closes', () => {
    const onClose = vi.fn();
    const { container } = render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: 1, snapshot: snap() }}
        newer={{ id: 'n', timestamp: 2, snapshot: snap({ name: 'Z' }) }}
        onClose={onClose}
      />,
    );
    const overlay = container.querySelector('.test-def-diff-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('labels header strip when versions omit aliases', () => {
    const tsA = Date.UTC(2024, 0, 2, 9, 0, 0);
    const tsB = Date.UTC(2024, 0, 3, 9, 0, 0);
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: tsA, snapshot: snap() }}
        newer={{ id: 'n', timestamp: tsB, snapshot: snap() }}
        onClose={vi.fn()}
      />,
    );
    const range = document.querySelector('.test-def-diff-range');
    expect(range?.textContent).toContain(formatTimestamp(tsA));
    expect(range?.textContent).toContain(formatTimestamp(tsB));
  });

  it('shows header removals and form field deltas on overview tab', () => {
    render(
      <RequestDefinitionVersionDiff
        open
        older={{
          id: 'o',
          timestamp: 1,
          snapshot: snap({ headers: [{ key: 'retire', value: '1' }] }),
        }}
        newer={{
          id: 'n',
          timestamp: 2,
          snapshot: snap({ headers: [{ key: 'H', value: '1' }] }),
        }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Headers/ }));
    expect(screen.getByText('retire')).toBeInTheDocument();

    cleanup();
    render(
      <RequestDefinitionVersionDiff
        open
        older={{
          id: 'x',
          timestamp: 10,
          snapshot: snap({
            headers: [{ key: 'H', value: '1' }],
            bodyForm: [{ key: 'f', value: '1' }],
          }),
        }}
        newer={{
          id: 'y',
          timestamp: 11,
          snapshot: snap({
            headers: [{ key: 'H', value: '1' }],
            bodyForm: [{ key: 'f', value: '99' }],
          }),
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/form fields modified/i)).toBeInTheDocument();
  });

  it('stops propagation on modal shell clicks', () => {
    const onClose = vi.fn();
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: 1, snapshot: snap() }}
        newer={{ id: 'n', timestamp: 2, snapshot: snap({ name: 'Z' }) }}
        onClose={onClose}
      />,
    );
    fireEvent.click(document.querySelector('.test-def-diff-body')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows body-type row on overview and auth viewer when secrets diverge', () => {
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: 1, snapshot: snap({ bodyType: 'json', auth: { type: 'none' } }) }}
        newer={{
          id: 'n',
          timestamp: 2,
          snapshot: snap({ bodyType: 'text', auth: { type: 'oauth2', tokenUrl: 'https://token', clientId: 'id', clientSecret: 's' } }),
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Body Type')).toBeInTheDocument();
    const bodyTypeRow = screen.getByText('Body Type').closest('.test-def-diff-row');
    expect(bodyTypeRow).toHaveTextContent('json');
    expect(bodyTypeRow).toHaveTextContent('text');
    fireEvent.click(screen.getByRole('button', { name: /Auth/ }));
    expect(screen.getByTestId('json-viewer')).toBeInTheDocument();
  });

  it('feeds plaintext bodies through the JSON diff viewer tabs', () => {
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: 1, snapshot: snap({ body: '{"a":1}' }) }}
        newer={{ id: 'n', timestamp: 2, snapshot: snap({ body: '{"a":2}' }) }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Body/ }));
    expect(screen.getByTestId('json-viewer')).toBeInTheDocument();

    cleanup();
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'a', timestamp: 1, snapshot: snap({ body: '<<<not-json-old' }) }}
        newer={{ id: 'b', timestamp: 2, snapshot: snap({ body: '<<<not-json-new' }) }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Body/ }));
    expect(screen.getByTestId('json-viewer')).toBeInTheDocument();
  });

  it('lists header additions without removals or tweaks', () => {
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: 1, snapshot: snap({ headers: [] }) }}
        newer={{ id: 'n', timestamp: 2, snapshot: snap({ headers: [{ key: 'X-New', value: '1' }] }) }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Headers/ }));
    expect(screen.getByText('X-New')).toBeInTheDocument();
  });

  it('closes from the footer Close button', () => {
    const onClose = vi.fn();
    render(
      <RequestDefinitionVersionDiff open older={{ id: 'o', timestamp: 1, snapshot: snap() }} newer={{ id: 'n', timestamp: 2, snapshot: snap({ url: '/z' }) }} onClose={onClose} />,
    );
    const closeBtn = document.querySelector('.test-def-diff-footer')?.querySelector('button.btn');
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders overview none fallbacks when body types are unset', () => {
    render(
      <RequestDefinitionVersionDiff
        open
        older={{ id: 'o', timestamp: 1, snapshot: snap({ bodyType: undefined }) }}
        newer={{ id: 'n', timestamp: 2, snapshot: snap({ bodyType: 'json' }) }}
        onClose={vi.fn()}
      />,
    );
    const row = screen.getByText('Body Type').closest('.test-def-diff-row');
    expect(row).toHaveTextContent('none');
    expect(row).toHaveTextContent('json');
  });

  it('shows tab badges whenever sections contain tracked edits', () => {
    render(
      <RequestDefinitionVersionDiff
        open
        older={{
          id: 'o',
          timestamp: 1,
          snapshot: snap({ headers: [{ key: 'H', value: '1' }], bodyType: 'json', auth: { type: 'basic', username: 'a', password: 'b' } }),
        }}
        newer={{
          id: 'n',
          timestamp: 2,
          snapshot: snap({
            headers: [{ key: 'H', value: '2' }],
            body: '{"k":true}',
            bodyType: 'json',
            auth: { type: 'bearer', token: 'tok' },
          }),
        }}
        onClose={vi.fn()}
      />,
    );

    expect(document.querySelector('.test-def-diff-tab-count')).toBeInTheDocument();
  });
});
