/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  selectOptionByIndex,
  getCustomSelectValue,
  getCustomSelectOptionLabels,
} from '../../../test-utils/customSelectHelper';
import MoveModal from './MoveModal';
import type { FeatureGroup } from '../../../shared/types';

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

const makeFeatureGroups = (): FeatureGroup[] => [
  {
    id: 'fg-1', name: 'Auth', microserviceId: 'svc-1', environmentId: 'env-1',
    scenarios: [
      {
        id: 'sc-1', name: 'Login', kind: 'standard',
        tests: [{ id: 't-1', name: 'GET login', url: '/login', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } }],
      },
      { id: 'sc-2', name: 'Signup', kind: 'standard', tests: [] },
    ],
  },
  {
    id: 'fg-2', name: 'Payments', microserviceId: 'svc-1', environmentId: 'env-1',
    scenarios: [
      { id: 'sc-3', name: 'Checkout', kind: 'standard', tests: [] },
    ],
  },
];

describe('MoveModal', () => {
  const onMove = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => { onMove.mockClear(); onClose.mockClear(); });

  const renderModal = (overrides = {}) =>
    render(
      <MoveModal
        type="scenario"
        itemName="Login"
        featureGroups={makeFeatureGroups()}
        currentFgId="fg-1"
        currentScenarioId="sc-1"
        onMove={onMove}
        onClose={onClose}
        {...overrides}
      />,
    );

  it('renders title with type label', () => {
    renderModal();
    expect(screen.getByTestId('modal-title').textContent).toContain('Move Scenario');
  });

  it('renders Move Test title for test type', () => {
    renderModal({ type: 'test' });
    expect(screen.getByTestId('modal-title').textContent).toContain('Move Test');
  });

  it('shows item name in banner', () => {
    renderModal();
    screen.getByText('Login');
  });

  it('renders feature group select with placeholder', () => {
    const { container } = renderModal();
    expect(getCustomSelectValue(container)).toBe('— Select Feature Group —');
    screen.getByText('— Select Feature Group —');
  });

  it('disables Move button initially (no target selected)', () => {
    renderModal();
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Move button when a different feature group is selected', () => {
    const { container } = renderModal();
    selectOptionByIndex(container, 0, 'Payments (1 scenarios)');
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables Move when same location is selected', () => {
    const { container } = renderModal();
    selectOptionByIndex(container, 0, 'Auth (2 scenarios) (current)');
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(true);
    screen.getByText(/current location/i);
  });

  it('calls onMove with correct target for scenario', () => {
    const { container } = renderModal();
    selectOptionByIndex(container, 0, 'Payments (1 scenarios)');
    fireEvent.click(screen.getByText('Move'));
    expect(onMove).toHaveBeenCalledWith({ fgId: 'fg-2', scenarioId: undefined });
  });

  it('calls onClose when Cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows scenario select for test type when feature group is selected', () => {
    const { container } = renderModal({ type: 'test' });
    selectOptionByIndex(container, 0, 'Payments (1 scenarios)');
    expect(container.querySelectorAll('.cs-wrapper')).toHaveLength(2);
  });

  it('disables Move for test type until both fg and scenario are selected', () => {
    const { container } = renderModal({ type: 'test' });
    selectOptionByIndex(container, 0, 'Payments (1 scenarios)');
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(true);

    selectOptionByIndex(container, 1, 'Checkout (0 tests)');
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onMove with fgId and scenarioId for test type', () => {
    const { container } = renderModal({ type: 'test' });
    selectOptionByIndex(container, 0, 'Payments (1 scenarios)');
    selectOptionByIndex(container, 1, 'Checkout (0 tests)');
    fireEvent.click(screen.getByText('Move'));
    expect(onMove).toHaveBeenCalledWith({ fgId: 'fg-2', scenarioId: 'sc-3' });
  });

  it('shows empty state when no feature groups', () => {
    renderModal({ featureGroups: [] });
    screen.getByText('No feature groups available');
  });

  it('shows empty state when selected fg has no scenarios (test type)', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg-empty', name: 'Empty', microserviceId: 's', environmentId: 'e', scenarios: [],
    }];
    const { container } = renderModal({ type: 'test', featureGroups: fgs });
    selectOptionByIndex(container, 0, 'Empty (0 scenarios)');
    screen.getByText('No scenarios in this feature group');
  });

  it('filters target scenarios when sourceScenarioKind is set', () => {
    const mixed: FeatureGroup[] = [{
      id: 'fg-mix', name: 'Mixed', microserviceId: 's', environmentId: 'e',
      scenarios: [
        { id: 'sc-std', name: 'Std', kind: 'standard', tests: [] },
        {
          id: 'sc-par', name: 'Par', kind: 'parameterized', tests: [
            {
              id: 'tp-1', name: 'T1', url: '/x', method: 'GET',
              headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            },
          ],
        },
      ],
    }];
    const { container } = renderModal({ type: 'test', sourceScenarioKind: 'parameterized', featureGroups: mixed });
    selectOptionByIndex(container, 0, 'Mixed (2 scenarios)');

    const scenarioLabels = getCustomSelectOptionLabels(container, 1);
    expect(scenarioLabels.some(l => /Par \(1 tests\)/.test(l))).toBe(true);
    expect(scenarioLabels.some(l => /Std/.test(l))).toBe(false);

    selectOptionByIndex(container, 1, 'Par (1 tests)');
    fireEvent.click(screen.getByText('Move'));
    expect(onMove).toHaveBeenCalledWith({ fgId: 'fg-mix', scenarioId: 'sc-par' });
  });

  it('shows parameterized empty message when feature group only has standard scenarios', () => {
    const onlyStandard: FeatureGroup[] = [{
      id: 'fg-s', name: 'StandardsOnly', microserviceId: 's', environmentId: 'e',
      scenarios: [{ id: 'sc-std', name: 'Std', kind: 'standard', tests: [] }],
    }];
    const { container } = renderModal({ type: 'test', sourceScenarioKind: 'parameterized', featureGroups: onlyStandard });
    selectOptionByIndex(container, 0, 'StandardsOnly (1 scenarios)');
    screen.getByText('No parameterized scenarios in this feature group');
  });

  it('shows standard empty message when feature group only has parameterized scenarios', () => {
    const onlyParameterized: FeatureGroup[] = [{
      id: 'fg-p', name: 'ParOnly', microserviceId: 's', environmentId: 'e',
      scenarios: [{ id: 'sc-par', name: 'Par', kind: 'parameterized', tests: [] }],
    }];
    const { container } = renderModal({ type: 'test', sourceScenarioKind: 'standard', featureGroups: onlyParameterized });
    selectOptionByIndex(container, 0, 'ParOnly (1 scenarios)');
    screen.getByText('No standard scenarios in this feature group');
  });

  it('marks current feature group in dropdown', () => {
    const { container } = renderModal();
    expect(getCustomSelectOptionLabels(container, 0).some(l => /Auth.*current/.test(l))).toBe(true);
  });

  it('marks current scenario when moving a test within the same feature group', () => {
    const { container } = renderModal({ type: 'test' });
    selectOptionByIndex(container, 0, 'Auth (2 scenarios) (current)');
    expect(getCustomSelectOptionLabels(container, 1).some(l => /Login.*\(current\)/.test(l))).toBe(true);
  });

  it('does not call onMove when Move is disabled at same test location', () => {
    const { container } = renderModal({ type: 'test' });
    selectOptionByIndex(container, 0, 'Auth (2 scenarios) (current)');
    selectOptionByIndex(container, 1, 'Login (1 tests) (current)');
    const moveBtn = screen.getByText('Move') as HTMLButtonElement;
    expect(moveBtn.disabled).toBe(true);
    fireEvent.click(moveBtn);
    expect(onMove).not.toHaveBeenCalled();
  });
});
