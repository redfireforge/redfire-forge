/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CopyTestModal from './CopyTestModal';
import type { Scenario, FeatureGroup } from '../../../shared/types';

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
      { id: 'sc-1', name: 'Login Scenario', tests: [makeTest()] },
      { id: 'sc-2', name: 'Signup Scenario', tests: [] },
    ],
  },
  {
    id: 'fg-2', name: 'Payments', microserviceId: 'svc-1', environmentId: 'env-1',
    scenarios: [
      { id: 'sc-1', name: 'Shared Id Scenario', tests: [] },
      { id: 'sc-3', name: 'Checkout Scenario', tests: [] },
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
    renderModal();
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
  });

  it('disables Copy Here when no target scenario is selected', () => {
    renderModal({ sourceScenarioId: '' });
    expect(screen.getByText('Copy Here')).toBeDisabled();
  });

  it('does not mark current when scenario id matches source but feature group differs', () => {
    renderModal();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'fg-2' } });
    expect(screen.getByRole('option', { name: 'Shared Id Scenario' })).toBeInTheDocument();
    expect(screen.queryByText(/Shared Id Scenario \(current\)/)).toBeNull();
  });

  it('does not show current marker when a different feature group is targeted', () => {
    renderModal();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'fg-2' } });
    expect(screen.queryByText(/\(current\)/)).toBeNull();
  });

  it('marks the source scenario as current when target matches source location', () => {
    renderModal();
    expect(screen.getByRole('option', { name: /Login Scenario \(current\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Signup Scenario' })).toBeInTheDocument();
  });

  it('defaults to source feature and scenario', () => {
    renderModal();
    const selects = screen.getAllByRole('combobox');
    expect((selects[0] as HTMLSelectElement).value).toBe('fg-1');
    expect((selects[1] as HTMLSelectElement).value).toBe('sc-1');
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
    renderModal();
    const fgSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(fgSelect, { target: { value: 'fg-2' } });

    const scSelect = screen.getAllByRole('combobox')[1];
    expect((scSelect as HTMLSelectElement).value).toBe('sc-1');
  });

  it('marks current scenario in the dropdown', () => {
    renderModal();
    screen.getByText('Login Scenario (current)');
  });

  it('shows non-current scenario labels without suffix', () => {
    renderModal();
    expect(screen.getByRole('option', { name: 'Signup Scenario' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Signup Scenario (current)' })).toBeNull();
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
    renderModal();
    const scSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(scSelect, { target: { value: 'sc-2' } });
    expect((scSelect as HTMLSelectElement).value).toBe('sc-2');
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
    renderModal({ featureGroups });
    const fgSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(fgSelect, {
      target: { value: 'fg-empty' },
    });
    expect(screen.getByText('No scenarios in this feature group')).toBeInTheDocument();
  });

  it('shows No scenarios when initial feature id does not match any group', () => {
    renderModal({
      sourceFeatureId: 'missing-fg',
      sourceScenarioId: 'sc-1',
    });
    expect(screen.getByText('No scenarios in this feature group')).toBeInTheDocument();
  });
});

