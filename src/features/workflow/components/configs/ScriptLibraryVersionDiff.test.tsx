/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScriptLibraryVersionDiff from './ScriptLibraryVersionDiff';
import type { ScriptLibraryVersion } from '../../engine/scriptLibraries';
import type { ScriptLibraryDiffResult } from '../../engine/scriptLibraryVersioning';

// Mock json-diff-kit
vi.mock('json-diff-kit', () => ({
  Differ: class { diff() { return [[]]; } },
  Viewer: () => <div data-testid="diff-viewer">json-diff-viewer</div>,
}));
vi.mock('json-diff-kit/dist/viewer.css', () => ({}));
vi.mock('json-diff-kit/dist/viewer-monokai.css', () => ({}));

const makeVersion = (overrides?: Partial<ScriptLibraryVersion>): ScriptLibraryVersion => ({
  id: 'v1',
  timestamp: new Date('2026-03-15T10:30:00').getTime(),
  changeSummary: 'code changed',
  snapshot: { name: 'Lib', description: 'Desc', code: 'code' },
  ...overrides,
});

const baseDiff: ScriptLibraryDiffResult = {
  nameChanged: false,
  descriptionChanged: false,
  codeChanged: false,
  oldName: 'Lib',
  newName: 'Lib',
  oldDescription: 'Desc',
  newDescription: 'Desc',
  oldCode: 'code',
  newCode: 'code',
};

describe('ScriptLibraryVersionDiff', () => {
  const onClose = vi.fn();
  const older = makeVersion({ id: 'v1', label: 'v1.0' });
  const newer = makeVersion({ id: 'v2', label: 'v2.0', timestamp: Date.now() });

  it('renders header with version labels', () => {
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={baseDiff} onClose={onClose} />);
    expect(screen.getByText('Script Library Comparison')).toBeTruthy();
    expect(screen.getByText('v1.0 → v2.0')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={baseDiff} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Overview and Code tabs', () => {
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={baseDiff} onClose={onClose} />);
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Code')).toBeTruthy();
  });

  it('shows no metadata changes message when nothing changed', () => {
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={baseDiff} onClose={onClose} />);
    expect(screen.getByText('No metadata changes — code may differ.')).toBeTruthy();
  });

  it('shows name change on overview tab', () => {
    const diff: ScriptLibraryDiffResult = { ...baseDiff, nameChanged: true, oldName: 'OldLib', newName: 'NewLib' };
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={diff} onClose={onClose} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('OldLib')).toBeTruthy();
    expect(screen.getByText('NewLib')).toBeTruthy();
  });

  it('shows description change on overview tab', () => {
    const diff: ScriptLibraryDiffResult = { ...baseDiff, descriptionChanged: true, oldDescription: '', newDescription: 'New desc' };
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={diff} onClose={onClose} />);
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('(empty)')).toBeTruthy();
    expect(screen.getByText('New desc')).toBeTruthy();
  });

  it('shows code identical message on code tab when no code change', () => {
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={baseDiff} onClose={onClose} />);
    fireEvent.click(screen.getByText('Code'));
    expect(screen.getByText('Code is identical.')).toBeTruthy();
  });

  it('renders diff viewer on code tab when code changed', () => {
    const diff: ScriptLibraryDiffResult = { ...baseDiff, codeChanged: true, oldCode: 'old', newCode: 'new' };
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={diff} onClose={onClose} />);
    fireEvent.click(screen.getByText('Code'));
    expect(screen.getByTestId('diff-viewer')).toBeTruthy();
  });

  it('shows badge counts for changed fields', () => {
    const diff: ScriptLibraryDiffResult = { ...baseDiff, nameChanged: true, descriptionChanged: true, codeChanged: true };
    render(<ScriptLibraryVersionDiff older={older} newer={newer} diff={diff} onClose={onClose} />);
    // Overview tab badge should show 2 (name + description)
    const badges = document.querySelectorAll('.script-lib-diff-tab-badge');
    expect(badges[0].textContent).toBe('2');
    expect(badges[1].textContent).toBe('1');
  });
});
