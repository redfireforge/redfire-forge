/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MappingCanvas from './MappingCanvas';
import type { ConnectionLine } from './hooks/useConnectionLines';
import type { MappingTrace } from './utils/mappingTrace';

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
    expect(container.querySelector('.dm-canvas-badge--expression')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--expression .dm-canvas-badge-text')!.textContent).toBe('ƒx expression');
  });

  it('fires onEditExpression when expression badge is clicked', () => {
    const exprLine = { ...line, hasExpression: true };
    const onEdit = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[exprLine]} {...defaults} onEditExpression={onEdit} />,
    );
    const badge = container.querySelector('.dm-canvas-badge--expression')!;
    fireEvent.click(badge);
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

  it('fires onToggleSelectMapping on shift-click', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} onSelectMapping={onSelect} onToggleSelectMapping={onToggle} />,
    );
    const hitArea = container.querySelector('path[stroke="transparent"]')!;
    fireEvent.click(hitArea, { shiftKey: true });
    expect(onToggle).toHaveBeenCalledWith('m1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('fires onToggleSelectMapping on meta-click', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} onSelectMapping={onSelect} onToggleSelectMapping={onToggle} />,
    );
    const hitArea = container.querySelector('path[stroke="transparent"]')!;
    fireEvent.click(hitArea, { metaKey: true });
    expect(onToggle).toHaveBeenCalledWith('m1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('applies expression line class for expression mappings', () => {
    const exprLine = { ...line, hasExpression: true };
    const { container } = render(
      <MappingCanvas lines={[exprLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-connection-line--expression')).toBeTruthy();
  });

  it('renders mismatch badge when hasTypeMismatch and no drift', () => {
    const mismatchLine = { ...line, hasTypeMismatch: true };
    const { container } = render(
      <MappingCanvas lines={[mismatchLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--mismatch')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--mismatch .dm-canvas-badge-text')!.textContent).toBe('⚠ mismatch');
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

  // ── Drift line styling ──────────────────────────

  it('renders breaking drift class on connection line', () => {
    const driftLine = { ...line, driftSeverity: 'breaking' as const };
    const { container } = render(
      <MappingCanvas lines={[driftLine]} {...defaults} />,
    );
    const path = container.querySelector('.dm-connection-line--drift-breaking');
    expect(path).not.toBeNull();
  });

  it('renders warning drift class on connection line', () => {
    const driftLine = { ...line, driftSeverity: 'warning' as const };
    const { container } = render(
      <MappingCanvas lines={[driftLine]} {...defaults} />,
    );
    const path = container.querySelector('.dm-connection-line--drift-warning');
    expect(path).not.toBeNull();
  });

  it('renders drift badge on line without expression', () => {
    const driftLine = { ...line, driftSeverity: 'breaking' as const };
    const { container } = render(
      <MappingCanvas lines={[driftLine]} {...defaults} />,
    );
    const badge = container.querySelector('.dm-canvas-badge--drift-breaking');
    expect(badge).not.toBeNull();
    expect(badge!.querySelector('.dm-canvas-badge-text')!.textContent).toBe('✕ drift');
  });

  it('renders both drift badge and expression badge when line has both', () => {
    const driftLine = { ...line, driftSeverity: 'breaking' as const, hasExpression: true };
    const { container } = render(
      <MappingCanvas lines={[driftLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--drift-breaking')).not.toBeNull();
    expect(container.querySelector('.dm-canvas-badge--expression')).not.toBeNull();
  });

  it('renders no drift styling when driftSeverity is absent', () => {
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} />,
    );
    expect(container.querySelector('.dm-connection-line--drift-breaking')).toBeNull();
    expect(container.querySelector('.dm-connection-line--drift-warning')).toBeNull();
  });
});

describe('debug mode overlay', () => {
  it('renders trace value badge when debugMode is true and line has traceValue', () => {
    const traceLine = { ...line, traceValue: 'Alice', traceError: false };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} debugMode />,
    );
    expect(container.querySelector('.dm-trace-badge--ok')).not.toBeNull();
    expect(container.querySelector('.dm-trace-badge-text')!.textContent).toBe('Alice');
  });

  it('renders error trace badge when traceError is true', () => {
    const traceLine = { ...line, traceValue: 'undefined', traceError: true };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} debugMode />,
    );
    expect(container.querySelector('.dm-trace-badge--error')).not.toBeNull();
  });

  it('does not render trace badges when debugMode is false', () => {
    const traceLine = { ...line, traceValue: 'Alice', traceError: false };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-trace-badge')).toBeNull();
  });

  it('truncates long trace values on line badges', () => {
    const traceLine = { ...line, traceValue: 'a very long value that exceeds limit', traceError: false };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} debugMode />,
    );
    const text = container.querySelector('.dm-trace-badge-text')!.textContent!;
    expect(text.endsWith('…')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(17);
  });

  it('applies trace-ok class to connection line when debug and no error', () => {
    const traceLine = { ...line, traceValue: 'ok', traceError: false };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} debugMode />,
    );
    expect(container.querySelector('.dm-connection-line--trace-ok')).not.toBeNull();
  });

  it('applies trace-error class to connection line when debug and error', () => {
    const traceLine = { ...line, traceValue: 'err', traceError: true };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} debugMode />,
    );
    expect(container.querySelector('.dm-connection-line--trace-error')).not.toBeNull();
  });

  it('renders title tooltip with full trace value', () => {
    const fullValue = 'a long string with full details for tooltip';
    const traceLine = { ...line, traceValue: fullValue, traceError: false };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} debugMode />,
    );
    const title = container.querySelector('.dm-trace-badge title');
    expect(title!.textContent).toBe(fullValue);
  });

  it('does not render badge or trace-ok class for empty string traceValue', () => {
    const traceLine = { ...line, traceValue: '', traceError: false };
    const { container } = render(
      <MappingCanvas lines={[traceLine]} {...defaults} debugMode />,
    );
    expect(container.querySelector('.dm-trace-badge')).toBeNull();
    expect(container.querySelector('.dm-connection-line--trace-ok')).toBeNull();
  });
});

describe('MappingCanvas – failure pinpointing (9C)', () => {
  it('renders inline error label on failed mapping lines in debug mode', () => {
    const errorLine = { ...line, traceError: true, traceValue: 'undefined' };
    const { container } = render(
      <MappingCanvas lines={[errorLine]} {...defaults} debugMode />,
    );
    expect(container.querySelector('.dm-error-inline')).not.toBeNull();
    expect(container.querySelector('.dm-error-inline-text')).not.toBeNull();
  });

  it('does not render inline error label when not in debug mode', () => {
    const errorLine = { ...line, traceError: true, traceValue: 'undefined' };
    const { container } = render(
      <MappingCanvas lines={[errorLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-error-inline')).toBeNull();
  });

  it('does not render inline error label for non-error lines', () => {
    const okLine = { ...line, traceError: false, traceValue: 'Alice' };
    const { container } = render(
      <MappingCanvas lines={[okLine]} {...defaults} debugMode />,
    );
    expect(container.querySelector('.dm-error-inline')).toBeNull();
  });
});

describe('MappingCanvas – error detail callback (9C)', () => {
  const errorTrace: MappingTrace = {
    mappingId: 'm1',
    sourcePath: 'name',
    sourceId: 's1',
    sourceValue: 'Alice',
    targetPath: 'userName',
    targetValue: undefined,
    expression: '$broken($.name)',
    error: 'Unknown function: $broken',
    timestamp: Date.now(),
    durationMs: 1,
  };

  const traceMap = new Map<string, MappingTrace>([['m1', errorTrace]]);

  it('calls onShowErrorDetail when error inline is clicked', () => {
    const onShowErrorDetail = vi.fn();
    const errorLine = { ...line, traceError: true, traceValue: 'undefined' };
    const { container } = render(
      <MappingCanvas lines={[errorLine]} {...defaults} debugMode traceByMappingId={traceMap} onShowErrorDetail={onShowErrorDetail} />,
    );
    fireEvent.click(container.querySelector('.dm-error-inline')!);
    expect(onShowErrorDetail).toHaveBeenCalledTimes(1);
    const [data] = onShowErrorDetail.mock.calls[0];
    expect(data.sourcePath).toBe('name');
    expect(data.targetPath).toBe('userName');
    expect(data.expression).toBe('$broken($.name)');
    expect(data.error).toContain('Unknown function');
    expect(data.sourceValue).toBe('Alice');
  });

  it('does not call onShowErrorDetail when no traceByMappingId', () => {
    const onShowErrorDetail = vi.fn();
    const errorLine = { ...line, traceError: true, traceValue: 'undefined' };
    const { container } = render(
      <MappingCanvas lines={[errorLine]} {...defaults} debugMode onShowErrorDetail={onShowErrorDetail} />,
    );
    fireEvent.click(container.querySelector('.dm-error-inline')!);
    expect(onShowErrorDetail).not.toHaveBeenCalled();
  });

  it('does not call onShowErrorDetail when callback not provided', () => {
    const errorLine = { ...line, traceError: true, traceValue: 'undefined' };
    const { container } = render(
      <MappingCanvas lines={[errorLine]} {...defaults} debugMode traceByMappingId={traceMap} />,
    );
    expect(() => fireEvent.click(container.querySelector('.dm-error-inline')!)).not.toThrow();
  });
});
