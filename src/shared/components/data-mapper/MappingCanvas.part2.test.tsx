/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MappingCanvas from './MappingCanvas';
import type { ConnectionLine } from './hooks/useConnectionLines';
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

  describe('RemapHandle', () => {
    it('renders remap handle when onRemapDragStart is provided', () => {
      const onRemapDragStart = vi.fn();
      const { container } = render(
        <MappingCanvas
          lines={[line]}
          {...defaults}
          onRemapDragStart={onRemapDragStart}
        />,
      );
      const handle = container.querySelector('.dm-remap-handle');
      expect(handle).toBeTruthy();
    });

    it('does not render remap handle without onRemapDragStart', () => {
      const { container } = render(
        <MappingCanvas lines={[line]} {...defaults} />,
      );
      expect(container.querySelector('.dm-remap-handle')).toBeNull();
    });

    it('does not render remap handle for pending lines', () => {
      const pendingLine: ConnectionLine = { ...line, isPending: true };
      const { container } = render(
        <MappingCanvas
          lines={[pendingLine]}
          {...defaults}
          onRemapDragStart={vi.fn()}
        />,
      );
      expect(container.querySelector('.dm-remap-handle')).toBeNull();
    });

    it('fires onRemapDragStart on drag start', () => {
      const onRemapDragStart = vi.fn();
      const { container } = render(
        <MappingCanvas
          lines={[line]}
          {...defaults}
          onRemapDragStart={onRemapDragStart}
        />,
      );
      const handle = container.querySelector('.dm-remap-handle')!;
      const dt = { effectAllowed: '', setData: vi.fn() };
      fireEvent.dragStart(handle, { dataTransfer: dt });
      expect(onRemapDragStart).toHaveBeenCalledWith('m1');
      expect(dt.setData).toHaveBeenCalledWith(
        'application/mapper-remap',
        expect.stringContaining('"mappingId":"m1"'),
      );
    });

    it('fires onRemapDragEnd on drag end', () => {
      const onRemapDragEnd = vi.fn();
      const { container } = render(
        <MappingCanvas
          lines={[line]}
          {...defaults}
          onRemapDragStart={vi.fn()}
          onRemapDragEnd={onRemapDragEnd}
        />,
      );
      const handle = container.querySelector('.dm-remap-handle')!;
      fireEvent.dragEnd(handle);
      expect(onRemapDragEnd).toHaveBeenCalled();
    });
  });
});
