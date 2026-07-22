/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditLogPanel from './AuditLogPanel';

// Mock platform
vi.mock('../../../shared/utils/platform', () => ({ isTauri: () => false }));

// Mock fileSaver
vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn(),
}));

const AUDIT_LOG_KEY = 'perf-test-audit-log';

function seedEntries(entries: unknown[]) {
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries));
}

const baseEntry = (overrides: Record<string, unknown> = {}) => ({
  id: `e-${Math.random()}`,
  timestamp: Date.now(),
  entityType: 'environment',
  entityId: 'env-1',
  entityName: 'production',
  action: 'created',
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe('AuditLogPanel', () => {
  it('shows empty state when no entries', async () => {
    render(<AuditLogPanel />);
    await waitFor(() => {
      expect(screen.getByText(/No audit entries yet/)).toBeTruthy();
    });
  });

  it('displays entries from localStorage', async () => {
    seedEntries([
      baseEntry({ entityName: 'staging', action: 'created', entityType: 'environment' }),
      baseEntry({ entityName: 'api-svc', action: 'deleted', entityType: 'microservice' }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => {
      expect(screen.getByText('staging')).toBeTruthy();
      expect(screen.getByText('api-svc')).toBeTruthy();
    });
  });

  it('shows entries in reverse chronological order', async () => {
    seedEntries([
      baseEntry({ id: 'first', entityName: 'first-env', timestamp: 1000 }),
      baseEntry({ id: 'second', entityName: 'second-env', timestamp: 2000 }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => {
      const names = screen.getAllByText(/env/).map((el) => el.textContent);
      const firstIdx = names.findIndex((t) => t?.includes('second'));
      const secondIdx = names.findIndex((t) => t?.includes('first'));
      expect(firstIdx).toBeLessThan(secondIdx);
    });
  });

  it('filters by entity type', async () => {
    seedEntries([
      baseEntry({ entityName: 'prod', entityType: 'environment' }),
      baseEntry({ entityName: 'api-svc', entityType: 'microservice' }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('prod')).toBeTruthy());

    const filterWrappers = document.querySelectorAll('.audit-log-filter');
    fireEvent.click(filterWrappers[0].querySelector('.cs-trigger')!);
    const typeItem = Array.from(filterWrappers[0].querySelectorAll('.cs-item'))
      .find(el => el.querySelector('.cs-item-label')?.textContent === 'Microservice')!;
    fireEvent.click(typeItem);
    expect(screen.queryByText('prod')).toBeNull();
    expect(screen.getByText('api-svc')).toBeTruthy();
  });

  it('filters by action', async () => {
    seedEntries([
      baseEntry({ entityName: 'env-a', action: 'created' }),
      baseEntry({ entityName: 'env-b', action: 'deleted' }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('env-a')).toBeTruthy());

    const filterWrappers = document.querySelectorAll('.audit-log-filter');
    fireEvent.click(filterWrappers[1].querySelector('.cs-trigger')!);
    const actionItem = Array.from(filterWrappers[1].querySelectorAll('.cs-item'))
      .find(el => el.querySelector('.cs-item-label')?.textContent === 'Deleted')!;
    fireEvent.click(actionItem);
    expect(screen.queryByText('env-a')).toBeNull();
    expect(screen.getByText('env-b')).toBeTruthy();
  });

  it('searches by entity name', async () => {
    seedEntries([
      baseEntry({ entityName: 'production' }),
      baseEntry({ entityName: 'staging' }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('production')).toBeTruthy());

    const searchInput = screen.getByPlaceholderText('Search entries...');
    fireEvent.change(searchInput, { target: { value: 'stag' } });
    expect(screen.queryByText('production')).toBeNull();
    expect(screen.getByText('staging')).toBeTruthy();
  });

  it('clears audit log on confirm', async () => {
    seedEntries([baseEntry({ entityName: 'test-env' })]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('test-env')).toBeTruthy());

    fireEvent.click(screen.getByText('Clear Log'));
    fireEvent.click(screen.getByText('Yes'));
    await waitFor(() => {
      expect(screen.getByText(/No audit entries yet/)).toBeTruthy();
    });
  });

  it('shows changes detail for updated entries', async () => {
    seedEntries([
      baseEntry({
        entityName: 'api-svc',
        action: 'updated',
        entityType: 'microservice',
        changes: [{ field: 'baseUrl[prod]', oldValue: 'http://old', newValue: 'http://new' }],
      }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => {
      expect(screen.getByText('baseUrl[prod]:')).toBeTruthy();
      expect(screen.getByText('http://old')).toBeTruthy();
      expect(screen.getByText('http://new')).toBeTruthy();
    });
  });

  it('displays action badges with correct classes', async () => {
    seedEntries([
      baseEntry({ id: '1', action: 'created', entityName: 'created-env' }),
      baseEntry({ id: '2', action: 'updated', entityName: 'updated-env' }),
      baseEntry({ id: '3', action: 'deleted', entityName: 'deleted-env' }),
      baseEntry({ id: '4', action: 'renamed', entityName: 'renamed-env' }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => {
      const badges = screen.getAllByText(/Created|Updated|Deleted|Renamed/);
      expect(badges.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('shows entry count in description', async () => {
    seedEntries([baseEntry(), baseEntry()]);
    render(<AuditLogPanel />);
    await waitFor(() => {
      expect(screen.getByText(/2 entries recorded/)).toBeTruthy();
    });
  });

  it('exports JSON when button clicked', async () => {
    const { saveFile } = await import('../../../shared/utils/fileSaver');
    seedEntries([baseEntry({ entityName: 'test-env' })]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('test-env')).toBeTruthy());

    fireEvent.click(screen.getByText('Export JSON'));
    expect(saveFile).toHaveBeenCalled();
  });

  it('exports CSV when button clicked', async () => {
    const { saveFile } = await import('../../../shared/utils/fileSaver');
    seedEntries([baseEntry({ entityName: 'test-env' })]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('test-env')).toBeTruthy());

    fireEvent.click(screen.getByText('Export CSV'));
    expect(saveFile).toHaveBeenCalled();
  });

  it('shows filter-empty state when search excludes all entries', async () => {
    seedEntries([baseEntry({ entityName: 'alpha' })]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('alpha')).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText('Search entries...'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No entries match the current filter/)).toBeTruthy();
  });

  it('cancels clear confirmation when No is clicked', async () => {
    seedEntries([baseEntry({ entityName: 'keep-me' })]);
    render(<AuditLogPanel />);
    await waitFor(() => expect(screen.getByText('keep-me')).toBeTruthy());
    fireEvent.click(screen.getByText('Clear Log'));
    fireEvent.click(screen.getByText('No'));
    expect(screen.queryByText('Clear all entries?')).toBeNull();
    expect(screen.getByText('keep-me')).toBeTruthy();
  });

  it('renders empty string change values as (empty)', async () => {
    seedEntries([
      baseEntry({
        entityName: 'svc',
        action: 'updated',
        entityType: 'microservice',
        changes: [{ field: 'name', oldValue: '', newValue: 'x' }],
      }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => {
      expect(screen.getByText('(empty)')).toBeTruthy();
    });
  });

  it('renders non-string change values as JSON', async () => {
    seedEntries([
      baseEntry({
        entityName: 'svc',
        action: 'updated',
        entityType: 'microservice',
        changes: [{ field: 'meta', oldValue: { a: 1 }, newValue: [1, 2] }],
      }),
    ]);
    render(<AuditLogPanel />);
    await waitFor(() => {
      expect(screen.getByText('{"a":1}')).toBeTruthy();
      expect(screen.getByText('[1,2]')).toBeTruthy();
    });
  });
});
