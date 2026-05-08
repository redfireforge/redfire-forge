/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ColumnOrderPopover from './ColumnOrderPopover';
import type { OrderableItem } from './ColumnOrderPopover';

describe('ColumnOrderPopover', () => {
  const createItems = (): OrderableItem[] => [
    { mapping: 'userId', name: 'userId', type: 'path' },
    { mapping: 'status', name: 'status', type: 'validate' },
    { mapping: 'name', name: 'name', type: 'param' },
  ];

  const defaultProps = {
    items: createItems(),
    onApply: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    expect(screen.getByText('Column Order')).toBeInTheDocument();
  });

  it('renders all items', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    expect(screen.getByText('userId')).toBeInTheDocument();
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('shows type badges', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    expect(screen.getByText('Path')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Param')).toBeInTheDocument();
  });

  it('shows close button', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    fireEvent.click(screen.getAllByText('×')[0]);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when Cancel clicked', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onApply and onClose when Apply clicked', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    fireEvent.click(screen.getByText('Apply'));
    expect(defaultProps.onApply).toHaveBeenCalledWith(defaultProps.items);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not show quick-sort when no indexed columns', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    expect(screen.queryByText('By Index')).not.toBeInTheDocument();
    expect(screen.queryByText('By Field')).not.toBeInTheDocument();
  });

  it('shows quick-sort when indexed columns exist', () => {
    const items: OrderableItem[] = [
      { mapping: 'offers[0].code', name: 'code_0', type: 'validate' },
      { mapping: 'offers[1].code', name: 'code_1', type: 'validate' },
      { mapping: 'offers[0].name', name: 'name_0', type: 'validate' },
    ];
    render(<ColumnOrderPopover {...defaultProps} items={items} />);
    expect(screen.getByText('By Index')).toBeInTheDocument();
    expect(screen.getByText('By Field')).toBeInTheDocument();
  });

  it('sorts by index when By Index clicked', () => {
    const onApply = vi.fn();
    const items: OrderableItem[] = [
      { mapping: 'offers[1].code', name: 'code_1', type: 'validate' },
      { mapping: 'offers[0].name', name: 'name_0', type: 'validate' },
      { mapping: 'offers[0].code', name: 'code_0', type: 'validate' },
      { mapping: 'userId', name: 'userId', type: 'path' },
    ];
    render(<ColumnOrderPopover {...defaultProps} items={items} onApply={onApply} />);
    fireEvent.click(screen.getByText('By Index'));
    fireEvent.click(screen.getByText('Apply'));
    
    const applied = onApply.mock.calls[0][0] as OrderableItem[];
    expect(applied[0].type).toBe('path');
    expect(applied[1].mapping).toBe('offers[0].code');
    expect(applied[2].mapping).toBe('offers[0].name');
    expect(applied[3].mapping).toBe('offers[1].code');
  });

  it('sorts by field when By Field clicked', () => {
    const onApply = vi.fn();
    const items: OrderableItem[] = [
      { mapping: 'offers[1].code', name: 'code_1', type: 'validate' },
      { mapping: 'offers[0].name', name: 'name_0', type: 'validate' },
      { mapping: 'offers[0].code', name: 'code_0', type: 'validate' },
      { mapping: 'userId', name: 'userId', type: 'path' },
    ];
    render(<ColumnOrderPopover {...defaultProps} items={items} onApply={onApply} />);
    fireEvent.click(screen.getByText('By Field'));
    fireEvent.click(screen.getByText('Apply'));
    
    const applied = onApply.mock.calls[0][0] as OrderableItem[];
    expect(applied[0].type).toBe('path');
    expect(applied[1].mapping).toBe('offers[0].code');
    expect(applied[2].mapping).toBe('offers[1].code');
    expect(applied[3].mapping).toBe('offers[0].name');
  });

  it('supports drag and drop reordering', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    const items = screen.getAllByText('⠿');
    expect(items.length).toBe(3);
  });

  it('omits dragOver state branch when hovering the same slot twice', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    const items = screen.getAllByText('⠿').map(el => el.closest('.col-order-field-item') as HTMLElement);
    const dt = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
      files: [],
      types: [],
    } as unknown as DataTransfer;
    fireEvent.dragStart(items[1], { dataTransfer: dt });
    fireEvent.dragOver(items[1], { dataTransfer: dt, preventDefault: () => {} });
    fireEvent.dragOver(items[1], { dataTransfer: dt, preventDefault: () => {} });
    fireEvent.dragEnd(items[1]);
  });

  it('ends drag without reordering when dropped on same index', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    const items = screen.getAllByText('⠿').map(el => el.closest('.col-order-field-item') as HTMLElement);
    const dt = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
      files: [],
      types: [],
    } as unknown as DataTransfer;
    fireEvent.dragStart(items[0], { dataTransfer: dt });
    fireEvent.drop(items[0], { dataTransfer: dt, preventDefault: () => {} });
    const names = screen.getAllByText(/userId|status|name/).filter(el => el.classList.contains('col-order-field-name'));
    expect(names.map(n => n.textContent)).toEqual(['userId', 'status', 'name']);
  });

  it('does not render a type badge when type is omitted', () => {
    const items = [{ mapping: 'plain', name: 'Plain Column' }] as OrderableItem[];
    render(<ColumnOrderPopover {...defaultProps} items={items} />);
    expect(screen.queryByText('Path')).not.toBeInTheDocument();
  });

  it('applies modulo index styling classes for indexed mappings', () => {
    const items: OrderableItem[] = [{ mapping: 'offers[4].code', name: 'c4', type: 'validate' }];
    render(<ColumnOrderPopover {...defaultProps} items={items} />);
    expect(document.querySelector('.idx-0')).toBeTruthy();
  });

  it('auto-applies when autoApply is true', () => {
    const onApply = vi.fn();
    const items: OrderableItem[] = [
      { mapping: 'offers[0].code', name: 'code_0', type: 'validate' },
      { mapping: 'offers[1].code', name: 'code_1', type: 'validate' },
    ];
    render(<ColumnOrderPopover {...defaultProps} items={items} onApply={onApply} autoApply />);
    fireEvent.click(screen.getByText('By Index'));
    expect(onApply).toHaveBeenCalled();
  });

  it('shows drag-to-reorder label', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    expect(screen.getByText('Drag to reorder:')).toBeInTheDocument();
  });

  it('calls onClose when mousedown occurs outside the popover', () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <ColumnOrderPopover {...defaultProps} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not call onClose when mousedown is inside the popover', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    fireEvent.mouseDown(screen.getByText('Column Order'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('reorders rows via drag and drop', () => {
    render(<ColumnOrderPopover {...defaultProps} />);
    const items = screen.getAllByText('⠿').map(el => el.closest('.col-order-field-item') as HTMLElement);
    expect(items.length).toBe(3);
    const dt = { effectAllowed: '', dropEffect: 'move', setData: vi.fn(), preventDefault: vi.fn() };
    fireEvent.dragStart(items[0], { dataTransfer: dt as unknown as DataTransfer });
    fireEvent.dragOver(items[2], { dataTransfer: dt as unknown as DataTransfer, preventDefault: () => {} });
    fireEvent.drop(items[2], { dataTransfer: dt as unknown as DataTransfer, preventDefault: () => {} });
    const names = screen.getAllByText(/userId|status|name/).filter(el => el.classList.contains('col-order-field-name'));
    expect(names.map(n => n.textContent)).toEqual(['status', 'name', 'userId']);
  });

  it('shows Name badge for name-typed columns', () => {
    const items: OrderableItem[] = [{ mapping: 'x', name: 'Label', type: 'name' }];
    render(<ColumnOrderPopover {...defaultProps} items={items} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('falls back to raw type string for unknown type', () => {
    const items: OrderableItem[] = [{ mapping: 'x', name: 'Col', type: 'customType' }];
    render(<ColumnOrderPopover {...defaultProps} items={items} />);
    expect(screen.getByText('customType')).toBeInTheDocument();
  });
});
