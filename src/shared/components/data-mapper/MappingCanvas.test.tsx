/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import MappingCanvas from './MappingCanvas';
import type { ConnectionLine } from './hooks/useConnectionLines';

const line: ConnectionLine = {
  id: 'line-m1',
  mappingId: 'm1',
  sourcePath: 'name',
  targetPath: 'userName',
  sourceY: 50,
  targetY: 80,
  hasExpression: false,
  isAutoMapped: false,
};

const defaults = {
  width: 100,
  height: 200,
  selectedMappingId: null as string | null,
  onSelectMapping: vi.fn(),
  onRemoveMapping: vi.fn(),
};

describe('MappingCanvas', () => {
  it('renders nothing when no lines and height is 0', () => {
    const { container } = render(<MappingCanvas lines={[]} {...defaults} height={0} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders SVG with connection lines', () => {
    const { container } = render(<MappingCanvas lines={[line]} {...defaults} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeTruthy();
    expect(svg.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
  });

  it('adds selected class when mapping is selected', () => {
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} selectedMappingId="m1" />,
    );
    expect(container.querySelector('.dm-connection-line--selected')).toBeTruthy();
  });

  it('dims unselected lines when one is selected', () => {
    const line2: ConnectionLine = { ...line, id: 'line-m2', mappingId: 'm2', sourceY: 100, targetY: 120 };
    const { container } = render(
      <MappingCanvas lines={[line, line2]} {...defaults} selectedMappingId="m1" />,
    );
    expect(container.querySelector('.dm-connection-line--dimmed')).toBeTruthy();
  });

  it('shows remove button for selected mapping', () => {
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} selectedMappingId="m1" />,
    );
    expect(container.querySelector('.dm-remove-btn')).toBeTruthy();
  });

  it('does not show remove button when nothing selected', () => {
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} />,
    );
    expect(container.querySelector('.dm-remove-btn')).toBeNull();
  });

  it('shows expression badge for expression mappings', () => {
    const exprLine = { ...line, hasExpression: true };
    const { container } = render(
      <MappingCanvas lines={[exprLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-expression-badge')).toBeTruthy();
    expect(container.querySelector('.dm-expression-badge')!.textContent).toBe('fx');
  });

  it('fires onEditExpression when expression badge is clicked', () => {
    const exprLine = { ...line, hasExpression: true };
    const onEdit = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[exprLine]} {...defaults} onEditExpression={onEdit} />,
    );
    const badge = container.querySelector('.dm-expression-badge')!;
    badge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onEdit).toHaveBeenCalledWith('m1');
  });

  it('hides remove button when selected line is pending', () => {
    const pendingSelected: ConnectionLine = { ...line, isPending: true };
    const { container } = render(
      <MappingCanvas lines={[pendingSelected]} {...defaults} selectedMappingId="m1" onAcceptPending={vi.fn()} onRejectPending={vi.fn()} />,
    );
    expect(container.querySelector('.dm-remove-btn')).toBeNull();
  });

  it('adds auto-mapped dash style', () => {
    const autoLine = { ...line, isAutoMapped: true };
    const { container } = render(
      <MappingCanvas lines={[autoLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-connection-line--auto')).toBeTruthy();
  });

  it('fires onSelectMapping on path click', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} onSelectMapping={onSelect} />,
    );
    const hitArea = container.querySelector('path[stroke="transparent"]')!;
    hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('m1');
  });

  it('fires onRemoveMapping when remove button clicked', () => {
    const onRemove = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} selectedMappingId="m1" onRemoveMapping={onRemove} />,
    );
    const removeBtn = container.querySelector('.dm-remove-btn')!;
    removeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onRemove).toHaveBeenCalledWith('m1');
  });

  it('applies mismatch class for type-mismatched lines', () => {
    const mismatchLine: ConnectionLine = { ...line, hasTypeMismatch: true };
    const { container } = render(
      <MappingCanvas lines={[mismatchLine]} {...defaults} />,
    );
    const paths = container.querySelectorAll('.dm-connection-line');
    expect(paths[0]?.className.baseVal).toContain('dm-connection-line--mismatch');
  });

  it('does not apply mismatch class for compatible lines', () => {
    const okLine: ConnectionLine = { ...line, hasTypeMismatch: false };
    const { container } = render(
      <MappingCanvas lines={[okLine]} {...defaults} />,
    );
    const paths = container.querySelectorAll('.dm-connection-line');
    expect(paths[0]?.className.baseVal).not.toContain('dm-connection-line--mismatch');
  });
});

describe('pending lines', () => {
  it('applies pending class for isPending lines', () => {
    const pendingLine: ConnectionLine = { ...line, isPending: true };
    const { container } = render(
      <MappingCanvas lines={[pendingLine]} {...defaults} />,
    );
    const paths = container.querySelectorAll('.dm-connection-line');
    expect(paths[0]?.className.baseVal).toContain('dm-connection-line--pending');
  });

  it('renders accept/reject badges for pending lines', () => {
    const pendingLine: ConnectionLine = { ...line, isPending: true };
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[pendingLine]} {...defaults} onAcceptPending={onAccept} onRejectPending={onReject} />,
    );
    expect(container.querySelector('.dm-pending-accept')).toBeTruthy();
    expect(container.querySelector('.dm-pending-reject')).toBeTruthy();
  });

  it('does not render accept/reject badges for non-pending lines', () => {
    const normalLine: ConnectionLine = { ...line, isPending: false };
    const { container } = render(
      <MappingCanvas lines={[normalLine]} {...defaults} onAcceptPending={vi.fn()} onRejectPending={vi.fn()} />,
    );
    expect(container.querySelector('.dm-pending-accept')).toBeNull();
    expect(container.querySelector('.dm-pending-reject')).toBeNull();
  });

  it('calls onAcceptPending when accept badge is clicked', () => {
    const pendingLine: ConnectionLine = { ...line, isPending: true };
    const onAccept = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[pendingLine]} {...defaults} onAcceptPending={onAccept} onRejectPending={vi.fn()} />,
    );
    const accept = container.querySelector('.dm-pending-accept')!;
    accept.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onAccept).toHaveBeenCalledWith('m1');
  });

  it('calls onRejectPending when reject badge is clicked', () => {
    const pendingLine: ConnectionLine = { ...line, isPending: true };
    const onReject = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[pendingLine]} {...defaults} onAcceptPending={vi.fn()} onRejectPending={onReject} />,
    );
    const reject = container.querySelector('.dm-pending-reject')!;
    reject.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onReject).toHaveBeenCalledWith('m1');
  });

  it('deselects selected line on click', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} selectedMappingId="m1" onSelectMapping={onSelect} />,
    );
    const hitArea = container.querySelector('path[stroke="transparent"]')!;
    hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('renders SVG even with empty lines but non-zero height', () => {
    const { container } = render(
      <MappingCanvas lines={[]} {...defaults} height={200} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('uses minimum height of 100 for small heights', () => {
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} height={50} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('height')).toBe('100');
  });
});
