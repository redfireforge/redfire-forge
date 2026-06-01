import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, TestScenario, ScenarioKind, Scenario } from '../types';

export interface MigrationResult {
  groups: FeatureGroup[];
  migrated: boolean;
  splitCount: number;
}

function isParameterized(test: Scenario): boolean {
  return !!(test.dataSource || test.sharedDataSourceId);
}

export function inferScenarioKind(tests: Scenario[]): ScenarioKind {
  if (tests.length === 0) return 'standard';
  return tests.some(isParameterized) ? 'parameterized' : 'standard';
}

function needsMigration(sc: TestScenario): boolean {
  return (sc as unknown as Record<string, unknown>).kind === undefined;
}

export function migrateScenarioKinds(groups: FeatureGroup[]): MigrationResult {
  let migrated = false;
  let splitCount = 0;

  const migratedGroups = groups.map((fg) => {
    const newScenarios: TestScenario[] = [];

    for (const sc of fg.scenarios ?? []) {
      if (!needsMigration(sc)) {
        newScenarios.push(sc);
        continue;
      }

      migrated = true;
      const standardTests = sc.tests.filter((t) => !isParameterized(t));
      const paramTests = sc.tests.filter(isParameterized);

      if (paramTests.length === 0) {
        newScenarios.push({ ...sc, kind: 'standard' });
      } else if (standardTests.length === 0) {
        newScenarios.push({ ...sc, kind: 'parameterized' });
      } else {
        splitCount++;
        newScenarios.push({
          ...sc,
          kind: 'standard',
          tests: standardTests,
        });
        newScenarios.push({
          id: uuidv4(),
          name: `${sc.name} (Parameterized)`,
          kind: 'parameterized',
          auth: sc.auth,
          tests: paramTests,
        });
      }
    }

    if (newScenarios.length !== fg.scenarios.length ||
        newScenarios.some((s, i) => s !== fg.scenarios[i])) {
      return { ...fg, scenarios: newScenarios };
    }
    return fg;
  });

  return { groups: migrated ? migratedGroups : groups, migrated, splitCount };
}

/**
 * Normalizes the `actionType` field on a `Scenario`.
 *
 * Older saved scenarios predate the `actionType` field and have it absent.
 * All consumers must treat absent `actionType` as `'http'`; this function
 * makes that explicit by writing the field when missing so downstream code
 * can compare without needing the `?? 'http'` fallback everywhere.
 *
 * This function is non-destructive: scenarios that already have `actionType`
 * are returned unchanged (same object reference).
 */
export function normalizeScenarioActionType(scenario: Scenario): Scenario {
  if (scenario.actionType !== undefined) return scenario;
  return { ...scenario, actionType: 'http' };
}

/**
 * Normalizes `actionType` on every `Scenario` across all feature groups.
 * Returns the same `groups` array reference when no changes were needed.
 */
export function normalizeGroupActionTypes(groups: FeatureGroup[]): FeatureGroup[] {
  let changed = false;

  const normalized = groups.map((fg) => {
    let fgChanged = false;
    const newScenarios = fg.scenarios?.map((sc) => {
      let scChanged = false;
      const newTests = sc.tests.map((t) => {
        const nt = normalizeScenarioActionType(t);
        if (nt !== t) { changed = true; fgChanged = true; scChanged = true; }
        return nt;
      });
      return scChanged ? { ...sc, tests: newTests } : sc;
    });
    return fgChanged ? { ...fg, scenarios: newScenarios ?? fg.scenarios } : fg;
  });

  return changed ? normalized : groups;
}
