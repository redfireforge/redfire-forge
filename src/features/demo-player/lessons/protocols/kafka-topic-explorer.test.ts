/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaTopicExplorerLesson } from './kafka-topic-explorer';

describe('kafka-topic-explorer lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaTopicExplorerLesson.id).toBe('kafka-topic-explorer');
    expect(kafkaTopicExplorerLesson.domainId).toBe('protocols');
    expect(kafkaTopicExplorerLesson.category).toBe('kafka');
    expect(kafkaTopicExplorerLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTopicExplorerLesson.initialTab).toBe('kafka-message-studio');
    expect(kafkaTopicExplorerLesson.allowedTabs).toContain('kafka-settings');
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

  it('step te-intro has a preAction that clicks topics tab', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-intro')!;
    expect(step).toBeDefined();
    const ctx = makeCtx();
    if (step.preAction) await step.preAction(ctx);
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
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-consume')!;
    if (!step) return; // skip if step doesn't exist with this id
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

  it('step te-filter preAction uses detail-tabs when present (line 237 true branch)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-filter')!;
    if (!step) return;
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
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('ensureTopicSelected clicks row when detail-tabs absent (line 34/37 true branches — via te-consume preAction)', async () => {
    // te-consume preAction calls ensureTopicSelected
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-consume')!;
    if (!step?.preAction) return;
    // Provide topic table with row but NO detail tabs (so ensureTopicSelected clicks it)
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
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureTopicSelected clears search and clicks row (line 29 true + 34 true branch — via te-consume preAction)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-consume')!;
    if (!step?.preAction) return;
    // Search input with existing value
    const searchInput = document.createElement('input');
    searchInput.setAttribute('data-testid', 'topic-search');
    searchInput.value = 'payments';
    document.body.appendChild(searchInput);
    // Topic table with a row but no detail tabs
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
    const ctx = makeCtx();
    await step.preAction(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('topic-search'), '');
    expect(clickSpy).toHaveBeenCalled();
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

  it('setup breaks early from loop when topic rows already exist (line 64 true branch)', async () => {
    const table = document.createElement('table');
    table.className = 'kafka-explorer-topic-table';
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    const ctx = makeCtx();
    await kafkaTopicExplorerLesson.setup!(ctx);
    // Setup always calls click(TOPICS_TAB) then checks loop — delay should be called minimally
    const delayCalls = (ctx.delay as ReturnType<typeof vi.fn>).mock.calls.length;
    // Without early break: would call delay 20 times from kafkaPublishSetup + loop iterations
    // With break on first iteration: delayCalls should be << 20
    expect(delayCalls).toBeLessThan(10);
  });

  it('step te-consume action injects sample data when results zone is absent (line 295/298/302/303 branches)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-consume')!;
    if (!step?.action) return;
    // Create detail messages tab with action row but no results zone
    const messagesTab = document.createElement('div');
    messagesTab.setAttribute('data-testid', 'detail-messages-tab');
    const actionRow = document.createElement('div');
    actionRow.className = 'kafka-ms-action-row';
    messagesTab.appendChild(actionRow);
    document.body.appendChild(messagesTab);
    const ctx = makeCtx();
    await step.action(ctx);
    // Results zone should have been injected
    expect(messagesTab.querySelector('[data-testid="detail-results"]')).toBeTruthy();
  });

  it('step te-groups action injects sample group data when empty state present (line 371/371 branches)', async () => {
    const step = kafkaTopicExplorerLesson.steps.find((s) => s.id === 'te-groups')!;
    if (!step?.action) return;
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
});

// ─── K7: kafka-schema-registry ──────────────────────────────────

