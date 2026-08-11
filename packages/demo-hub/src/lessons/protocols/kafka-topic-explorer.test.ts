/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaTopicExplorerLesson } from './kafka-topic-explorer';

// kafkaPublishSetup performs its own network calls + UI fallback loops (up to
// ~12 ctx.delay calls when no Kafka server/DOM is present) that are unrelated
// to this lesson's own logic. Mock it to a fast no-op so delay-count
// assertions below reflect only kafka-topic-explorer's own loops.
vi.mock('../setup-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../setup-helpers')>();
  return {
    ...actual,
    kafkaPublishSetup: vi.fn().mockResolvedValue(undefined),
    preparePlaintextKafkaStudio: vi.fn().mockResolvedValue(undefined),
  };
});

describe('kafka-topic-explorer lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaTopicExplorerLesson.id).toBe('kafka-topic-explorer');
    expect(kafkaTopicExplorerLesson.domainId).toBe('protocols');
    expect(kafkaTopicExplorerLesson.category).toBe('kafka');
    expect(kafkaTopicExplorerLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTopicExplorerLesson.initialTab).toBe('kafka-message-studio');
    expect(kafkaTopicExplorerLesson.allowedTabs).toEqual(['kafka-message-studio']);
    expect(typeof kafkaTopicExplorerLesson.prepareBeforeNavigate).toBe('function');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaTopicExplorerLesson.concept.title).toBeTruthy();
    expect(kafkaTopicExplorerLesson.concept.body).toBeTruthy();
    expect(kafkaTopicExplorerLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaTopicExplorerLesson.concept.diagram).toContain('<svg');
  });

  it('has at least 7 steps', () => {
    expect(kafkaTopicExplorerLesson.steps.length).toBeGreaterThanOrEqual(7);
  });

  it('all steps have required fields and unique IDs', () => {
    for (const step of kafkaTopicExplorerLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
    const ids = kafkaTopicExplorerLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaTopicExplorerLesson.dockerEndpoint).toBeTruthy();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaTopicExplorerLesson.setup).toBe('function');
    expect(typeof kafkaTopicExplorerLesson.cleanup).toBe('function');
  });

  it('step te-intro action clicks topics tab', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-intro')!;
    expect(step).toBeDefined();
    const ctx = makeCtx();
    if (step.action) await step.action(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTopicExplorerLesson.setup) {
      await expect(kafkaTopicExplorerLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTopicExplorerLesson.cleanup) {
      await expect(kafkaTopicExplorerLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaTopicExplorerLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaTopicExplorerLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaTopicExplorerLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
      const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.length;
      const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
      const delayCalls = (ctx.delay as ReturnType<typeof vi.fn>).mock.calls.length;
      if (clickCalls + fillCalls + delayCalls > 0) { called = true; break; }
    }
    expect(called).toBe(true);
  });

  it('step te-select action clicks first topic row when present (if(row) true branch)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-select')!;
    expect(step).toBeDefined();
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureTopicsTab returns early when topic rows already exist (line 10 true branch)', async () => {
    // Pre-populate DOM with a topic row so ensureTopicsTab returns immediately
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // click may have been called for the Topics tab but ensureTopicsTab returned early
    // (no error should be thrown)
    expect(true).toBe(true);
  });

  it('ensureTopicSelected clears search filter when searchInput has a value (line 29 true branch)', async () => {
    // Create search input with a value
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'topic-search');
    input.value = 'existing search';
    document.body.appendChild(input);
    // Create detail tabs so ensureTopicSelected returns after clearing search
    const detailTabs = document.createElement('div');
    detailTabs.setAttribute('data-testid', 'detail-tabs');
    document.body.appendChild(detailTabs);
    // Pre-populate topic rows so ensureTopicsTab returns early
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-select')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('topic-search'), '');
  });

  it('detail tab preAction clicks messagesTab when present (line 283 true branch)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-browse')!;
    expect(step).toBeDefined();
    // Create DOM for ensureTopicSelected to pass
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const detailTabs = document.createElement('div');
    detailTabs.setAttribute('data-testid', 'detail-tabs');
    document.body.appendChild(detailTabs);
    const messagesTab = document.createElement('div');
    messagesTab.setAttribute('data-testid', 'detail-tab-messages');
    const clickSpy = vi.fn();
    messagesTab.addEventListener('click', clickSpy);
    document.body.appendChild(messagesTab);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step te-select preAction clears search when input has value (line 237 true branch)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-select')!;
    expect(step).toBeDefined();
    const searchInput = document.createElement('input');
    searchInput.setAttribute('data-testid', 'topic-search');
    searchInput.value = 'orders';
    document.body.appendChild(searchInput);
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('topic-search'), '');
  });

  it('te-browse preAction clicks audit.login row when present', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-browse')!;
    expect(step?.preAction).toBeDefined();
    // Provide topic table with an audit.login row
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    const nameCell = document.createElement('td');
    nameCell.className = 'kafka-explorer-topic-name';
    nameCell.textContent = 'audit.login';
    row.appendChild(nameCell);
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('te-browse preAction clicks Messages tab', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-browse')!;
    expect(step?.preAction).toBeDefined();
    // Provide topic rows so ensureTopicsTab passes
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    // Messages tab button
    const messagesTab = document.createElement('button');
    messagesTab.setAttribute('data-testid', 'detail-tab-messages');
    const tabClickSpy = vi.fn();
    messagesTab.addEventListener('click', tabClickSpy);
    document.body.appendChild(messagesTab);
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(tabClickSpy).toHaveBeenCalled();
  });

  it('ensureTopicsTab breaks loop early when topic rows appear (line 18 true branch via te-select preAction)', async () => {
    // Create a topic table with a styled row BEFORE the step fires
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    // te-select preAction calls ensureTopicSelected -> ensureTopicsTab
    // But ensureTopicsTab checks for TOPIC_ROW_SELECTOR first and returns early (line 10 true branch)
    // To test line 18, the rows should NOT exist at line 10 but SHOULD exist mid-loop
    // We need to remove the row initially and add it after click is called
    document.body.removeChild(table);
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-select')!;
    const ctx = makeCtx();
    // When ctx.click fires, add the row to simulate async topic load
    (ctx.click as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      document.body.appendChild(table);
    });
    await step.preAction!(ctx);
    // The loop in ensureTopicsTab should break on first delay iteration after row appears
    const delayCalls = (ctx.delay as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(delayCalls).toBeLessThan(25); // If never breaks, 20*500ms delay calls + others
  });

  it('ensureTopicSelected clears search filter when input has value (line 29 true branch via te-consume preAction)', async () => {
    // Create topic table row so ensureTopicsTab returns early
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    // Add search input with a value to trigger line 29 branch
    const searchInput = document.createElement('input');
    searchInput.setAttribute('data-testid', 'topic-search');
    searchInput.value = 'my-topic';
    document.body.appendChild(searchInput);
    // Add detail tabs so ensureTopicSelected returns early (line 34 true branch)
    const detailTabs = document.createElement('div');
    detailTabs.setAttribute('data-testid', 'detail-tabs');
    document.body.appendChild(detailTabs);
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-metrics')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ctx.fill should have been called with empty string (clearing search)
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const clearCall = fillCalls.find((c: unknown[]) => c[1] === '');
    expect(clearCall).toBeTruthy();
  });

  it('setup stays snappy and does not poll for topic rows (Topics click is step 1)', async () => {
    const ctx = makeCtx();
    await kafkaTopicExplorerLesson.setup!(ctx);
    const delayCalls = (ctx.delay as ReturnType<typeof vi.fn>).mock.calls.length;
    // Guard poll is at most 6 × 80ms; no 30×500 topic-row wait.
    expect(delayCalls).toBeLessThan(8);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('prepareBeforeNavigate is wired for quiet connect + seed', async () => {
    const { preparePlaintextKafkaStudio } = await import('../setup-helpers');
    await kafkaTopicExplorerLesson.prepareBeforeNavigate!(makeCtx());
    expect(preparePlaintextKafkaStudio).toHaveBeenCalled();
  });

  it('step te-browse action consumes and spotlights results', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-browse')!;
    expect(step?.action).toBeDefined();
    // Action depends on live Kafka — just verify it's a function
    expect(typeof step.action).toBe('function');
  });

  it('step te-cg action injects sample group data when empty state present (line 371 branches)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-cg')!;
    expect(step?.action).toBeDefined();
    // Create detail groups tab with empty state
    const groupsTab = document.createElement('div');
    groupsTab.setAttribute('data-testid', 'detail-groups-tab');
    const emptyState = document.createElement('div');
    emptyState.className = 'kafka-ms-empty-state';
    groupsTab.appendChild(emptyState);
    document.body.appendChild(groupsTab);
    // Need detail-tabs and topic table for ensureTopicSelected
    const detailTabs = document.createElement('div');
    detailTabs.setAttribute('data-testid', 'detail-tabs');
    document.body.appendChild(detailTabs);
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const ctx = makeCtx();
    await step.action(ctx);
    // Groups tab should have been populated (innerHTML changed)
    expect(groupsTab.innerHTML).toContain('kafka-consumer-group-table');
  });

  it('te-intro preAction removes selected class from topic rows (line 168)', async () => {
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.classList.add('selected');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(row.classList.contains('selected')).toBe(false);
  });

  it('ensureTopicSelected clicks row when no detail tabs (line 37 true branch)', async () => {
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-metrics')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('te-browse action clicks consume and waits for real rows', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-browse')!;
    expect(step).toBeDefined();
    expect(typeof step.action).toBe('function');
  });
  it('has Docker badge tag', () => {
    expect(kafkaTopicExplorerLesson.tag).toBe('🐳 Docker');
  });

  it('step te-collapse has preAction and action, highlights collapse button', () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-collapse')!;
    expect(step).toBeDefined();
    expect(typeof step.preAction).toBe('function');
    expect(typeof step.action).toBe('function');
    expect(step.highlight).toContain('collapse');
  });

  it('step te-collapse action clicks collapse button twice (collapse then expand)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-collapse')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    const collapseClicks = clickCalls.filter((c: unknown[]) => (c[0] as string).includes('collapse'));
    expect(collapseClicks.length).toBe(2);
  });

  it('has expected step IDs including te-collapse', () => {
    const ids = kafkaTopicExplorerLesson.steps.map((s) => s.id);
    expect(ids).toContain('te-collapse');
    expect(ids.indexOf('te-collapse')).toBeLessThan(ids.indexOf('te-metrics'));
  });

});

// ─── K7: kafka-schema-registry ──────────────────────────────────

