/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../demoRipple', () => ({
  showSpotlightRing: vi.fn(() => vi.fn()),
}));

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
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { purgeGqlLesson9WorkspaceArtifacts } from '../../adapters';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  LESSON8_ITEM_NAME,
  LESSON8_ITEM_RENAME,
  buildLesson8ImportPayload,
  gqlCollectionsHistoryLessonSetup,
  ensureHealthExecutedWithHistory,
  ensureHistoryPreviewOpen,
  ensureHistoryLoadedToEditor,
  loadHistoryToEditor,
  runHistoryEntry,
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

describe('gql-collections-history lesson — actions', () => {
  beforeEach(() => {
    setupGraphqlCollectionsHistoryBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlCollectionsHistoryAfterEach();
  });

it('gql8-exec-health runs health query once via executeLesson8HealthQuery', async () => {
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
    ctx.click.mockClear();
    const step2 = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-observe-history')!;
    await step2.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
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

  it('gql8 steps use prepare preActions that stop before the visible action', () => {
    const preActionIds = gqlCollectionsHistoryLesson.steps.map((s) => s.preAction?.name);
    expect(preActionIds).toEqual([
      'prepareGql8ExecHealthReading',
      'prepareGql8ObserveHistoryReading',
      'prepareGql8PreviewReading',
      'prepareGql8LoadReading',
      'prepareGql8RunReading',
      'prepareGql8SaveReading',
      'prepareGql8RenameReading',
      'prepareGql8ExportReading',
      'prepareGql8DeleteReading',
      'prepareGql8ImportFileReading',
      'prepareGql8ImportMergeReading',
    ]);
  });

  it('gql8-preview opens history preview panel', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.HISTORY_PREVIEW) {
        document.querySelector(GQL.HISTORY_PANEL)!.insertAdjacentHTML(
          'beforeend',
          '<div data-testid="gql-history-preview"></div>',
        );
      }
    });
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
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_ENTRY);
  });

  it('loadHistoryToEditor skips re-opening preview when already visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-history-load"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    await loadHistoryToEditor(ctx);
    expect(ctx.click).toHaveBeenCalledTimes(1);
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
        <div data-testid="gql-col-node" aria-expanded="true"><div class="gql-col-node-header"></div></div>
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
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_ENTRY);
  });

  it('runHistoryEntry waits for response viewer then holds spotlight on the result', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-history-run"></button>
      <div data-testid="gql-history-preview"></div>
      <div data-testid="gql-response-viewer"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    await runHistoryEntry(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RESPONSE_VIEWER, 15000);
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

  it('openHistoryPreview does not re-click entry when preview is already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-preview"></div>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    await ensureHistoryPreviewOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHistoryPreviewOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_ENTRY);
  });

  it('gql8-import-merge action calls confirmImportWithMerge helper', async () => {
    const ctx = makeCtx();
    const spy = vi.spyOn(
      await import('./graphql-lesson-helpers'),
      'confirmImportWithMerge',
    ).mockResolvedValue(undefined);
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import-merge')!;
    await step.action!(ctx);
    expect(spy).toHaveBeenCalledWith(ctx);
    spy.mockRestore();
  });

  it('gql8-import-merge step uses prepareGql8ImportMergeReading as preAction', async () => {
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import-merge')!;
    expect(step.verify).toBe(GQL.COL_ITEM);
    expect(step.preAction).toBe(
      (await import('./graphql-lesson-helpers')).prepareGql8ImportMergeReading,
    );
  });

  it('gql8-import-file action calls triggerCollectionsImportFile helper', async () => {
    const ctx = makeCtx();
    const spy = vi.spyOn(
      await import('./graphql-lesson-helpers'),
      'triggerCollectionsImportFile',
    ).mockResolvedValue(undefined);
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-import-file')!;
    await step.action!(ctx);
    expect(spy).toHaveBeenCalledWith(ctx);
    spy.mockRestore();
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

  it('ensureHealthExecutedWithHistory skips when preview is open without list entry', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-preview"></div></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('query { health }');
    await ensureHealthExecutedWithHistory(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHealthExecutedWithHistory(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('prepareGql8RunReading is instant when history preview already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const { prepareGql8RunReading } = await import('./graphql-lesson-helpers');
    await ensureHealthExecutedWithHistory(ctx);
    vi.mocked(ctx.click).mockClear();
    await prepareGql8RunReading(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
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
    expect(purgeGqlLesson9WorkspaceArtifacts).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('gqlCollectionsHistoryLessonCleanup purges lesson artifacts', async () => {
    const ctx = makeCtx();
    await gqlCollectionsHistoryLessonCleanup(ctx);
    expect(purgeGqlLesson9WorkspaceArtifacts).toHaveBeenCalled();
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-collections-history');
  });
});
