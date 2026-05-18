/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ValidationRepairPanel, { type MapperRepairIssue } from './ValidationRepairPanel';

function baseIssue(partial: Partial<MapperRepairIssue> = {}): MapperRepairIssue {
  return {
    id: 'i1',
    kind: 'missing-target',
    severity: 'error',
    message: 'Something broke',
    mappingId: 'm1',
    sourceId: 's1',
    sourcePath: '$.src',
    targetPath: '$.tgt',
    ...partial,
  };
}

describe('ValidationRepairPanel', () => {
  it('shows singular issue count heading', () => {
    render(
      <ValidationRepairPanel
        issues={[baseIssue({ id: 'only', message: 'one' })]}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(screen.getByText('1 issue')).toBeInTheDocument();
  });

  it('labels standard mapper repair kinds', () => {
    render(
      <ValidationRepairPanel
        issues={[
          baseIssue({ id: 'm', kind: 'missing-target', message: 'a' }),
          baseIssue({ id: 'd', kind: 'duplicate-target', message: 'b' }),
          baseIssue({ id: 't', kind: 'type-mismatch', message: 'c' }),
          baseIssue({ id: 'u', kind: 'unresolved-path', message: 'd' }),
        ]}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(screen.getByText('Missing target')).toBeInTheDocument();
    expect(screen.getByText('Duplicate target')).toBeInTheDocument();
    expect(screen.getByText('Type mismatch')).toBeInTheDocument();
    expect(screen.getByText('Unresolved path')).toBeInTheDocument();
  });

  it('renders nothing when issues empty', () => {
    const { container } = render(
      <ValidationRepairPanel
        issues={[]}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('uses warning icon for warning severity', () => {
    render(
      <ValidationRepairPanel
        issues={[baseIssue({ id: 'warn-row', severity: 'warning', message: 'Careful' })]}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('uses info icon for info severity', () => {
    render(
      <ValidationRepairPanel
        issues={[baseIssue({ id: 'info-row', severity: 'info', message: 'FYI' })]}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(screen.getByText('ℹ')).toBeInTheDocument();
  });

  it('shows plural "+N more issues" when more than twelve rows', () => {
    const issues = Array.from({ length: 14 }, (_, i) =>
      baseIssue({ id: `row-${i}`, message: `msg-${i}`, targetPath: `$.p${i}` }),
    );
    render(
      <ValidationRepairPanel
        issues={issues}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(screen.getByText('+2 more issues')).toBeInTheDocument();
    expect(screen.queryByText('msg-12')).not.toBeInTheDocument();
    expect(screen.getByText('msg-11')).toBeInTheDocument();
  });

  it('shows singular "+1 more issue" when thirteen issues total', () => {
    const issues = Array.from({ length: 13 }, (_, i) =>
      baseIssue({ id: `row-${i}`, message: `m-${i}` }),
    );
    render(
      <ValidationRepairPanel
        issues={issues}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(screen.getByText('+1 more issue')).toBeInTheDocument();
  });

  it('falls back issue label for unexpected kind values', () => {
    render(
      <ValidationRepairPanel
        issues={[
          baseIssue({
            kind: 'not-a-real-kind' as unknown as MapperRepairIssue['kind'],
            message: 'odd',
          }),
        ]}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    expect(screen.getByText('Issue')).toBeInTheDocument();
  });

  it('disables Fix without suggestedFixExpression and enables when provided', () => {
    const onFix = vi.fn();
    const { rerender } = render(
      <ValidationRepairPanel
        issues={[baseIssue({ id: 'a', suggestedFixExpression: undefined })]}
        onFix={onFix}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    const fixBtn = screen.getByRole('button', { name: 'Fix' });
    expect(fixBtn).toBeDisabled();
    expect(fixBtn).toHaveAttribute('title', 'No automatic fix available');

    rerender(
      <ValidationRepairPanel
        issues={[baseIssue({ id: 'a', suggestedFixExpression: '$trim($.x)' })]}
        onFix={onFix}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={vi.fn()}
      />,
    );
    const fixAgain = screen.getByRole('button', { name: 'Fix' });
    expect(fixAgain).not.toBeDisabled();
    expect(fixAgain).toHaveAttribute('title', 'Apply suggested fix');
    fireEvent.click(fixAgain);
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(onFix.mock.calls[0][0].suggestedFixExpression).toBe('$trim($.x)');
  });

  it('invokes Replace and Ignore once callbacks', () => {
    const onReplace = vi.fn();
    const onIgnoreOnce = vi.fn();
    const sample = baseIssue({ id: 'act-me', message: 'replace me' });
    render(
      <ValidationRepairPanel
        issues={[sample]}
        onFix={vi.fn()}
        onReplace={onReplace}
        onIgnoreOnce={onIgnoreOnce}
        onOpenNode={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ignore once' }));
    expect(onReplace).toHaveBeenCalledWith(sample);
    expect(onIgnoreOnce).toHaveBeenCalledWith(sample);
  });

  it('invokes Open node callback', () => {
    const onOpenNode = vi.fn();
    const sample = baseIssue({ id: 'open-me', message: 'focus' });
    render(
      <ValidationRepairPanel
        issues={[sample]}
        onFix={vi.fn()}
        onReplace={vi.fn()}
        onIgnoreOnce={vi.fn()}
        onOpenNode={onOpenNode}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open node' }));
    expect(onOpenNode).toHaveBeenCalledWith(sample);
  });
});
