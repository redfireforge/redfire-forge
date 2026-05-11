/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import MapperToolbar from './MapperToolbar';

vi.mock('./utils/mappingProfiles', () => ({
  loadProfiles: vi.fn(() => Promise.resolve([
    { id: 'p1', name: 'Profile A', mappings: [{ id: 'm1', sourceId: 's', sourcePath: 'a', targetPath: 'b' }] },
    { id: 'p2', name: 'Profile B', mappings: [] },
  ])),
  saveProfile: vi.fn(() => Promise.resolve({ id: 'p-new', name: 'New', mappings: [] })),
  deleteProfile: vi.fn(() => Promise.resolve(true)),
  renameProfile: vi.fn(() => Promise.resolve(true)),
}));

import { loadProfiles, saveProfile, deleteProfile, renameProfile } from './utils/mappingProfiles';

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

function renderWithProfiles(overrides?: Partial<Parameters<typeof MapperToolbar>[0]>) {
  return renderToolbar({
    contextId: 'ctx-1',
    mappings: [{ id: 'm1', sourceId: 's', sourcePath: 'x', targetPath: 'y' }],
    onLoadProfile: vi.fn(),
    mappingCount: 1,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe('profiles menu', () => {
  async function openMenu() {
    await act(async () => {
      fireEvent.click(screen.getByTitle('Mapping profiles'));
    });
  }

  it('shows Profiles button when contextId, mappings, and onLoadProfile are provided', () => {
    renderWithProfiles();
    expect(screen.getByTitle('Mapping profiles')).toBeTruthy();
  });

  it('does not show Profiles button when contextId is missing', () => {
    renderToolbar({ mappings: [{ id: 'm1', sourceId: 's', sourcePath: 'x', targetPath: 'y' }], onLoadProfile: vi.fn() });
    expect(screen.queryByText(/Profiles/)).toBeNull();
  });

  it('opens and closes profile menu', async () => {
    renderWithProfiles();
    expect(screen.queryByPlaceholderText('Profile name…')).toBeNull();
    await openMenu();
    expect(screen.getByPlaceholderText('Profile name…')).toBeTruthy();
    await openMenu();
    expect(screen.queryByPlaceholderText('Profile name…')).toBeNull();
  });

  it('lists existing profiles', async () => {
    renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getByText('Profile A')).toBeTruthy());
    expect(screen.getByText('Profile B')).toBeTruthy();
  });

  it('calls saveProfile when Save clicked with name', async () => {
    renderWithProfiles();
    await openMenu();
    const input = screen.getByPlaceholderText('Profile name…');
    fireEvent.change(input, { target: { value: 'New Profile' } });
    await act(async () => { fireEvent.click(screen.getByText('Save')); });
    expect(saveProfile).toHaveBeenCalledWith('ctx-1', 'New Profile', expect.any(Array));
  });

  it('Save button is disabled when name is empty', async () => {
    renderWithProfiles();
    await openMenu();
    const saveBtn = screen.getByText('Save').closest('button');
    expect(saveBtn?.disabled).toBe(true);
  });

  it('calls saveProfile on Enter key in name input', async () => {
    renderWithProfiles();
    await openMenu();
    const input = screen.getByPlaceholderText('Profile name…');
    fireEvent.change(input, { target: { value: 'Enter Profile' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(saveProfile).toHaveBeenCalled();
  });

  it('calls onLoadProfile when profile name clicked', async () => {
    const { props } = renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getByText('Profile A')).toBeTruthy());
    fireEvent.click(screen.getByText('Profile A'));
    expect(props.onLoadProfile).toHaveBeenCalledWith([{ id: 'm1', sourceId: 's', sourcePath: 'a', targetPath: 'b' }]);
  });

  it('calls deleteProfile when delete button clicked', async () => {
    renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getAllByTitle('Delete').length).toBeGreaterThan(0));
    await act(async () => { fireEvent.click(screen.getAllByTitle('Delete')[0]); });
    expect(deleteProfile).toHaveBeenCalledWith('ctx-1', 'p1');
  });

  it('enters rename mode when rename button clicked', async () => {
    renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getAllByTitle('Rename').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTitle('Rename')[0]);
    const renameInput = screen.getByDisplayValue('Profile A');
    expect(renameInput).toBeTruthy();
  });

  it('calls renameProfile on Enter in rename input', async () => {
    renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getAllByTitle('Rename').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTitle('Rename')[0]);
    const renameInput = screen.getByDisplayValue('Profile A');
    fireEvent.change(renameInput, { target: { value: 'Renamed' } });
    await act(async () => { fireEvent.keyDown(renameInput, { key: 'Enter' }); });
    expect(renameProfile).toHaveBeenCalledWith('ctx-1', 'p1', 'Renamed');
  });

  it('cancels rename on Escape', async () => {
    renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getAllByTitle('Rename').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTitle('Rename')[0]);
    const renameInput = screen.getByDisplayValue('Profile A');
    fireEvent.keyDown(renameInput, { key: 'Escape' });
    expect(screen.getByText('Profile A')).toBeTruthy();
  });

  it('exits rename mode on blur', async () => {
    renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getAllByTitle('Rename').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTitle('Rename')[0]);
    const renameInput = screen.getByDisplayValue('Profile A');
    await act(async () => { fireEvent.blur(renameInput); });
    expect(renameProfile).toHaveBeenCalled();
  });

  it('closes menu on outside click', async () => {
    renderWithProfiles();
    await openMenu();
    expect(screen.getByPlaceholderText('Profile name…')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText('Profile name…')).toBeNull();
  });

  it('shows "No saved profiles" when list is empty', async () => {
    vi.mocked(loadProfiles).mockReturnValue(Promise.resolve([]));
    renderWithProfiles();
    await openMenu();
    await waitFor(() => expect(screen.getByText('No saved profiles')).toBeTruthy());
  });
});

describe('code view toggle', () => {
  it('shows Code button when onToggleCodeView provided', () => {
    renderToolbar({ onToggleCodeView: vi.fn() });
    expect(screen.getByTitle('Show code view')).toBeTruthy();
  });

  it('hides Code button when onToggleCodeView not provided', () => {
    renderToolbar();
    expect(screen.queryByText(/Code/)).toBeNull();
  });

  it('calls onToggleCodeView when clicked', () => {
    const onToggle = vi.fn();
    renderToolbar({ onToggleCodeView: onToggle });
    fireEvent.click(screen.getByTitle('Show code view'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows active style and "Hide code view" title when active', () => {
    renderToolbar({ onToggleCodeView: vi.fn(), showCodeView: true });
    const btn = screen.getByTitle('Hide code view');
    expect(btn.className).toContain('dm-toolbar-btn--active');
  });
});

describe('debug mode toggle', () => {
  it('shows Debug button when hasTraceData and onToggleDebugMode provided', () => {
    renderToolbar({ hasTraceData: true, onToggleDebugMode: vi.fn(), debugMode: false });
    expect(screen.getByText(/Debug/)).toBeTruthy();
  });

  it('hides Debug button when no trace data', () => {
    renderToolbar({ hasTraceData: false, onToggleDebugMode: vi.fn() });
    expect(screen.queryByText(/Debug/)).toBeNull();
  });

  it('hides Debug button when no toggle callback', () => {
    renderToolbar({ hasTraceData: true });
    expect(screen.queryByText(/Debug/)).toBeNull();
  });

  it('calls onToggleDebugMode when clicked', () => {
    const onToggle = vi.fn();
    renderToolbar({ hasTraceData: true, onToggleDebugMode: onToggle, debugMode: false });
    fireEvent.click(screen.getByTitle('Show runtime data flow'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows active style when debugMode is true', () => {
    renderToolbar({ hasTraceData: true, onToggleDebugMode: vi.fn(), debugMode: true });
    const btn = screen.getByTitle('Exit debug overlay');
    expect(btn.className).toContain('dm-toolbar-btn--active');
  });

  it('shows error count badge when traceErrorCount > 0', () => {
    renderToolbar({
      hasTraceData: true,
      onToggleDebugMode: vi.fn(),
      debugMode: false,
      traceErrorCount: 3,
    });
    const badge = screen.getByText('3');
    expect(badge.className).toContain('dm-toolbar-badge--error');
  });

  it('hides error count badge when traceErrorCount is 0', () => {
    const { container } = renderToolbar({
      hasTraceData: true,
      onToggleDebugMode: vi.fn(),
      debugMode: false,
      traceErrorCount: 0,
    });
    expect(container.querySelector('.dm-toolbar-badge--error')).toBeNull();
  });
});

describe('samples menu', () => {
  it('shows Samples button when onLoadGallerySample is provided', () => {
    renderToolbar({ onLoadGallerySample: vi.fn() });
    expect(screen.getByText(/Samples/)).toBeTruthy();
  });

  it('does not show Samples button when onLoadGallerySample is not provided', () => {
    renderToolbar();
    expect(screen.queryByText(/Samples/)).toBeNull();
  });

  it('opens and closes samples menu', () => {
    renderToolbar({ onLoadGallerySample: vi.fn() });
    const samplesBtn = screen.getByTitle('Load a gallery sample');
    expect(document.querySelector('.dm-samples-menu')).toBeNull();
    fireEvent.click(samplesBtn);
    expect(document.querySelector('.dm-samples-menu')).toBeTruthy();
    fireEvent.click(samplesBtn);
    expect(document.querySelector('.dm-samples-menu')).toBeNull();
  });

  it('calls onLoadGallerySample when a sample is clicked', () => {
    const onLoad = vi.fn();
    renderToolbar({ onLoadGallerySample: onLoad });
    fireEvent.click(screen.getByTitle('Load a gallery sample'));
    const sampleItems = document.querySelectorAll('.dm-sample-item');
    expect(sampleItems.length).toBeGreaterThan(0);
    fireEvent.click(sampleItems[0]);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('closes samples menu after selecting a sample', () => {
    renderToolbar({ onLoadGallerySample: vi.fn() });
    fireEvent.click(screen.getByTitle('Load a gallery sample'));
    expect(document.querySelector('.dm-samples-menu')).toBeTruthy();
    const sampleItems = document.querySelectorAll('.dm-sample-item');
    fireEvent.click(sampleItems[0]);
    expect(document.querySelector('.dm-samples-menu')).toBeNull();
  });

  it('closes samples menu on outside click', () => {
    renderToolbar({ onLoadGallerySample: vi.fn() });
    fireEvent.click(screen.getByTitle('Load a gallery sample'));
    expect(document.querySelector('.dm-samples-menu')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('.dm-samples-menu')).toBeNull();
  });

  it('shows difficulty badges on sample items', () => {
    renderToolbar({ onLoadGallerySample: vi.fn() });
    fireEvent.click(screen.getByTitle('Load a gallery sample'));
    const diffBadges = document.querySelectorAll('.dm-sample-difficulty');
    expect(diffBadges.length).toBeGreaterThan(0);
  });
});
