import { describe, it, expect } from 'vitest';
import {
  buildDefaultSnapshotLabel,
  countTypesFromSdl,
  filterSnapshotsByQuery,
  formatSnapshotDayHeader,
  formatSnapshotDate,
  groupSnapshotsByDay,
  isGenericSnapshotLabel,
  resolveSnapshotTypesCount,
  snapshotDisplayTitle,
  snapshotDisplaySubtitle,
} from './changelogPanelUtils';
import type { GraphqlSchemaSnapshot } from '../../../shared/types/graphql';

const SDL = `
  type Query { health: String }
  type User { id: ID! name: String! }
  enum Status { OK }
`;

describe('changelogPanelUtils', () => {
  it('countTypesFromSdl ignores text without schema type declarations', () => {
    expect(countTypesFromSdl('directive @x on FIELD\n# comment only')).toBe(0);
  });

  it('countTypesFromSdl returns zero for empty SDL', () => {
    expect(countTypesFromSdl('')).toBe(0);
    expect(countTypesFromSdl('  \n  ')).toBe(0);
  });

  it('countTypesFromSdl counts type definitions', () => {
    expect(countTypesFromSdl(SDL)).toBe(3);
  });

  it('resolveSnapshotTypesCount prefers introspection count', () => {
    expect(resolveSnapshotTypesCount(SDL, 10)).toBe(10);
    expect(resolveSnapshotTypesCount(SDL, 0)).toBe(3);
  });

  it('formatSnapshotDayHeader returns Invalid Date for invalid day strings', () => {
    expect(formatSnapshotDayHeader('not-a-real-day')).toBe('Invalid Date');
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
    expect(isGenericSnapshotLabel(undefined)).toBe(true);
  });

  it('snapshotDisplayTitle returns the custom label when not generic', () => {
    const snap = {
      id: '2',
      label: 'Release Candidate',
      capturedAt: Date.UTC(2026, 5, 22, 16, 31),
      typesCount: 2,
      sdl: SDL,
      connectionId: 'c1',
    } satisfies GraphqlSchemaSnapshot;
    expect(snapshotDisplayTitle(snap)).toBe('Release Candidate');
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

  it('formatSnapshotDayHeader shows Yesterday for prior day', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    expect(formatSnapshotDayHeader(yesterday)).toBe('Yesterday');
  });

  it('formatSnapshotDayHeader formats older days with weekday', () => {
    expect(formatSnapshotDayHeader('Mon Jan 01 2024')).toMatch(/2024/);
  });

  it('snapshotDisplaySubtitle uses types only for generic labels', () => {
    const snap = {
      id: '1',
      label: 'Snapshot',
      capturedAt: Date.UTC(2026, 5, 22, 16, 31),
      typesCount: 1,
      sdl: SDL,
      connectionId: 'c1',
    } satisfies GraphqlSchemaSnapshot;
    expect(snapshotDisplaySubtitle(snap)).toBe('1 type');
  });

  it('snapshotDisplaySubtitle includes date for custom labels', () => {
    const snap = {
      id: '1',
      label: 'Release 2.0',
      capturedAt: Date.UTC(2026, 5, 22, 16, 31),
      typesCount: 2,
      sdl: SDL,
      connectionId: 'c1',
    } satisfies GraphqlSchemaSnapshot;
    expect(snapshotDisplaySubtitle(snap)).toContain('2 types');
    expect(snapshotDisplaySubtitle(snap)).toContain(formatSnapshotDate(snap.capturedAt));
  });

  it('filterSnapshotsByQuery returns all when query is blank', () => {
    const snaps = [
      { id: '1', label: 'v1.0', capturedAt: Date.now(), typesCount: 1, sdl: SDL, connectionId: 'c1' },
    ] satisfies GraphqlSchemaSnapshot[];
    expect(filterSnapshotsByQuery(snaps, '   ')).toHaveLength(1);
  });

  it('filterSnapshotsByQuery matches formatted date strings', () => {
    const ts = Date.UTC(2026, 5, 22, 16, 31);
    const snaps = [
      { id: '1', label: 'alpha', capturedAt: ts, typesCount: 1, sdl: SDL, connectionId: 'c1' },
    ] satisfies GraphqlSchemaSnapshot[];
    expect(filterSnapshotsByQuery(snaps, '2026')).toHaveLength(1);
  });

  it('groupSnapshotsByDay merges same-day snapshots into one bucket', () => {
    const t = Date.now();
    const snaps = [
      { id: '1', capturedAt: t, typesCount: 1, sdl: SDL, connectionId: 'c1' },
      { id: '2', capturedAt: t + 1000, typesCount: 1, sdl: SDL, connectionId: 'c1' },
    ] satisfies GraphqlSchemaSnapshot[];
    const groups = groupSnapshotsByDay(snaps);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});
