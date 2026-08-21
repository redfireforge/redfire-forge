/**
 * Row-level `--tags`/`--tag-mode` filtering for the `run` command (BUG-2).
 * Pulled out of `cli/index.ts`'s action callback so this logic is unit-testable —
 * `index.ts` has no test coverage today since it's a single monolithic Commander action.
 */
import type { Scenario } from '../src/shared/types';

export interface RowTagFilterResult {
  /** Scenarios to actually run — row-filtered, with fully-emptied scenarios dropped. */
  scenarios: Scenario[];
  /** Names of scenarios dropped entirely because every row was filtered out. */
  droppedScenarioNames: string[];
  /** Total rows remaining across all kept scenarios, for console reporting. */
  matchingRowCount: number;
}

/** Parse `--tags` into a normalized (lowercase, trimmed, deduped-by-filter) tag list. */
export function parseTagFilter(raw: string): string[] {
  return raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

/**
 * Filter each scenario's data rows by tag. A scenario with no data source (or an
 * already-empty one) is untouched and always kept — `--tags` only applies to
 * data-driven tests. A scenario whose rows *become* empty after filtering is
 * dropped entirely, rather than falling through to a single unparameterized
 * execution (the previous behavior — see BUG-2).
 */
export function filterScenariosByRowTags(
  scenarios: Scenario[],
  filterTags: string[],
  tagMode: 'any' | 'all',
): RowTagFilterResult {
  const kept: Scenario[] = [];
  const droppedScenarioNames: string[] = [];
  let matchingRowCount = 0;

  for (const sc of scenarios) {
    if (!sc.dataSource || sc.dataSource.rows.length === 0) {
      kept.push(sc);
      continue;
    }

    const filteredRows = sc.dataSource.rows.filter(row => {
      const rowTags = row.tags ?? [];
      if (rowTags.length === 0) return false;
      return tagMode === 'any'
        ? filterTags.some(t => rowTags.includes(t))
        : filterTags.every(t => rowTags.includes(t));
    });

    if (filteredRows.length === 0) {
      droppedScenarioNames.push(sc.name);
      continue;
    }

    kept.push({ ...sc, dataSource: { ...sc.dataSource, rows: filteredRows } });
    matchingRowCount += filteredRows.length;
  }

  return { scenarios: kept, droppedScenarioNames, matchingRowCount };
}
