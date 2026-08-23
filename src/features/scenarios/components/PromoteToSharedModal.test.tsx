/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PromoteToSharedModal from './PromoteToSharedModal';
import { DataSource } from '@shared/types';

vi.mock('../../../shared/components/PopupModal', () => ({
  default: ({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void }) => (
    <div data-testid="popup-modal">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      <div data-testid="modal-footer">{footer}</div>
      <button data-testid="close-x" onClick={onClose}>X</button>
    </div>
  ),
}));

const createMockDataSource = (overrides: Partial<DataSource> = {}): DataSource => ({
  columns: [
    { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
    { id: 'c2', name: 'status', type: 'validate', mapping: 'status' },
  ],
  rows: [
    { id: 'r1', values: { c1: '1', c2: 'active' }, enabled: true },
    { id: 'r2', values: { c1: '2', c2: 'inactive' }, enabled: false },
  ],
  source: { type: 'inline' },
  urlTemplate: 'https://api.example.com/users/{{userId}}',
  ...overrides,
});

describe('PromoteToSharedModal', () => {
  const defaultProps = {
    dataSource: createMockDataSource(),
    testName: 'My Test',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders modal with title', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Promote to Shared Data Source');
  });

  it('pre-fills name from test name', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    const nameInput = screen.getByDisplayValue('My Test Data');
    expect(nameInput).toBeInTheDocument();
  });

  it('shows preview with column info', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    expect(screen.getByText(/userId, status/)).toBeInTheDocument();
  });

  it('shows data row count', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    expect(screen.getByText(/2 total/)).toBeInTheDocument();
    expect(screen.getByText(/1 enabled/)).toBeInTheDocument();
  });

  it('shows URL template', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    expect(screen.getByText('https://api.example.com/users/{{userId}}')).toBeInTheDocument();
  });

  it('shows validate column count', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    expect(screen.getByText(/1 validate column/)).toBeInTheDocument();
  });

  it('allows editing name', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    const input = screen.getByDisplayValue('My Test Data');
    fireEvent.change(input, { target: { value: 'Custom Name' } });
    expect(screen.getByDisplayValue('Custom Name')).toBeInTheDocument();
  });

  it('disables confirm when name is empty', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    const input = screen.getByDisplayValue('My Test Data');
    fireEvent.change(input, { target: { value: '' } });
    const promoteBtn = screen.getByText('⬆ Promote & Link');
    expect(promoteBtn).toBeDisabled();
  });

  it('calls onConfirm with name when clicked', () => {
    const onConfirm = vi.fn();
    render(<PromoteToSharedModal {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('⬆ Promote & Link'));
    expect(onConfirm).toHaveBeenCalledWith('My Test Data', undefined);
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn();
    render(<PromoteToSharedModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('adds tags', () => {
    const onConfirm = vi.fn();
    render(<PromoteToSharedModal {...defaultProps} onConfirm={onConfirm} />);
    
    const tagInput = screen.getByPlaceholderText('Add tag...');
    fireEvent.change(tagInput, { target: { value: 'regression' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    
    expect(screen.getByText('regression')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('⬆ Promote & Link'));
    expect(onConfirm).toHaveBeenCalledWith('My Test Data', ['regression']);
  });

  it('removes tags', () => {
    const onConfirm = vi.fn();
    render(<PromoteToSharedModal {...defaultProps} onConfirm={onConfirm} />);
    
    const tagInput = screen.getByPlaceholderText('Add tag...');
    fireEvent.change(tagInput, { target: { value: 'test' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    
    expect(screen.getByText('test')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('×'));
    
    fireEvent.click(screen.getByText('⬆ Promote & Link'));
    expect(onConfirm).toHaveBeenCalledWith('My Test Data', undefined);
  });

  it('deduplicates tags', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    
    const tagInput = screen.getByPlaceholderText('Add tag...');
    fireEvent.change(tagInput, { target: { value: 'dup' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.change(tagInput, { target: { value: 'dup' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    
    expect(screen.getAllByText('dup')).toHaveLength(1);
  });

  it('adds tag on blur', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    
    const tagInput = screen.getByPlaceholderText('Add tag...');
    fireEvent.change(tagInput, { target: { value: 'blurred' } });
    fireEvent.blur(tagInput);
    
    expect(screen.getByText('blurred')).toBeInTheDocument();
  });

  it('shows info about promotion', () => {
    render(<PromoteToSharedModal {...defaultProps} />);
    expect(screen.getByText(/linked to the new shared data source/)).toBeInTheDocument();
    expect(screen.getByText(/Inline data will be removed/)).toBeInTheDocument();
  });

  it('handles data source without URL template', () => {
    render(<PromoteToSharedModal {...defaultProps} dataSource={createMockDataSource({ urlTemplate: undefined })} />);
    expect(screen.queryByText(/URL template/)).not.toBeInTheDocument();
  });

  it('handles data source without validate columns', () => {
    const ds = createMockDataSource({
      columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
    });
    render(<PromoteToSharedModal {...defaultProps} dataSource={ds} />);
    expect(screen.queryByText(/validate column/)).not.toBeInTheDocument();
  });

  it('uses empty defaults when columns and rows are undefined', () => {
    const emptyLists = {
      columns: undefined,
      rows: undefined,
      source: { type: 'inline' as const },
    } as unknown as DataSource;
    render(<PromoteToSharedModal {...defaultProps} dataSource={emptyLists} />);
    const previewSection = screen.getByText('Columns:').closest('.popup-modal-preview')!;
    expect(previewSection.textContent).toContain('Columns:');
    expect(previewSection.textContent).toContain('0');
    expect(previewSection.textContent).toContain('none');
  });

  it('uses plural wording for multiple validate columns', () => {
    const ds = createMockDataSource({
      columns: [
        { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
        { id: 'c2', name: 'a', type: 'validate', mapping: '$.a' },
        { id: 'c3', name: 'b', type: 'validate', mapping: '$.b' },
      ],
    });
    render(<PromoteToSharedModal {...defaultProps} dataSource={ds} />);
    expect(screen.getByText(/2 validate columns/)).toBeInTheDocument();
  });

  it('omits disabled-row suffix when every row is enabled', () => {
    const ds = createMockDataSource({
      rows: [
        { id: 'r1', values: { c1: '1', c2: 'a' }, enabled: true },
        { id: 'r2', values: { c1: '2', c2: 'b' }, enabled: undefined },
      ],
    });
    render(<PromoteToSharedModal {...defaultProps} dataSource={ds} />);
    expect(screen.getByText(/2 total/)).toBeInTheDocument();
    expect(screen.queryByText(/disabled/)).not.toBeInTheDocument();
  });

});
