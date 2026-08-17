/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockTemplateHelperModal } from './ApiMockTemplateHelperModal';
import { TEMPLATE_HELPER_CATALOG } from '../../../shared/api-mock/templateHelperCatalog';

describe('ApiMockTemplateHelperModal', () => {
  const writeText = vi.fn(async () => undefined);

  beforeEach(() => {
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists helpers, filters, navigates, inserts, copies, and closes', async () => {
    const onInsert = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockTemplateHelperModal onInsert={onInsert} onClose={onClose} />);

    expect(screen.getByTestId('api-mock-template-helpers-modal')).toBeTruthy();
    expect(screen.getByTestId('api-mock-template-helpers-count').textContent)
      .toBe(`${TEMPLATE_HELPER_CATALOG.length}/${TEMPLATE_HELPER_CATALOG.length}`);
    expect(screen.getByTestId('api-mock-template-helpers-nav')).toBeTruthy();
    expect(screen.getByTestId('api-mock-template-helpers-catalog')).toBeTruthy();
    expect(screen.getByTestId('api-mock-template-helpers-group-request')).toBeTruthy();
    expect(screen.getByTestId('api-mock-template-helpers-group-faker')).toBeTruthy();
    expect(screen.getByTestId('api-mock-template-helpers-cat-all')).toHaveAttribute('data-active', 'true');

    fireEvent.change(screen.getByTestId('api-mock-template-helpers-search'), { target: { value: 'uuid' } });
    expect(screen.getByTestId('api-mock-template-helpers-count').textContent).toMatch(/^\d+\/\d+$/);
    const rows = screen.getAllByTestId('api-mock-template-helpers-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(row => /uuid/i.test(row.textContent ?? ''))).toBe(true);

    fireEvent.keyDown(screen.getByTestId('api-mock-template-helpers-search'), { key: 'a' });
    fireEvent.keyDown(screen.getByTestId('api-mock-template-helpers-search'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('api-mock-template-helpers-search'), { key: 'Enter', shiftKey: true });
    fireEvent.click(screen.getByTestId('api-mock-template-helpers-next'));
    fireEvent.click(screen.getByTestId('api-mock-template-helpers-prev'));

    fireEvent.click(screen.getAllByTestId('api-mock-template-helpers-insert')[0]);
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('{{'));

    fireEvent.click(screen.getAllByTestId('api-mock-template-helpers-copy')[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getAllByTestId('api-mock-template-helpers-copy')[0]).toHaveTextContent('Copied');

    fireEvent.click(screen.getByTestId('api-mock-template-helpers-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state and focuses search on Cmd+F', () => {
    render(<ApiMockTemplateHelperModal onInsert={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('api-mock-template-helpers-search'), { target: { value: 'zzzz-missing' } });
    expect(screen.getByTestId('api-mock-template-helpers-empty')).toHaveTextContent('No helpers match');
    expect(screen.getByTestId('api-mock-template-helpers-next')).toBeDisabled();

    const search = screen.getByTestId('api-mock-template-helpers-search') as HTMLInputElement;
    search.blur();
    fireEvent.keyDown(window, { key: 'a', metaKey: true });
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true });
    expect(document.activeElement).toBe(search);
  });

  it('keeps Copy as Copy when the clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<ApiMockTemplateHelperModal onInsert={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByTestId('api-mock-template-helpers-copy')[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getAllByTestId('api-mock-template-helpers-copy')[0]).toHaveTextContent('Copy');
  });

  it('clears Copied after the flash, even if another row was copied first', async () => {
    vi.useFakeTimers();
    render(<ApiMockTemplateHelperModal onInsert={vi.fn()} onClose={vi.fn()} />);
    const copies = screen.getAllByTestId('api-mock-template-helpers-copy');
    await act(async () => { fireEvent.click(copies[0]); });
    expect(copies[0]).toHaveTextContent('Copied');
    await act(async () => { fireEvent.click(copies[1]); });
    expect(copies[1]).toHaveTextContent('Copied');
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(copies[0]).toHaveTextContent('Copy');
    expect(copies[1]).toHaveTextContent('Copy');
  });

  it('highlights a clicked row', () => {
    render(<ApiMockTemplateHelperModal onInsert={vi.fn()} onClose={vi.fn()} />);
    const rows = screen.getAllByTestId('api-mock-template-helpers-row');
    fireEvent.click(rows[1]);
    expect(rows[1]).toHaveAttribute('data-active', 'true');
  });

  it('filters the catalog to one category and inserts on double-click', () => {
    const onInsert = vi.fn();
    render(<ApiMockTemplateHelperModal onInsert={onInsert} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-template-helpers-cat-request'));
    expect(screen.getByTestId('api-mock-template-helpers-cat-request')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('api-mock-template-helpers-group-request')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-template-helpers-group-faker')).toBeNull();
    const cards = screen.getAllByTestId('api-mock-template-helpers-row');
    fireEvent.doubleClick(cards[0]);
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('{{'));
  });

  it('returns to All when the current category has no search hits', () => {
    render(<ApiMockTemplateHelperModal onInsert={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-template-helpers-cat-faker'));
    fireEvent.change(screen.getByTestId('api-mock-template-helpers-search'), { target: { value: 'pathParam' } });
    expect(screen.getByTestId('api-mock-template-helpers-cat-all')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('api-mock-template-helpers-group-request')).toBeTruthy();
  });
});
