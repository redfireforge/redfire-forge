/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScriptLibraryVersionPanel from './ScriptLibraryVersionPanel';
import type { ScriptLibrary, ScriptLibraryVersion } from '../../engine/scriptLibraries';

const { diffPropsSpy } = vi.hoisted(() => ({ diffPropsSpy: vi.fn() }));

vi.mock('./ScriptLibraryVersionDiff', () => ({
  default: function MockScriptLibraryVersionDiff(props: {
    onClose: () => void;
    older: ScriptLibraryVersion;
    newer: ScriptLibraryVersion;
  }) {
    diffPropsSpy(props);
    return (
      <div data-testid="script-lib-version-diff-mock">
        <button type="button" onClick={props.onClose}>Close diff view</button>
      </div>
    );
  },
}));

// Mock json-diff-kit to avoid ESM issues if diff component loads
vi.mock('json-diff-kit', () => ({
  Differ: class { diff() { return [[]]; } },
  Viewer: () => null,
}));
vi.mock('json-diff-kit/dist/viewer.css', () => ({}));
vi.mock('json-diff-kit/dist/viewer-monokai.css', () => ({}));

function makeVersion(overrides?: Partial<ScriptLibraryVersion>): ScriptLibraryVersion {
  return {
    id: 'v1',
    timestamp: Date.now() - 60000,
    changeSummary: 'code changed',
    snapshot: { name: 'Helpers', description: 'Utils', code: 'function add(a,b){return a+b}' },
    ...overrides,
  };
}

function makeLib(overrides?: Partial<ScriptLibrary>): ScriptLibrary {
  return {
    id: 'lib-1',
    name: 'Helpers',
    description: 'Utils',
    code: 'function add(a,b){return a+b}',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('ScriptLibraryVersionPanel', () => {
  const onLibraryChange = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    resetAllMocks();
    diffPropsSpy.mockClear();
  });

  it('shows empty state when no versions', () => {
    render(
      <ScriptLibraryVersionPanel
        library={makeLib()}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('No version history yet')).toBeTruthy();
  });

  it('renders version list', () => {
    const lib = makeLib({
      versions: [
        makeVersion({ id: 'v1', changeSummary: 'initial version' }),
        makeVersion({ id: 'v2', changeSummary: 'code changed (+2 lines)' }),
      ],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('initial version')).toBeTruthy();
    expect(screen.getByText('code changed (+2 lines)')).toBeTruthy();
    expect(screen.getByText('2 versions')).toBeTruthy();
  });

  it('shows library name in title', () => {
    render(
      <ScriptLibraryVersionPanel
        library={makeLib({ name: 'MyLib' })}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Version History — MyLib')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    render(
      <ScriptLibraryVersionPanel
        library={makeLib({ versions: [makeVersion()] })}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows usage tags when usages provided', () => {
    render(
      <ScriptLibraryVersionPanel
        library={makeLib()}
        onLibraryChange={onLibraryChange}
        usages={[
          { workflowId: 'wf1', workflowName: 'Auth Flow', nodeId: 'n1', nodeLabel: 'Token Script' },
        ]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Used by:')).toBeTruthy();
    expect(screen.getByText('Auth Flow › Token Script')).toBeTruthy();
  });

  it('calls onLibraryChange with restored version on Restore click', () => {
    const v = makeVersion({ id: 'v1', snapshot: { name: 'OldName', description: 'OldDesc', code: 'oldCode' } });
    const lib = makeLib({ name: 'Current', versions: [v] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('↩ Restore'));
    expect(onLibraryChange).toHaveBeenCalled();
    const result = onLibraryChange.mock.calls[0][0];
    expect(result.name).toBe('OldName');
    expect(result.description).toBe('OldDesc');
    expect(result.code).toBe('oldCode');
  });

  it('calls onLibraryChange to delete version on Delete click', () => {
    const lib = makeLib({ versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const delBtns = screen.getAllByText('✕ Delete');
    fireEvent.click(delBtns[0]);
    expect(onLibraryChange).toHaveBeenCalled();
    const result = onLibraryChange.mock.calls[0][0];
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].id).toBe('v2');
  });

  it('shows Compare button when two versions selected', () => {
    const lib = makeLib({
      versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2', timestamp: Date.now() - 120000 })],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    // No Compare button initially
    expect(screen.queryByText('Compare')).toBeNull();

    // Select both versions via checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText('Compare')).toBeTruthy();
  });

  it('shows footer version count', () => {
    const lib = makeLib({ versions: [makeVersion()] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('1 version')).toBeTruthy();
  });

  it('shows clear selection button when selection exists', () => {
    const lib = makeLib({ versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText('Clear selection')).toBeNull();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('Clear selection')).toBeTruthy();
  });

  it('opens compare view with older/newer ordered by timestamp', () => {
    const tOlder = 1_700_000_000_000;
    const tNewer = 1_700_000_060_000;
    const lib = makeLib({
      versions: [
        makeVersion({ id: 'v-newer', timestamp: tNewer, snapshot: { name: 'A', description: '', code: 'x' } }),
        makeVersion({ id: 'v-older', timestamp: tOlder, snapshot: { name: 'B', description: '', code: 'y' } }),
      ],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByTitle('Compare selected versions'));
    expect(screen.getByTestId('script-lib-version-diff-mock')).toBeTruthy();
    expect(diffPropsSpy).toHaveBeenCalledTimes(1);
    const { older, newer } = diffPropsSpy.mock.calls[0][0];
    expect(older.id).toBe('v-older');
    expect(newer.id).toBe('v-newer');
  });

  it('orders compare pair correctly when first selected id has newer timestamp', () => {
    const tOlder = 1_700_000_000_000;
    const tNewer = 1_700_000_060_000;
    const lib = makeLib({
      versions: [
        makeVersion({ id: 'v-older', timestamp: tOlder, snapshot: { name: 'B', description: '', code: 'y' } }),
        makeVersion({ id: 'v-newer', timestamp: tNewer, snapshot: { name: 'A', description: '', code: 'x' } }),
      ],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByTitle('Compare selected versions'));
    const { older, newer } = diffPropsSpy.mock.calls[0][0];
    expect(older.id).toBe('v-older');
    expect(newer.id).toBe('v-newer');
  });

  it('closes compare view and returns to list', () => {
    const lib = makeLib({
      versions: [
        makeVersion({ id: 'v1', timestamp: 1_700_000_000_000 }),
        makeVersion({ id: 'v2', timestamp: 1_700_000_060_000 }),
      ],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByTitle('Compare selected versions'));
    expect(screen.getByTestId('script-lib-version-diff-mock')).toBeTruthy();
    fireEvent.click(screen.getByText('Close diff view'));
    expect(screen.queryByTestId('script-lib-version-diff-mock')).toBeNull();
    expect(screen.getByText('Version History — Helpers')).toBeTruthy();
  });

  it('deselects a version when checkbox toggled off', () => {
    const lib = makeLib({ versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const cb = screen.getAllByRole('checkbox')[0];
    fireEvent.click(cb);
    expect(screen.getByText('Clear selection')).toBeTruthy();
    fireEvent.click(cb);
    expect(screen.queryByText('Clear selection')).toBeNull();
  });

  it('does not select more than two versions', () => {
    const lib = makeLib({
      versions: [
        makeVersion({ id: 'v1' }),
        makeVersion({ id: 'v2' }),
        makeVersion({ id: 'v3' }),
      ],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.map(b => b.checked)).toEqual([true, true, false]);
    expect(screen.getByText('Compare')).toBeTruthy();
  });

  it('clears selection from footer button', () => {
    const lib = makeLib({ versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('Clear selection')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear selection'));
    expect(screen.queryByText('Clear selection')).toBeNull();
  });

  it('toggles selection when row is clicked', () => {
    const lib = makeLib({ versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const rows = screen.getAllByRole('checkbox').map(cb => cb.closest('.script-lib-version-item')!);
    fireEvent.click(rows[0]!);
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(rows[0]!);
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(false);
  });

  it('starts rename from double-click on label and commits on blur', () => {
    const v = makeVersion({ id: 'v1', label: 'Original' });
    const lib = makeLib({ versions: [v] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.doubleClick(screen.getByText('Original'));
    const input = screen.getByPlaceholderText('Version label…');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: '  Relabeled  ' } });
    fireEvent.blur(input);
    expect(onLibraryChange).toHaveBeenCalled();
    const updated = onLibraryChange.mock.calls[0][0];
    expect(updated.versions![0].label).toBe('Relabeled');
  });

  it('starts rename with empty label when version has no label', () => {
    const lib = makeLib({
      versions: [makeVersion({ id: 'v1', label: undefined })],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTitle('Rename this version'));
    const input = screen.getByPlaceholderText('Version label…') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('commits rename on Enter and Escape closes editor without calling change', () => {
    const lib = makeLib({ versions: [makeVersion({ id: 'v1', label: 'L1' })] });
    const { rerender } = render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTitle('Rename this version'));
    const input = screen.getByPlaceholderText('Version label…');
    fireEvent.change(input, { target: { value: 'FromEnter' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onLibraryChange).toHaveBeenCalledTimes(1);
    const afterRename = onLibraryChange.mock.calls[0][0] as ScriptLibrary;
    onLibraryChange.mockClear();

    rerender(
      <ScriptLibraryVersionPanel
        library={afterRename}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTitle('Rename this version'));
    const input2 = screen.getByPlaceholderText('Version label…');
    fireEvent.change(input2, { target: { value: 'Ignored' } });
    fireEvent.keyDown(input2, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByPlaceholderText('Version label…')).toBeNull();
    expect(onLibraryChange).not.toHaveBeenCalled();
  });

  it('shows formatted timestamp when version has no label', () => {
    const ts = new Date(2026, 4, 6, 15, 30).getTime();
    const lib = makeLib({
      versions: [makeVersion({ id: 'v1', label: undefined, timestamp: ts, changeSummary: undefined })],
    });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    const expected = new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    expect(screen.getByText('1 version')).toBeTruthy();
  });

  it('treats missing versions array as empty history', () => {
    const { versions: _omit, ...rest } = makeLib();
    const libNoVers = rest as ScriptLibrary;
    render(
      <ScriptLibraryVersionPanel
        library={libNoVers}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('No version history yet')).toBeTruthy();
    expect(screen.getByText('0 versions')).toBeTruthy();
  });

  it('removes version id from selection when that version is deleted', () => {
    const lib = makeLib({ versions: [makeVersion({ id: 'v1' }), makeVersion({ id: 'v2' })] });
    render(
      <ScriptLibraryVersionPanel
        library={lib}
        onLibraryChange={onLibraryChange}
        usages={[]}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('Clear selection')).toBeTruthy();
    fireEvent.click(screen.getAllByTitle('Delete this version')[0]!);
    expect(onLibraryChange).toHaveBeenCalled();
    expect(screen.queryByText('Clear selection')).toBeNull();
  });
});
