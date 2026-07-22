/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaHeadersFiltersLesson } from './kafka-headers-filters';

describe('kafka-headers-filters lesson', () => {
  it('has valid lesson structure', () => {
    expect(kafkaHeadersFiltersLesson.id).toBe('kafka-headers-filters');
    expect(kafkaHeadersFiltersLesson.domainId).toBe('protocols');
    expect(kafkaHeadersFiltersLesson.category).toBe('kafka');
    expect(kafkaHeadersFiltersLesson.name).toBe('Headers & Filters');
    expect(kafkaHeadersFiltersLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaHeadersFiltersLesson.initialTab).toBe('kafka-message-studio');
  });

  it('has allowedTabs including kafka-settings', () => {
    expect(kafkaHeadersFiltersLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has a dockerEndpoint and dockerCommand', () => {
    expect(kafkaHeadersFiltersLesson.dockerEndpoint).toBeTruthy();
    expect(kafkaHeadersFiltersLesson.dockerCommand).toBeTruthy();
  });

  it('has a setup function (kafkaPublishSetup)', () => {
    expect(typeof kafkaHeadersFiltersLesson.setup).toBe('function');
  });

  it('has a cleanup function', () => {
    expect(typeof kafkaHeadersFiltersLesson.cleanup).toBe('function');
  });

  it('has concept with title, body, and key terms', () => {
    expect(kafkaHeadersFiltersLesson.concept.title).toBeTruthy();
    expect(kafkaHeadersFiltersLesson.concept.body).toBeTruthy();
    expect(kafkaHeadersFiltersLesson.concept.keyTerms).toBeDefined();
    expect(kafkaHeadersFiltersLesson.concept.keyTerms!.length).toBeGreaterThan(0);
  });

  it('has an SVG diagram', () => {
    expect(kafkaHeadersFiltersLesson.concept.diagram).toContain('<svg');
  });

  it('has exactly 7 steps', () => {
    expect(kafkaHeadersFiltersLesson.steps.length).toBe(7);
  });

  it('all steps have required fields (id, title, description)', () => {
    for (const step of kafkaHeadersFiltersLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('step IDs are unique', () => {
    const ids = kafkaHeadersFiltersLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has expected step IDs in order', () => {
    const ids = kafkaHeadersFiltersLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'hf-fill-all',
      'hf-send-header',
      'hf-filter-intro',
      'hf-key-filter',
      'hf-header-filter',
      'hf-jsonpath',
      'hf-detail',
    ]);
  });

  it('step hf-fill-all has preAction (navigate + cleanup) and action (fill all fields)', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-fill-all')!;
    expect(step.highlight).toBeTruthy();
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
    expect(step.verify).toBeTruthy();
  });

  it('step hf-fill-all preAction navigates to publish tab and clears stale header rows', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-fill-all')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-publish'));
    expect(ctx.click).toHaveBeenCalledWith('.kafka-ms-remove-btn');
  });

  it('step hf-send-header action clicks send and waits for result', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-send-header')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('step hf-filter-intro highlights the filters section container, no action', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-filter-intro')!;
    expect(typeof step.preAction).toBe('function');
    expect(step.action).toBeUndefined();
    expect(step.highlight).toContain('kafka-ms-con-filters');
  });

  it('step hf-filter-intro preAction clicks consume tab, resets mode, and clears all filter inputs', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-filter-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-consume'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-mode-once'));
    // All four filter fields must be cleared so repeat runs don't compound filters.
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('con-key'), '');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('con-header'), '');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('con-jsonpath'), '');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('con-jsonval'), '');
  });

  it('step hf-key-filter has both preAction and action', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
  });

  it('step hf-key-filter preAction fills topic, position, and key filter', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const fillSelectors = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(fillSelectors.some((s: string) => s.includes('con-topic'))).toBe(true);
    expect(fillSelectors.some((s: string) => s.includes('con-key'))).toBe(true);
  });

  it('step hf-key-filter action clicks consume and waits for results', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('results-zone'), expect.any(Number));
  });

  it('step hf-header-filter has preAction and action, highlights CON_HEADER_FILTER_INPUT', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-header-filter')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
    expect(step.highlight).toContain('con-header');
  });

  it('step hf-header-filter preAction clears key filter and sets header match', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-header-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const fillArgs = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const keyFilterClear = fillArgs.find((c: unknown[]) => (c[0] as string).includes('con-key') && c[1] === '');
    expect(keyFilterClear).toBeDefined();
    const headerMatchFill = fillArgs.find((c: unknown[]) => (c[0] as string).includes('con-header') && (c[1] as string).includes('traceId'));
    expect(headerMatchFill).toBeDefined();
  });

  it('step hf-header-filter action clicks consume and waits for results', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-header-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('results-zone'), expect.any(Number));
  });

  it('step hf-jsonpath preAction clears header filter (not key) and sets JSONPath fields', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-jsonpath')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const fillArgs = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    // Must clear the header filter left by hf-header-filter, not the key filter.
    const headerFilterClear = fillArgs.find((c: unknown[]) => (c[0] as string).includes('con-header') && c[1] === '');
    expect(headerFilterClear).toBeDefined();
    const jsonpathFill = fillArgs.find((c: unknown[]) => (c[1] as string).includes('$.status'));
    expect(jsonpathFill).toBeDefined();
    const jsonvalFill = fillArgs.find((c: unknown[]) => c[1] === 'CREATED');
    expect(jsonvalFill).toBeDefined();
  });

  it('step hf-detail action clicks con-row-0 (not thead) and waits for detail pane', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-detail')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Must target the first *data* row by testid — tr:first-child matches the
    // <thead> column-header row which has no onClick and would leave the pane closed.
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="con-row-0"]');
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('detail-pane'), expect.any(Number));
  });
  it('has Docker badge tag', () => {
    expect(kafkaHeadersFiltersLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K6: kafka-topic-explorer ───────────────────────────────────

