/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockStatusPickerModal } from './ApiMockStatusPickerModal';
import { HTTP_STATUS_CATALOG } from './apiMockResponseEditorConstants';

const allCodes = HTTP_STATUS_CATALOG.flatMap(c => c.entries.map(e => e.code));

describe('ApiMockStatusPickerModal', () => {
  it('renders all status codes by default', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    expect(screen.getByTestId('api-mock-status-picker-modal')).toBeTruthy();
    expect(screen.getByText(`${allCodes.length} / ${allCodes.length}`)).toBeTruthy();
  });

  it('filters by search query', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    const search = screen.getByTestId('api-mock-status-picker-search');
    fireEvent.change(search, { target: { value: 'teapot' } });
    expect(screen.getByTestId('api-mock-status-pick-418')).toBeTruthy();
    expect(screen.queryByTestId('api-mock-status-pick-200')).toBeNull();
  });

  it('filters by status code number', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    const search = screen.getByTestId('api-mock-status-picker-search');
    fireEvent.change(search, { target: { value: '503' } });
    expect(screen.getByTestId('api-mock-status-pick-503')).toBeTruthy();
  });

  it('calls onPick with code and reason when a row is clicked', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('api-mock-status-pick-404'));
    expect(onPick).toHaveBeenCalledWith(404, 'Not Found');
    expect(onClose).toHaveBeenCalled();
  });

  it('highlights the current status', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={201} onPick={onPick} onClose={onClose} />);
    const row = screen.getByTestId('api-mock-status-pick-201');
    expect(row.className).toContain('am-sp-row--current');
  });

  it('closes on Escape', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId('api-mock-status-picker-modal'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when clicking the overlay background', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('api-mock-status-picker-modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clears search when the clear button is clicked', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    const search = screen.getByTestId('api-mock-status-picker-search');
    fireEvent.change(search, { target: { value: 'teapot' } });
    expect(screen.queryByTestId('api-mock-status-pick-200')).toBeNull();
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByTestId('api-mock-status-pick-200')).toBeTruthy();
  });

  it('navigates with arrow keys and selects with Enter', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    const search = screen.getByTestId('api-mock-status-picker-search');
    fireEvent.change(search, { target: { value: '418' } });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(418, "I'm a Teapot");
  });

  it('shows category filter buttons', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    for (const range of ['1xx', '2xx', '3xx', '4xx', '5xx']) {
      expect(screen.getAllByText(range).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows group headers with category labels', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    for (const label of ['Informational', 'Success', 'Client Error', 'Server Error']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows empty state when no codes match', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    const search = screen.getByTestId('api-mock-status-picker-search');
    fireEvent.change(search, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No matching status codes')).toBeTruthy();
  });

  it('includes descriptions for each status code', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ApiMockStatusPickerModal currentStatus={200} onPick={onPick} onClose={onClose} />);
    expect(screen.getByText(/Standard response for successful requests/)).toBeTruthy();
    expect(screen.getByText(/Requested resource could not be found/)).toBeTruthy();
  });
});
