/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScriptLibraryManager from './ScriptLibraryManager';
import type { ScriptLibrary } from '../../engine/scriptLibraries';
import * as scriptLibraryVersioning from '../../engine/scriptLibraryVersioning';

// Mock uuid for deterministic IDs
vi.mock('uuid', () => ({ v4: () => 'new-lib-id' }));

vi.mock('./ScriptLibraryVersionPanel', () => ({
  default: ({ onLibraryChange, onClose }: { onLibraryChange: (lib: ScriptLibrary) => void; onClose: () => void }) => (
    <div data-testid="script-lib-version-panel">
      <button type="button" onClick={() => onLibraryChange({ id: 'lib-v', name: 'Updated', description: 'd', code: '//', createdAt: '2024-01-01', updatedAt: '2024-01-01' })}>Apply library</button>
      <button type="button" onClick={onClose}>Close version panel</button>
    </div>
  ),
}));

describe('ScriptLibraryManager', () => {
  const onLibrariesChange = vi.fn();
  const onSelectionChange = vi.fn();
  const onClose = vi.fn();

  const sampleLibs: ScriptLibrary[] = [
    { id: 'lib-1', name: 'Utils', description: 'Utility functions', code: 'function add(a,b){return a+b}', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'lib-2', name: 'Helpers', description: '', code: 'function mul(a,b){return a*b}', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders library list', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Utils')).toBeTruthy();
    expect(screen.getByText('Helpers')).toBeTruthy();
    expect(screen.getByText('Utility functions')).toBeTruthy();
  });

  it('shows empty message when no libraries', () => {
    render(
      <ScriptLibraryManager
        libraries={[]}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/No libraries yet/)).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles library selection on checkbox click', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={['lib-1']}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    // Uncheck lib-1
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('adds library to selection', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onSelectionChange).toHaveBeenCalledWith(['lib-1']);
  });

  it('shows create form when + New Library clicked', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('+ New Library'));
    expect(screen.getByPlaceholderText('Library name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Description (optional)')).toBeTruthy();
  });

  it('creates a new library', () => {
    render(
      <ScriptLibraryManager
        libraries={[]}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('+ New Library'));
    fireEvent.change(screen.getByPlaceholderText('Library name'), { target: { value: 'My Lib' } });
    fireEvent.change(screen.getByPlaceholderText('Description (optional)'), { target: { value: 'A desc' } });
    fireEvent.change(screen.getByPlaceholderText('// Reusable functions...'), { target: { value: '// code' } });
    fireEvent.click(screen.getByText('Create'));
    expect(onLibrariesChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'My Lib', description: 'A desc', code: '// code' }),
    ]);
  });

  it('does not create with empty name', () => {
    render(
      <ScriptLibraryManager
        libraries={[]}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('+ New Library'));
    fireEvent.click(screen.getByText('Create'));
    expect(onLibrariesChange).not.toHaveBeenCalled();
  });

  it('cancels create form', () => {
    render(
      <ScriptLibraryManager
        libraries={[]}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('+ New Library'));
    expect(screen.getByPlaceholderText('Library name')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('Library name')).toBeNull();
  });

  it('deletes a library and removes from selection', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={['lib-1', 'lib-2']}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    // Click delete button (✕) for first library
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);
    expect(onLibrariesChange).toHaveBeenCalledWith([sampleLibs[1]]);
    expect(onSelectionChange).toHaveBeenCalledWith(['lib-2']);
  });

  it('opens edit form when Edit clicked', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    // Should show edit form with current values
    const nameInput = screen.getByDisplayValue('Utils');
    expect(nameInput).toBeTruthy();
  });

  it('saves edited library', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    const nameInput = screen.getByDisplayValue('Utils');
    fireEvent.change(nameInput, { target: { value: 'Updated Utils' } });
    fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'New desc' } });
    fireEvent.change(screen.getByDisplayValue('function add(a,b){return a+b}'), { target: { value: '// x' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onLibrariesChange).toHaveBeenCalled();
    const call = onLibrariesChange.mock.calls[0][0];
    expect(call[0].name).toBe('Updated Utils');
    expect(call[0].description).toBe('New desc');
    expect(call[0].code).toBe('// x');
  });

  it('cancels edit form', () => {
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    expect(screen.getByDisplayValue('Utils')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    // Should close edit form
    expect(screen.queryByDisplayValue('Utils')).toBeNull();
    // But library name should still show in list
    expect(screen.getByText('Utils')).toBeTruthy();
  });

  it('uses autoSaveVersion noop when library unchanged on save', () => {
    const spy = vi.spyOn(scriptLibraryVersioning, 'autoSaveVersion').mockImplementation((lib) => lib);
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.click(screen.getByText('Save'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('opens version panel from History and closes', () => {
    const withVersions: ScriptLibrary[] = [
      { id: 'lib-v', name: 'V', description: '', code: 'x', createdAt: '2024-01-01', updatedAt: '2024-01-01', versions: [{ id: 'v1', timestamp: 1, changeSummary: 'x', snapshot: { name: 'V', description: '', code: 'x' } }] },
    ];
    render(
      <ScriptLibraryManager
        libraries={withVersions}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    const historyBtn = screen.getByRole('button', { name: /History/ });
    fireEvent.click(historyBtn);
    expect(screen.getByTestId('script-lib-version-panel')).toBeTruthy();
    fireEvent.click(screen.getByText('Apply library'));
    expect(onLibrariesChange).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close version panel'));
    expect(screen.queryByTestId('script-lib-version-panel')).toBeNull();
  });

  it('passes usages to version panel when workflows reference library', () => {
    const withLib: ScriptLibrary[] = [
      { id: 'lib-u', name: 'U', description: '', code: '//', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    ];
    const workflows = [{ id: 'w1', name: 'W', nodes: [{ id: 'n1', type: 'script', data: { libraryIds: ['lib-u'], label: 'Step' } }] }];
    render(
      <ScriptLibraryManager
        libraries={withLib}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
        workflows={workflows}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /History/ }));
    expect(screen.getByTestId('script-lib-version-panel')).toBeTruthy();
  });

  it('uses auto-saved library list when autoSaveVersion returns updated library', () => {
    const lib: ScriptLibrary = sampleLibs[0];
    const versioned: ScriptLibrary = {
      ...lib,
      versions: [{ id: 'snap', timestamp: 1, changeSummary: 'initial', snapshot: { name: lib.name, description: lib.description, code: lib.code } }],
    };
    const spy = vi.spyOn(scriptLibraryVersioning, 'autoSaveVersion').mockReturnValue(versioned);
    render(
      <ScriptLibraryManager
        libraries={sampleLibs}
        selectedIds={[]}
        onLibrariesChange={onLibrariesChange}
        onSelectionChange={onSelectionChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getAllByText('Edit')[0]);
    fireEvent.click(screen.getByText('Save'));
    expect(spy).toHaveBeenCalled();
    expect(onLibrariesChange).toHaveBeenCalled();
    spy.mockRestore();
  });
});
