/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketFilterBar } from './WebSocketFilterBar';

describe('WebSocketFilterBar', () => {
  const defaultProps = {
    sizeFilter: 'all' as const,
    setSizeFilter: vi.fn(),
    timeFilter: 'all' as const,
    setTimeFilter: vi.fn(),
    contentTypeFilter: 'all' as const,
    setContentTypeFilter: vi.fn(),
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
    filterPresets: [],
    presetDropdownOpen: false,
    setPresetDropdownOpen: vi.fn(),
    presetDropdownRef: { current: null } as React.RefObject<HTMLDivElement>,
    onSavePreset: vi.fn(),
    onApplyPreset: vi.fn(),
    onDeletePreset: vi.fn(),
  };

  it('renders size, time, and content type selects', () => {
    render(<WebSocketFilterBar {...defaultProps} />);
    expect(screen.getByLabelText('Size filter')).toBeTruthy();
    expect(screen.getByLabelText('Time filter')).toBeTruthy();
    expect(screen.getByLabelText('Content type filter')).toBeTruthy();
  });

  it('updates size filter on change', () => {
    render(<WebSocketFilterBar {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Size filter'), { target: { value: 'lt1k' } });
    expect(defaultProps.setSizeFilter).toHaveBeenCalledWith('lt1k');
  });

  it('updates time filter on change', () => {
    render(<WebSocketFilterBar {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Time filter'), { target: { value: 'last30s' } });
    expect(defaultProps.setTimeFilter).toHaveBeenCalledWith('last30s');
  });

  it('updates content type filter on change', () => {
    render(<WebSocketFilterBar {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Content type filter'), { target: { value: 'json' } });
    expect(defaultProps.setContentTypeFilter).toHaveBeenCalledWith('json');
  });

  it('shows clear button when activeFilterCount > 0', () => {
    render(<WebSocketFilterBar {...defaultProps} activeFilterCount={2} />);
    expect(screen.getByTestId('clear-filters-btn')).toBeTruthy();
  });

  it('hides clear button when activeFilterCount is 0', () => {
    render(<WebSocketFilterBar {...defaultProps} activeFilterCount={0} />);
    expect(screen.queryByTestId('clear-filters-btn')).toBeNull();
  });

  it('calls onClearFilters when clear button clicked', () => {
    const onClear = vi.fn();
    render(<WebSocketFilterBar {...defaultProps} activeFilterCount={1} onClearFilters={onClear} />);
    fireEvent.click(screen.getByTestId('clear-filters-btn'));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows presets button', () => {
    render(<WebSocketFilterBar {...defaultProps} />);
    expect(screen.getByTestId('presets-btn')).toBeTruthy();
  });

  it('toggles preset dropdown on presets button click', () => {
    const setOpen = vi.fn();
    render(<WebSocketFilterBar {...defaultProps} setPresetDropdownOpen={setOpen} />);
    fireEvent.click(screen.getByTestId('presets-btn'));
    expect(setOpen).toHaveBeenCalled();
  });

  it('shows preset dropdown when open', () => {
    render(<WebSocketFilterBar {...defaultProps} presetDropdownOpen={true} />);
    expect(screen.getByTestId('presets-dropdown')).toBeTruthy();
    expect(screen.getByTestId('save-preset-btn')).toBeTruthy();
  });

  it('shows "No saved presets" when no presets exist', () => {
    render(<WebSocketFilterBar {...defaultProps} presetDropdownOpen={true} />);
    expect(screen.getByText('No saved presets')).toBeTruthy();
  });

  it('renders preset rows when presets exist', () => {
    const presets = [
      { id: 'fp-1', name: 'Preset A', searchMode: 'text' as const, searchQuery: '', createdAt: '' },
      { id: 'fp-2', name: 'Preset B', searchMode: 'regex' as const, searchQuery: '.*', createdAt: '' },
    ];
    render(<WebSocketFilterBar {...defaultProps} presetDropdownOpen={true} filterPresets={presets} />);
    expect(screen.getByText('Preset A')).toBeTruthy();
    expect(screen.getByText('Preset B')).toBeTruthy();
  });

  it('calls onApplyPreset when preset is clicked', () => {
    const onApply = vi.fn();
    const presets = [
      { id: 'fp-1', name: 'My Preset', searchMode: 'text' as const, searchQuery: '', createdAt: '' },
    ];
    render(<WebSocketFilterBar {...defaultProps} presetDropdownOpen={true} filterPresets={presets} onApplyPreset={onApply} />);
    fireEvent.click(screen.getByText('My Preset'));
    expect(onApply).toHaveBeenCalledWith(presets[0]);
  });

  it('calls onDeletePreset when delete button clicked', () => {
    const onDelete = vi.fn();
    const presets = [
      { id: 'fp-1', name: 'My Preset', searchMode: 'text' as const, searchQuery: '', createdAt: '' },
    ];
    render(<WebSocketFilterBar {...defaultProps} presetDropdownOpen={true} filterPresets={presets} onDeletePreset={onDelete} />);
    fireEvent.click(screen.getByTestId('preset-delete-fp-1'));
    expect(onDelete).toHaveBeenCalledWith('fp-1');
  });

  it('calls onSavePreset when save button clicked', () => {
    const onSave = vi.fn();
    render(<WebSocketFilterBar {...defaultProps} presetDropdownOpen={true} onSavePreset={onSave} />);
    fireEvent.click(screen.getByTestId('save-preset-btn'));
    expect(onSave).toHaveBeenCalled();
  });
});
