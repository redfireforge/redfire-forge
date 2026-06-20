/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlCollectionsHistoryLesson } from './graphql-collections-history';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON8_ITEM_NAME,
  LESSON8_ITEM_RENAME,
  buildLesson8ImportPayload,
  resetGqlLesson8SessionFlags,
  resetGqlLessonSessionFlags,
  gqlCollectionsHistoryLessonSetup,
} from './graphql-lesson-helpers';

function stubMonacoEditor(query = 'query { health }'): void {
  const w = window as unknown as {
    monaco?: {
      editor: {
        getModels: () => Array<{ getValue: () => string; setValue: (v: string) => void; uri: { toString: () => string } }>;
        getEditors: () => Array<{ getModel: () => null; setValue: (v: string) => void }>;
      };
    };
  };
  w.monaco = {
    editor: {
      getModels: () => [{
        getValue: () => query,
        setValue: () => {},
        uri: { toString: () => 'inmemory://graphql/1' },
      }],
      getEditors: () => [{ getModel: () => null, setValue: () => {} }],
    },
  };
}

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
    expect(gqlCollectionsHistoryLesson.steps.length).toBe(8);
    expect(gqlCollectionsHistoryLesson.estimatedMinutes).toBe(3);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlCollectionsHistoryLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlCollectionsHistoryLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlCollectionsHistoryLesson.steps.map((s) => s.id)).toEqual([
      'gql8-execute',
      'gql8-preview',
      'gql8-load',
      'gql8-run',
      'gql8-save',
      'gql8-rename',
      'gql8-export',
      'gql8-import',
    ]);
  });

  it('all 8 steps have pauseAfter: true', () => {
    gqlCollectionsHistoryLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlCollectionsHistoryLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('gql8-execute runs health query and opens history', async () => {
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
    const step = gqlCollectionsHistoryLesson.steps.find((s) => s.id === 'gql8-execute')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
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

  it('setup clears endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    await gqlCollectionsHistoryLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });
});
