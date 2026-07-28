/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SchemaDiffModal from './SchemaDiffModal';
import type { ClassifiedDrift } from './utils/schemaDrift';

function makeDrift(overrides: Partial<ClassifiedDrift> & { path: string }): ClassifiedDrift {
  return {
    driftType: 'added',
    currentType: 'string',
    affectedMappingIds: [],
    severity: 'info',
    description: `Field "${overrides.path}" changed.`,
    ...overrides,
  };
}

describe('SchemaDiffModal', () => {
  it('renders with role dialog', () => {
    const drifts = [makeDrift({ path: 'email' })];
    render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows "Schema Changes" title', () => {
    const drifts = [makeDrift({ path: 'email' })];
    render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    expect(screen.getByText('Schema Changes')).toBeTruthy();
  });

  it('renders severity count badges', () => {
    const drifts = [
      makeDrift({ path: 'a', severity: 'breaking', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1'] }),
      makeDrift({ path: 'b', severity: 'warning', driftType: 'typeChanged' }),
      makeDrift({ path: 'c', severity: 'info', driftType: 'added' }),
    ];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    expect(container.ownerDocument.body.querySelector('.dm-diff-count--breaking')!.textContent).toBe('1 breaking');
    expect(container.ownerDocument.body.querySelector('.dm-diff-count--warning')!.textContent).toBe('1 warning');
    expect(container.ownerDocument.body.querySelector('.dm-diff-count--info')!.textContent).toBe('1 info');
  });

  it('sorts rows by severity (breaking first)', () => {
    const drifts = [
      makeDrift({ path: 'z-info', severity: 'info' }),
      makeDrift({ path: 'a-breaking', severity: 'breaking', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1'] }),
      makeDrift({ path: 'm-warning', severity: 'warning' }),
    ];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    const rows = container.ownerDocument.body.querySelectorAll('.dm-diff-row');
    expect(rows[0].classList.contains('dm-diff-row--breaking')).toBe(true);
    expect(rows[1].classList.contains('dm-diff-row--warning')).toBe(true);
    expect(rows[2].classList.contains('dm-diff-row--info')).toBe(true);
  });

  it('shows field path in monospace cell', () => {
    const drifts = [makeDrift({ path: 'user.email' })];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    const pathCell = container.ownerDocument.body.querySelector('.dm-diff-path');
    expect(pathCell!.textContent).toBe('user.email');
  });

  it('shows affected mapping count for breaking drifts', () => {
    const drifts = [
      makeDrift({ path: 'x', severity: 'breaking', driftType: 'removed', savedType: 'string', affectedMappingIds: ['m1', 'm2'] }),
    ];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    const affected = container.ownerDocument.body.querySelector('.dm-diff-affected');
    expect(affected!.textContent).toBe('2');
  });

  it('shows "—" for no affected mappings', () => {
    const drifts = [makeDrift({ path: 'x', severity: 'info' })];
    render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    const drifts = [makeDrift({ path: 'a' })];
    render(<SchemaDiffModal drifts={drifts} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('acceptMode shows Cancel and Accept & Update', () => {
    const onClose = vi.fn();
    const onAccept = vi.fn();
    render(
      <SchemaDiffModal
        drifts={[makeDrift({ path: 'a' })]}
        onClose={onClose}
        onAccept={onAccept}
        acceptMode
      />,
    );
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Accept & Update')).toBeTruthy();
    expect(screen.queryByText('Close')).toBeNull();

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Accept & Update'));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn();
    const drifts = [makeDrift({ path: 'a' })];
    render(<SchemaDiffModal drifts={drifts} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows change type labels', () => {
    const drifts = [
      makeDrift({ path: 'a', driftType: 'added', severity: 'info' }),
      makeDrift({ path: 'b', driftType: 'removed', severity: 'warning', savedType: 'string' }),
      makeDrift({ path: 'c', driftType: 'typeChanged', severity: 'warning', savedType: 'number', currentType: 'string' }),
    ];
    render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    expect(screen.getByText('+ added')).toBeTruthy();
    expect(screen.getByText('− removed')).toBeTruthy();
    expect(screen.getByText('≠ type changed')).toBeTruthy();
  });

  it('renders em dash when saved type is absent on added fields', () => {
    const drifts = [makeDrift({ path: 'newfield', driftType: 'added', severity: 'info', currentType: 'string' })];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    const row = container.ownerDocument.body.querySelector('.dm-diff-row');
    const typeCells = row?.querySelectorAll('.dm-diff-type');
    expect(typeCells?.[0]?.textContent?.trim()).toBe('—');
  });

  it('renders em dash when current type is absent on removed fields', () => {
    const drifts = [makeDrift({
      path: 'gone',
      driftType: 'removed',
      severity: 'breaking',
      savedType: 'string',
      currentType: undefined,
      affectedMappingIds: ['m1'],
    })];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    const row = container.ownerDocument.body.querySelector('.dm-diff-row--breaking');
    const typeCells = row?.querySelectorAll('.dm-diff-type');
    expect(typeCells?.[1]?.textContent?.trim()).toBe('—');
  });

  it('hides severity count badge when count is 0', () => {
    const drifts = [makeDrift({ path: 'a', severity: 'info' })];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    expect(container.ownerDocument.body.querySelector('.dm-diff-count--breaking')).toBeNull();
    expect(container.ownerDocument.body.querySelector('.dm-diff-count--warning')).toBeNull();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    const drifts = [makeDrift({ path: 'a' })];
    render(<SchemaDiffModal drifts={drifts} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores non-Escape keydown on window listener', () => {
    const onClose = vi.fn();
    render(<SchemaDiffModal drifts={[makeDrift({ path: 'a' })]} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the shell on mount', () => {
    const drifts = [makeDrift({ path: 'a' })];
    const { container } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    const shell = container.ownerDocument.body.querySelector('.dm-diff-shell');
    expect(shell).not.toBeNull();
    expect(document.activeElement).toBe(shell);
  });

  it('does not throw when restoring focus after SVG element was focused', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('tabindex', '-1');
    document.body.appendChild(svg);
    svg.focus();
    expect(document.activeElement).toBe(svg);
    const drifts = [makeDrift({ path: 'a' })];
    const { unmount } = render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    unmount();
    document.body.removeChild(svg);
  });

  it('labels nullable drift changes', () => {
    const drifts = [
      makeDrift({ path: 'opt', driftType: 'nullableChanged', severity: 'info', savedType: 'string', currentType: 'string' }),
    ];
    render(<SchemaDiffModal drifts={drifts} onClose={vi.fn()} />);
    expect(screen.getByText('~ nullable')).toBeTruthy();
  });

  describe('repair UI', () => {
    const breakingDrift = makeDrift({
      path: 'userName',
      severity: 'breaking',
      driftType: 'removed',
      savedType: 'string',
      affectedMappingIds: ['m1'],
    });

    it('renders Repair column header when repairSuggestions provided', () => {
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'Similar name',
        strategy: 'similar-name' as const,
        confidence: 70,
      }]]]);
      render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      expect(screen.getByText('Repair')).toBeTruthy();
    });

    it('does not render Repair column when repairSuggestions not provided', () => {
      render(<SchemaDiffModal drifts={[breakingDrift]} onClose={vi.fn()} />);
      expect(screen.queryByText('Repair')).toBeNull();
    });

    it('renders Repair button with suggestion count', () => {
      const suggestions = new Map([['userName', [
        { driftPath: 'userName', mappingId: 'm1', suggestedPath: 'user_name', reason: 'Similar', strategy: 'similar-name' as const, confidence: 70 },
        { driftPath: 'userName', mappingId: 'm1', suggestedPath: 'username', reason: 'Similar', strategy: 'similar-name' as const, confidence: 50 },
      ]]]);
      render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      const repairBtn = screen.getByLabelText('Repair userName');
      expect(repairBtn.textContent).toContain('2');
    });

    it('opens dropdown on Repair button click', () => {
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'Similar name "user_name" (edit distance: 2)',
        strategy: 'similar-name' as const,
        confidence: 70,
      }]]]);
      const { container } = render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText('Repair userName'));
      expect(container.ownerDocument.body.querySelector('.dm-repair-dropdown')).not.toBeNull();
      expect(container.ownerDocument.body.querySelector('.dm-repair-suggestion-path')!.textContent).toBe('user_name');
      expect(container.ownerDocument.body.querySelector('.dm-repair-confidence')!.textContent).toBe('70%');
    });

    it('calls onApplyRepair when Apply is clicked', () => {
      const onApply = vi.fn();
      const suggestion = {
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'Similar',
        strategy: 'similar-name' as const,
        confidence: 70,
      };
      const suggestions = new Map([['userName', [suggestion]]]);
      render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={onApply}
        />,
      );
      fireEvent.click(screen.getByLabelText('Repair userName'));
      fireEvent.click(screen.getByText('Apply'));
      expect(onApply).toHaveBeenCalledWith('m1', suggestion);
    });

    it('shows "No suggestions" for breaking drift without suggestions', () => {
      const suggestions = new Map<string, never[]>();
      render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      expect(screen.getByText('No suggestions')).toBeTruthy();
    });

    it('shows confidence color coding', () => {
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'test',
        strategy: 'similar-name' as const,
        confidence: 85,
      }]]]);
      const { container } = render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText('Repair userName'));
      expect(container.ownerDocument.body.querySelector('.dm-repair-confidence--high')).not.toBeNull();
    });

    it('shows medium confidence styling', () => {
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'test',
        strategy: 'similar-name' as const,
        confidence: 55,
      }]]]);
      const { container } = render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText('Repair userName'));
      expect(container.ownerDocument.body.querySelector('.dm-repair-confidence--medium')).not.toBeNull();
    });

    it('shows low confidence styling', () => {
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'test',
        strategy: 'similar-name' as const,
        confidence: 30,
      }]]]);
      const { container } = render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText('Repair userName'));
      expect(container.ownerDocument.body.querySelector('.dm-repair-confidence--low')).not.toBeNull();
    });

    it('closes repair dropdown when repair button is clicked again', () => {
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'Similar',
        strategy: 'similar-name' as const,
        confidence: 70,
      }]]]);
      const { container } = render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      const btn = screen.getByLabelText('Repair userName');
      fireEvent.click(btn);
      expect(container.ownerDocument.body.querySelector('.dm-repair-dropdown')).not.toBeNull();
      fireEvent.click(btn);
      expect(container.ownerDocument.body.querySelector('.dm-repair-dropdown')).toBeNull();
    });

    it('shows No suggestions when apply handler is missing but drift has suggestions', () => {
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'Similar',
        strategy: 'similar-name' as const,
        confidence: 70,
      }]]]);
      render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
        />,
      );
      expect(screen.getByText('No suggestions')).toBeTruthy();
    });

    it('shows em dash in repair cell for non-breaking drifts', () => {
      const drift = makeDrift({
        path: 'w',
        severity: 'warning',
        driftType: 'typeChanged',
        savedType: 'number',
        currentType: 'string',
      });
      const suggestions = new Map([['w', [{
        driftPath: 'w',
        mappingId: 'm1',
        suggestedPath: 'x',
        reason: 'Similar',
        strategy: 'similar-name' as const,
        confidence: 70,
      }]]]);
      const { container } = render(
        <SchemaDiffModal
          drifts={[drift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
        />,
      );
      const repairCell = container.ownerDocument.body.querySelector('.dm-diff-row--warning .dm-diff-repair-cell');
      expect(repairCell?.textContent?.trim()).toBe('—');
    });

    it('shows em dash for breaking row with suggestions when no apply handler and no affected mappings', () => {
      const drift = makeDrift({
        path: 'solo',
        severity: 'breaking',
        driftType: 'removed',
        savedType: 'string',
        affectedMappingIds: [],
      });
      const suggestions = new Map([['solo', [{
        driftPath: 'solo',
        mappingId: 'm1',
        suggestedPath: 's',
        reason: 'Similar',
        strategy: 'similar-name' as const,
        confidence: 70,
      }]]]);
      const { container } = render(
        <SchemaDiffModal
          drifts={[drift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
        />,
      );
      const repairCell = container.ownerDocument.body.querySelector('.dm-diff-row--breaking .dm-diff-repair-cell');
      expect(repairCell?.textContent?.trim()).toBe('—');
    });

    it('renders Apply all repairs button when batch handler provided', () => {
      const onApplyBatch = vi.fn();
      const suggestions = new Map([['userName', [{
        driftPath: 'userName',
        mappingId: 'm1',
        suggestedPath: 'user_name',
        reason: 'Similar',
        strategy: 'similar-name' as const,
        confidence: 70,
      }]]]);
      render(
        <SchemaDiffModal
          drifts={[breakingDrift]}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
          onApplyRepairBatch={onApplyBatch}
        />,
      );
      expect(screen.getByText('Apply all repairs (1)')).toBeTruthy();
    });

    it('calls batch handler with highest-confidence suggestion per mapping', () => {
      const onApplyBatch = vi.fn();
      const drifts = [
        breakingDrift,
        makeDrift({
          path: 'legacyName',
          severity: 'breaking',
          driftType: 'removed',
          savedType: 'string',
          affectedMappingIds: ['m1', 'm2'],
        }),
      ];
      const suggestions = new Map<string, Array<{
        driftPath: string;
        mappingId: string;
        suggestedPath: string;
        reason: string;
        strategy: 'similar-name';
        confidence: number;
      }>>([
        ['userName', [
          { driftPath: 'userName', mappingId: 'm1', suggestedPath: 'user_name_low', reason: 'low', strategy: 'similar-name', confidence: 40 },
          { driftPath: 'userName', mappingId: 'm1', suggestedPath: 'user_name_high', reason: 'high', strategy: 'similar-name', confidence: 85 },
        ]],
        ['legacyName', [
          { driftPath: 'legacyName', mappingId: 'm2', suggestedPath: 'legacy_name', reason: 'rename', strategy: 'similar-name', confidence: 75 },
        ]],
      ]);
      render(
        <SchemaDiffModal
          drifts={drifts}
          onClose={vi.fn()}
          repairSuggestions={suggestions}
          onApplyRepair={vi.fn()}
          onApplyRepairBatch={onApplyBatch}
        />,
      );
      fireEvent.click(screen.getByText('Apply all repairs (2)'));
      expect(onApplyBatch).toHaveBeenCalledTimes(1);
      const repairs = onApplyBatch.mock.calls[0][0];
      expect(repairs).toHaveLength(2);
      const repairM1 = repairs.find((r: { mappingId: string; suggestion: { suggestedPath: string } }) => r.mappingId === 'm1');
      expect(repairM1?.suggestion.suggestedPath).toBe('user_name_high');
    });
  });
});
