/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DriftBanner from './DriftBanner';
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

describe('DriftBanner', () => {
  it('renders nothing when drifts are empty', () => {
    const { container } = render(
      <DriftBanner drifts={[]} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders warning style for non-breaking drifts', () => {
    const drifts = [makeDrift({ path: 'email', severity: 'info' })];
    const { container } = render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    const banner = container.querySelector('.dm-drift-banner');
    expect(banner).not.toBeNull();
    expect(banner!.classList.contains('dm-drift-banner--warning')).toBe(true);
    expect(banner!.classList.contains('dm-drift-banner--breaking')).toBe(false);
  });

  it('renders breaking style when any drift is breaking', () => {
    const drifts = [
      makeDrift({ path: 'email', severity: 'info' }),
      makeDrift({
        path: 'status',
        driftType: 'removed',
        savedType: 'string',
        severity: 'breaking',
        affectedMappingIds: ['m1'],
        description: 'Field "status" was removed — 1 mapping will break.',
      }),
    ];
    const { container } = render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    const banner = container.querySelector('.dm-drift-banner');
    expect(banner!.classList.contains('dm-drift-banner--breaking')).toBe(true);
  });

  it('shows breaking items detail list', () => {
    const drifts = [
      makeDrift({
        path: 'name',
        driftType: 'removed',
        savedType: 'string',
        severity: 'breaking',
        affectedMappingIds: ['m1'],
        description: 'Field "name" was removed — 1 mapping will break.',
      }),
    ];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText(/1 mapping will break/)).toBeTruthy();
  });

  it('shows summary counts', () => {
    const drifts = [
      makeDrift({ path: 'a', driftType: 'added', severity: 'info' }),
      makeDrift({ path: 'b', driftType: 'added', severity: 'info' }),
      makeDrift({
        path: 'c',
        driftType: 'removed',
        savedType: 'string',
        severity: 'warning',
        affectedMappingIds: [],
      }),
    ];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText(/2 added/)).toBeTruthy();
    expect(screen.getByText(/1 removed/)).toBeTruthy();
  });

  it('shows affected mapping count', () => {
    const drifts = [
      makeDrift({
        path: 'x',
        driftType: 'removed',
        savedType: 'string',
        severity: 'breaking',
        affectedMappingIds: ['m1', 'm2', 'm3'],
        description: 'Field "x" was removed — 3 mappings will break.',
      }),
    ];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText(/3 mappings? affected/)).toBeTruthy();
  });

  it('calls onAcceptAndUpdate when Accept button is clicked', () => {
    const onAccept = vi.fn();
    const drifts = [makeDrift({ path: 'a', severity: 'warning' })];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={onAccept} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Accept & Update'));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const drifts = [makeDrift({ path: 'a', severity: 'info' })];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByLabelText('Dismiss drift notification'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('has role="alert" for accessibility', () => {
    const drifts = [makeDrift({ path: 'a', severity: 'info' })];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('does NOT show breaking items list for warning-only drifts', () => {
    const drifts = [
      makeDrift({ path: 'a', driftType: 'typeChanged', severity: 'warning' }),
    ];
    const { container } = render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.querySelector('.dm-drift-banner-items')).toBeNull();
  });

  it('shows non-breaking title for all-info drifts', () => {
    const drifts = [
      makeDrift({ path: 'a', driftType: 'added', severity: 'info' }),
      makeDrift({ path: 'b', driftType: 'added', severity: 'info' }),
    ];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('Source schema changed since last mapping')).toBeTruthy();
  });

  it('shows breaking title when any drift is breaking', () => {
    const drifts = [
      makeDrift({ path: 'a', severity: 'info' }),
      makeDrift({
        path: 'b',
        driftType: 'removed',
        savedType: 'string',
        severity: 'breaking',
        affectedMappingIds: ['m1'],
        description: 'Field "b" was removed — 1 mapping will break.',
      }),
    ];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('Source schema has breaking changes')).toBeTruthy();
  });

  it('shows singular grammar for 1 affected mapping', () => {
    const drifts = [
      makeDrift({
        path: 'x',
        driftType: 'removed',
        savedType: 'string',
        severity: 'breaking',
        affectedMappingIds: ['m1'],
        description: 'Field "x" was removed — 1 mapping will break.',
      }),
    ];
    render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText(/1 mapping affected/)).toBeTruthy();
  });

  it('hides affected span when totalAffectedMappings is 0', () => {
    const drifts = [
      makeDrift({ path: 'a', driftType: 'added', severity: 'info' }),
    ];
    const { container } = render(
      <DriftBanner drifts={drifts} onAcceptAndUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.querySelector('.dm-drift-banner-affected')).toBeNull();
  });
});
