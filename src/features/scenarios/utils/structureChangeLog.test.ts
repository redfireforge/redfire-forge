import { describe, it, expect, vi } from 'vitest';
import type { FeatureGroup } from '../../../shared/types';
import {
  createEntry,
  appendToLog,
  logScenarioAdded,
  logScenarioRemoved,
  logScenarioRenamed,
  logScenarioMovedIn,
  logScenarioMovedOut,
  logTestAdded,
  logTestRemoved,
  logTestRenamed,
  logTestMovedIn,
  logTestMovedOut,
  logTestCopied,
  logFgRenamed,
  logItemRestored,
  deleteLogEntry,
  clearLog,
  countLogEntries,
  stripStructureLog,
  hasStructureLog,
  actionLabel,
  actionIcon,
  actionClass,
} from './structureChangeLog';

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }));

function makeFg(overrides?: Partial<FeatureGroup>): FeatureGroup {
  return { id: 'fg1', name: 'FG1', scenarios: [], ...overrides };
}

describe('structureChangeLog', () => {
  describe('createEntry', () => {
    it('creates entry with required fields', () => {
      const e = createEntry('scenario-added', 'Sc1');
      expect(e.id).toBe('test-uuid');
      expect(e.action).toBe('scenario-added');
      expect(e.entityName).toBe('Sc1');
      expect(e.timestamp).toBeGreaterThan(0);
      expect(e.scenarioName).toBeUndefined();
      expect(e.detail).toBeUndefined();
    });

    it('creates entry with optional fields', () => {
      const e = createEntry('test-added', 'T1', 'Sc1', 'some detail');
      expect(e.scenarioName).toBe('Sc1');
      expect(e.detail).toBe('some detail');
    });
  });

  describe('appendToLog', () => {
    it('prepends entry to empty log', () => {
      const fg = makeFg();
      const entry = createEntry('scenario-added', 'Sc1');
      const result = appendToLog(fg, entry);
      expect(result.structureLog).toHaveLength(1);
      expect(result.structureLog![0]).toBe(entry);
    });

    it('prepends entry to existing log', () => {
      const existing = createEntry('scenario-removed', 'Old');
      const fg = makeFg({ structureLog: [existing] });
      const entry = createEntry('scenario-added', 'New');
      const result = appendToLog(fg, entry);
      expect(result.structureLog).toHaveLength(2);
      expect(result.structureLog![0].entityName).toBe('New');
      expect(result.structureLog![1].entityName).toBe('Old');
    });

    it('caps log at maxEntries', () => {
      const entries = Array.from({ length: 5 }, (_, i) => createEntry('scenario-added', `S${i}`));
      const fg = makeFg({ structureLog: entries });
      const entry = createEntry('scenario-added', 'New');
      const result = appendToLog(fg, entry, 3);
      expect(result.structureLog).toHaveLength(3);
      expect(result.structureLog![0].entityName).toBe('New');
    });

    it('does not mutate original', () => {
      const fg = makeFg();
      const entry = createEntry('scenario-added', 'Sc1');
      appendToLog(fg, entry);
      expect(fg.structureLog).toBeUndefined();
    });
  });

  describe('convenience loggers', () => {
    const fg = makeFg();

    it('logScenarioAdded', () => {
      const r = logScenarioAdded(fg, 'MySc');
      expect(r.structureLog![0].action).toBe('scenario-added');
      expect(r.structureLog![0].entityName).toBe('MySc');
    });

    it('logScenarioRemoved', () => {
      const r = logScenarioRemoved(fg, 'MySc');
      expect(r.structureLog![0].action).toBe('scenario-removed');
    });

    it('logScenarioRenamed', () => {
      const r = logScenarioRenamed(fg, 'Old', 'New');
      expect(r.structureLog![0].action).toBe('scenario-renamed');
      expect(r.structureLog![0].detail).toBe('Old → New');
    });

    it('logScenarioMovedIn', () => {
      const r = logScenarioMovedIn(fg, 'MySc', 'OtherFG');
      expect(r.structureLog![0].action).toBe('scenario-moved-in');
      expect(r.structureLog![0].detail).toBe('from OtherFG');
    });

    it('logScenarioMovedOut', () => {
      const r = logScenarioMovedOut(fg, 'MySc', 'OtherFG');
      expect(r.structureLog![0].action).toBe('scenario-moved-out');
      expect(r.structureLog![0].detail).toBe('to OtherFG');
    });

    it('logTestAdded', () => {
      const r = logTestAdded(fg, 'T1', 'Sc1');
      expect(r.structureLog![0].action).toBe('test-added');
      expect(r.structureLog![0].scenarioName).toBe('Sc1');
    });

    it('logTestRemoved', () => {
      const r = logTestRemoved(fg, 'T1', 'Sc1');
      expect(r.structureLog![0].action).toBe('test-removed');
    });

    it('logTestRenamed', () => {
      const r = logTestRenamed(fg, 'Old', 'New', 'Sc1');
      expect(r.structureLog![0].action).toBe('test-renamed');
      expect(r.structureLog![0].detail).toBe('Old → New');
      expect(r.structureLog![0].scenarioName).toBe('Sc1');
    });

    it('logTestMovedIn', () => {
      const r = logTestMovedIn(fg, 'T1', 'Sc1', 'OtherFG');
      expect(r.structureLog![0].action).toBe('test-moved-in');
      expect(r.structureLog![0].detail).toBe('from OtherFG');
    });

    it('logTestMovedOut', () => {
      const r = logTestMovedOut(fg, 'T1', 'Sc1', 'OtherFG');
      expect(r.structureLog![0].action).toBe('test-moved-out');
      expect(r.structureLog![0].detail).toBe('to OtherFG');
    });

    it('logTestCopied', () => {
      const r = logTestCopied(fg, 'T1', 'Sc1');
      expect(r.structureLog![0].action).toBe('test-copied');
    });

    it('logFgRenamed', () => {
      const r = logFgRenamed(fg, 'Old', 'New');
      expect(r.structureLog![0].action).toBe('fg-renamed');
      expect(r.structureLog![0].detail).toBe('Old → New');
    });
  });

  describe('CRUD', () => {
    it('deleteLogEntry removes entry by id', () => {
      const entry = { ...createEntry('scenario-added', 'Sc1'), id: 'e1' };
      const entry2 = { ...createEntry('scenario-removed', 'Sc2'), id: 'e2' };
      const fg = makeFg({ structureLog: [entry, entry2] });
      const result = deleteLogEntry(fg, 'e1');
      expect(result.structureLog).toHaveLength(1);
      expect(result.structureLog![0].id).toBe('e2');
    });

    it('clearLog empties the log', () => {
      const entry = createEntry('scenario-added', 'Sc1');
      const fg = makeFg({ structureLog: [entry] });
      const result = clearLog(fg);
      expect(result.structureLog).toEqual([]);
    });
  });

  describe('helpers', () => {
    it('countLogEntries returns correct count', () => {
      expect(countLogEntries(makeFg())).toBe(0);
      expect(countLogEntries(makeFg({ structureLog: [createEntry('scenario-added', 'Sc1')] }))).toBe(1);
    });

    it('stripStructureLog removes structureLog', () => {
      const fg = makeFg({ structureLog: [createEntry('scenario-added', 'Sc1')] });
      const result = stripStructureLog(fg);
      expect(result.structureLog).toBeUndefined();
      expect(result.name).toBe('FG1');
    });

    it('hasStructureLog detects log presence', () => {
      expect(hasStructureLog(makeFg())).toBe(false);
      expect(hasStructureLog(makeFg({ structureLog: [] }))).toBe(false);
      expect(hasStructureLog(makeFg({ structureLog: [createEntry('scenario-added', 'Sc1')] }))).toBe(true);
    });
  });

  describe('display helpers', () => {
    it('actionLabel returns human-readable labels', () => {
      expect(actionLabel('scenario-added')).toBe('Scenario added');
      expect(actionLabel('test-removed')).toBe('Test removed');
      expect(actionLabel('fg-renamed')).toBe('Group renamed');
    });

    it('deleteLogEntry keeps log when id does not match', () => {
      const e1 = { ...createEntry('scenario-added', 'A'), id: 'keep' };
      const fg = makeFg({ structureLog: [e1] });
      const r = deleteLogEntry(fg, 'missing');
      expect(r.structureLog).toHaveLength(1);
    });

    it('actionLabel covers all known action codes', () => {
      const cases: Array<[import('../../../shared/types').StructureChangeAction, string]> = [
        ['scenario-added', 'Scenario added'],
        ['scenario-removed', 'Scenario removed'],
        ['scenario-renamed', 'Scenario renamed'],
        ['scenario-moved-in', 'Scenario moved in'],
        ['scenario-moved-out', 'Scenario moved out'],
        ['test-added', 'Test added'],
        ['test-removed', 'Test removed'],
        ['test-renamed', 'Test renamed'],
        ['test-moved-in', 'Test moved in'],
        ['test-moved-out', 'Test moved out'],
        ['test-copied', 'Test copied'],
        ['fg-renamed', 'Group renamed'],
        ['restored', 'Restored from trash'],
      ];
      for (const [code, label] of cases) {
        expect(actionLabel(code)).toBe(label);
      }
    });

    it('actionIcon covers renamed actions', () => {
      expect(actionIcon('scenario-added')).toBe('+');
      expect(actionIcon('scenario-moved-in')).toBe('+');
      expect(actionIcon('test-copied')).toBe('+');
      expect(actionIcon('scenario-removed')).toBe('−');
      expect(actionIcon('test-moved-out')).toBe('−');
      expect(actionIcon('scenario-renamed')).toBe('~');
    });

    it('actionLabel default returns action string for unknown values', () => {
      expect(actionLabel('not-a-real-action' as unknown as import('../../../shared/types').StructureChangeAction)).toBe('not-a-real-action');
    });

    it('actionIcon returns bullet fallback', () => {
      expect(actionIcon('not-a-real-action' as unknown as import('../../../shared/types').StructureChangeAction)).toBe('•');
    });

    it('actionClass returns empty string fallback', () => {
      expect(actionClass('not-a-real-action' as unknown as import('../../../shared/types').StructureChangeAction)).toBe('');
    });

    it('actionClass returns correct CSS classes', () => {
      expect(actionClass('scenario-added')).toBe('added');
      expect(actionClass('test-moved-in')).toBe('added');
      expect(actionClass('test-copied')).toBe('added');
      expect(actionClass('scenario-removed')).toBe('removed');
      expect(actionClass('test-moved-out')).toBe('removed');
      expect(actionClass('test-renamed')).toBe('modified');
    });
  });

  describe('logItemRestored', () => {
    it('adds a restored entry to the feature group log', () => {
      const fg = makeFg();
      const result = logItemRestored(fg, 'Login Flow');
      expect(result.structureLog).toHaveLength(1);
      expect(result.structureLog![0].action).toBe('restored');
      expect(result.structureLog![0].entityName).toBe('Login Flow');
      expect(result.structureLog![0].detail).toBe('restored from trash');
    });

    it('uses custom detail when provided', () => {
      const fg = makeFg();
      const result = logItemRestored(fg, 'Login Flow', 'Auth Scenarios', 'restored with new ID');
      expect(result.structureLog![0].scenarioName).toBe('Auth Scenarios');
      expect(result.structureLog![0].detail).toBe('restored with new ID');
    });

    it('actionLabel returns correct label for restored', () => {
      expect(actionLabel('restored')).toBe('Restored from trash');
    });

    it('actionIcon returns restore arrow for restored', () => {
      expect(actionIcon('restored')).toBe('\u21A9');
    });

    it('actionClass returns added for restored', () => {
      expect(actionClass('restored')).toBe('added');
    });
  });
});
