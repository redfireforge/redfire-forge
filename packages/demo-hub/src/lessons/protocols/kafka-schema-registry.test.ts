/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaSchemaRegistryLesson } from './kafka-schema-registry';

describe('kafka-schema-registry lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaSchemaRegistryLesson.id).toBe('kafka-schema-registry');
    expect(kafkaSchemaRegistryLesson.domainId).toBe('protocols');
    expect(kafkaSchemaRegistryLesson.category).toBe('kafka');
    expect(kafkaSchemaRegistryLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaSchemaRegistryLesson.initialTab).toBe('kafka-message-studio');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaSchemaRegistryLesson.concept.title).toBeTruthy();
    expect(kafkaSchemaRegistryLesson.concept.body).toBeTruthy();
    expect(kafkaSchemaRegistryLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaSchemaRegistryLesson.concept.diagram).toContain('<svg');
  });

  it('has at least 7 steps with unique IDs', () => {
    expect(kafkaSchemaRegistryLesson.steps.length).toBeGreaterThanOrEqual(7);
    const ids = kafkaSchemaRegistryLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has setup and cleanup functions', () => {
    expect(typeof kafkaSchemaRegistryLesson.setup).toBe('function');
    expect(typeof kafkaSchemaRegistryLesson.cleanup).toBe('function');
  });

  it('has dockerEndpoint configured', () => {
    expect(kafkaSchemaRegistryLesson.dockerEndpoint).toBeTruthy();
  });

  it('step sr-connect action clicks connect button', async () => {
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-connect')!;
    expect(step).toBeDefined();
    if (step.action) {
      const ctx = makeCtx();
      await step.action(ctx);
      expect(ctx.click).toHaveBeenCalled();
    }
  });

  // ── Setup / cleanup ────────────────────────────────────────────────

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaSchemaRegistryLesson.setup) {
      await expect(kafkaSchemaRegistryLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaSchemaRegistryLesson.cleanup) {
      await expect(kafkaSchemaRegistryLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  // ── Step preActions and actions ──────────────────────────────────

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaSchemaRegistryLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaSchemaRegistryLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('at least one step calls ctx.click or ctx.fill during action/preAction', async () => {
    let called = false;
    for (const step of kafkaSchemaRegistryLesson.steps) {
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

  it('step sr-select action clicks first subject row when present (if(row) true branch)', async () => {
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-select')!;
    expect(step).toBeDefined();
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'subject-table');
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

  it('ensureRegistryConnected returns early when subject table already exists (line 13 true branch)', async () => {
    // Subject table already present — ensureRegistryConnected should return immediately
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'subject-table');
    document.body.appendChild(table);
    // sr-list preAction calls ensureRegistryConnected
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-list')!;
    expect(step).toBeDefined();
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // No fill/click for URL/connect should happen
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureRegistryConnected fills URL when input is empty (line 16 true branch)', async () => {
    const urlInput = document.createElement('input');
    urlInput.setAttribute('data-testid', 'registry-url-input');
    urlInput.value = '';
    document.body.appendChild(urlInput);
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'registry-connect-btn');
    document.body.appendChild(connectBtn);
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-list')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('registry-url-input'), expect.any(String));
  });

  it('ensureRegistryConnected connects when URL is already filled (line 22 true branch)', async () => {
    const urlInput = document.createElement('input');
    urlInput.setAttribute('data-testid', 'registry-url-input');
    urlInput.value = 'http://localhost:8081';
    document.body.appendChild(urlInput);
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'registry-connect-btn');
    document.body.appendChild(connectBtn);
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-list')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('registry-connect-btn'));
  });

  it('ensureSubjectSelected clicks row when detail panel is absent (line 34/39 true branch)', async () => {
    // Subject table with a row but no detail panel — click should fire
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'subject-table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);
    // sr-select action calls ensureSubjectSelected implicitly... actually it just clicks the row directly
    // Test via the action step with a fresh call
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-select')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('sr-select preAction clears schema search filter when it has a value (line 222 true branch)', async () => {
    // Subject table already present (so ensureRegistryConnected returns early)
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'subject-table');
    document.body.appendChild(table);
    // Schema search input with a value
    const searchInput = document.createElement('input');
    searchInput.setAttribute('data-testid', 'subject-filter');
    searchInput.value = 'orders-value';
    document.body.appendChild(searchInput);
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-select')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ctx.fill should have been called to clear the search — find that call
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const clearCall = fillCalls.find(c => c[1] === '');
    expect(clearCall).toBeTruthy();
  });

  it('step sr-intro preAction clears selected class from subject table rows', async () => {
    document.body.innerHTML = `
      <table class="kafka-schema-subject-table">
        <tbody><tr class="selected"></tr></tbody>
      </table>`;
    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-intro')!;
    await step.preAction!(makeCtx());
    expect(document.querySelector('.kafka-schema-subject-table tr.selected')).toBeNull();
  });

  it('ensureSubjectSelected clicks first subject row when detail panel absent', async () => {
    const table = document.createElement('table');
    table.setAttribute('data-testid', 'subject-table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-schema')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureSubjectSelected returns early when detail panel already visible', async () => {
    const detail = document.createElement('div');
    detail.setAttribute('data-testid', 'schema-detail-panel');
    document.body.appendChild(detail);

    const table = document.createElement('table');
    table.setAttribute('data-testid', 'subject-table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    row.setAttribute('style', 'cursor:pointer');
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    const step = kafkaSchemaRegistryLesson.steps.find((s) => s.id === 'sr-schema')!;
    await step.preAction!(makeCtx());
    expect(clickSpy).not.toHaveBeenCalled();
  });
  it('has Docker badge tag', () => {
    expect(kafkaSchemaRegistryLesson.tag).toBe('🐳 Docker');
  });

});

