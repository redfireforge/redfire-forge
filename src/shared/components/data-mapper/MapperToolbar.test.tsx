/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MapperToolbar from './MapperToolbar';

function renderToolbar(overrides?: Partial<Parameters<typeof MapperToolbar>[0]>) {
  const defaults = {
    onAutoMap: vi.fn(),
    onClearAll: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    mappingCount: 0,
  };
  const props = { ...defaults, ...overrides };
  const result = render(<MapperToolbar {...props} />);
  return { ...result, props };
}

describe('MapperToolbar', () => {
  it('renders auto-map button', () => {
    renderToolbar();
    expect(screen.getByText(/Auto-map/)).toBeTruthy();
  });

  it('calls onAutoMap when clicked', () => {
    const { props } = renderToolbar();
    fireEvent.click(screen.getByText(/Auto-map/));
    expect(props.onAutoMap).toHaveBeenCalledTimes(1);
  });

  it('shows auto-map candidate count badge', () => {
    const { container } = renderToolbar({ autoMapCount: 5 });
    const badge = container.querySelector('.dm-toolbar-badge');
    expect(badge?.textContent).toBe('5');
  });

  it('hides badge when autoMapCount is 0', () => {
    const { container } = renderToolbar({ autoMapCount: 0 });
    expect(container.querySelector('.dm-toolbar-badge')).toBeNull();
  });

  it('hides badge when autoMapCount is undefined', () => {
    const { container } = renderToolbar();
    expect(container.querySelector('.dm-toolbar-badge')).toBeNull();
  });

  it('clear all is disabled when mappingCount is 0', () => {
    renderToolbar({ mappingCount: 0 });
    const clearBtn = screen.getByText(/Clear all/).closest('button');
    expect(clearBtn?.disabled).toBe(true);
  });

  it('clear all is enabled when mappingCount > 0', () => {
    renderToolbar({ mappingCount: 3 });
    const clearBtn = screen.getByText(/Clear all/).closest('button');
    expect(clearBtn?.disabled).toBe(false);
  });

  it('calls onClearAll when clicked', () => {
    const { props } = renderToolbar({ mappingCount: 1 });
    fireEvent.click(screen.getByText(/Clear all/));
    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it('shows mapping count status', () => {
    renderToolbar({ mappingCount: 7 });
    expect(screen.getByText('7 mappings')).toBeTruthy();
  });

  it('shows singular "mapping" for count 1', () => {
    renderToolbar({ mappingCount: 1 });
    expect(screen.getByText('1 mapping')).toBeTruthy();
  });

  it('hides status when no mappings', () => {
    renderToolbar({ mappingCount: 0 });
    expect(screen.queryByText(/mapping/i)).toBeNull();
  });

  it('undo is disabled when canUndo is false', () => {
    renderToolbar({ canUndo: false });
    const undoBtn = screen.getByText(/Undo/).closest('button');
    expect(undoBtn?.disabled).toBe(true);
  });

  it('undo is enabled when canUndo is true', () => {
    renderToolbar({ canUndo: true });
    const undoBtn = screen.getByText(/Undo/).closest('button');
    expect(undoBtn?.disabled).toBe(false);
  });

  it('calls onUndo when clicked', () => {
    const { props } = renderToolbar({ canUndo: true });
    fireEvent.click(screen.getByText(/Undo/));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
  });

  it('redo is disabled when canRedo is false', () => {
    renderToolbar({ canRedo: false });
    const redoBtn = screen.getByText(/Redo/).closest('button');
    expect(redoBtn?.disabled).toBe(true);
  });

  it('redo is enabled when canRedo is true', () => {
    renderToolbar({ canRedo: true });
    const redoBtn = screen.getByText(/Redo/).closest('button');
    expect(redoBtn?.disabled).toBe(false);
  });

  it('calls onRedo when clicked', () => {
    const { props } = renderToolbar({ canRedo: true });
    fireEvent.click(screen.getByText(/Redo/));
    expect(props.onRedo).toHaveBeenCalledTimes(1);
  });

  it('shows preview toggle when onTogglePreview provided', () => {
    renderToolbar({ onTogglePreview: vi.fn() });
    expect(screen.getByTitle('Show preview')).toBeTruthy();
  });

  it('hides preview toggle when onTogglePreview not provided', () => {
    renderToolbar();
    expect(screen.queryByText(/Preview/)).toBeNull();
  });

  it('calls onTogglePreview when clicked', () => {
    const onToggle = vi.fn();
    renderToolbar({ onTogglePreview: onToggle });
    fireEvent.click(screen.getByTitle('Show preview'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows active style when showPreview is true', () => {
    renderToolbar({ onTogglePreview: vi.fn(), showPreview: true });
    const btn = screen.getByTitle('Hide preview');
    expect(btn.className).toContain('dm-toolbar-btn--active');
  });

  it('shows "Hide preview" title when active', () => {
    renderToolbar({ onTogglePreview: vi.fn(), showPreview: true });
    expect(screen.getByTitle('Hide preview')).toBeTruthy();
  });
});

describe('pending accept/reject buttons', () => {
  it('shows Accept All and Reject All when hasPending is true', () => {
    renderToolbar({
      hasPending: true,
      onAcceptAllPending: vi.fn(),
      onRejectAllPending: vi.fn(),
    });
    expect(screen.getByTitle('Accept all pending auto-maps')).toBeTruthy();
    expect(screen.getByTitle('Reject all pending auto-maps')).toBeTruthy();
  });

  it('does not show Accept/Reject when hasPending is false', () => {
    renderToolbar({
      hasPending: false,
      onAcceptAllPending: vi.fn(),
      onRejectAllPending: vi.fn(),
    });
    expect(screen.queryByTitle('Accept all pending auto-maps')).toBeNull();
    expect(screen.queryByTitle('Reject all pending auto-maps')).toBeNull();
  });

  it('calls onAcceptAllPending when clicked', () => {
    const onAccept = vi.fn();
    renderToolbar({
      hasPending: true,
      onAcceptAllPending: onAccept,
      onRejectAllPending: vi.fn(),
    });
    fireEvent.click(screen.getByTitle('Accept all pending auto-maps'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onRejectAllPending when clicked', () => {
    const onReject = vi.fn();
    renderToolbar({
      hasPending: true,
      onAcceptAllPending: vi.fn(),
      onRejectAllPending: onReject,
    });
    fireEvent.click(screen.getByTitle('Reject all pending auto-maps'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
