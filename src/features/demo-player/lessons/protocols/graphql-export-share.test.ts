/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql10'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlExportShareLesson } from './graphql-export-share';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  resetGqlLesson9SessionFlags,
  resetGqlLessonSessionFlags,
  gqlExportShareLessonSetup,
  gqlExportShareLessonCleanup,
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
    expect(gqlExportShareLesson.steps.length).toBe(7);
    expect(gqlExportShareLesson.estimatedMinutes).toBe(4);
    expect(gqlExportShareLesson.tabBudget).toBe(1);
  });

  // ── Concept content ───────────────────────────────────────────────────────

  it('concept title mentions Export and Share', () => {
    expect(gqlExportShareLesson.concept.title).toContain('Export');
    expect(gqlExportShareLesson.concept.title).toContain('Share');
  });

  it('concept body explains WHY no heavy code gen panel', () => {
    expect(gqlExportShareLesson.concept.body).toContain('code-generation');
  });

  it('concept body explains two export surfaces', () => {
    expect(gqlExportShareLesson.concept.body).toContain('Surface 1');
    expect(gqlExportShareLesson.concept.body).toContain('Surface 2');
  });

  it('concept body explains WHY cURL is the universal sharing format', () => {
    expect(gqlExportShareLesson.concept.body).toContain('cURL');
    expect(gqlExportShareLesson.concept.body).toContain('curl -X POST');
  });

  it('concept body explains WHY sync is one-way', () => {
    expect(gqlExportShareLesson.concept.body).toContain('one-way');
  });

  it('has 5 key terms', () => {
    expect(gqlExportShareLesson.concept.keyTerms).toHaveLength(5);
  });

  it('key terms include One-way sync', () => {
    const terms = gqlExportShareLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('One-way sync');
  });

  it('key terms include Copy as cURL', () => {
    const terms = gqlExportShareLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Copy as cURL');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('diagram is a 700x430 SVG', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
    expect(gqlExportShareLesson.concept.diagram).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('diagram contains window chrome traffic lights', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlExportShareLesson.concept.diagram).toContain('#febc2e');
    expect(gqlExportShareLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows Builder field tree with health and user fields', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('Field Tree');
    expect(gqlExportShareLesson.concept.diagram).toContain('health');
    expect(gqlExportShareLesson.concept.diagram).toContain('user');
  });

  it('diagram shows SDL preview panel with Copy and Edit in Editor buttons', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('SDL Preview');
    expect(gqlExportShareLesson.concept.diagram).toContain('Copy');
    expect(gqlExportShareLesson.concept.diagram).toContain('Edit in Editor');
  });

  it('diagram shows History context menu with Copy as cURL highlighted', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('Copy as cURL');
    expect(gqlExportShareLesson.concept.diagram).toContain('History');
  });

  it('diagram shows cURL output preview', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('curl -X POST');
  });

  it('diagram uses CSS design tokens', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('var(--bg)');
    expect(gqlExportShareLesson.concept.diagram).toContain('var(--surface)');
    expect(gqlExportShareLesson.concept.diagram).toContain('var(--border)');
    expect(gqlExportShareLesson.concept.diagram).toContain('var(--primary)');
  });

  it('diagram shows lifecycle legend from Builder to cURL', () => {
    expect(gqlExportShareLesson.concept.diagram).toContain('Execute');
    expect(gqlExportShareLesson.concept.diagram).toContain('terminal / CI / team');
  });

  // ── Step spotlights match their panel/element ─────────────────────────────

  it('gql9-builder highlights field tree', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-builder')!;
    expect(step.highlight).toBe(GQL.QB_FIELD_TREE);
    expect(step.verify).toBe(GQL.QB_CODE);
  });

  it('gql9-preview highlights SDL preview code', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-preview')!;
    expect(step.highlight).toBe(GQL.QB_CODE);
    expect(step.verify).toBe(GQL.QB_CODE);
  });

  it('gql9-copy highlights copy button', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-copy')!;
    expect(step.highlight).toBe(GQL.QB_COPY);
    expect(step.verify).toBe(GQL.QB_COPY);
  });

  it('gql9-edit highlights edit-in-editor button and verifies editor mode', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-edit')!;
    expect(step.highlight).toBe(GQL.QB_EDIT);
    expect(step.verify).toBe(GQL.MODE_EDITOR);
  });

  it('gql9-curl highlights history context menu and verifies history entry', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-curl')!;
    expect(step.highlight).toBe(GQL.HISTORY_CONTEXT_MENU);
    expect(step.verify).toBe(GQL.HISTORY_ENTRY);
  });

  // ── Step description WHY content ──────────────────────────────────────────

  it('gql9-builder description explains WHY Builder is schema-guided', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-builder')!;
    expect(step.description).toContain('schema-guided');
  });

  it('gql9-preview description explains WHY live preview eliminates round-trip', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-preview')!;
    expect(step.description).toContain('live');
    expect(step.description).toContain('canonical export surface');
  });

  it('gql9-copy description lists use cases for clipboard sharing', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-copy')!;
    expect(step.description).toContain('clipboard');
    expect(step.description).toContain('development workflow');
  });

  it('gql9-edit description explains WHY transfer is one-way', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-edit')!;
    expect(step.description).toContain('one-way');
    expect(step.description).toContain('checkbox');
  });

  it('gql9-curl description explains WHY cURL is the universal sharing format', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-curl')!;
    expect(step.description).toContain('curl -X POST');
    expect(step.description).toContain('universal sharing format');
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
      'gql9-exec-export',
      'gql9-open-history',
      'gql9-curl',
    ]);
  });

  it('all 7 steps have pauseAfter enabled', () => {
    gqlExportShareLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBeTruthy();
    });
  });

  it('gql9-curl has extended pauseAfter so viewers can read the context menu', () => {
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-curl')!;
    expect(step.pauseAfter).toBe(5500);
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelector(GQL.HISTORY_CONTEXT_MENU)?.remove();
    });
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-curl')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(document.querySelector(GQL.HISTORY_CONTEXT_MENU)).toBeNull();
  });

  it('gql9-curl preAction opens context menu during reading phase when not yet visible', async () => {
    const ctx = makeCtx();
    const entry = document.createElement('div');
    entry.setAttribute('data-testid', 'gql-history-entry');
    document.body.appendChild(entry);
    const dispatchSpy = vi.spyOn(entry, 'dispatchEvent');
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-curl')!;
    await step.preAction!(ctx);
    expect(dispatchSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(600);
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

  it('gql9-exec-export executes query from editor', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-qb-edit"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    stubMonacoEditor('query { health user(id: "usr-1") { id } }');
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-exec-export')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql9-open-history opens history panel for latest entry', async () => {
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
      </div>
      <button data-testid="gql-qb-edit"></button>
      <div data-testid="gql-qb-field-tree">
        <div class="gql-qb-field-row"><span class="gql-qb-expand-spacer"></span><button class="gql-qb-check gql-qb-check--checked"></button><span class="gql-qb-field-name">health</span></div>
        <div class="gql-qb-field-row"><button class="gql-qb-expand-btn gql-qb-expand-btn--open"></button><button class="gql-qb-check gql-qb-check--partial"></button><span class="gql-qb-field-name">user</span></div>
        <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="usr-1" /></div>
      </div>
      <pre data-testid="gql-qb-code">query { health user(id: "usr-1") { id } }</pre>
    `;
    stubMonacoEditor('query { health user(id: "usr-1") { id } }');
    const step = gqlExportShareLesson.steps.find((s) => s.id === 'gql9-open-history')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(document.querySelector(GQL.HISTORY_ENTRY)).toBeTruthy();
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

  it('setup creates demo tab', async () => {
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
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-export-share',
      'Export & Share Queries',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlExportShareLessonCleanup closes demo tab', async () => {
    const ctx = makeCtx();
    await gqlExportShareLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-export-share');
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
