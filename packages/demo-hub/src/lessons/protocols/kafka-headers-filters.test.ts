/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaHeadersFiltersLesson } from './kafka-headers-filters';
import { KAFKA } from '@shared/selectors';

describe('kafka-headers-filters lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });
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

  it('has exactly 8 steps', () => {
    expect(kafkaHeadersFiltersLesson.steps.length).toBe(8);
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
      'hf-body-contains',
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
    // Quiet clear writes directly to the DOM — seed filter inputs so we can assert.
    for (const [id, testId] of [
      ['kms-con-key', 'con-key-filter-input'],
      ['kms-con-header', 'con-header-filter-input'],
      ['kms-con-jsonpath', 'con-jsonpath-input'],
      ['kms-con-jsonval', 'con-jsonval-input'],
      ['kms-con-body', 'con-body-contains-input'],
    ] as const) {
      const input = document.createElement('input');
      input.id = id;
      input.setAttribute('data-testid', testId);
      input.value = 'stale';
      document.body.appendChild(input);
    }

    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-filter-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('tab-consume'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('con-mode-once'));
    // Quiet clear — no visible ctx.fill on Body Contains (avoids flashing that field).
    expect((document.querySelector('[data-testid="con-jsonpath-input"]') as HTMLInputElement).value).toBe('');
    expect((document.querySelector('[data-testid="con-jsonval-input"]') as HTMLInputElement).value).toBe('');
    expect(
      (document.querySelector('[data-testid="con-body-contains-input"]') as HTMLInputElement).value,
    ).toBe('');
  });

  it('step hf-key-filter preAction selects Earliest from the portaled CustomSelect menu', async () => {
    // CustomSelect portals .cs-menu to document.body — not inside the select wrapper.
    // Regression: querying .cs-item only inside the wrapper left Start Position on Latest,
    // so Consume Once timed out waiting for new messages and never saw the pre-seeded key.
    const wrap = document.createElement('div');
    wrap.setAttribute('data-testid', 'con-position-select');
    wrap.innerHTML = '<button type="button" class="cs-trigger">Latest</button>';
    document.body.appendChild(wrap);

    let earliestClicked = false;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel.includes('con-position-select') && sel.includes('cs-trigger')) {
        const menu = document.createElement('div');
        menu.className = 'cs-menu';
        const latest = document.createElement('div');
        latest.className = 'cs-item';
        latest.textContent = 'Latest';
        const earliest = document.createElement('div');
        earliest.className = 'cs-item';
        earliest.textContent = 'Earliest';
        earliest.addEventListener('click', () => { earliestClicked = true; });
        menu.append(latest, earliest);
        document.body.appendChild(menu);
      }
    });

    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    await step.preAction!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(`${KAFKA.CON_POSITION_SELECT} .cs-trigger`);
    expect(earliestClicked).toBe(true);
  });

  it('step hf-key-filter has both preAction and action', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
  });

  it('step hf-key-filter preAction fills topic and group (filters cleared quietly)', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const fillSelectors = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
    expect(fillSelectors.some((s: string) => s.includes('con-topic'))).toBe(true);
    expect(fillSelectors.some((s: string) => s.includes('con-group'))).toBe(true);
    // Must not tour Body Contains with visible fill during Key filter prep.
    expect(fillSelectors.some((s: string) => String(s).includes('body-contains'))).toBe(false);
  });

  it('step hf-key-filter action clicks consume and waits for results', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-key-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('results-zone'), expect.any(Number));
    // Action must not visible-fill Body Contains (that caused the flashing ring).
    const bodyFills = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).includes('body-contains'),
    );
    expect(bodyFills).toHaveLength(0);
  });

  it('step hf-header-filter has preAction and action, highlights CON_HEADER_FILTER_INPUT', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-header-filter')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
    expect(step.highlight).toContain('con-header');
  });

  it('step hf-header-filter preAction clears filters quietly (no Body Contains fill tour)', async () => {
    const body = document.createElement('input');
    body.setAttribute('data-testid', 'con-body-contains-input');
    body.value = 'stale';
    document.body.appendChild(body);

    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-header-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(body.value).toBe('');
    const fillArgs = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const bodyContainsFill = fillArgs.find((c: unknown[]) => String(c[0]).includes('body-contains'));
    expect(bodyContainsFill).toBeUndefined();
  });

  it('step hf-header-filter action clicks consume and waits for results', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-header-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('results-zone'), expect.any(Number));
    const bodyFills = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).includes('body-contains'),
    );
    expect(bodyFills).toHaveLength(0);
  });

  it('step hf-jsonpath preAction clears all filters quietly including bodyContains', async () => {
    const body = document.createElement('input');
    body.setAttribute('data-testid', 'con-body-contains-input');
    body.value = 'stale';
    document.body.appendChild(body);
    const header = document.createElement('input');
    header.id = 'kms-con-header';
    header.value = 'stale';
    document.body.appendChild(header);

    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-jsonpath')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(header.value).toBe('');
    expect(body.value).toBe('');
  });

  it('step hf-jsonpath highlights the JSONPath pair (not Body Contains)', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-jsonpath')!;
    expect(step.highlight).toContain('con-jsonpath-pair');
    expect(step.highlight).not.toContain('body-contains');
  });

  it('step hf-jsonpath action fills JSONPath fields and never tours Body Contains', async () => {
    const pair = document.createElement('div');
    pair.setAttribute('data-testid', 'con-jsonpath-pair');
    pair.scrollIntoView = vi.fn();
    document.body.appendChild(pair);

    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-jsonpath')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('jsonpath'), '$.status');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('jsonval'), 'CREATED');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume-btn'));
    const bodyFills = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => String(c[0]).includes('body-contains'),
    );
    expect(bodyFills).toHaveLength(0);
  });

  it('step hf-detail action clicks con-row-0 and waits for detail modal', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-detail')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="con-row-0"]');
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('detail-modal'), expect.any(Number));
  });

  it('step hf-body-contains has preAction and action, highlights body-contains input', () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-body-contains')!;
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
    expect(step.highlight).toContain('body-contains');
  });

  it('step hf-body-contains action fills body contains and clicks consume', async () => {
    const step = kafkaHeadersFiltersLesson.steps.find((s) => s.id === 'hf-body-contains')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('body-contains'), 'us-east');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('consume-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('results-zone'), expect.any(Number));
  });
  it('has Docker badge tag', () => {
    expect(kafkaHeadersFiltersLesson.tag).toBe('🐳 Docker');
  });

});

// ─── K6: kafka-topic-explorer ───────────────────────────────────

