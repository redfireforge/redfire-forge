/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  resetGqlLesson7SessionFlags,
  ensureBuilderMode,
  ensureHealthFieldSelected,
  ensureSelectAllDemonstrated,
  ensureUserIdFieldOptionExpanded,
} from './lesson7-query-builder';

vi.mock('./gql-demo-core/schema', () => ({
  ensureIntrospectedOnDirectEndpoint: vi.fn(async () => {}),
}));

vi.mock('./gql-demo-core/setup', () => ({
  closeGqlActivityPanelIfOpen: vi.fn(async () => {}),
}));

vi.mock('./gql-demo-core/monaco', () => ({
  fillGqlEditor: vi.fn(async () => {}),
  fillGqlVariables: vi.fn(async () => {}),
  ensureVariablesPanelOpen: vi.fn(async () => {}),
  getGqlEditorQuery: vi.fn(() => 'query { health }'),
  getGqlVariablesJson: vi.fn(() => '{}'),
  getMonacoGqlEditorInstance: vi.fn(() => null),
}));

vi.mock('./core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./core')>();
  return {
    ...actual,
    ensureEditorMode: vi.fn(async () => {}),
    ensureDemoTabDirectHttpEndpoint: vi.fn(async () => {}),
    seedDemoUsers: vi.fn(async () => {}),
    syncGqlQueryToAppState: vi.fn(),
  };
});

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

describe('lesson7-query-builder — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson7SessionFlags();
  });

  it('ensureBuilderMode clicks builder when tree missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-qb-field-tree"></div>
    `;
    await ensureBuilderMode(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('ensureUserIdFieldOptionExpanded expands collapsed option row', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button data-testid="gql-fo-expand-user.id"></button>
        </div>
      </div>
    `;
    await ensureUserIdFieldOptionExpanded(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureSelectAllDemonstrated toggles select-all twice', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-row" data-field="health">
          <button class="gql-qb-check gql-qb-check--checked"></button>
        </div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <textarea data-testid="gql-qb-code"></textarea>
    `;
    const textarea = document.querySelector('textarea')!;
    Object.defineProperty(textarea, 'value', { value: 'query { health }', configurable: true });
    await ensureSelectAllDemonstrated(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.QB_SELECT_ALL);
  });

  it('ensureHealthFieldSelected clicks health row when unchecked', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check"></button></div>
      </div>
      <textarea data-testid="gql-qb-code">query { }</textarea>
    `;
    await ensureHealthFieldSelected(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureUserFieldConfigured expands user row and fills id arg', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">user</span><button class="gql-qb-expand-btn"></button><button class="gql-qb-check"></button></div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <textarea data-testid="gql-qb-code">query { health }</textarea>
      <input data-testid="gql-qb-arg-user-id" value="" />
    `;
    const { ensureUserFieldConfigured } = await import('./lesson7-query-builder');
    await ensureUserFieldConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.QB_ARG_USER_ID, expect.any(String));
  });

  it('prepareEditInEditorReading switches from editor back to builder', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree"></div>
      <div data-testid="gql-qb-field-options">
        <button data-testid="gql-fo-expand-user.id"></button>
        <input data-testid="gql-fo-alias-user.id" value="userId" />
        <button data-testid="gql-fo-include-user.id" aria-checked="true"></button>
      </div>
      <textarea data-testid="gql-qb-code">query { user(id: "usr-1") { id @include(if: true) } }</textarea>
    `;
    const { prepareEditInEditorReading } = await import('./lesson7-query-builder');
    await prepareEditInEditorReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('demonstrateOneWaySyncContrast switches to builder and scrolls code preview', async () => {
    const ctx = makeCtx();
    const codeEl = document.createElement('textarea');
    codeEl.setAttribute('data-testid', 'gql-qb-code');
    codeEl.textContent = '# edited in editor\nquery { health }';
    codeEl.scrollIntoView = vi.fn();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-qb-field-tree"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    document.body.appendChild(codeEl);
    const { demonstrateOneWaySyncContrast, ensureEditedToEditor } = await import('./lesson7-query-builder');
    await ensureEditedToEditor(ctx);
    await demonstrateOneWaySyncContrast(ctx);
    expect(codeEl.scrollIntoView).toHaveBeenCalled();
  });

  it('ensureAliasConfigured fills alias input on user.id field', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">user</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <textarea data-testid="gql-qb-code">query { user(id: "usr-1") { id } }</textarea>
      <div data-testid="gql-qb-field-options">
        <button data-testid="gql-fo-expand-user.id"></button>
        <input data-testid="gql-fo-alias-user.id" value="" />
      </div>
      <input data-testid="gql-qb-arg-user-id" value="usr-1" />
    `;
    const { ensureAliasConfigured } = await import('./lesson7-query-builder');
    await ensureAliasConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('ensureIncludeConfigured toggles include directive when unchecked', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">user</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <textarea data-testid="gql-qb-code">query { user(id: "usr-1") { id } userId: id @include(if: true) }</textarea>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button data-testid="gql-fo-expand-user.id"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="userId" />
            <button data-testid="gql-fo-include-user.id" aria-checked="false"></button>
          </div>
        </div>
      </div>
      <input data-testid="gql-qb-arg-user-id" value="usr-1" />
    `;
    const { ensureIncludeConfigured } = await import('./lesson7-query-builder');
    await ensureIncludeConfigured(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.FO_INCLUDE_USER_ID);
  });

  it('ensureBuilderMode short-circuits when builder already active with tree', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree"></div>
    `;
    await ensureBuilderMode(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('ensureHealthFieldSelected short-circuits when health already in code', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
      </div>
      <textarea data-testid="gql-qb-code">query { health }</textarea>
    `;
    await ensureHealthFieldSelected(ctx);
    vi.mocked(ctx.delay).mockClear();
    await ensureHealthFieldSelected(ctx);
    expect(vi.mocked(ctx.delay).mock.calls.length).toBe(0);
  });

  it('getBuilderCodeText returns trimmed builder preview text', async () => {
    const { getBuilderCodeText } = await import('./lesson7-query-builder');
    document.body.innerHTML = `<textarea data-testid="gql-qb-code">  query { health }  </textarea>`;
    expect(getBuilderCodeText()).toBe('query { health }');
  });

  it('demonstrateEditorCommentLine uses fillGqlEditor fallback without Monaco executeEdits', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <button data-testid="gql-qb-edit"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-qb-field-tree"></div>
      <textarea data-testid="gql-qb-code">query { health }</textarea>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button data-testid="gql-fo-expand-user.id"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="userId" />
            <button data-testid="gql-fo-include-user.id" aria-checked="true"></button>
          </div>
        </div>
      </div>
    `;
    const monacoMod = await import('./gql-demo-core/monaco');
    vi.mocked(monacoMod.getMonacoGqlEditorInstance).mockReturnValue(null);
    const { demonstrateEditorCommentLine, ensureIncludeConfigured } = await import('./lesson7-query-builder');
    await ensureIncludeConfigured(ctx);
    await demonstrateEditorCommentLine(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensureInEditorAfterTransfer clicks editor tab when transfer done but editor inactive', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-editor"></button>
      <button data-testid="gql-qb-edit"></button>
      <div data-testid="gql-editor"></div>
      <div data-testid="gql-qb-field-tree"></div>
      <textarea data-testid="gql-qb-code">query { health }</textarea>
    `;
    const { ensureEditedToEditor, ensureInEditorAfterTransfer } = await import('./lesson7-query-builder');
    await ensureEditedToEditor(ctx);
    document.querySelector(GQL.MODE_EDITOR)?.classList.remove('gql-mode-btn--active');
    await ensureInEditorAfterTransfer(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('gqlQueryBuilderLessonSetup catches seed errors when Docker offline', async () => {
    const ctx = makeCtx();
    const coreMod = await import('./core');
    vi.mocked(coreMod.seedDemoUsers).mockRejectedValueOnce(new Error('offline'));
    const tabMod = await import('./gql-demo-tab');
    const { gqlQueryBuilderLessonSetup } = await import('./lesson7-query-builder');
    await gqlQueryBuilderLessonSetup(ctx);
    expect(tabMod.ensureGqlDemoTab).toHaveBeenCalled();
  });

  it('gqlQueryBuilderLessonCleanup closes demo tab', async () => {
    const ctx = makeCtx();
    const tabMod = await import('./gql-demo-tab');
    const { gqlQueryBuilderLessonCleanup } = await import('./lesson7-query-builder');
    await gqlQueryBuilderLessonCleanup(ctx);
    expect(tabMod.closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-query-builder');
  });

  it('prepareEditInEditorReading returns to editor when transfer already done', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-editor"></button>
      <button data-testid="gql-qb-edit"></button>
      <div data-testid="gql-editor"></div>
      <div data-testid="gql-qb-field-tree"></div>
      <textarea data-testid="gql-qb-code">query { user(id: "usr-1") { id @include(if: true) } }</textarea>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button data-testid="gql-fo-expand-user.id"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="userId" />
            <button data-testid="gql-fo-include-user.id" aria-checked="true"></button>
          </div>
        </div>
      </div>
      <input data-testid="gql-qb-arg-user-id" value="usr-1" />
    `;
    const { ensureEditedToEditor, prepareEditInEditorReading } = await import('./lesson7-query-builder');
    await ensureEditedToEditor(ctx);
    document.querySelector(GQL.MODE_EDITOR)?.classList.remove('gql-mode-btn--active');
    await prepareEditInEditorReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('ensureIncludeConfigured short-circuits when @include already in builder code', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">user</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <textarea data-testid="gql-qb-code">query { user(id: "usr-1") { id @include(if: true) } }</textarea>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button data-testid="gql-fo-expand-user.id"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="userId" />
            <button data-testid="gql-fo-include-user.id" aria-checked="true"></button>
          </div>
        </div>
      </div>
      <input data-testid="gql-qb-arg-user-id" value="usr-1" />
    `;
    const { ensureIncludeConfigured } = await import('./lesson7-query-builder');
    await ensureIncludeConfigured(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureIncludeConfigured(ctx);
    expect(vi.mocked(ctx.click).mock.calls.length).toBe(0);
  });

  it('ensureUserFieldConfigured skips expand when user row already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
        <div class="gql-qb-field-row">
          <span class="gql-qb-field-name">user</span>
          <button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button>
          <button class="gql-qb-check gql-qb-check--partial"></button>
        </div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <textarea data-testid="gql-qb-code">query { health }</textarea>
      <input data-testid="gql-qb-arg-user-id" value="" />
    `;
    const { ensureUserFieldConfigured } = await import('./lesson7-query-builder');
    await ensureUserFieldConfigured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.QB_ARG_USER_ID, expect.any(String));
  });

  it('ensureUserIdFieldOptionExpanded uses title fallback expand selector', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">health</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
        <div class="gql-qb-field-row"><span class="gql-qb-field-name">user</span><button class="gql-qb-check gql-qb-check--checked"></button></div>
      </div>
      <button data-testid="gql-qb-select-all"></button>
      <textarea data-testid="gql-qb-code">query { user(id: "usr-1") { id } }</textarea>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button class="gql-qb-fo-expand" title="user.id"></button>
        </div>
      </div>
      <input data-testid="gql-qb-arg-user-id" value="usr-1" />
    `;
    await ensureUserIdFieldOptionExpanded(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('demonstrateEditorCommentLine types via Monaco executeEdits when available', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder"></button>
      <button data-testid="gql-qb-edit"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-qb-field-tree"></div>
      <textarea data-testid="gql-qb-code">query { health }</textarea>
      <div data-testid="gql-qb-field-options">
        <div class="gql-qb-fo-row">
          <button data-testid="gql-fo-expand-user.id"></button>
          <div class="gql-qb-fo-body">
            <input data-testid="gql-fo-alias-user.id" value="userId" />
            <button data-testid="gql-fo-include-user.id" aria-checked="true"></button>
          </div>
        </div>
      </div>
    `;
    const monacoMod = await import('./gql-demo-core/monaco');
    const executeEdits = vi.fn();
    vi.mocked(monacoMod.getMonacoGqlEditorInstance).mockReturnValue({
      getModel: () => ({ getValue: () => 'query { health }', uri: { toString: () => 'uri' } }),
      getPosition: () => ({ lineNumber: 1, column: 1 }),
      executeEdits,
      focus: vi.fn(),
      revealLineInCenter: vi.fn(),
    } as never);
    const { demonstrateEditorCommentLine, ensureIncludeConfigured } = await import('./lesson7-query-builder');
    await ensureIncludeConfigured(ctx);
    await demonstrateEditorCommentLine(ctx);
    expect(executeEdits).toHaveBeenCalled();
  });
});
