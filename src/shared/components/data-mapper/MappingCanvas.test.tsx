/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MappingCanvas from './MappingCanvas';
import type { ConnectionLine } from './hooks/useConnectionLines';
import type { MappingTrace } from './utils/mappingTrace';
import type { RepairSuggestion } from './utils/schemaRepair';

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

  it('updates hover state via transparent path mouseEnter and mouseLeave', () => {
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} />,
    );
    const hitAreas = container.querySelectorAll('path[stroke="transparent"]');
    const hitArea = hitAreas[0] as SVGPathElement;
    fireEvent.mouseEnter(hitArea);
    expect(container.querySelector('.dm-connection-line--selected')).not.toBeNull();
    const visible = container.querySelectorAll('.dm-connection-line')[0] as SVGPathElement;
    expect(visible.getAttribute('stroke-width')).toBe('2.5');
    fireEvent.mouseLeave(hitArea);
    expect(container.querySelector('.dm-connection-line--selected')).toBeNull();
    expect((container.querySelectorAll('.dm-connection-line')[0] as SVGPathElement).getAttribute('stroke-width')).toBe('1.5');
  });

  it('mouseLeave on a line keeps hover when a different line is hovered', () => {
    const line2: ConnectionLine = { ...line, id: 'line-m2', mappingId: 'm2', sourceY: 100, targetY: 120 };
    const { container } = render(
      <MappingCanvas lines={[line, line2]} {...defaults} />,
    );
    const hitAreas = container.querySelectorAll('path[stroke="transparent"]');
    fireEvent.mouseEnter(hitAreas[0] as Element);
    fireEvent.mouseEnter(hitAreas[1] as Element);
    fireEvent.mouseLeave(hitAreas[0] as Element);
    const paths = container.querySelectorAll('.dm-connection-line');
    expect((paths[1] as SVGPathElement).getAttribute('stroke-width')).toBe('2.5');
  });

  it('fires onToggleSelectMapping on ctrl-click', () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} onSelectMapping={onSelect} onToggleSelectMapping={onToggle} />,
    );
    const hitArea = container.querySelector('path[stroke="transparent"]')!;
    fireEvent.click(hitArea, { ctrlKey: true });
    expect(onToggle).toHaveBeenCalledWith('m1');
    expect(onSelect).not.toHaveBeenCalled();
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

  it('renders instructional overlay when no mappings exist', () => {
    const { container } = render(
      <MappingCanvas lines={[]} {...defaults} height={200} />,
    );
    expect(container.querySelector('.dm-canvas-empty-guide')).toBeTruthy();
    const title = container.querySelector('.dm-canvas-empty-guide-title');
    expect(title?.textContent).toContain('No mappings yet');
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

describe('MappingCanvas – suggestion badge', () => {
  it('renders suggestion badge when mapping has suggestions and no expression', () => {
    const suggestions = new Map([
      ['m1', [{ mappingId: 'm1', label: '$toInt', expression: '$toInt($.name)', description: 'Convert to int', category: 'conversion', priority: 90 }]],
    ]);
    const onApply = vi.fn();
    const mismatchLine = { ...line, hasTypeMismatch: true };
    const { container } = render(
      <MappingCanvas lines={[mismatchLine]} {...defaults} expressionSuggestions={suggestions} onApplySuggestion={onApply} />,
    );
    expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--suggestion .dm-canvas-badge-text')!.textContent).toContain('$toInt');
  });

  it('calls onApplySuggestion when suggestion badge is clicked', () => {
    const suggestions = new Map([
      ['m1', [{ mappingId: 'm1', label: '$toInt', expression: '$toInt($.name)', description: 'Convert to int', category: 'conversion', priority: 90 }]],
    ]);
    const onApply = vi.fn();
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} expressionSuggestions={suggestions} onApplySuggestion={onApply} />,
    );
    const badge = container.querySelector('.dm-canvas-badge--suggestion')!;
    fireEvent.click(badge);
    expect(onApply).toHaveBeenCalledWith('m1', '$toInt($.name)');
  });

  it('does not render suggestion badge when mapping has an expression', () => {
    const suggestions = new Map([
      ['m1', [{ mappingId: 'm1', label: '$toInt', expression: '$toInt($.name)', description: '', category: 'conversion', priority: 90 }]],
    ]);
    const exprLine = { ...line, hasExpression: true };
    const { container } = render(
      <MappingCanvas lines={[exprLine]} {...defaults} expressionSuggestions={suggestions} onApplySuggestion={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeNull();
  });

  it('does not render suggestion badge when no onApplySuggestion callback', () => {
    const suggestions = new Map([
      ['m1', [{ mappingId: 'm1', label: '$toInt', expression: '$toInt($.name)', description: '', category: 'conversion', priority: 90 }]],
    ]);
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} expressionSuggestions={suggestions} />,
    );
    expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeNull();
  });

  it('does not render suggestion badge when mapping not in suggestions map', () => {
    const suggestions = new Map([
      ['other', [{ mappingId: 'other', label: '$toInt', expression: '$toInt($.other)', description: '', category: 'conversion', priority: 90 }]],
    ]);
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} expressionSuggestions={suggestions} onApplySuggestion={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeNull();
  });

  it('does not render suggestion badge when suggestions array is empty', () => {
    const suggestions = new Map<string, never[]>([['m1', []]]);
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} expressionSuggestions={suggestions} onApplySuggestion={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeNull();
  });
});

describe('MappingCanvas – pattern badge', () => {
  it('renders pattern badge for pattern-based mappings', () => {
    const patternLine = { ...line, isFromPattern: true };
    const { container } = render(
      <MappingCanvas lines={[patternLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--pattern')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--pattern .dm-canvas-badge-text')!.textContent).toBe('↻ pattern');
  });

  it('does not render pattern badge when line has expression', () => {
    const patternExprLine = { ...line, isFromPattern: true, hasExpression: true };
    const { container } = render(
      <MappingCanvas lines={[patternExprLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--pattern')).toBeNull();
  });

  it('does not render pattern badge when line has drift', () => {
    const patternDriftLine = { ...line, isFromPattern: true, driftSeverity: 'warning' as const };
    const { container } = render(
      <MappingCanvas lines={[patternDriftLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--pattern')).toBeNull();
  });

  it('stacks pattern badge below suggestion badge when both present', () => {
    const suggestions = new Map([
      ['m1', [{ mappingId: 'm1', label: '$toInt', expression: '$toInt($.name)', description: '', category: 'conversion', priority: 90 }]],
    ]);
    const patternMismatchLine = { ...line, isFromPattern: true, hasTypeMismatch: true };
    const { container } = render(
      <MappingCanvas lines={[patternMismatchLine]} {...defaults} expressionSuggestions={suggestions} onApplySuggestion={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--pattern')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeTruthy();
  });
});

describe('MappingCanvas – confidence badge', () => {
  it('renders confidence badge for pending lines with score', () => {
    const confLine = { ...line, isPending: true, confidenceScore: 85 };
    const { container } = render(
      <MappingCanvas lines={[confLine]} {...defaults} onAcceptPending={vi.fn()} onRejectPending={vi.fn()} />,
    );
    const badge = container.querySelector('.dm-canvas-badge--confidence-high');
    expect(badge).toBeTruthy();
    expect(badge!.querySelector('.dm-canvas-badge-text')!.textContent).toBe('85%');
  });

  it('renders mid confidence variant for scores between 50 and 80', () => {
    const confLine = { ...line, isPending: true, confidenceScore: 65 };
    const { container } = render(
      <MappingCanvas lines={[confLine]} {...defaults} onAcceptPending={vi.fn()} onRejectPending={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--confidence-mid')).toBeTruthy();
  });

  it('renders low confidence variant for scores below 50', () => {
    const confLine = { ...line, isPending: true, confidenceScore: 30 };
    const { container } = render(
      <MappingCanvas lines={[confLine]} {...defaults} onAcceptPending={vi.fn()} onRejectPending={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--confidence-low')).toBeTruthy();
  });

  it('does not render confidence badge when not pending', () => {
    const confLine = { ...line, isPending: false, confidenceScore: 85 };
    const { container } = render(
      <MappingCanvas lines={[confLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--confidence-high')).toBeNull();
  });

  it('stacks confidence badge below pattern badge when isFromPattern', () => {
    const patternConfLine = { ...line, isPending: true, isFromPattern: true, confidenceScore: 75 };
    const { container } = render(
      <MappingCanvas lines={[patternConfLine]} {...defaults} onAcceptPending={vi.fn()} onRejectPending={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--pattern')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--confidence-mid')).toBeTruthy();
  });

  it('stacks confidence badge with suggestion', () => {
    const suggestions = new Map([
      ['m1', [{ mappingId: 'm1', label: '$toInt', expression: '$toInt($.name)', description: '', category: 'conversion', priority: 90 }]],
    ]);
    const confLine = { ...line, isPending: true, confidenceScore: 90, hasTypeMismatch: true };
    const { container } = render(
      <MappingCanvas lines={[confLine]} {...defaults} onAcceptPending={vi.fn()} onRejectPending={vi.fn()} expressionSuggestions={suggestions} onApplySuggestion={vi.fn()} />,
    );
    expect(container.querySelector('.dm-canvas-badge--suggestion')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--confidence-high')).toBeTruthy();
  });
});

describe('MappingCanvas – array kind badges', () => {
  it('renders loop array badge', () => {
    const loopLine = { ...line, arrayKind: 'loop' as const, arrayLabel: 'for each' };
    const { container } = render(
      <MappingCanvas lines={[loopLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--loop')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--loop .dm-canvas-badge-text')!.textContent).toContain('∞');
  });

  it('renders aggregate array badge', () => {
    const aggLine = { ...line, arrayKind: 'aggregate' as const, arrayLabel: '$count' };
    const { container } = render(
      <MappingCanvas lines={[aggLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--aggregate')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--aggregate .dm-canvas-badge-text')!.textContent).toContain('Σ');
  });

  it('renders spread array badge with raw label', () => {
    const spreadLine = { ...line, arrayKind: 'spread' as const, arrayLabel: 'wrap' };
    const { container } = render(
      <MappingCanvas lines={[spreadLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--spread')).toBeTruthy();
    expect(container.querySelector('.dm-canvas-badge--spread .dm-canvas-badge-text')!.textContent).toBe('wrap');
  });

  it('does not render array badge when line has expression', () => {
    const loopExpr = { ...line, arrayKind: 'loop' as const, arrayLabel: 'for each', hasExpression: true };
    const { container } = render(
      <MappingCanvas lines={[loopExpr]} {...defaults} />,
    );
    expect(container.querySelector('.dm-canvas-badge--loop')).toBeNull();
  });

  it('applies loop class to connection line', () => {
    const loopLine = { ...line, arrayKind: 'loop' as const, arrayLabel: 'for each' };
    const { container } = render(
      <MappingCanvas lines={[loopLine]} {...defaults} />,
    );
    expect(container.querySelector('.dm-connection-line--loop')).toBeTruthy();
  });
});

describe('MappingCanvas – selectedMappingIds (multi-select)', () => {
  it('highlights lines from selectedMappingIds set', () => {
    const selected = new Set(['m1']);
    const { container } = render(
      <MappingCanvas lines={[line]} {...defaults} selectedMappingIds={selected} />,
    );
    expect(container.querySelector('.dm-connection-line--selected')).toBeTruthy();
  });

  it('dims other lines when selectedMappingIds has entries', () => {
    const line2: ConnectionLine = { ...line, id: 'line-m2', mappingId: 'm2', sourceY: 100, targetY: 120 };
    const selected = new Set(['m1']);
    const { container } = render(
      <MappingCanvas lines={[line, line2]} {...defaults} selectedMappingIds={selected} />,
    );
    expect(container.querySelector('.dm-connection-line--dimmed')).toBeTruthy();
  });
});

describe('MappingCanvas – error detail callback (9C)', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

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

  it('formats non-JSON-serializable trace values with String() fallback', () => {
    const onShowErrorDetail = vi.fn();
    const badTrace: MappingTrace = {
      ...errorTrace,
      sourceValue: circular,
      targetValue: null,
    };
    const map = new Map<string, MappingTrace>([['m1', badTrace]]);
    const errorLine = { ...line, traceError: true, traceValue: 'undefined' };
    const { container } = render(
      <MappingCanvas lines={[errorLine]} {...defaults} debugMode traceByMappingId={map} onShowErrorDetail={onShowErrorDetail} />,
    );
    fireEvent.click(container.querySelector('.dm-error-inline')!);
    expect(onShowErrorDetail).toHaveBeenCalledTimes(1);
    const [data] = onShowErrorDetail.mock.calls[0];
    expect(data.sourceValue).toBe('[object Object]');
    expect(data.targetValue).toBe('null');
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

// ─── Repair badge on breaking drift lines ──────────────────

describe('MappingCanvas — repair badge', () => {
  const breakingLine: ConnectionLine = {
    ...line,
    driftSeverity: 'breaking',
  };

  const suggestion: RepairSuggestion = {
    driftPath: 'name',
    mappingId: 'm1',
    suggestedPath: 'user.fullName',
    reason: 'similar name',
    strategy: 'similar-name',
    confidence: 85,
  };

  it('renders repair badge when breaking drift has suggestions', () => {
    const repairMap = new Map([['m1', [suggestion]]]);
    const onApplyRepair = vi.fn();
    const { container } = render(
      <MappingCanvas
        lines={[breakingLine]}
        {...defaults}
        repairSuggestions={repairMap}
        onApplyRepair={onApplyRepair}
      />,
    );
    const repairBadge = container.querySelector('.dm-canvas-badge--repair');
    expect(repairBadge).toBeTruthy();
    const text = repairBadge!.querySelector('.dm-canvas-badge-text');
    expect(text?.textContent).toContain('repair');
    expect(text?.textContent).toContain('fullName');
  });

  it('calls onApplyRepair when repair badge is clicked', () => {
    const repairMap = new Map([['m1', [suggestion]]]);
    const onApplyRepair = vi.fn();
    const { container } = render(
      <MappingCanvas
        lines={[breakingLine]}
        {...defaults}
        repairSuggestions={repairMap}
        onApplyRepair={onApplyRepair}
      />,
    );
    const repairBadge = container.querySelector('.dm-canvas-badge--repair');
    fireEvent.click(repairBadge!);
    expect(onApplyRepair).toHaveBeenCalledTimes(1);
    expect(onApplyRepair).toHaveBeenCalledWith('m1', suggestion);
  });

  it('does not render repair badge without onApplyRepair', () => {
    const repairMap = new Map([['m1', [suggestion]]]);
    const { container } = render(
      <MappingCanvas lines={[breakingLine]} {...defaults} repairSuggestions={repairMap} />,
    );
    expect(container.querySelector('.dm-canvas-badge--repair')).toBeNull();
  });

  it('does not render repair badge for warning drift', () => {
    const warningLine: ConnectionLine = { ...line, driftSeverity: 'warning' };
    const repairMap = new Map([['m1', [suggestion]]]);
    const onApplyRepair = vi.fn();
    const { container } = render(
      <MappingCanvas
        lines={[warningLine]}
        {...defaults}
        repairSuggestions={repairMap}
        onApplyRepair={onApplyRepair}
      />,
    );
    expect(container.querySelector('.dm-canvas-badge--repair')).toBeNull();
  });

  it('does not render repair badge when no suggestions exist', () => {
    const repairMap = new Map<string, RepairSuggestion[]>();
    const onApplyRepair = vi.fn();
    const { container } = render(
      <MappingCanvas
        lines={[breakingLine]}
        {...defaults}
        repairSuggestions={repairMap}
        onApplyRepair={onApplyRepair}
      />,
    );
    expect(container.querySelector('.dm-canvas-badge--repair')).toBeNull();
  });

  it('truncates long suggested paths in badge label', () => {
    const longSugg: RepairSuggestion = {
      ...suggestion,
      suggestedPath: 'deeply.nested.very.long.path.to.field',
    };
    const repairMap = new Map([['m1', [longSugg]]]);
    const onApplyRepair = vi.fn();
    const { container } = render(
      <MappingCanvas
        lines={[breakingLine]}
        {...defaults}
        repairSuggestions={repairMap}
        onApplyRepair={onApplyRepair}
      />,
    );
    const text = container.querySelector('.dm-canvas-badge--repair .dm-canvas-badge-text');
    expect(text?.textContent).toContain('repair');
    expect(text!.textContent!.length).toBeLessThan(40);
  });
});
