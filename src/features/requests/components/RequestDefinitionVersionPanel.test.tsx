/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestDefinitionVersionPanel from './RequestDefinitionVersionPanel';
import type { RequestDefinitionVersion, RequestDefinitionSnapshot } from '../../../shared/types';

function snapshot(overrides: Partial<RequestDefinitionSnapshot> = {}): RequestDefinitionSnapshot {
  return {
    name: 'R',
    url: '/u',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    ...overrides,
  };
}

function version(id: string, ts: number, label?: string, changeSummary?: string): RequestDefinitionVersion {
  return {
    id,
    timestamp: ts,
    label,
    changeSummary,
    snapshot: snapshot(),
  };
}

describe('RequestDefinitionVersionPanel', () => {
  const onRestore = vi.fn();
  const onDelete = vi.fn();
  const onRename = vi.fn();
  const onCompare = vi.fn();

  beforeEach(() => {
    resetAllMocks();
  });

  it('shows empty hint when versions empty', () => {
    render(
      <RequestDefinitionVersionPanel
        versions={[]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    expect(screen.getByText(/No definition history yet/)).toBeInTheDocument();
    expect(screen.getByText(/\b0 versions\b/)).toBeInTheDocument();
  });

  it('renders plural footer count when more than one version', () => {
    render(
      <RequestDefinitionVersionPanel
        versions={[version('a', 1), version('b', 2)]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    expect(screen.getByText('2 versions')).toBeInTheDocument();
  });

  it('caps selection at two and invokes compare ordered by timestamp', () => {
    const vOld = version('old', 1000);
    const vMid = version('mid', 2000);
    const vNew = version('new', 3000);
    render(
      <RequestDefinitionVersionPanel
        versions={[vNew, vMid, vOld]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    const compareBtns = screen.getAllByText('Compare');
    expect(compareBtns.length).toBeGreaterThan(0);
    fireEvent.click(compareBtns[0]);
    expect(onCompare).toHaveBeenCalledWith(vMid, vNew);
  });

  it('restore and delete propagate without bubbling row toggle quirks', () => {
    const v = version('v1', Date.now(), 'L1');
    render(
      <RequestDefinitionVersionPanel
        versions={[v]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    fireEvent.click(screen.getByTitle('Restore this version'));
    expect(onRestore).toHaveBeenCalledWith(v);
    fireEvent.click(screen.getByTitle('Delete this version'));
    expect(onDelete).toHaveBeenCalledWith('v1');
  });

  it('finishes rename on blur when label non-empty', () => {
    const v = version('vx', Date.now(), 'Old');
    render(
      <RequestDefinitionVersionPanel
        versions={[v]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    fireEvent.click(screen.getByTitle('Rename this version'));
    const input = screen.getByPlaceholderText(/Version label/);
    fireEvent.change(input, { target: { value: '  NewLbl  ' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('vx', 'NewLbl');
  });

  it('Escape aborts rename without notifying consumers', () => {
    const v = version('esc', Date.now(), 'Stable');
    render(
      <RequestDefinitionVersionPanel
        versions={[v]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    fireEvent.click(screen.getByTitle('Rename this version'));
    const input = screen.getByPlaceholderText(/Version label/);
    fireEvent.change(input, { target: { value: 'Draft' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('double-clicking labels enters edit mode', () => {
    const v = version('dbl', Date.now(), 'Lbl');
    const { container } = render(
      <RequestDefinitionVersionPanel
        versions={[v]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    const labelSpan = container.querySelector('.test-def-version-item-label');
    expect(labelSpan).toBeTruthy();
    fireEvent.doubleClick(labelSpan!);
    expect(screen.getByPlaceholderText(/Version label/)).toBeInTheDocument();
  });

  it('renders singular version grammar in footer', () => {
    render(
      <RequestDefinitionVersionPanel
        versions={[version('solo', Date.now())]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    expect(screen.getByText(/1 version/)).toBeInTheDocument();
  });

  it('shows change summary row when provided', () => {
    render(
      <RequestDefinitionVersionPanel
        versions={[version('id', Date.now(), 'x', 'body modified')]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    expect(screen.getByText('body modified')).toBeInTheDocument();
  });

  it('clear selection resets toolbar', () => {
    render(
      <RequestDefinitionVersionPanel
        versions={[version('a', 1), version('b', 2)]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByText('Clear selection'));
    expect(screen.queryByText('Compare')).not.toBeInTheDocument();
  });

  it('blur without trimming rename text avoids calling consumers', () => {
    const v = version('ws', Date.now(), 'Keep');
    render(
      <RequestDefinitionVersionPanel
        versions={[v]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    fireEvent.click(screen.getByTitle('Rename this version'));
    const input = screen.getByPlaceholderText(/Version label/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
  });

  it('commits rename from Enter identical to blur', () => {
    const v = version('ent', Date.now(), 'Lbl');
    render(
      <RequestDefinitionVersionPanel
        versions={[v]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    fireEvent.click(screen.getByTitle('Rename this version'));
    const input = screen.getByPlaceholderText(/Version label/);
    fireEvent.change(input, { target: { value: 'Entered' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('ent', 'Entered');
  });

  it('deselects a chosen row via checkbox toggle', () => {
    render(
      <RequestDefinitionVersionPanel
        versions={[version('solo', Date.now()), version('another', Date.now() + 1)]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    const box = screen.getAllByRole('checkbox')[0];
    fireEvent.click(box);
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).not.toBeChecked();
  });

  it('shows formatted timestamp fallback when labels missing', () => {
    const { container } = render(
      <RequestDefinitionVersionPanel
        versions={[{ ...version('bare', Date.UTC(2023, 10, 15, 14, 30)), label: undefined }]}
        currentSnapshot={snapshot()}
        onRestore={onRestore}
        onDelete={onDelete}
        onRename={onRename}
        onCompare={onCompare}
      />,
    );
    const labelEl = container.querySelector('.test-def-version-item-label');
    expect(labelEl?.textContent).toMatch(/\bNov\b|\b15\b|\b2023\b|\bPM\b|\bAM\b/);
  });
});
