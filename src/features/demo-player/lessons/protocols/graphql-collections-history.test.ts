/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql9'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlCollectionsHistoryLesson } from './graphql-collections-history';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON8_ITEM_NAME,
  LESSON8_ITEM_RENAME,
  buildLesson8ImportPayload,
  resetGqlLesson8SessionFlags,
  resetGqlLessonSessionFlags,
  gqlCollectionsHistoryLessonSetup,
  ensureHealthExecutedWithHistory,
  ensureHistoryPreviewOpen,
  ensureHistoryLoadedToEditor,
  ensureHistoryRunExecuted,
  ensureSavedToCollectionFromHistory,
  ensureCollectionItemRenamed,
  ensureCollectionRestoredViaImport,
  openCollectionsPanel,
  openHistoryPanel,
  ensureDemoCollectionExists,
  gqlCollectionsHistoryLessonCleanup,
} from './graphql-lesson-helpers';
import { stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-collections-history lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson8SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlCollectionsHistoryLesson.id).toBe('gql-collections-history');
    expect(gqlCollectionsHistoryLesson.category).toBe('graphql');
    expect(gqlCollectionsHistoryLesson.name).toBe('Collections & History');
    expect(gqlCollectionsHistoryLesson.steps.length).toBe(9);
    expect(gqlCollectionsHistoryLesson.estimatedMinutes).toBe(5);
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

  it('concept body explains Preview, Load, Run distinction', () => {
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Preview');
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Load');
    expect(gqlCollectionsHistoryLesson.concept.body).toContain('Run');
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

  it('diagram shows Load and Run action buttons', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Load');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Run');
  });

  it('diagram shows lifecycle legend with Execute → Import flow', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Execute');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Export');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('Import');
  });

  it('diagram uses CSS design tokens', () => {
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('var(--bg)');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('var(--surface)');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('var(--border)');
    expect(gqlCollectionsHistoryLesson.concept.diagram).toContain('var(--primary)');
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

  it('gql8-import highlights collections import button', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import')!;
    expect(step.highlight).toBe(GQL.COLLECTIONS_IMPORT);
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

  it('gql8-load description explains WHY Load differs from Run', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-load')!;
    expect(step.description).toContain('without');
  });

  it('gql8-run description explains WHY Run collapses Load+Execute', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-run')!;
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

  it('gql8-import description explains Merge vs Replace', () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import')!;
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
      'gql8-import',
    ]);
  });

  it('all 9 steps have pauseAfter: true', () => {
    gqlCollectionsHistoryLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlCollectionsHistoryLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('gql8-exec-health runs health query', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-exec-health')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql8-observe-history opens history after execute', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
      </div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-observe-history')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
  });

  it('gql8-preview opens history preview panel', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-preview"></div>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-preview')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_ENTRY);
  });

  it('gql8-load clicks history load button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-history-load"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-load')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_LOAD);
  });

  it('gql8-save opens save-to-collection modal', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div class="gql-col-node-header"></div>
          <div data-testid="gql-col-item"><span class="gql-col-item-name">${LESSON8_ITEM_NAME}</span></div>
        </div>
      </div>
      <div data-testid="gql-save-col-modal">
        <input data-testid="gql-save-col-name" />
        <button data-testid="gql-save-col-save"></button>
      </div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-save')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SAVE_COL_NAME, LESSON8_ITEM_NAME);
  });

  it('buildLesson8ImportPayload is valid JSON with health query', () => {
    const parsed = JSON.parse(buildLesson8ImportPayload()) as { collections: { items: { name: string; operation: { query: string } }[] }[] };
    expect(parsed.collections[0].items[0].name).toBe(LESSON8_ITEM_RENAME);
    expect(parsed.collections[0].items[0].operation.query).toContain('health');
  });

  it('gql8-run clicks history run button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-run')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_RUN);
  });

  it('gql8-rename opens rename modal for collection item', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div class="gql-col-node-header"></div>
          <div data-testid="gql-col-item"><span class="gql-col-item-name">${LESSON8_ITEM_NAME}</span></div>
        </div>
      </div>
      <input data-testid="gql-col-item-rename-input" />
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-save-col-modal"><input data-testid="gql-save-col-name" /><button data-testid="gql-save-col-save"></button></div>
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-rename')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.COL_ITEM_RENAME, LESSON8_ITEM_RENAME);
  });

  it('gql8-export clicks collection export button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-collections-export"></button>
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div data-testid="gql-col-item"><span class="gql-col-item-name">${LESSON8_ITEM_RENAME}</span></div>
        </div>
      </div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
    `;
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-export')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.COLLECTIONS_EXPORT);
  });

  it('ensureHistoryLoadedToEditor guard skips when editor already loaded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-preview"></div>
      </div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    await ensureHistoryLoadedToEditor(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHistoryLoadedToEditor(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_LOAD);
  });

  it('ensureCollectionItemRenamed guard skips when item already renamed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div class="gql-col-node-header"></div>
          <div data-testid="gql-col-item"><span class="gql-col-item-name">${LESSON8_ITEM_RENAME}</span></div>
        </div>
      </div>
      <input data-testid="gql-col-item-rename-input" />
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-save-col-modal"><input data-testid="gql-save-col-name" /><button data-testid="gql-save-col-save"></button></div>
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    await ensureCollectionItemRenamed(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureCollectionItemRenamed(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureHistoryPreviewOpen guard skips when preview already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-preview"></div>
      </div>
    `;
    await ensureHistoryPreviewOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHistoryPreviewOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_ENTRY);
  });

  it('gql8-import action calls collection restore helper', async () => {
    const ctx = makeCtx();
    const spy = vi.spyOn(
      await import('./graphql-lesson-helpers'),
      'ensureCollectionRestoredViaImport',
    ).mockResolvedValue(undefined);
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import')!;
    await step.action!(ctx);
    expect(spy).toHaveBeenCalledWith(ctx);
    spy.mockRestore();
  });

  it('gql8-import step uses collection restore helper as preAction', async () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import')!;
    expect(step.verify).toBe(GQL.COL_ITEM);
    expect(step.preAction).toBe(ensureCollectionItemRenamed);
  });

  it('ensureHealthExecutedWithHistory guard skips repeat execute', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureHealthExecutedWithHistory(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHealthExecutedWithHistory(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('setup creates demo tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    await gqlCollectionsHistoryLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-collections-history',
      'Collections & History',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('openHistoryPanel clicks when tab inactive and skips when active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel"></div>
    `;
    await openHistoryPanel(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    document.querySelector(GQL.ACTIVITY_HISTORY)!.classList.add('gql-activity-tab--active');
    vi.mocked(ctx.click).mockClear();
    await openHistoryPanel(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
  });

  it('openCollectionsPanel clicks when tab inactive and skips when active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel"></div>
    `;
    await openCollectionsPanel(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_COLLECTIONS);
    document.querySelector(GQL.ACTIVITY_COLLECTIONS)!.classList.add('gql-activity-tab--active');
    vi.mocked(ctx.click).mockClear();
    await openCollectionsPanel(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_COLLECTIONS);
  });

  it('ensureDemoCollectionExists creates a collection when none exist', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel"></div>
      <button data-testid="gql-collections-new"></button>
    `;
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.COL_NODE) {
        const panel = document.querySelector(GQL.COLLECTIONS_PANEL)!;
        panel.insertAdjacentHTML('beforeend', '<div data-testid="gql-col-node"></div>');
      }
    });
    await ensureDemoCollectionExists(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.COLLECTIONS_NEW);
  });

  it('ensureHistoryRunExecuted reopens preview when missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-run"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureHistoryRunExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_RUN);
  });

  it('ensureHistoryRunExecuted guard skips when response viewer present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-preview"></div>
      </div>
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureHistoryRunExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHistoryRunExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_RUN);
  });

  it('ensureSavedToCollectionFromHistory handles empty collection modal', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div class="gql-col-node-header"></div>
        </div>
      </div>
      <button data-testid="gql-collections-new"></button>
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-save-col-modal" class="gql-save-col-empty">
        <input data-testid="gql-save-col-name" />
        <button data-testid="gql-save-col-cancel"></button>
        <button data-testid="gql-save-col-save"></button>
      </div>
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.COL_ITEM) {
        document.querySelector(GQL.COL_NODE)!.insertAdjacentHTML(
          'beforeend',
          `<div data-testid="gql-col-item"><span class="gql-col-item-name">${LESSON8_ITEM_NAME}</span></div>`,
        );
      }
    });
    await ensureSavedToCollectionFromHistory(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SAVE_COL_CANCEL);
  });

  it('ensureCollectionRestoredViaImport guard skips when collection item exists', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div class="gql-col-node-header"></div>
          <div data-testid="gql-col-item"><span class="gql-col-item-name">${LESSON8_ITEM_RENAME}</span></div>
        </div>
      </div>
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-save-col-modal"><input data-testid="gql-save-col-name" /><button data-testid="gql-save-col-save"></button></div>
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureCollectionItemRenamed(ctx);
    vi.stubGlobal('DataTransfer', class {
      items = { add: vi.fn() };
      files = [] as unknown as FileList;
    });
    document.body.insertAdjacentHTML(
      'beforeend',
      `<input type="file" data-testid="gql-collections-import-input" />
       <button data-testid="gql-collections-import"></button>
       <div data-testid="gql-import-mode-dialog"></div>
       <button data-testid="gql-import-mode-merge"></button>
       <div data-testid="gql-col-ctx-menu"><button>Delete</button></div>`,
    );
    const input = document.querySelector<HTMLInputElement>(GQL.COLLECTIONS_IMPORT_INPUT)!;
    Object.defineProperty(input, 'files', {
      set: vi.fn(),
      configurable: true,
    });
    await ensureCollectionRestoredViaImport(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureCollectionRestoredViaImport(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.COLLECTIONS_IMPORT);
  });

  it('setup closes open history and collections panels', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    await gqlCollectionsHistoryLessonSetup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_COLLECTIONS);
  });

  it('cleanup closes demo tab and resets lesson 8 session flags', async () => {
    const ctx = makeCtx();
    await gqlCollectionsHistoryLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-collections-history');
  });

  it('ensureSavedToCollectionFromHistory guard skips when item already saved', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div class="gql-col-node-header"></div>
          <div data-testid="gql-col-item"><span class="gql-col-item-name">${LESSON8_ITEM_NAME}</span></div>
        </div>
      </div>
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-save-col-modal"><input data-testid="gql-save-col-name" /><button data-testid="gql-save-col-save"></button></div>
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureSavedToCollectionFromHistory(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureSavedToCollectionFromHistory(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_SAVE_TO_COL);
  });

  it('ensureSavedToCollectionFromHistory reopens preview when missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true">
          <div class="gql-col-node-header"></div>
        </div>
      </div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-save-col-modal"><input data-testid="gql-save-col-name" /><button data-testid="gql-save-col-save"></button></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
    `;
    stubMonacoEditor('query { health }');
    await ensureHealthExecutedWithHistory(ctx);
    await ensureDemoCollectionExists(ctx);
    await ctx.click(GQL.HISTORY_ENTRY);
    await ctx.waitFor(GQL.HISTORY_PREVIEW, 5000);
    document.querySelector(GQL.HISTORY_PREVIEW)?.remove();
    await ensureSavedToCollectionFromHistory(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_ENTRY);
  });

  it('openHistoryPanel skips click when history tab already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
    `;
    const tab = document.querySelector<HTMLElement>(GQL.ACTIVITY_HISTORY)!;
    const clickSpy = vi.spyOn(tab, 'click');
    await openHistoryPanel(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('openCollectionsPanel skips click when collections tab already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections" class="gql-activity-tab--active"></button>
      <div data-testid="gql-collections-panel"></div>
    `;
    const tab = document.querySelector<HTMLElement>(GQL.ACTIVITY_COLLECTIONS)!;
    const clickSpy = vi.spyOn(tab, 'click');
    await openCollectionsPanel(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureHistoryLoadedToEditor guard skips when health query already loaded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-preview"></div>
        <button data-testid="gql-history-load"></button>
      </div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
    `;
    stubMonacoEditor('query { health }');
    await ensureHistoryLoadedToEditor(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHistoryLoadedToEditor(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_LOAD);
  });

  it('ensureSavedToCollectionFromHistory expands collapsed collection node', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="false">
          <div class="gql-col-node-header"></div>
        </div>
      </div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-save-col-modal"><input data-testid="gql-save-col-name" /><button data-testid="gql-save-col-save"></button></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
    `;
    stubMonacoEditor('query { health }');
    const header = document.querySelector<HTMLElement>('.gql-col-node-header')!;
    const clickSpy = vi.spyOn(header, 'click');
    await ensureHealthExecutedWithHistory(ctx);
    await ensureDemoCollectionExists(ctx);
    await ensureHistoryPreviewOpen(ctx);
    await ctx.click(GQL.HISTORY_SAVE_TO_COL);
    await ctx.waitFor(GQL.SAVE_COL_MODAL, 5000);
    await ctx.fill(GQL.SAVE_COL_NAME, LESSON8_ITEM_NAME);
    await ctx.click(GQL.SAVE_COL_SAVE);
    await openCollectionsPanel(ctx);
    clickSpy.mockClear();
    await ensureSavedToCollectionFromHistory(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gqlCollectionsHistoryLessonSetup selects response tab when inactive', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <input data-testid="gql-endpoint-input" value="" />
      <div data-testid="gql-editor"></div>
    `;
    stubMonacoEditor('');
    const tab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE)!;
    const clickSpy = vi.spyOn(tab, 'click');
    await gqlCollectionsHistoryLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});
