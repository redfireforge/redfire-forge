// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HarEntryPreviewList } from './HarEntryPreviewList';
import type { HarPreviewResult } from '@shared/api-mock/harImport';

function makePreview(overrides: Partial<HarPreviewResult> = {}): HarPreviewResult {
  return {
    accepted: [
      {
        index: 0, method: 'GET', path: '/users', host: 'api.example.com', status: 200,
        hasRedactedHeaders: false,
        source: { method: 'GET', path: '/users' },
      },
      {
        index: 1, method: 'POST', path: '/orders', host: 'api.example.com', status: 201,
        hasRedactedHeaders: true,
        source: { method: 'POST', path: '/orders' },
      },
    ],
    autoFiltered: [],
    secretHits: 0,
    truncated: false,
    ...overrides,
  };
}

describe('HarEntryPreviewList', () => {
  it('renders one row per accepted entry', () => {
    render(
      <HarEntryPreviewList
        preview={makePreview()}
        selectedIndices={new Set([0, 1])}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId(/^am-har-entry-\d+$/)).toHaveLength(2);
  });

  it('checkboxes are checked based on selectedIndices (accepted-array position)', () => {
    render(
      <HarEntryPreviewList
        preview={makePreview()}
        selectedIndices={new Set([0])}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    const cb0 = screen.getByTestId('am-har-entry-cb-0') as HTMLInputElement;
    const cb1 = screen.getByTestId('am-har-entry-cb-1') as HTMLInputElement;
    expect(cb0.checked).toBe(true);
    expect(cb1.checked).toBe(false);
  });

  it('onToggle is called with accepted-array position (not entry.index)', () => {
    const onToggle = vi.fn();
    // accepted[0].index=5, accepted[1].index=7 — toggle must pass 0 and 1, not 5 and 7
    const preview = makePreview({
      accepted: [
        { index: 5, method: 'GET', path: '/a', host: 'h', status: 200, hasRedactedHeaders: false, source: { method: 'GET', path: '/a' } },
        { index: 7, method: 'POST', path: '/b', host: 'h', status: 200, hasRedactedHeaders: false, source: { method: 'POST', path: '/b' } },
      ],
    });
    render(
      <HarEntryPreviewList
        preview={preview}
        selectedIndices={new Set([0])}
        onToggle={onToggle}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    // Click the second checkbox (accepted position 1, raw index 7)
    fireEvent.click(screen.getByTestId('am-har-entry-cb-1'));
    expect(onToggle).toHaveBeenCalledWith(1);  // position, not raw index
    expect(onToggle).not.toHaveBeenCalledWith(7);
  });

  it('Select All button calls onSelectAll', () => {
    const onSelectAll = vi.fn();
    render(
      <HarEntryPreviewList
        preview={makePreview()}
        selectedIndices={new Set()}
        onToggle={vi.fn()}
        onSelectAll={onSelectAll}
        onDeselectAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('am-har-select-all'));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('None button calls onDeselectAll', () => {
    const onDeselectAll = vi.fn();
    render(
      <HarEntryPreviewList
        preview={makePreview()}
        selectedIndices={new Set([0, 1])}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={onDeselectAll}
      />,
    );
    fireEvent.click(screen.getByTestId('am-har-select-none'));
    expect(onDeselectAll).toHaveBeenCalledTimes(1);
  });

  it('shows lock icon for entries with hasRedactedHeaders=true', () => {
    render(
      <HarEntryPreviewList
        preview={makePreview()}
        selectedIndices={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    // accepted[1] has hasRedactedHeaders=true
    const redacted = screen.getAllByLabelText('redacted headers');
    expect(redacted).toHaveLength(1);
  });

  it('renders filtered entries in the collapsible section', () => {
    const preview = makePreview({
      autoFiltered: [
        { index: 2, method: 'OPTIONS', path: '/api', host: 'h', status: 204, hasRedactedHeaders: false, filteredReason: 'options-preflight' },
      ],
    });
    render(
      <HarEntryPreviewList
        preview={preview}
        selectedIndices={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('am-har-filtered-section')).toBeTruthy();
    expect(screen.getByText(/CORS/i)).toBeTruthy();
  });

  it('shows filter reason tag for filtered entries', () => {
    const preview = makePreview({
      autoFiltered: [
        { index: 3, method: 'GET', path: '/ga', host: 'google-analytics.com', status: 200, hasRedactedHeaders: false, filteredReason: 'tracking-domain' },
      ],
    });
    render(
      <HarEntryPreviewList
        preview={preview}
        selectedIndices={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getByText(/tracking/i)).toBeTruthy();
  });

  it('shows empty message when no accepted entries', () => {
    const preview = makePreview({ accepted: [] });
    render(
      <HarEntryPreviewList
        preview={preview}
        selectedIndices={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('am-har-empty')).toBeTruthy();
  });

  it('shows filtered count in summary when autoFiltered is non-empty', () => {
    const preview = makePreview({
      autoFiltered: [
        { index: 0, method: 'OPTIONS', path: '/x', host: 'h', status: 200, hasRedactedHeaders: false, filteredReason: 'options-preflight' },
      ],
    });
    render(
      <HarEntryPreviewList
        preview={preview}
        selectedIndices={new Set()}
        onToggle={vi.fn()}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 filtered/i)).toBeTruthy();
  });
});
