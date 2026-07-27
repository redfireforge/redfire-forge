/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TrashPanel from './TrashPanel';
import type { TrashItem, TrashSettings } from '../../../shared/types';
import { makeTrashItem } from '../../../test-utils/factories';

function makeItems(): TrashItem[] {
  return [
    makeTrashItem({ id: 'a', entityName: 'Login Flow', entityType: 'scenario', parentPath: 'Auth Feature' }),
    makeTrashItem({
      id: 'b', entityName: 'Payment Tests', entityType: 'featureGroup', parentPath: '',
      childCounts: { scenarios: 3, tests: 8 },
    }),
    makeTrashItem({ id: 'c', entityName: 'GET /users', entityType: 'test', parentPath: 'User Feature > CRUD' }),
    makeTrashItem({ id: 'd', entityName: 'User CSV', entityType: 'sharedDataSource', parentPath: '' }),
  ];
}

const DEFAULT_SETTINGS: TrashSettings = { retentionDays: 30, maxItems: 100 };

describe('TrashPanel', () => {
  let onRestore: ReturnType<typeof vi.fn>;
  let onPermanentlyDelete: ReturnType<typeof vi.fn>;
  let onEmptyTrash: ReturnType<typeof vi.fn>;
  let onUpdateSettings: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRestore = vi.fn().mockResolvedValue(undefined);
    onPermanentlyDelete = vi.fn().mockResolvedValue(undefined);
    onEmptyTrash = vi.fn().mockResolvedValue(undefined);
    onUpdateSettings = vi.fn().mockResolvedValue(undefined);
    onClose = vi.fn();
  });

  function renderPanel(items: TrashItem[], opts: { loading?: boolean; settings?: TrashSettings } = {}) {
    return render(
      <TrashPanel
        trashItems={items}
        loading={opts.loading ?? false}
        trashSettings={opts.settings ?? DEFAULT_SETTINGS}
        onUpdateSettings={onUpdateSettings}
        onRestore={onRestore}
        onPermanentlyDelete={onPermanentlyDelete}
        onEmptyTrash={onEmptyTrash}
        onClose={onClose}
      />,
    );
  }

  it('renders title with item count', () => {
    renderPanel(makeItems());
    expect(screen.getByText('Trash')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders all items in the list', () => {
    renderPanel(makeItems());
    expect(screen.getByText('Login Flow')).toBeInTheDocument();
    expect(screen.getByText('Payment Tests')).toBeInTheDocument();
    expect(screen.getByText('GET /users')).toBeInTheDocument();
    expect(screen.getByText('User CSV')).toBeInTheDocument();
  });

  it('displays entity type labels', () => {
    renderPanel(makeItems());
    expect(screen.getByText('Scenario')).toBeInTheDocument();
    expect(screen.getByText('Feature Group')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Shared Data Source')).toBeInTheDocument();
  });

  it('displays child counts for feature groups', () => {
    renderPanel(makeItems());
    expect(screen.getByText('3 scenarios \u00B7 8 tests')).toBeInTheDocument();
  });

  it('displays parent path', () => {
    renderPanel(makeItems());
    expect(screen.getByText('Auth Feature')).toBeInTheDocument();
    expect(screen.getByText('User Feature > CRUD')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    renderPanel([]);
    expect(screen.getByText('Trash is empty')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderPanel([], { loading: true });
    expect(screen.getByText(/Loading trash/)).toBeInTheDocument();
  });

  it('filters items by search', () => {
    renderPanel(makeItems());
    fireEvent.change(screen.getByPlaceholderText(/Search trash/), { target: { value: 'Login' } });
    expect(screen.getByText('Login Flow')).toBeInTheDocument();
    expect(screen.queryByText('Payment Tests')).not.toBeInTheDocument();
    expect(screen.queryByText('GET /users')).not.toBeInTheDocument();
  });

  it('shows no-match message when search has no results', () => {
    renderPanel(makeItems());
    fireEvent.change(screen.getByPlaceholderText(/Search trash/), { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No items match your search')).toBeInTheDocument();
  });

  it('filters by parent path', () => {
    renderPanel(makeItems());
    fireEvent.change(screen.getByPlaceholderText(/Search trash/), { target: { value: 'CRUD' } });
    expect(screen.getByText('GET /users')).toBeInTheDocument();
    expect(screen.queryByText('Login Flow')).not.toBeInTheDocument();
  });

  it('calls onRestore when Restore button is clicked', () => {
    renderPanel([makeTrashItem({ id: 'r1', entityName: 'Restore Me' })]);
    fireEvent.click(screen.getByRole('button', { name: /restore Restore Me/i }));
    expect(onRestore).toHaveBeenCalledWith('r1');
  });

  it('shows confirm dialog for permanent delete', () => {
    renderPanel([makeTrashItem({ id: 'd1', entityName: 'Delete Me' })]);
    fireEvent.click(screen.getByRole('button', { name: /delete Delete Me permanently/i }));
    expect(screen.getByText(/Permanently delete "Delete Me"\? This cannot be undone\./)).toBeInTheDocument();
  });

  it('calls onPermanentlyDelete after confirming', () => {
    renderPanel([makeTrashItem({ id: 'd1', entityName: 'Delete Me' })]);
    fireEvent.click(screen.getByRole('button', { name: /delete Delete Me permanently/i }));
    const confirmBtn = screen.getAllByRole('button', { name: /delete/i }).find(
      btn => btn.classList.contains('btn-danger'),
    );
    expect(confirmBtn).toBeDefined();
    fireEvent.click(confirmBtn!);
    expect(onPermanentlyDelete).toHaveBeenCalledWith('d1');
  });

  it('shows confirm dialog for empty trash', () => {
    renderPanel(makeItems());
    fireEvent.click(screen.getByRole('button', { name: /empty trash/i }));
    expect(screen.getByText(/Permanently delete all 4 items/)).toBeInTheDocument();
  });

  it('calls onEmptyTrash after confirming', () => {
    renderPanel(makeItems());
    fireEvent.click(screen.getByRole('button', { name: /empty trash/i }));
    const confirmBtns = screen.getAllByRole('button').filter(
      btn => btn.textContent === 'Empty Trash' && btn.classList.contains('btn-danger'),
    );
    expect(confirmBtns.length).toBe(1);
    fireEvent.click(confirmBtns[0]);
    expect(onEmptyTrash).toHaveBeenCalledTimes(1);
  });

  it('disables Empty Trash button when trash is empty', () => {
    renderPanel([]);
    const emptyBtn = screen.getByRole('button', { name: /empty trash/i });
    expect(emptyBtn).toBeDisabled();
  });

  it('calls onClose when Close button is clicked', () => {
    renderPanel([]);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has list role with listitems', () => {
    renderPanel(makeItems());
    const list = screen.getByRole('list');
    const listItems = within(list).getAllByRole('listitem');
    expect(listItems).toHaveLength(4);
  });

  // ── Settings UI tests ──

  it('renders retention dropdown with current setting', () => {
    renderPanel([], { settings: { retentionDays: 14, maxItems: 200 } });
    const retentionTrigger = screen.getByLabelText('Trash retention period');
    expect(retentionTrigger.querySelector('.cs-text')?.textContent).toBe('14 days');
  });

  it('renders max items dropdown with current setting', () => {
    renderPanel([], { settings: { retentionDays: 30, maxItems: 200 } });
    const maxTrigger = screen.getByLabelText('Maximum trash items');
    expect(maxTrigger.querySelector('.cs-text')?.textContent).toBe('200');
  });

  it('calls onUpdateSettings when retention is changed', () => {
    renderPanel([]);
    const retentionTrigger = screen.getByLabelText('Trash retention period');
    fireEvent.click(retentionTrigger);
    fireEvent.click(screen.getByText('7 days'));
    expect(onUpdateSettings).toHaveBeenCalledWith({ retentionDays: 7 });
  });

  it('calls onUpdateSettings when max items is changed', () => {
    renderPanel([]);
    const maxTrigger = screen.getByLabelText('Maximum trash items');
    fireEvent.click(maxTrigger);
    fireEvent.click(screen.getByText('50'));
    expect(onUpdateSettings).toHaveBeenCalledWith({ maxItems: 50 });
  });

  // ── formatExpiry edge cases ──

  it('shows "Expired" when item is past expiry', () => {
    renderPanel([makeTrashItem({ expiresAt: Date.now() - 1000 })]);
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });

  it('shows "Expires in 1 day" for singular', () => {
    renderPanel([makeTrashItem({ expiresAt: Date.now() + 12 * 3_600_000 })]);
    expect(screen.getByText(/Expires in 1 day$/)).toBeInTheDocument();
  });

  it('shows plural "Expires in N days" for > 1 day', () => {
    renderPanel([makeTrashItem({ expiresAt: Date.now() + 5 * 86_400_000 })]);
    expect(screen.getByText(/Expires in 5 days/)).toBeInTheDocument();
  });

  // ── formatChildCounts edge cases ──

  it('shows singular "1 scenario" and "1 test"', () => {
    renderPanel([makeTrashItem({ childCounts: { scenarios: 1, tests: 1 } })]);
    expect(screen.getByText('1 scenario \u00B7 1 test')).toBeInTheDocument();
  });

  it('omits child counts div when not present', () => {
    renderPanel([makeTrashItem({ childCounts: undefined })]);
    expect(screen.queryByText(/\d+ scenario/)).not.toBeInTheDocument();
  });

  // ── Cancel flows ──

  it('cancels permanent delete dialog', () => {
    renderPanel([makeTrashItem({ id: 'c1', entityName: 'Cancel Me' })]);
    fireEvent.click(screen.getByRole('button', { name: /delete Cancel Me permanently/i }));
    expect(screen.getByText(/Permanently delete "Cancel Me"/)).toBeInTheDocument();
    const cancelBtn = screen.getAllByRole('button').find(b => b.textContent === 'Cancel');
    expect(cancelBtn).toBeDefined();
    fireEvent.click(cancelBtn!);
    expect(screen.queryByText(/Permanently delete "Cancel Me"/)).not.toBeInTheDocument();
    expect(onPermanentlyDelete).not.toHaveBeenCalled();
  });

  it('cancels empty trash dialog', () => {
    renderPanel(makeItems());
    fireEvent.click(screen.getByRole('button', { name: /empty trash/i }));
    expect(screen.getByText(/Permanently delete all/)).toBeInTheDocument();
    const cancelBtn = screen.getAllByRole('button').find(b => b.textContent === 'Cancel');
    expect(cancelBtn).toBeDefined();
    fireEvent.click(cancelBtn!);
    expect(screen.queryByText(/Permanently delete all/)).not.toBeInTheDocument();
    expect(onEmptyTrash).not.toHaveBeenCalled();
  });

  // ── Empty trash singular message ──

  it('shows singular message for 1 item in empty trash confirm', () => {
    renderPanel([makeTrashItem()]);
    fireEvent.click(screen.getByRole('button', { name: /empty trash/i }));
    expect(screen.getByText(/Permanently delete all 1 item\?/)).toBeInTheDocument();
  });
});
