/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlExportShareLesson } from './graphql-export-share';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  resetGqlLesson9SessionFlags,
  resetGqlLessonSessionFlags,
  gqlExportShareLessonSetup,
  getBuilderCodeText,
  ensureBuilderHealthAndUserSelected,
  ensureBuilderSdlCopied,
  ensureExportBuilderEditedToEditor,
  ensureHistoryCopyAsCurl,
} from './graphql-lesson-helpers';
import { stubBuilderFieldTree, stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

describe('gql-export-share lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson9SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlExportShareLesson.id).toBe('gql-export-share');
    expect(gqlExportShareLesson.category).toBe('graphql');
    expect(gqlExportShareLesson.name).toBe('Export & Share Queries');
    expect(gqlExportShareLesson.steps.length).toBe(5);
    expect(gqlExportShareLesson.estimatedMinutes).toBe(3);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlExportShareLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlExportShareLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlExportShareLesson.steps.map((s) => s.id)).toEqual([
      'gql9-builder',
      'gql9-preview',
      'gql9-copy',
      'gql9-edit',
      'gql9-curl',
    ]);
  });

  it('all 5 steps have pauseAfter: true', () => {
    gqlExportShareLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlExportShareLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('gql9-builder selects health and user in builder', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn"></button><button class="gql-qb-check"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    stubMonacoEditor();
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-builder')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(getBuilderCodeText()).toContain('health');
  });

  it('gql9-copy clicks builder copy button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <button data-testid="gql-qb-copy"></button>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-copy')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.QB_COPY);
  });

  it('gql9-curl opens history context menu for Copy as cURL', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-context-menu">
          <button type="button">Copy as cURL</button>
        </div>
      </div>
      <button data-testid="gql-qb-edit"></button>
      <button data-testid="gql-mode-builder"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    stubMonacoEditor();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-curl')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(document.querySelector(GQL.HISTORY_CONTEXT_MENU)).toBeTruthy();
  });

  it('gql9-preview reads SDL and re-selects fields when incomplete', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree()}
    `;
    document.querySelector('pre')!.textContent = 'query { }';
    stubMonacoEditor('');
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-preview')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.QB_CODE, 5000);
  });

  it('gql9-preview skips re-select when health and user already in code', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-preview')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MODE_BUILDER);
  });

  it('gql9-edit transfers SDL to editor', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      ${stubBuilderFieldTree(true)}
      <button data-testid="gql-mode-editor"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-edit')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.QB_EDIT);
  });

  it('ensureBuilderHealthAndUserSelected guard skips when fields already selected', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    await ensureBuilderHealthAndUserSelected(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureBuilderHealthAndUserSelected(ctx);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('ensureBuilderSdlCopied guard skips repeat copy', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <button data-testid="gql-qb-copy"></button>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    await ensureBuilderSdlCopied(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureBuilderSdlCopied(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.QB_COPY);
  });

  it('ensureExportBuilderEditedToEditor guard skips when editor already has health query', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    stubMonacoEditor('query { health user(id: "usr-1") { id } }');
    await ensureExportBuilderEditedToEditor(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureExportBuilderEditedToEditor(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.QB_EDIT);
  });

  it('ensureHistoryCopyAsCurl guard skips repeat curl copy', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-context-menu"><button type="button">Copy as cURL</button></div>
      </div>
      <button data-testid="gql-qb-edit"></button>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    stubMonacoEditor('query { health }');
    await ensureHistoryCopyAsCurl(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHistoryCopyAsCurl(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('setup clears endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://old" />
      <button data-testid="gql-mode-editor"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
    }));
    await gqlExportShareLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlExportShareLessonSetup closes history and collections panels', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-activity-collections"></button>
      <div data-testid="gql-collections-panel"></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await gqlExportShareLessonSetup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_COLLECTIONS);
  });

  it('ensureHistoryCopyAsCurl skips execute when already executed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-activity-history"></button>
      <div data-testid="gql-history-panel">
        <div data-testid="gql-history-entry"></div>
        <div data-testid="gql-history-context-menu"><button type="button">Copy as cURL</button></div>
      </div>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
      <button data-testid="gql-qb-edit"></button>
    `;
    stubMonacoEditor('query { health user(id: "usr-1") { id } }');
    await ensureHistoryCopyAsCurl(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureHistoryCopyAsCurl(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });
});
