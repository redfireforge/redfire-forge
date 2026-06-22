/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql11'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlPerformanceTracingLesson } from './graphql-performance-tracing';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  buildTracingUserQuery,
  getComplexityBadgeScore,
  resetGqlLesson10SessionFlags,
  resetGqlLessonSessionFlags,
  gqlPerformanceTracingLessonSetup,
  ensureTracingHealthQuery,
  ensureTracingUserQuery,
  getGqlEditorQuery,
  ensureTracingExecuted,
  ensureTracingViewOpen,
  ensureTracingResolverHovered,
  ensureTracingSortedByDuration,
  ensureLatencyHistogramVisible,
  gqlPerformanceTracingLessonCleanup,
} from './graphql-lesson-helpers';
import { stubMonacoEditor } from './__test-utils__/graphql-test-fixtures';

function stubTracingDom(extra = ''): string {
  return `
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-execute-btn"></button>
    <span data-testid="gql-complexity-badge">≈1</span>
    <div data-testid="gql-response-viewer"></div>
    <button data-testid="gql-rv-tracing-badge"></button>
    <div data-testid="gql-trace-view">
      <button data-testid="gql-trace-sort-duration">Slowest first</button>
      <div data-testid="gql-trace-resolver-row"><div class="gql-trace-bar"></div></div>
    </div>
    ${extra}
  `;
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
    expect(gqlPerformanceTracingLesson.steps.length).toBe(8);
    expect(gqlPerformanceTracingLesson.estimatedMinutes).toBe(4);
    expect(gqlPerformanceTracingLesson.tabBudget).toBe(1);
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
      'gql10-tracing-badge',
      'gql10-waterfall',
      'gql10-hover',
      'gql10-sort',
      'gql10-histogram',
    ]);
  });

  it('all 8 steps have pauseAfter: true', () => {
    gqlPerformanceTracingLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  // ── Concept content ───────────────────────────────────────────────────────

  it('concept title mentions Performance Tracing', () => {
    expect(gqlPerformanceTracingLesson.concept.title).toContain('Performance');
    expect(gqlPerformanceTracingLesson.concept.title).toContain('Tracing');
  });

  it('concept body describes three performance layers', () => {
    expect(gqlPerformanceTracingLesson.concept.body).toContain('Layer 1');
    expect(gqlPerformanceTracingLesson.concept.body).toContain('Layer 2');
    expect(gqlPerformanceTracingLesson.concept.body).toContain('Layer 3');
  });

  it('concept body explains WHY complexity estimation matters', () => {
    expect(gqlPerformanceTracingLesson.concept.body).toContain('authoring time');
  });

  it('concept body explains WHY waterfall is more useful than total latency', () => {
    expect(gqlPerformanceTracingLesson.concept.body).toContain('waterfall');
    expect(gqlPerformanceTracingLesson.concept.body).toContain('bottleneck');
  });

  it('concept body explains WHY distribution matters (p95)', () => {
    expect(gqlPerformanceTracingLesson.concept.body).toContain('p95');
    expect(gqlPerformanceTracingLesson.concept.body).toContain('distribution');
  });

  it('has 5 key terms', () => {
    expect(gqlPerformanceTracingLesson.concept.keyTerms).toHaveLength(5);
  });

  it('key terms include Resolver row', () => {
    const terms = gqlPerformanceTracingLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Resolver row');
  });

  it('key terms include Latency histogram', () => {
    const terms = gqlPerformanceTracingLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Latency histogram');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('diagram is a 700x430 SVG', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('diagram contains window chrome traffic lights', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('#febc2e');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows complexity badge', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('Complexity');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('≈5');
  });

  it('diagram shows Tracing tab active', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('Tracing');
  });

  it('diagram shows waterfall resolver rows', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('Query.user');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('Query.health');
  });

  it('diagram shows color legend for resolver durations', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('50ms');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('200ms');
  });

  it('diagram shows histogram strip with p95 marker', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('Latency Histogram');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('p95');
  });

  it('diagram uses CSS design tokens', () => {
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('var(--bg)');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('var(--surface)');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('var(--border)');
    expect(gqlPerformanceTracingLesson.concept.diagram).toContain('var(--primary)');
  });

  // ── Step spotlights match their panel/element ─────────────────────────────

  it('gql10-complexity highlights complexity badge', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-complexity')!;
    expect(step.highlight).toBe(GQL.COMPLEXITY_BADGE);
    expect(step.verify).toBe(GQL.COMPLEXITY_BADGE);
  });

  it('gql10-expand highlights complexity badge', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    expect(step.highlight).toBe(GQL.COMPLEXITY_BADGE);
    expect(step.verify).toBe(GQL.COMPLEXITY_BADGE);
  });

  it('gql10-execute highlights execute button (not tracing badge)', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-execute')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
    expect(step.verify).toBe(GQL.RV_TRACING_BADGE);
  });

  it('gql10-tracing-badge highlights the tracing badge and verifies trace view', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-tracing-badge')!;
    expect(step.highlight).toBe(GQL.RV_TRACING_BADGE);
    expect(step.verify).toBe(GQL.TRACE_VIEW);
  });

  it('gql10-waterfall highlights trace view', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-waterfall')!;
    expect(step.highlight).toBe(GQL.TRACE_VIEW);
    expect(step.verify).toBe(GQL.TRACE_VIEW);
  });

  it('gql10-hover highlights resolver row', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-hover')!;
    expect(step.highlight).toBe(GQL.TRACE_RESOLVER_ROW);
    expect(step.verify).toBe(GQL.TRACE_RESOLVER_ROW);
  });

  it('gql10-sort highlights sort-by-duration button', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-sort')!;
    expect(step.highlight).toBe(GQL.TRACE_SORT_DURATION);
    expect(step.verify).toBe(GQL.TRACE_SORT_DURATION);
  });

  it('gql10-histogram highlights histogram strip', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-histogram')!;
    expect(step.highlight).toBe(GQL.HISTOGRAM_STRIP);
    expect(step.verify).toBe(GQL.HISTOGRAM_STRIP);
  });

  // ── New gql10-tracing-badge step behaviour ────────────────────────────────

  it('gql10-tracing-badge step has correct preAction and uses ensureTracingExecuted', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-tracing-badge')!;
    expect(step.preAction).toBe(ensureTracingExecuted);
  });

  it('gql10-tracing-badge action calls ensureTracingViewOpen', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-tracing-badge')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TRACING_BADGE);
  });

  // ── Step description WHY content ──────────────────────────────────────────

  it('gql10-complexity description explains WHY complexity estimation matters', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-complexity')!;
    expect(step.description).toContain('authoring time');
    expect(step.description).toContain('server');
  });

  it('gql10-expand description explains WHY score increases with fields', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    expect(step.description).toContain('resolver');
    expect(step.description).toContain('N+1');
  });

  it('gql10-execute description explains WHY server must opt in to tracing', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-execute')!;
    expect(step.description).toContain('extensions.tracing');
    expect(step.description).toContain('opt in');
  });

  it('gql10-tracing-badge description explains WHY badge not auto-open', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-tracing-badge')!;
    expect(step.description).toContain('conditional');
  });

  it('gql10-waterfall description explains parallel vs sequential resolvers', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-waterfall')!;
    expect(step.description).toContain('parallel');
    expect(step.description).toContain('sequential');
  });

  it('gql10-hover description explains Start offset significance', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-hover')!;
    expect(step.description).toContain('Start');
    expect(step.description).toContain('color');
  });

  it('gql10-sort description explains WHY sort finds bottleneck', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-sort')!;
    expect(step.description).toContain('bottleneck');
  });

  it('gql10-histogram description explains p95 and distribution patterns', () => {
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-histogram')!;
    expect(step.description).toContain('p95');
    expect(step.description).toContain('distribution');
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

  it('getComplexityBadgeScore parses ≈N badge text', () => {
    document.body.innerHTML = '<span data-testid="gql-complexity-badge">≈12</span>';
    expect(getComplexityBadgeScore()).toBe(12);
  });

  it('gql10-complexity waits for complexity badge', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <span data-testid="gql-complexity-badge">≈1</span>
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
      <span data-testid="gql-complexity-badge">≈5</span>
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
      <span data-testid="gql-complexity-badge">≈5</span>
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
      <span data-testid="gql-complexity-badge">≈5</span>
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

  it('gql10-expand re-runs user query when complexity does not increase', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom('<span data-testid="gql-complexity-badge">≈5</span>');
    stubMonacoEditor('query { health }');
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.COMPLEXITY_BADGE, 5000);
  });

  it('gql10-expand skips re-run when complexity already increased', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    const badge = document.querySelector(GQL.COMPLEXITY_BADGE)!;
    badge.textContent = '≈10';
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    badge.textContent = '≈10';
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql10-waterfall opens tracing view', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-waterfall')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TRACING_BADGE);
  });

  it('gql10-hover dispatches mouseover on resolver bar', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    const bar = document.querySelector<HTMLElement>(`${GQL.TRACE_RESOLVER_ROW} .gql-trace-bar`)!;
    const spy = vi.spyOn(bar, 'dispatchEvent');
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-hover')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(spy).toHaveBeenCalled();
  });

  it('ensureTracingHealthQuery guard skips when health query loaded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor('query { health }');
    await ensureTracingHealthQuery(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTracingHealthQuery(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureTracingExecuted guard skips when tracing badge visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    await ensureTracingExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTracingExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureTracingViewOpen guard skips when trace view visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    await ensureTracingViewOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTracingViewOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.RV_TRACING_BADGE);
  });

  it('ensureTracingSortedByDuration guard skips when sort active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom(
      '<button data-testid="gql-trace-sort-duration" class="gql-trace-sort-btn--active"></button>',
    );
    stubMonacoEditor(buildTracingUserQuery());
    await ensureTracingSortedByDuration(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTracingSortedByDuration(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TRACE_SORT_DURATION);
  });

  it('getComplexityBadgeScore returns 0 when badge missing', () => {
    document.body.innerHTML = '';
    expect(getComplexityBadgeScore()).toBe(0);
  });

  it('gql10-expand does not re-run user query when complexity increases', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor('query { health }');
    const badge = document.querySelector(GQL.COMPLEXITY_BADGE)!;
    let score = 1;
    Object.defineProperty(badge, 'textContent', {
      get: () => `≈${score}`,
    });
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    await step.preAction!(ctx);
    score = 10;
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
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
    await gqlPerformanceTracingLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-performance-tracing',
      'Performance Tracing',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('ensureTracingViewOpen uses tracing tab when badge missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom().replace(
      '<button data-testid="gql-rv-tracing-badge"></button>',
      '<button data-testid="gql-rv-tab-tracing"></button>',
    );
    stubMonacoEditor(buildTracingUserQuery());
    await ensureTracingViewOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_TRACING);
  });

  it('ensureTracingHealthQuery guard skips when health query loaded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    const { setQuery } = stubMonacoEditor('query { health }');
    await ensureTracingHealthQuery(ctx);
    vi.mocked(setQuery).mockClear();
    await ensureTracingHealthQuery(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensureTracingUserQuery uses demo user id from session', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    const { resetGqlLesson2SessionFlags, seedDemoUsers } = await import('./graphql-lesson-helpers');
    resetGqlLesson2SessionFlags();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-tracing' } } }) })
      .mockResolvedValueOnce({ json: async () => ({ data: { createUser: { id: 'usr-b' } } }) }));
    await seedDemoUsers();
    stubMonacoEditor('query { health }');
    await ensureTracingUserQuery(ctx);
    expect(getGqlEditorQuery()).toContain('usr-tracing');
  });

  it('ensureTracingResolverHovered guard skips on second call', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    const row = document.querySelector(GQL.TRACE_RESOLVER_ROW)!;
    const bar = row.querySelector('.gql-trace-bar')!;
    const mouseSpy = vi.spyOn(bar, 'dispatchEvent');
    await ensureTracingResolverHovered(ctx);
    mouseSpy.mockClear();
    await ensureTracingResolverHovered(ctx);
    expect(mouseSpy).not.toHaveBeenCalled();
  });

  it('ensureLatencyHistogramVisible guard skips when histogram present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom(
      '<div data-testid="gql-histogram-strip"></div>',
    );
    stubMonacoEditor(buildTracingUserQuery());
    await ensureLatencyHistogramVisible(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLatencyHistogramVisible(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('getComplexityBadgeScore returns 0 when text has no digits', () => {
    document.body.innerHTML = '<span data-testid="gql-complexity-badge">n/a</span>';
    expect(getComplexityBadgeScore()).toBe(0);
  });

  it('gql10-expand re-runs user query when complexity does not increase', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor('query { health }');
    const badge = document.querySelector(GQL.COMPLEXITY_BADGE)!;
    Object.defineProperty(badge, 'textContent', { get: () => '≈5' });
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.COMPLEXITY_BADGE, 5000);
  });

  it('gql10-expand re-runs user query when complexity score unchanged', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor('query { health }');
    const badge = document.querySelector(GQL.COMPLEXITY_BADGE)!;
    Object.defineProperty(badge, 'textContent', { get: () => '≈5' });
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    const userSpy = vi.spyOn(
      await import('./graphql-lesson-helpers'),
      'ensureTracingUserQuery',
    );
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(userSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    userSpy.mockRestore();
  });

  it('gqlPerformanceTracingLessonCleanup closes demo tab', async () => {
    const ctx = makeCtx();
    await gqlPerformanceTracingLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-performance-tracing');
  });

  it('ensureTracingResolverHovered completes when resolver bar missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom().replace(
      '<div data-testid="gql-trace-resolver-row"><div class="gql-trace-bar"></div></div>',
      '<div data-testid="gql-trace-resolver-row"></div>',
    );
    stubMonacoEditor(buildTracingUserQuery());
    await ensureTracingResolverHovered(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql10-expand does not re-run when before score is zero', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom().replace(
      '<span data-testid="gql-complexity-badge">≈5</span>',
      '<span data-testid="gql-complexity-badge">n/a</span>',
    );
    stubMonacoEditor('query { health }');
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql10-complexity action calls ensureTracingHealthQuery', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor('query { health }');
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-complexity')!;
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.COMPLEXITY_BADGE, 5000);
  });

  it('ensureTracingSortedByDuration guard skips when already sorted', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    await ensureTracingSortedByDuration(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTracingSortedByDuration(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TRACE_SORT_DURATION);
  });

  it('ensureTracingHealthQuery guard skips when health query unchanged', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor('query { health }');
    await ensureTracingHealthQuery(ctx);
    const { setQuery } = stubMonacoEditor('query { health }');
    vi.mocked(setQuery).mockClear();
    await ensureTracingHealthQuery(ctx);
    expect(setQuery).not.toHaveBeenCalled();
  });

  it('ensureTracingViewOpen clicks tracing tab when badge missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom().replace(
      '<button data-testid="gql-rv-tracing-badge"></button>',
      '<button data-testid="gql-rv-tab-tracing"></button>',
    );
    stubMonacoEditor(buildTracingUserQuery());
    await ensureTracingViewOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_TRACING);
  });

  it('getComplexityBadgeScore returns 0 when badge element missing', () => {
    document.body.innerHTML = '';
    expect(getComplexityBadgeScore()).toBe(0);
  });

  it('gqlPerformanceTracingLessonSetup closes history and collections panels', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <input data-testid="gql-endpoint-input" value="http://old" />
      <div data-testid="gql-history-panel"></div>
      <div data-testid="gql-collections-panel"></div>
      <div data-testid="gql-editor"></div>
    `;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await gqlPerformanceTracingLessonSetup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_COLLECTIONS);
  });

  it('ensureLatencyHistogramVisible executes until histogram appears', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor(buildTracingUserQuery());
    await ensureLatencyHistogramVisible(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql10-expand skips re-run when complexity increases', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = stubTracingDom();
    stubMonacoEditor('query { health }');
    const badge = document.querySelector(GQL.COMPLEXITY_BADGE)!;
    let score = 1;
    Object.defineProperty(badge, 'textContent', { get: () => `≈${score}` });
    const step = gqlPerformanceTracingLesson.steps.find((s) => s.id === 'gql10-expand')!;
    const userSpy = vi.spyOn(
      await import('./graphql-lesson-helpers'),
      'ensureTracingUserQuery',
    ).mockImplementation(async () => {
      score = 10;
    });
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(userSpy).toHaveBeenCalledTimes(1);
    userSpy.mockRestore();
  });
});
