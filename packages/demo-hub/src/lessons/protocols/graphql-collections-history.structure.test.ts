/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql9'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

vi.mock('../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../adapters')>();
  return {
    ...actual,
    purgeGqlLesson9WorkspaceArtifacts: vi.fn(async () => ({
      collectionsRemoved: 0,
      itemsRemoved: 0,
      historyEntriesRemoved: 0,
    })),
  };
});

import {
  setupGraphqlCollectionsHistoryBeforeEach,
  teardownGraphqlCollectionsHistoryAfterEach,
} from './graphql-collections-history.testHelpers';
import { gqlCollectionsHistoryLesson } from './graphql-collections-history';
import { GQL } from '@shared/selectors';
describe('gql-collections-history lesson', () => {
  beforeEach(() => {
    setupGraphqlCollectionsHistoryBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlCollectionsHistoryAfterEach();
  });

afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlCollectionsHistoryLesson.id).toBe('gql-collections-history');
    expect(gqlCollectionsHistoryLesson.category).toBe('graphql');
    expect(gqlCollectionsHistoryLesson.name).toBe('Collections & History');
    expect(gqlCollectionsHistoryLesson.steps.length).toBe(11);
    expect(gqlCollectionsHistoryLesson.estimatedMinutes).toBe(7);
    expect(gqlCollectionsHistoryLesson.tabBudget).toBe(1);
  });

  // ── Concept content ───────────────────────────────────────────────────────

  it('concept title includes Collections and History', () => {
    expect(gqlCollectionsHistoryLesson.concept.title).toContain('Collections');
    expect(gqlCollectionsHistoryLesson.concept.title).toContain('History');
  });

  it('concept body explains WHY History auto-logs', () => {
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('automatically appended');
  });

  it('concept body explains Preview, Load into editor, and Open & Run distinction', () => {
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Preview');
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Load into editor');
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Open & Run');
  });

  it('concept body explains Merge vs Replace import modes', () => {
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Merge');
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Replace');
  });

  it('concept body mentions team workflow for Collections', () => {
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Collections');
  });

  it('has 5 key terms', () => {
    expect(gqlCollectionsHistoryLesson.concept.keyTerms).toHaveLength(5);
  });

  it('key terms include Preview (read-only)', () => {
    const terms = gqlCollectionsHistoryLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Preview (read-only)');
  });

  it('key terms include Load into editor vs Open & Run', () => {
    const terms = gqlCollectionsHistoryLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Load into editor vs Open & Run');
  });

  it('key terms include Import merge vs replace', () => {
    const terms = gqlCollectionsHistoryLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Import merge vs replace');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('diagram is a 700x430 SVG', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('diagram contains window chrome traffic lights', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('#febc2e');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows History and Collections activity icons', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('History');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Collections');
  });

  it('diagram shows Save to Collection dialog', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Save to Collection');
  });

  it('diagram shows Load into editor and Open & Run action buttons', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Load into editor');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Open &amp; Run');
  });

  it('diagram shows lifecycle legend with Execute → Import flow', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Execute');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Export');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Import');
  });

  it('diagram uses hex design palette', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('#0f172a');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('#1e293b');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('#3b4a60');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('#3b82f6');
  });

  // ── Step spotlights match their panel/element ─────────────────────────────

  it('gql8-exec-health highlights execute button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-exec-health')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
    expect(step.verify).toBe(GQL.RESPONSE_VIEWER);
  });

  it('gql8-observe-history highlights history entry', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-observe-history')!;
    expect(step.highlight).toBe(GQL.HISTORY_ENTRY);
    expect(step.verify).toBe(GQL.HISTORY_ENTRY);
  });

  it('gql8-preview highlights history preview panel', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-preview')!;
    expect(step.highlight).toBe(GQL.HISTORY_PREVIEW);
    expect(step.verify).toBe(GQL.HISTORY_PREVIEW);
  });

  it('gql8-load highlights history load button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-load')!;
    expect(step.highlight).toBe(GQL.HISTORY_LOAD);
    expect(step.verify).toBe(GQL.EDITOR);
  });

  it('gql8-run highlights history run button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-run')!;
    expect(step.highlight).toBe(GQL.HISTORY_RUN);
    expect(step.verify).toBe(GQL.RESPONSE_VIEWER);
  });

  it('gql8-save highlights save-to-collection button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-save')!;
    expect(step.highlight).toBe(GQL.HISTORY_SAVE_TO_COL);
    expect(step.verify).toBe(GQL.COL_ITEM);
  });

  it('gql8-rename highlights rename input', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-rename')!;
    expect(step.highlight).toBe(GQL.COL_ITEM_RENAME);
    expect(step.verify).toBe(GQL.COL_ITEM);
  });

  it('gql8-export highlights collections export button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-export')!;
    expect(step.highlight).toBe(GQL.COLLECTIONS_EXPORT);
    expect(step.verify).toBe(GQL.COLLECTIONS_EXPORT);
  });

  it('gql8-delete highlights collection node', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-delete')!;
    expect(step.highlight).toBe(GQL.COL_NODE);
    expect(step.verify).toBe(GQL.COLLECTIONS_PANEL);
  });

  it('gql8-import-file highlights collections import button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import-file')!;
    expect(step.highlight).toBe(GQL.COLLECTIONS_IMPORT);
    expect(step.verify).toBe(GQL.IMPORT_MODE_DIALOG);
  });

  it('gql8-import-merge highlights merge mode button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import-merge')!;
    expect(step.highlight).toBe(GQL.IMPORT_MODE_MERGE);
    expect(step.verify).toBe(GQL.COL_ITEM);
  });

  // ── Step description WHY content ──────────────────────────────────────────

  it('gql8-observe-history description explains WHY auto-log', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-observe-history')!;
    expect(step.description).toContain('IndexedDB');
    expect(step.description).toContain('automatically');
  });

  it('gql8-preview description explains WHY preview is read-only', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-preview')!;
    expect(step.description).toContain('read-only');
  });

  it('gql8-load description uses Load into editor button label', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-load')!;
    expect(step.description).toContain('Load into editor');
    expect(step.description).toContain('without');
  });

  it('gql8-run description uses Open & Run button label', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-run')!;
    expect(step.description).toContain('Open & Run');
    expect(step.description).toContain('immediately');
  });

  it('gql8-save description explains WHY Collections exist', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-save')!;
    expect(step.description).toContain('History');
    expect(step.description).toContain('persist');
  });

  it('gql8-rename description explains WHY context menu (not double-click) for rename', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-rename')!;
    expect(step.description).toContain('double-click');
    expect(step.description).toContain('context menu');
  });

  it('gql8-export description mentions use cases for export', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-export')!;
    expect(step.description).toContain('JSON');
    expect(step.description).toContain('version control');
  });

  it('gql8-import-merge description explains Merge vs Replace', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import-merge')!;
    expect(step.description).toContain('Merge');
    expect(step.description).toContain('Replace');
  });

  it('has docker prerequisite fields', () => {
    expect(gqlCollectionsHistoryLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlCollectionsHistoryLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlCollectionsHistoryLesson.steps.map((s) => s.id)).toEqual([
      'gql8-exec-health',
      'gql8-observe-history',
      'gql8-preview',
      'gql8-load',
      'gql8-run',
      'gql8-save',
      'gql8-rename',
      'gql8-export',
      'gql8-delete',
      'gql8-import-file',
      'gql8-import-merge',
    ]);
  });

  it('all 11 steps have pauseAfter: true', () => {
    gqlCollectionsHistoryLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlCollectionsHistoryLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });
});
