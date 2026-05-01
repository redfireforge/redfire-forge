/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestDefinitionVersionPanel from './TestDefinitionVersionPanel';
import type { TestDefinitionVersion, TestDefinitionSnapshot } from '../../../shared/types';

const mkSnapshot = (overrides?: Partial<TestDefinitionSnapshot>): TestDefinitionSnapshot => ({
  name: 'Test API',
  url: 'https://api.example.com',
  method: 'GET',
  headers: [],
  body: '',
  auth: { type: 'none' },
  ...overrides,
});

const mkVersion = (id: string, ts: number, overrides?: Partial<TestDefinitionVersion>): TestDefinitionVersion => ({
  id,
  timestamp: ts,
  snapshot: mkSnapshot(),
  ...overrides,
});

describe('TestDefinitionVersionPanel', () => {
  const defaultProps = {
    versions: [] as TestDefinitionVersion[],
    currentSnapshot: mkSnapshot(),
    onRestore: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onCompare: vi.fn(),
  };

  it('renders empty state when no versions', () => {
    render(<TestDefinitionVersionPanel {...defaultProps} />);
    expect(screen.getByText(/no definition history/i)).toBeTruthy();
  });

  it('renders version items', () => {
    const versions = [
      mkVersion('v1', Date.now() - 60000, { label: 'First save' }),
      mkVersion('v2', Date.now(), { label: 'Second save' }),
    ];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} />);
    expect(screen.getByText('First save')).toBeTruthy();
    expect(screen.getByText('Second save')).toBeTruthy();
  });

  it('shows compare button when 2 versions selected', () => {
    const versions = [
      mkVersion('v1', Date.now() - 60000),
      mkVersion('v2', Date.now()),
    ];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText('Compare')).toBeTruthy();
  });

  it('limits selection to 2 versions', () => {
    const versions = [
      mkVersion('v1', Date.now() - 120000),
      mkVersion('v2', Date.now() - 60000),
      mkVersion('v3', Date.now()),
    ];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]); // should not select third
    // Third checkbox should not be checked
    expect((checkboxes[2] as HTMLInputElement).checked).toBe(false);
  });

  it('calls onRestore when restore button clicked', () => {
    const onRestore = vi.fn();
    const versions = [mkVersion('v1', Date.now())];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} onRestore={onRestore} />);
    const restoreBtn = screen.getByTitle('Restore this version');
    fireEvent.click(restoreBtn);
    expect(onRestore).toHaveBeenCalledWith(versions[0]);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    const versions = [mkVersion('v1', Date.now())];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} onDelete={onDelete} />);
    const deleteBtn = screen.getByTitle('Delete this version');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('v1');
  });

  it('calls onCompare with older and newer versions in correct order', () => {
    const onCompare = vi.fn();
    const versions = [
      mkVersion('v1', 1000),
      mkVersion('v2', 2000),
    ];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} onCompare={onCompare} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Compare'));
    expect(onCompare).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'v1' }),
      expect.objectContaining({ id: 'v2' }),
    );
  });

  it('shows rename input on double-click label', () => {
    const versions = [mkVersion('v1', Date.now(), { label: 'My Version' })];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} />);
    const label = screen.getByText('My Version');
    fireEvent.doubleClick(label);
    const input = screen.getByDisplayValue('My Version');
    expect(input).toBeTruthy();
  });

  it('calls onRename when rename input is submitted', () => {
    const onRename = vi.fn();
    const versions = [mkVersion('v1', Date.now(), { label: 'Old Name' })];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} onRename={onRename} />);
    fireEvent.doubleClick(screen.getByText('Old Name'));
    const input = screen.getByDisplayValue('Old Name');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('v1', 'New Name');
  });

  it('shows version count in footer', () => {
    const versions = [mkVersion('v1', Date.now()), mkVersion('v2', Date.now() - 1000)];
    render(<TestDefinitionVersionPanel {...defaultProps} versions={versions} />);
    expect(screen.getByText(/2 version/i)).toBeTruthy();
  });
});
