/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';
import {
  resetGqlLesson8SessionFlags,
  executeLesson8HealthQuery,
  prepareGql8ObserveHistoryReading,
  prepareGql8LoadReading,
  prepareGql8SaveReading,
  openHistoryPreview,
  loadHistoryToEditor,
  runHistoryEntry,
  saveHistoryToCollection,
  confirmImportWithMerge,
  triggerCollectionsImportFile,
  prepareGql8ImportMergeReading,
  prepareGql8ImportFileReading,
  LESSON8_ITEM_NAME,
} from './lesson8-collections-history';

describe('lesson8-collections-history pacing', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson8SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('executeLesson8HealthQuery sets session flag so observe preAction skips re-execute', async () => {
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
    await executeLesson8HealthQuery(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    ctx.click.mockClear();
    await prepareGql8ObserveHistoryReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('prepareGql8LoadReading does not click Load — only recovery preview setup', async () => {
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
    await executeLesson8HealthQuery(ctx);
    ctx.click.mockClear();
    await prepareGql8LoadReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_LOAD);
  });

  it('loadHistoryToEditor clicks Load during visible action', async () => {
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
    stubMonacoEditor('query { health }');
    await loadHistoryToEditor(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_LOAD);
  });

  it('prepareGql8SaveReading does not open save modal during reading', async () => {
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
      <button data-testid="gql-history-run"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    await executeLesson8HealthQuery(ctx);
    await runHistoryEntry(ctx);
    ctx.click.mockClear();
    ctx.fill.mockClear();
    await prepareGql8SaveReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_SAVE_TO_COL);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.SAVE_COL_NAME, LESSON8_ITEM_NAME);
  });

  it('prepareGql8SaveReading does not re-run history or switch to Collections', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-history-save-to-col"></button>
      <div data-testid="gql-history-preview"></div>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"><div data-testid="gql-history-entry"></div></div>
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel"></div>
      <button data-testid="gql-history-run"></button>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    ctx.click.mockClear();
    await prepareGql8SaveReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_RUN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ACTIVITY_COLLECTIONS);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('saveHistoryToCollection skips save when lesson item already exists in DOM', async () => {
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
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    await saveHistoryToCollection(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.SAVE_COL_NAME, LESSON8_ITEM_NAME);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.HISTORY_SAVE_TO_COL);
  });

  it('saveHistoryToCollection fills item name during visible action when not yet saved', async () => {
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
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    await saveHistoryToCollection(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SAVE_COL_NAME, LESSON8_ITEM_NAME);
  });

  it('prepareGql8ImportFileReading does not click Import during reading', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections" class="gql-activity-tab--active"></button>
      <div data-testid="gql-collections-panel"></div>
      <button data-testid="gql-collections-import"></button>
      <input data-testid="gql-collections-import-input" type="file" />
    `;
    await prepareGql8ImportFileReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.COLLECTIONS_IMPORT);
  });

  it('prepareGql8ImportMergeReading opens dialog but does not click Merge during reading', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections" class="gql-activity-tab--active"></button>
      <div data-testid="gql-collections-panel"></div>
      <button data-testid="gql-collections-import"></button>
      <input data-testid="gql-collections-import-input" type="file" />
    `;
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.IMPORT_MODE_DIALOG) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<div data-testid="gql-import-mode-dialog"><button data-testid="gql-import-mode-merge">Merge</button></div>',
        );
      }
    });
    ctx.click.mockClear();
    await prepareGql8ImportMergeReading(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.IMPORT_MODE_MERGE);
    expect(document.querySelector(GQL.IMPORT_MODE_DIALOG)).toBeTruthy();
  });

  it('confirmImportWithMerge clicks Merge during visible action', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections" class="gql-activity-tab--active"></button>
      <div data-testid="gql-collections-panel">
        <div data-testid="gql-col-node" aria-expanded="true"><div class="gql-col-node-header"></div></div>
      </div>
      <div data-testid="gql-import-mode-dialog">
        <button data-testid="gql-import-mode-merge">Merge</button>
      </div>
    `;
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.COL_ITEM) {
        document.querySelector(GQL.COL_NODE)!.insertAdjacentHTML(
          'beforeend',
          '<div data-testid="gql-col-item"><span class="gql-col-item-name">Lesson 8 Health</span></div>',
        );
      }
    });
    await confirmImportWithMerge(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.IMPORT_MODE_MERGE);
  });

  it('triggerCollectionsImportFile clicks Import and opens mode dialog', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-collections" class="gql-activity-tab--active"></button>
      <div data-testid="gql-collections-panel"></div>
      <button data-testid="gql-collections-import"></button>
      <input data-testid="gql-collections-import-input" type="file" />
    `;
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === GQL.IMPORT_MODE_DIALOG) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<div data-testid="gql-import-mode-dialog"></div>',
        );
      }
    });
    await triggerCollectionsImportFile(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.COLLECTIONS_IMPORT);
  });

  it('openHistoryPreview clicks history entry during visible action', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-preview"></div>
      </div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor();
    await executeLesson8HealthQuery(ctx);
    ctx.click.mockClear();
    await openHistoryPreview(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.HISTORY_ENTRY);
  });
});
