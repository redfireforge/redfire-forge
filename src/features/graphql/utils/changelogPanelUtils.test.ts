import { describe, it, expect } from 'vitest';
import {
  buildDefaultSnapshotLabel,
  countTypesFromSdl,
  filterSnapshotsByQuery,
  formatSnapshotDayHeader,
  groupSnapshotsByDay,
  isGenericSnapshotLabel,
  resolveSnapshotTypesCount,
  snapshotDisplayTitle,
} from './changelogPanelUtils';
import type { GraphqlSchemaSnapshot } from '../../../shared/types/graphql';

const SDL = `
  type Query { health: String }
  type User { id: ID! name: String! }
  enum Status { OK }
`;

describe('changelogPanelUtils', () => {
  it('countTypesFromSdl counts type definitions', () => {
    expect(countTypesFromSdl(SDL)).toBe(3);
  });

  it('resolveSnapshotTypesCount prefers introspection count', () => {
    expect(resolveSnapshotTypesCount(SDL, 10)).toBe(10);
    expect(resolveSnapshotTypesCount(SDL, 0)).toBe(3);
  });

  it('buildDefaultSnapshotLabel includes date and time', () => {
    const label = buildDefaultSnapshotLabel(Date.UTC(2026, 5, 22, 16, 31));
    expect(label).toMatch(/^Snapshot · /);
    expect(label).toContain('Jun');
  });

  it('isGenericSnapshotLabel detects auto labels', () => {
    expect(isGenericSnapshotLabel('Snapshot')).toBe(true);
    expect(isGenericSnapshotLabel('Snapshot · Jun 22, 2026 4:31 PM')).toBe(true);
    expect(isGenericSnapshotLabel('Prior release (demo)')).toBe(false);
  });

  it('snapshotDisplayTitle uses time for generic labels', () => {
    const snap = {
      id: '1',
      label: 'Snapshot · Jun 22, 2026 4:31 PM',
      capturedAt: Date.UTC(2026, 5, 22, 16, 31),
      typesCount: 3,
      sdl: SDL,
      connectionId: 'c1',
    } satisfies GraphqlSchemaSnapshot;
    expect(snapshotDisplayTitle(snap)).not.toBe('Snapshot');
  });

  it('filterSnapshotsByQuery matches label and date text', () => {
    const snaps = [
      { id: '1', label: 'v1.0', capturedAt: Date.now(), typesCount: 1, sdl: SDL, connectionId: 'c1' },
      { id: '2', label: 'baseline', capturedAt: Date.now() - 1000, typesCount: 1, sdl: SDL, connectionId: 'c1' },
    ] satisfies GraphqlSchemaSnapshot[];
    expect(filterSnapshotsByQuery(snaps, 'baseline')).toHaveLength(1);
  });

  it('groupSnapshotsByDay buckets snapshots', () => {
    const today = Date.now();
    const snaps = [
      { id: '1', capturedAt: today, typesCount: 1, sdl: SDL, connectionId: 'c1' },
      { id: '2', capturedAt: today - 86_400_000, typesCount: 1, sdl: SDL, connectionId: 'c1' },
    ] satisfies GraphqlSchemaSnapshot[];
    const groups = groupSnapshotsByDay(snaps);
    expect(groups.length).toBe(2);
    expect(formatSnapshotDayHeader(groups[0].dayKey)).toBe('Today');
  });
});
