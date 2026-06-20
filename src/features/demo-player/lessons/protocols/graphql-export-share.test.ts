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
} from './graphql-lesson-helpers';

function stubMonacoEditor(query = 'query { health user(id: "usr-1") { id name email } }'): void {
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
});
