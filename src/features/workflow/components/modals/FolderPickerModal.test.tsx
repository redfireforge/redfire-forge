/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FolderPickerModal from './FolderPickerModal';
import type { WorkflowFolder } from '../../types/workflow';

const folders: WorkflowFolder[] = [
  { id: 'f1', name: 'API Tests', order: 0 },
  { id: 'f2', name: 'Load Tests', order: 1 },
  { id: 'f3', name: 'Stress', parentId: 'f2', order: 0 },
];

describe('FolderPickerModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <FolderPickerModal open={false} folders={folders} onPick={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('.fp-dialog')).toBeNull();
  });

  it('renders folder tree when open', () => {
    render(<FolderPickerModal open={true} folders={folders} onPick={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Workflows (root)')).toBeInTheDocument();
    expect(screen.getByText('API Tests')).toBeInTheDocument();
    expect(screen.getByText('Load Tests')).toBeInTheDocument();
    expect(screen.getByText('Stress')).toBeInTheDocument();
  });

  it('shows custom title', () => {
    render(<FolderPickerModal open={true} folders={folders} title="Save To..." onPick={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Save To...')).toBeInTheDocument();
  });

  it('selects Workflows (root) by default and confirms with null', () => {
    const onPick = vi.fn();
    render(<FolderPickerModal open={true} folders={folders} onPick={onPick} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Move Here'));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('re-selects Workflows root after choosing a folder', () => {
    const onPick = vi.fn();
    render(<FolderPickerModal open={true} folders={folders} onPick={onPick} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('API Tests'));
    fireEvent.click(screen.getByText('Workflows (root)'));
    fireEvent.click(screen.getByText('Move Here'));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('selects a folder and confirms with its id', () => {
    const onPick = vi.fn();
    render(<FolderPickerModal open={true} folders={folders} onPick={onPick} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('API Tests'));
    fireEvent.click(screen.getByText('Move Here'));
    expect(onPick).toHaveBeenCalledWith('f1');
  });

  it('selects a nested folder', () => {
    const onPick = vi.fn();
    render(<FolderPickerModal open={true} folders={folders} onPick={onPick} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Stress'));
    fireEvent.click(screen.getByText('Move Here'));
    expect(onPick).toHaveBeenCalledWith('f3');
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<FolderPickerModal open={true} folders={folders} onPick={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when backdrop is clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(<FolderPickerModal open={true} folders={folders} onPick={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(container.querySelector('.fp-backdrop')!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when close button is clicked', () => {
    const onCancel = vi.fn();
    render(<FolderPickerModal open={true} folders={folders} onPick={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('highlights selected row', () => {
    const { container } = render(<FolderPickerModal open={true} folders={folders} onPick={vi.fn()} onCancel={vi.fn()} />);
    expect(container.querySelector('.fp-row-selected')?.textContent).toContain('Workflows');
    fireEvent.click(screen.getByText('Load Tests'));
    const selectedRows = container.querySelectorAll('.fp-row-selected');
    expect(selectedRows.length).toBe(1);
    expect(selectedRows[0].textContent).toContain('Load Tests');
  });

  it('toggles expand/collapse on child folders', () => {
    const { container } = render(<FolderPickerModal open={true} folders={folders} onPick={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Stress')).toBeInTheDocument();
    const expandArrow = container.querySelector('.fp-row-expand');
    expect(expandArrow).toBeTruthy();
    fireEvent.click(expandArrow!);
    expect(screen.queryByText('Stress')).toBeNull();
    fireEvent.click(expandArrow!);
    expect(screen.getByText('Stress')).toBeInTheDocument();
  });

  it('renders with empty folders', () => {
    render(<FolderPickerModal open={true} folders={[]} onPick={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Workflows (root)')).toBeInTheDocument();
  });
});
