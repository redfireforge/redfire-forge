/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  selectOptionByIndex,
  getCustomSelectValue,
  getCustomSelectOptionLabels,
} from '../../../test-utils/customSelectHelper';
import CopyTestModal from './CopyTestModal';
import type { Scenario, FeatureGroup } from '@shared/types';

vi.mock('../../../shared/components/PopupModal', () => ({
  __esModule: true,
  default: ({ title, onClose: _onClose, children, footer }: {
    title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
  }) => (
    <div data-testid="popup-modal">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
    </div>
  ),
}));

const makeTest = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: 'test-1',
  name: 'Login Test',
  url: '/api/login',
  method: 'POST',
  headers: [],
  body: '',
  auth: { type: 'none' },
  validation: { mode: 'none' },
  ...overrides,
});

const makeFeatureGroups = (): FeatureGroup[] => [
  {
    id: 'fg-1', name: 'Auth', microserviceId: 'svc-1', environmentId: 'env-1',
    scenarios: [
      { id: 'sc-1', name: 'Login Scenario', kind: 'standard', tests: [makeTest()] },
      { id: 'sc-2', name: 'Signup Scenario', kind: 'standard', tests: [] },
    ],
  },
  {
    id: 'fg-2', name: 'Payments', microserviceId: 'svc-1', environmentId: 'env-1',
    scenarios: [
      { id: 'sc-1', name: 'Shared Id Scenario', kind: 'standard', tests: [] },
      { id: 'sc-3', name: 'Checkout Scenario', kind: 'parameterized', tests: [] },
    ],
  },
];

describe('CopyTestModal', () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => { onConfirm.mockClear(); onClose.mockClear(); });

  const renderModal = (overrides = {}) =>
    render(
      <CopyTestModal
        test={makeTest()}
        sourceFeatureId="fg-1"
        sourceScenarioId="sc-1"
        featureGroups={makeFeatureGroups()}
        onConfirm={onConfirm}
        onClose={onClose}
        {...overrides}
      />,
    );

  it('renders the title and test name banner', () => {
    renderModal();
    expect(screen.getByTestId('modal-title').textContent).toContain('Copy Test To...');
    screen.getByText('Login Test');
  });

  it('renders feature group and scenario dropdowns', () => {
    const { container } = renderModal();
    expect(container.querySelectorAll('.cs-wrapper')).toHaveLength(2);
  });

  it('disables Copy Here when no target scenario is selected', () => {
    renderModal({ sourceScenarioId: '' });
    expect(screen.getByText('Copy Here')).toBeDisabled();
  });

  it('does not mark current when scenario id matches source but feature group differs', () => {
    const { container } = renderModal();
    selectOptionByIndex(container, 0, 'Payments');
    expect(getCustomSelectOptionLabels(container, 1)).toContain('Shared Id Scenario');
    expect(screen.queryByText(/Shared Id Scenario \(current\)/)).toBeNull();
  });

  it('does not show current marker when a different feature group is targeted', () => {
    const { container } = renderModal();
    selectOptionByIndex(container, 0, 'Payments');
    expect(screen.queryByText(/\(current\)/)).toBeNull();
  });

  it('marks the source scenario as current when target matches source location', () => {
    const { container } = renderModal();
    const labels = getCustomSelectOptionLabels(container, 1);
    expect(labels.some(l => /Login Scenario \(current\)/.test(l))).toBe(true);
    expect(labels).toContain('Signup Scenario');
  });

  it('defaults to source feature and scenario', () => {
    const { container } = renderModal();
    expect(getCustomSelectValue(container, 0)).toBe('Auth');
    expect(getCustomSelectValue(container, 1)).toBe('Login Scenario (current)');
  });

  it('calls onConfirm with selected feature and scenario on Copy', () => {
    renderModal();
    fireEvent.click(screen.getByText('Copy Here'));
    expect(onConfirm).toHaveBeenCalledWith('fg-1', 'sc-1');
  });

  it('calls onClose when Cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates scenarios when feature group changes', () => {
    const { container } = renderModal();
    selectOptionByIndex(container, 0, 'Payments');
    expect(getCustomSelectValue(container, 1)).toBe('Shared Id Scenario');
  });

  it('marks current scenario in the dropdown', () => {
    renderModal();
    screen.getByText('Login Scenario (current)');
  });

  it('shows non-current scenario labels without suffix', () => {
    const { container } = renderModal();
    const labels = getCustomSelectOptionLabels(container, 1);
    expect(labels).toContain('Signup Scenario');
    expect(labels.some(l => l === 'Signup Scenario (current)')).toBe(false);
  });


  it('disables Copy Here when no target scenario is available', () => {
    renderModal({
      sourceScenarioId: '',
      featureGroups: [{ id: 'fg-1', name: 'Solo', microserviceId: 's', environmentId: 'e', scenarios: [] }],
    });
    const copy = screen.getByRole('button', { name: /Copy Here/ });
    expect(copy).toBeDisabled();
    fireEvent.click(copy);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('updates target scenario when changing scenario select manually', () => {
    const { container } = renderModal();
    selectOptionByIndex(container, 1, 'Signup Scenario');
    expect(getCustomSelectValue(container, 1)).toBe('Signup Scenario');
    fireEvent.click(screen.getByText('Copy Here'));
    expect(onConfirm).toHaveBeenCalledWith('fg-1', 'sc-2');
  });

  it('resets target scenario when changing to a feature group with no scenarios', () => {
    const featureGroups = [
      ...makeFeatureGroups(),
      {
        id: 'fg-empty',
        name: 'NoScenarios',
        microserviceId: 'svc-1',
        environmentId: 'env-1',
        scenarios: [],
      },
    ];
    const { container } = renderModal({ featureGroups });
    selectOptionByIndex(container, 0, 'NoScenarios');
    expect(screen.getByText('No scenarios in this feature group')).toBeInTheDocument();
  });

  it('shows No scenarios when initial feature id does not match any group', () => {
    renderModal({
      sourceFeatureId: 'missing-fg',
      sourceScenarioId: 'sc-1',
    });
    expect(screen.getByText('No scenarios in this feature group')).toBeInTheDocument();
  });

  it('filters scenarios by sourceScenarioKind when provided', () => {
    const { container } = renderModal({
      sourceScenarioKind: 'parameterized',
      sourceFeatureId: 'fg-2',
      sourceScenarioId: 'sc-3',
    });
    expect(getCustomSelectOptionLabels(container, 1).some(l => /Checkout Scenario/.test(l))).toBe(true);
    expect(getCustomSelectOptionLabels(container, 1).some(l => /Shared Id Scenario/.test(l))).toBe(false);
  });

  it('shows kind-specific empty message when no matching scenarios', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg-1', name: 'Only Standard', microserviceId: 's', environmentId: 'e',
      scenarios: [
        { id: 'sc-1', name: 'Standard Only', kind: 'standard', tests: [] },
      ],
    }];
    renderModal({
      featureGroups: fgs,
      sourceFeatureId: 'fg-1',
      sourceScenarioId: 'sc-1',
      sourceScenarioKind: 'parameterized',
    });
    expect(screen.getByText('No parameterized scenarios in this feature group')).toBeInTheDocument();
  });

  it('shows standard empty message when filtering for standard', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg-1', name: 'Only Param', microserviceId: 's', environmentId: 'e',
      scenarios: [
        { id: 'sc-1', name: 'Param Only', kind: 'parameterized', tests: [] },
      ],
    }];
    renderModal({
      featureGroups: fgs,
      sourceFeatureId: 'fg-1',
      sourceScenarioId: 'sc-1',
      sourceScenarioKind: 'standard',
    });
    expect(screen.getByText('No standard scenarios in this feature group')).toBeInTheDocument();
  });

  it('kind filtering updates when switching feature groups', () => {
    const fgs: FeatureGroup[] = [
      {
        id: 'fg-1', name: 'Mixed', microserviceId: 's', environmentId: 'e',
        scenarios: [
          { id: 'sc-1', name: 'Standard', kind: 'standard', tests: [] },
          { id: 'sc-2', name: 'Param', kind: 'parameterized', tests: [] },
        ],
      },
      {
        id: 'fg-2', name: 'Standard Only', microserviceId: 's', environmentId: 'e',
        scenarios: [
          { id: 'sc-3', name: 'Only Std', kind: 'standard', tests: [] },
        ],
      },
    ];
    const { container } = renderModal({
      featureGroups: fgs,
      sourceFeatureId: 'fg-1',
      sourceScenarioId: 'sc-2',
      sourceScenarioKind: 'parameterized',
    });
    const scenarioLabels = getCustomSelectOptionLabels(container, 1);
    expect(scenarioLabels.some(l => l.includes('Param'))).toBe(true);
    expect(scenarioLabels.some(l => l === 'Standard')).toBe(false);

    selectOptionByIndex(container, 0, 'Standard Only');
    expect(screen.getByText('No parameterized scenarios in this feature group')).toBeInTheDocument();
  });
});

