import { v4 as uuidv4 } from 'uuid';
import type { FeatureGroup, StructureChangeEntry, StructureChangeAction } from '@shared/types';

const MAX_LOG_ENTRIES = 50;

/** Create a structure change entry. */
export function createEntry(
  action: StructureChangeAction,
  entityName: string,
  scenarioName?: string,
  detail?: string,
): StructureChangeEntry {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    action,
    entityName,
    scenarioName,
    detail,
  };
}

/** Append an entry to a feature group's structure log, capping at MAX_LOG_ENTRIES. */
export function appendToLog(
  fg: FeatureGroup,
  entry: StructureChangeEntry,
  maxEntries: number = MAX_LOG_ENTRIES,
): FeatureGroup {
  const log = [entry, ...(fg.structureLog ?? [])].slice(0, maxEntries);
  return { ...fg, structureLog: log };
}

/** Log a scenario addition. */
export function logScenarioAdded(fg: FeatureGroup, scenarioName: string): FeatureGroup {
  return appendToLog(fg, createEntry('scenario-added', scenarioName));
}

/** Log a scenario removal. */
export function logScenarioRemoved(fg: FeatureGroup, scenarioName: string): FeatureGroup {
  return appendToLog(fg, createEntry('scenario-removed', scenarioName));
}

/** Log a scenario rename. */
export function logScenarioRenamed(fg: FeatureGroup, oldName: string, newName: string): FeatureGroup {
  return appendToLog(fg, createEntry('scenario-renamed', newName, undefined, `${oldName} → ${newName}`));
}

/** Log a scenario moved into this feature group. */
export function logScenarioMovedIn(fg: FeatureGroup, scenarioName: string, fromFgName: string): FeatureGroup {
  return appendToLog(fg, createEntry('scenario-moved-in', scenarioName, undefined, `from ${fromFgName}`));
}

/** Log a scenario moved out of this feature group. */
export function logScenarioMovedOut(fg: FeatureGroup, scenarioName: string, toFgName: string): FeatureGroup {
  return appendToLog(fg, createEntry('scenario-moved-out', scenarioName, undefined, `to ${toFgName}`));
}

/** Log a test addition. */
export function logTestAdded(fg: FeatureGroup, testName: string, scenarioName: string): FeatureGroup {
  return appendToLog(fg, createEntry('test-added', testName, scenarioName));
}

/** Log a test removal. */
export function logTestRemoved(fg: FeatureGroup, testName: string, scenarioName: string): FeatureGroup {
  return appendToLog(fg, createEntry('test-removed', testName, scenarioName));
}

/** Log a test rename. */
export function logTestRenamed(fg: FeatureGroup, oldName: string, newName: string, scenarioName: string): FeatureGroup {
  return appendToLog(fg, createEntry('test-renamed', newName, scenarioName, `${oldName} → ${newName}`));
}

/** Log a test moved into this feature group. */
export function logTestMovedIn(fg: FeatureGroup, testName: string, scenarioName: string, fromFgName: string): FeatureGroup {
  return appendToLog(fg, createEntry('test-moved-in', testName, scenarioName, `from ${fromFgName}`));
}

/** Log a test moved out of this feature group. */
export function logTestMovedOut(fg: FeatureGroup, testName: string, scenarioName: string, toFgName: string): FeatureGroup {
  return appendToLog(fg, createEntry('test-moved-out', testName, scenarioName, `to ${toFgName}`));
}

/** Log a test copied into this feature group. */
export function logTestCopied(fg: FeatureGroup, testName: string, scenarioName: string): FeatureGroup {
  return appendToLog(fg, createEntry('test-copied', testName, scenarioName));
}

/** Log a feature group rename. */
export function logFgRenamed(fg: FeatureGroup, oldName: string, newName: string): FeatureGroup {
  return appendToLog(fg, createEntry('fg-renamed', newName, undefined, `${oldName} → ${newName}`));
}

/** Log an item restored from trash into this feature group. */
export function logItemRestored(fg: FeatureGroup, entityName: string, scenarioName?: string, detail?: string): FeatureGroup {
  return appendToLog(fg, createEntry('restored', entityName, scenarioName, detail ?? 'restored from trash'));
}

/** Delete a single log entry. */
export function deleteLogEntry(fg: FeatureGroup, entryId: string): FeatureGroup {
  return { ...fg, structureLog: (fg.structureLog ?? []).filter(e => e.id !== entryId) };
}

/** Clear all log entries. */
export function clearLog(fg: FeatureGroup): FeatureGroup {
  return { ...fg, structureLog: [] };
}

/** Count log entries. */
export function countLogEntries(fg: FeatureGroup): number {
  return fg.structureLog?.length ?? 0;
}

/** Strip structure log from a feature group (for export). */
export function stripStructureLog(fg: FeatureGroup): FeatureGroup {
  const { structureLog: _, ...rest } = fg;
  return rest as FeatureGroup;
}

/** Check if feature group has any structure log entries. */
export function hasStructureLog(fg: FeatureGroup): boolean {
  return (fg.structureLog?.length ?? 0) > 0;
}

/** Get a human-readable label for an action. */
export function actionLabel(action: StructureChangeAction): string {
  switch (action) {
    case 'scenario-added': return 'Scenario added';
    case 'scenario-removed': return 'Scenario removed';
    case 'scenario-renamed': return 'Scenario renamed';
    case 'scenario-moved-in': return 'Scenario moved in';
    case 'scenario-moved-out': return 'Scenario moved out';
    case 'test-added': return 'Test added';
    case 'test-removed': return 'Test removed';
    case 'test-renamed': return 'Test renamed';
    case 'test-moved-in': return 'Test moved in';
    case 'test-moved-out': return 'Test moved out';
    case 'test-copied': return 'Test copied';
    case 'fg-renamed': return 'Group renamed';
    case 'restored': return 'Restored from trash';
    default: return action;
  }
}

/** Get an icon/badge character for an action. */
export function actionIcon(action: StructureChangeAction): string {
  if (action === 'restored') return '\u21A9';
  if (action.includes('added') || action.includes('moved-in') || action.includes('copied')) return '+';
  if (action.includes('removed') || action.includes('moved-out')) return '\u2212';
  if (action.includes('renamed')) return '~';
  return '\u2022';
}

export type StructureLogFilter = 'all' | 'scenario' | 'test' | 'fg';

/** Filter structure log entries by category tab. */
export function filterStructureChangeEntries(
  entries: StructureChangeEntry[],
  filter: StructureLogFilter | string,
): StructureChangeEntry[] {
  return entries.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'scenario') return e.action.startsWith('scenario-');
    if (filter === 'test') return e.action.startsWith('test-');
    if (filter === 'fg') return e.action.startsWith('fg-');
    return true;
  });
}

/** Get CSS modifier class for an action. */
export function actionClass(action: StructureChangeAction): string {
  if (action === 'restored') return 'added';
  if (action.includes('added') || action.includes('moved-in') || action.includes('copied')) return 'added';
  if (action.includes('removed') || action.includes('moved-out')) return 'removed';
  if (action.includes('renamed')) return 'modified';
  return '';
}
