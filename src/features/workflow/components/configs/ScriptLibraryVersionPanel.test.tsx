/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScriptLibraryVersionPanel from './ScriptLibraryVersionPanel';
import type { ScriptLibrary, ScriptLibraryVersion } from '../../engine/scriptLibraries';

// Mock json-diff-kit to avoid ESM issues in test
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
    vi.clearAllMocks();
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
    fireEvent.click(screen.getByLabelText('Close'));
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
});
