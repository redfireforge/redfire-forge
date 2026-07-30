/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FeatureGroup } from '../../../shared/types';
import MoveModal from './MoveModal';

vi.mock('../../../shared/components/PopupModal', () => ({
  __esModule: true,
  default: ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>
      <h3>{title}</h3>
      <div>{children}</div>
      <div>{footer}</div>
    </div>
  ),
}));

vi.mock('../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, options, 'data-testid': dataTestId }: {
    value: string;
    onChange: (next: string) => void;
    options: Array<{ value: string; label: string }>;
    'data-testid'?: string;
  }) => (
    <select data-testid={dataTestId ?? 'mock-select'} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">empty</option>
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  ),
}));

const featureGroups: FeatureGroup[] = [
  {
    id: 'fg-1',
    name: 'FG One',
    microserviceId: 'svc',
    environmentId: 'env',
    scenarios: [
      { id: 'sc-1', name: 'Standard A', kind: 'standard', tests: [] },
      { id: 'sc-2', name: 'Param B', kind: 'parameterized', tests: [] },
    ],
  },
  {
    id: 'fg-2',
    name: 'FG Two',
    microserviceId: 'svc',
    environmentId: 'env',
    scenarios: [
      { id: 'sc-3', name: 'Standard C', kind: 'standard', tests: [] },
    ],
  },
];

describe('MoveModal coverage gaps', () => {
  it('guards move when no destination is selected', () => {
    const onMove = vi.fn();
    render(
      <MoveModal
        type="scenario"
        itemName="Scenario X"
        featureGroups={featureGroups}
        currentFgId="fg-1"
        onMove={onMove}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Move'));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('moves scenario when selecting a different feature group', () => {
    const onMove = vi.fn();
    render(
      <MoveModal
        type="scenario"
        itemName="Scenario X"
        featureGroups={featureGroups}
        currentFgId="fg-1"
        onMove={onMove}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: 'fg-2' } });
    fireEvent.click(screen.getByText('Move'));
    expect(onMove).toHaveBeenCalledWith({ fgId: 'fg-2', scenarioId: undefined });
  });

  it('filters target scenarios by source kind and resets scenario when FG changes', () => {
    const onMove = vi.fn();
    const { getAllByTestId } = render(
      <MoveModal
        type="test"
        itemName="Test Y"
        featureGroups={featureGroups}
        currentFgId="fg-1"
        currentScenarioId="sc-1"
        sourceScenarioKind="standard"
        onMove={onMove}
        onClose={vi.fn()}
      />,
    );

    const selects = getAllByTestId('mock-select');
    fireEvent.change(selects[0], { target: { value: 'fg-1' } });

    // Standard-only filter should allow sc-1 but not parameterized sc-2
    const scenarioSelect = getAllByTestId('mock-select')[1] as HTMLSelectElement;
    const scenarioValues = Array.from(scenarioSelect.options).map((o) => o.value);
    expect(scenarioValues).toContain('sc-1');
    expect(scenarioValues).not.toContain('sc-2');

    fireEvent.change(scenarioSelect, { target: { value: 'sc-1' } });
    fireEvent.change(getAllByTestId('mock-select')[0], { target: { value: 'fg-2' } });

    // After FG change, scenario selection should reset and then select new scenario
    const scenarioSelect2 = getAllByTestId('mock-select')[1] as HTMLSelectElement;
    expect(scenarioSelect2.value).toBe('');
    fireEvent.change(scenarioSelect2, { target: { value: 'sc-3' } });

    fireEvent.click(screen.getByText('Move'));
    expect(onMove).toHaveBeenCalledWith({ fgId: 'fg-2', scenarioId: 'sc-3' });
  });

  it('shows same-location warning for test move into current fg/scenario', () => {
    render(
      <MoveModal
        type="test"
        itemName="Test Y"
        featureGroups={featureGroups}
        currentFgId="fg-1"
        currentScenarioId="sc-1"
        onMove={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const selects = screen.getAllByTestId('mock-select');
    fireEvent.change(selects[0], { target: { value: 'fg-1' } });
    fireEvent.change(screen.getAllByTestId('mock-select')[1], { target: { value: 'sc-1' } });

    expect(screen.getByText(/current location/i)).toBeTruthy();
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(true);
  });
});
