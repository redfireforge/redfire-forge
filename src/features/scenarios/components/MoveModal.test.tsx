/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      { id: 'sc-1', name: 'Login', tests: [{ id: 't-1', name: 'GET login', url: '/login', method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } }] },
      { id: 'sc-2', name: 'Signup', tests: [] },
    ],
  },
  {
    id: 'fg-2', name: 'Payments', microserviceId: 'svc-1', environmentId: 'env-1',
    scenarios: [
      { id: 'sc-3', name: 'Checkout', tests: [] },
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
    renderModal();
    const select = screen.getByRole('combobox');
    expect((select as HTMLSelectElement).value).toBe('');
    screen.getByText('— Select Feature Group —');
  });

  it('disables Move button initially (no target selected)', () => {
    renderModal();
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Move button when a different feature group is selected', () => {
    renderModal();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fg-2' } });
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables Move when same location is selected', () => {
    renderModal();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'fg-1' } });
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(true);
    screen.getByText(/current location/i);
  });

  it('calls onMove with correct target for scenario', () => {
    renderModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fg-2' } });
    fireEvent.click(screen.getByText('Move'));
    expect(onMove).toHaveBeenCalledWith({ fgId: 'fg-2', scenarioId: undefined });
  });

  it('calls onClose when Cancel is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows scenario select for test type when feature group is selected', () => {
    renderModal({ type: 'test' });
    const fgSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(fgSelect, { target: { value: 'fg-2' } });
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
  });

  it('disables Move for test type until both fg and scenario are selected', () => {
    renderModal({ type: 'test' });
    const fgSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(fgSelect, { target: { value: 'fg-2' } });
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(true);

    const scSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(scSelect, { target: { value: 'sc-3' } });
    expect((screen.getByText('Move') as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onMove with fgId and scenarioId for test type', () => {
    renderModal({ type: 'test' });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'fg-2' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'sc-3' } });
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
    renderModal({ type: 'test', featureGroups: fgs });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'fg-empty' } });
    screen.getByText('No scenarios in this feature group');
  });

  it('marks current feature group in dropdown', () => {
    renderModal();
    screen.getByText(/Auth.*current/);
  });

  it('marks current scenario when moving a test within the same feature group', () => {
    renderModal({ type: 'test' });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'fg-1' } });
    screen.getByText(/Login.*\(current\)/);
  });

  it('does not call onMove when Move is disabled at same test location', () => {
    renderModal({ type: 'test' });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'fg-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'sc-1' } });
    const moveBtn = screen.getByText('Move') as HTMLButtonElement;
    expect(moveBtn.disabled).toBe(true);
    fireEvent.click(moveBtn);
    expect(onMove).not.toHaveBeenCalled();
  });
});
