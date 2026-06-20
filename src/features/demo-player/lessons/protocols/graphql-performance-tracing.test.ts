/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlPerformanceTracingLesson } from './graphql-performance-tracing';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  buildTracingUserQuery,
  getComplexityBadgeScore,
  resetGqlLesson10SessionFlags,
  resetGqlLessonSessionFlags,
  gqlPerformanceTracingLessonSetup,
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
        setValue: (v: string) => { query = v; },
        uri: { toString: () => 'inmemory://graphql/1' },
      }],
      getEditors: () => [{ getModel: () => null, setValue: (v: string) => { query = v; } }],
    },
  };
}

describe('gql-performance-tracing lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson10SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlPerformanceTracingLesson.id).toBe('gql-performance-tracing');
    expect(gqlPerformanceTracingLesson.category).toBe('graphql');
    expect(gqlPerformanceTracingLesson.name).toBe('Performance Tracing');
    expect(gqlPerformanceTracingLesson.steps.length).toBe(7);
    expect(gqlPerformanceTracingLesson.estimatedMinutes).toBe(4);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlPerformanceTracingLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlPerformanceTracingLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlPerformanceTracingLesson.steps.map((s) => s.id)).toEqual([
      'gql10-complexity',
      'gql10-expand',
      'gql10-execute',
      'gql10-waterfall',
      'gql10-hover',
      'gql10-sort',
      'gql10-histogram',
    ]);
  });

  it('all 7 steps have pauseAfter: true', () => {
    gqlPerformanceTracingLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlPerformanceTracingLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('buildTracingUserQuery includes health and user id', () => {
    const q = buildTracingUserQuery('usr-42');
    expect(q).toContain('health');
    expect(q).toContain('user(id: "usr-42")');
  });

  it('getComplexityBadgeScore parses ~N badge text', () => {
    document.body.innerHTML = '<span data-testid="gql-complexity-badge">~12</span>';
    expect(getComplexityBadgeScore()).toBe(12);
  });

  it('gql10-complexity waits for complexity badge', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <span data-testid="gql-complexity-badge">~1</span>
    `;
    stubMonacoEditor();
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-complexity')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.COMPLEXITY_BADGE, 5000);
  });

  it('gql10-execute clicks execute and waits for tracing badge', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-execute-btn"></button>
      <span data-testid="gql-complexity-badge">~5</span>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tracing-badge"></button>
    `;
    stubMonacoEditor(buildTracingUserQuery());
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-execute')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.RV_TRACING_BADGE, 15000);
  });

  it('gql10-sort clicks duration sort button', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-execute-btn"></button>
      <span data-testid="gql-complexity-badge">~5</span>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tracing-badge"></button>
      <div data-testid="gql-trace-view">
        <button data-testid="gql-trace-sort-duration">Slowest first</button>
        <div data-testid="gql-trace-resolver-row"><div class="gql-trace-bar"></div></div>
      </div>
    `;
    stubMonacoEditor(buildTracingUserQuery());
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-sort')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TRACE_SORT_DURATION);
  });

  it('gql10-histogram runs extra executes until histogram appears', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <button data-testid="gql-execute-btn"></button>
      <span data-testid="gql-complexity-badge">~5</span>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tracing-badge"></button>
      <div data-testid="gql-trace-view">
        <button data-testid="gql-trace-sort-duration" class="gql-trace-sort-btn--active"></button>
      </div>
    `;
    stubMonacoEditor(buildTracingUserQuery());
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-histogram')!;
    await step.preAction!(ctx);
    // Simulate histogram appearing after first extra execute
    (ctx.click as ReturnType<typeof vi.fn>).mockImplementation(async (sel: string) => {
      if (sel === GQL.EXECUTE_BTN) {
        const hist = document.createElement('div');
        hist.setAttribute('data-testid', 'gql-histogram-strip');
        document.body.appendChild(hist);
      }
    });
    await step.action!(ctx);
    expect(document.querySelector(GQL.HISTOGRAM_STRIP)).toBeTruthy();
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
    await gqlPerformanceTracingLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });
});
