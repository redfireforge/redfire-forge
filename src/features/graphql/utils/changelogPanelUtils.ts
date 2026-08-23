import type { GraphqlSchemaSnapshot } from '@shared/types/graphql';

/** Count GraphQL definition lines when introspection types array is unavailable. */
export function countTypesFromSdl(sdl: string): number {
  const matches = sdl.match(/^\s*(type|interface|enum|input|scalar|union)\s+[A-Za-z_]\w*/gm);
  return matches?.length ?? 0;
}

export function resolveSnapshotTypesCount(sdl: string, introspectedCount: number): number {
  if (introspectedCount > 0) return introspectedCount;
  return countTypesFromSdl(sdl);
}

/** Default label for manual saves — time makes each snapshot distinguishable. */
export function buildDefaultSnapshotLabel(capturedAt: number): string {
  const d = new Date(capturedAt);
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Snapshot · ${date} ${time}`;
}

export function formatSnapshotDate(capturedAt: number): string {
  const d = new Date(capturedAt);
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

export function formatSnapshotTime(capturedAt: number): string {
  return new Date(capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function snapshotDayKey(capturedAt: number): string {
  return new Date(capturedAt).toDateString();
}

export function formatSnapshotDayHeader(dayKey: string): string {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  if (dayKey === today) return 'Today';
  if (dayKey === yesterday) return 'Yesterday';
  return new Date(dayKey).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isGenericSnapshotLabel(label: string | undefined): boolean {
  return !label || label === 'Snapshot' || label.startsWith('Snapshot ·');
}

export function snapshotDisplayTitle(snap: GraphqlSchemaSnapshot): string {
  if (!isGenericSnapshotLabel(snap.label)) return snap.label!;
  return formatSnapshotTime(snap.capturedAt);
}

export function snapshotDisplaySubtitle(snap: GraphqlSchemaSnapshot): string {
  const types = `${snap.typesCount} type${snap.typesCount === 1 ? '' : 's'}`;
  if (!isGenericSnapshotLabel(snap.label)) {
    return `${types} · ${formatSnapshotDate(snap.capturedAt)}`;
  }
  return types;
}

export function filterSnapshotsByQuery(
  snapshots: GraphqlSchemaSnapshot[],
  query: string,
): GraphqlSchemaSnapshot[] {
  const q = query.trim().toLowerCase();
  if (!q) return snapshots;
  return snapshots.filter((snap) => {
    const label = snap.label ?? 'Snapshot';
    const date = formatSnapshotDate(snap.capturedAt);
    return label.toLowerCase().includes(q) || date.toLowerCase().includes(q);
  });
}

export function groupSnapshotsByDay(
  snapshots: GraphqlSchemaSnapshot[],
): Array<{ dayKey: string; items: GraphqlSchemaSnapshot[] }> {
  const map = new Map<string, GraphqlSchemaSnapshot[]>();
  for (const snap of snapshots) {
    const key = snapshotDayKey(snap.capturedAt);
    const bucket = map.get(key);
    if (bucket) bucket.push(snap);
    else map.set(key, [snap]);
  }
  return [...map.entries()].map(([dayKey, items]) => ({ dayKey, items }));
}

export const CHANGELOG_VISIBLE_CAP = 8;
