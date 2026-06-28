/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  resetGqlLesson4SessionFlags,
  prepareGql4IntrospectReading,
  ensureSchemaExplorerOpen,
  selectSchemaType,
  searchSchemaTypes,
  ensureQueryTypeSelected,
  ensureUserTypeSelected,
  ensureEditorReadyForInsert,
  ensureTryInsertDone,
  markTryInsertDone,
  gqlSchemaLessonSetup,
  gqlSchemaLessonCleanup,
  gqlSchemaTypeSelector,
  gqlTryFieldSelector,
} from './lesson4-schema-exploration';

const getGqlEditorQueryMock = vi.fn(() => 'query { }');

vi.mock('./core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./core')>();
  return {
    ...actual,
    ensureEditorMode: vi.fn(async () => {}),
    ensureIntrospected: vi.fn(async () => {}),
    closeGqlActivityPanelIfOpen: vi.fn(async () => {}),
    fillGqlEditor: vi.fn(async () => {}),
    setGqlRightTabSchema: vi.fn(async () => {}),
    openSchemaTabWhenCached: vi.fn(async () => true),
    waitForSchemaCached: vi.fn(async () => true),
    getGqlEditorQuery: (...args: unknown[]) => getGqlEditorQueryMock(...args),
  };
});

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

vi.mock('../../env-manager-lesson-helpers', () => ({
  ensureGqlDemoHeaderContext: vi.fn(async () => {}),
}));

describe('lesson4-schema-exploration — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson4SessionFlags();
    getGqlEditorQueryMock.mockReturnValue('query { }');
  });

  it('gqlSchemaTypeSelector and gqlTryFieldSelector build test ids', () => {
    expect(gqlSchemaTypeSelector('Query')).toBe('[data-testid="gql-se-type-Query"]');
    expect(gqlTryFieldSelector('health')).toBe('[data-testid="gql-try-field-health"]');
  });

  it('prepareGql4IntrospectReading opens schema tab when cache is ready', async () => {
    const ctx = makeCtx();
    const core = await import('./core');
    document.body.innerHTML = `<span data-testid="gql-schema-badge-ok"></span>`;
    await prepareGql4IntrospectReading(ctx);
    expect(core.openSchemaTabWhenCached).toHaveBeenCalled();
  });

  it('prepareGql4IntrospectReading clicks response tab when cache is not ready', async () => {
    const ctx = makeCtx();
    const core = await import('./core');
    vi.mocked(core.waitForSchemaCached).mockResolvedValue(false);
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
    `;
    await prepareGql4IntrospectReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('prepareGql4IntrospectReading skips response click when already selected', async () => {
    const ctx = makeCtx();
    const core = await import('./core');
    vi.mocked(core.waitForSchemaCached).mockResolvedValue(false);
    vi.mocked(core.openSchemaTabWhenCached).mockResolvedValue(false);
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    `;
    await prepareGql4IntrospectReading(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureSchemaExplorerOpen fast-path when badge, tab, and type list exist', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
    `;
    const core = await import('./core');
    await ensureSchemaExplorerOpen(ctx);
    expect(core.ensureIntrospected).not.toHaveBeenCalled();
  });

  it('ensureSchemaExplorerOpen opens schema tab when not selected after introspect', async () => {
    const ctx = makeCtx();
    const core = await import('./core');
    document.body.innerHTML = `
      <button data-testid="gql-right-tab-schema" aria-selected="false"></button>
      <div data-testid="gql-schema-explorer"></div>
      <div data-testid="gql-se-type-list"></div>
    `;
    await ensureSchemaExplorerOpen(ctx);
    expect(core.setGqlRightTabSchema).toHaveBeenCalled();
  });

  it('selectSchemaType marks Query and User session flags', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
      <button data-testid="gql-se-type-Query"></button>
      <button data-testid="gql-se-type-User"></button>
      <div data-testid="gql-se-type-detail"></div>
    `;
    await selectSchemaType(ctx, 'Query');
    await selectSchemaType(ctx, 'User');
    expect(ctx.click).toHaveBeenCalledWith(gqlSchemaTypeSelector('Query'));
    expect(ctx.click).toHaveBeenCalledWith(gqlSchemaTypeSelector('User'));
  });

  it('ensureQueryTypeSelected short-circuits when Query already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
      <div data-testid="gql-se-type-detail"></div>
    `;
    await selectSchemaType(ctx, 'Query');
    vi.mocked(ctx.click).mockClear();
    await ensureQueryTypeSelected(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureUserTypeSelected short-circuits when User already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
      <input data-testid="gql-se-search" />
      <button data-testid="gql-se-type-User"></button>
      <div data-testid="gql-se-type-detail"></div>
    `;
    await ensureUserTypeSelected(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureUserTypeSelected(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('searchSchemaTypes fills the schema search input', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
      <input data-testid="gql-se-search" />
    `;
    await searchSchemaTypes(ctx, 'User');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.SCHEMA_SEARCH, 'User');
  });

  it('ensureEditorReadyForInsert fills template when query missing and clicks monaco', async () => {
    const ctx = makeCtx();
    const core = await import('./core');
    getGqlEditorQueryMock.mockReturnValue('');
    document.body.innerHTML = `
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    await ensureEditorReadyForInsert(ctx);
    expect(core.fillGqlEditor).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(`${GQL.EDITOR} .monaco-editor`);
  });

  it('ensureEditorReadyForInsert skips monaco click when editor surface missing', async () => {
    const ctx = makeCtx();
    getGqlEditorQueryMock.mockReturnValue('query { health }');
    await ensureEditorReadyForInsert(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(`${GQL.EDITOR} .monaco-editor`);
  });

  it('ensureTryInsertDone short-circuits when flag or editor already has health', async () => {
    const ctx = makeCtx();
    markTryInsertDone();
    await ensureTryInsertDone(ctx);
    getGqlEditorQueryMock.mockReturnValue('query { health }');
    resetGqlLesson4SessionFlags();
    await ensureTryInsertDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
  });

  it('ensureTryInsertDone clicks Try health when button exists', async () => {
    const ctx = makeCtx();
    getGqlEditorQueryMock.mockReturnValue('query { }');
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
      <button data-testid="gql-se-type-Query"></button>
      <div data-testid="gql-se-type-detail"></div>
      <div data-testid="gql-editor"></div>
      <button data-testid="gql-try-field-health"></button>
      <div data-testid="gql-insert-field-toast"></div>
    `;
    await ensureTryInsertDone(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
  });

  it('ensureTryInsertDone completes without click when Try button missing', async () => {
    const ctx = makeCtx();
    getGqlEditorQueryMock.mockReturnValue('query { }');
    document.body.innerHTML = `
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <div data-testid="gql-se-type-list"></div>
      <button data-testid="gql-se-type-Query"></button>
      <div data-testid="gql-se-type-detail"></div>
      <div data-testid="gql-editor"></div>
    `;
    await ensureTryInsertDone(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TRY_FIELD_HEALTH);
  });

  it('gqlSchemaLessonSetup toggles editor and response tab when inactive', async () => {
    const ctx = makeCtx();
    const editorBtn = document.createElement('button');
    editorBtn.setAttribute('data-testid', 'gql-mode-editor');
    const editorClickSpy = vi.spyOn(editorBtn, 'click');
    const responseTab = document.createElement('button');
    responseTab.setAttribute('data-testid', 'gql-right-tab-response');
    responseTab.setAttribute('aria-selected', 'false');
    const responseClickSpy = vi.spyOn(responseTab, 'click');
    document.body.append(editorBtn, responseTab);
    await gqlSchemaLessonSetup(ctx);
    expect(editorClickSpy).toHaveBeenCalled();
    expect(responseClickSpy).toHaveBeenCalled();
  });

  it('gqlSchemaLessonSetup skips toggles when editor and response already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    `;
    await gqlSchemaLessonSetup(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('gqlSchemaLessonCleanup closes demo tab', async () => {
    const ctx = makeCtx();
    const tabMod = await import('./gql-demo-tab');
    await gqlSchemaLessonCleanup(ctx);
    expect(tabMod.closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-schema-exploration');
  });
});
