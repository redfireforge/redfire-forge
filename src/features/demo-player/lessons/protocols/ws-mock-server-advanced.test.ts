/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsMockServerAdvancedLesson } from './ws-mock-server-advanced';
import { makeCtx } from './ws-test-utils';

describe('ws-mock-server-advanced lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsMockServerAdvancedLesson.id).toBe('ws-mock-server-advanced');
    expect(wsMockServerAdvancedLesson.domainId).toBe('protocols');
    expect(wsMockServerAdvancedLesson.name).toBe('Advanced Mock Server');
    expect(wsMockServerAdvancedLesson.steps.length).toBe(8);
    expect(wsMockServerAdvancedLesson.concept.title).toBeTruthy();
    expect(wsMockServerAdvancedLesson.concept.body).toBeTruthy();
    expect(wsMockServerAdvancedLesson.initialTab).toBe('websocket-studio');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsMockServerAdvancedLesson.setup).toBe('function');
    expect(typeof wsMockServerAdvancedLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsMockServerAdvancedLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsMockServerAdvancedLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has 4 key terms defined', () => {
    expect(wsMockServerAdvancedLesson.concept.keyTerms).toBeDefined();
    expect(wsMockServerAdvancedLesson.concept.keyTerms!.length).toBe(4);
    const termNames = wsMockServerAdvancedLesson.concept.keyTerms!.map(t => t.term);
    expect(termNames).toContain('Match pattern');
    expect(termNames).toContain('Fallback mode');
    expect(termNames).toContain('Template variable');
    expect(termNames).toContain('Rule priority');
  });

  it('has a diagram', () => {
    expect(wsMockServerAdvancedLesson.concept.diagram).toBeTruthy();
  });

  it('has category websocket and estimatedMinutes 3', () => {
    expect(wsMockServerAdvancedLesson.category).toBe('websocket');
    expect(wsMockServerAdvancedLesson.estimatedMinutes).toBe(3);
  });

  it('has correct step IDs in order', () => {
    const ids = wsMockServerAdvancedLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'mock-adv-rules-tab',
      'mock-adv-add-rule',
      'mock-adv-response',
      'mock-adv-delay',
      'mock-adv-test-preview',
      'mock-adv-toggle',
      'mock-adv-fallback',
      'mock-adv-live',
    ]);
  });

  // ─── Step: mock-adv-rules-tab ───────────────────────────────

  it('step mock-adv-rules-tab action switches to mock mode and clicks rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-rules-tab')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-rules-tab action uses waitFor before clicking rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-rules-tab')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-rules-tab highlights the mode-mock button (visible in client mode)', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-rules-tab')!;
    expect(step.highlight).toContain('mode-mock');
  });

  // ─── Step: mock-adv-add-rule ────────────────────────────────

  it('step mock-adv-add-rule preAction navigates to Mock mode + Rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-add-rule')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-add-rule action clicks add rule button', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-add-rule')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-add-rule'));
  });

  it('step mock-adv-add-rule highlights add rule button', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-add-rule')!;
    expect(step.highlight).toContain('mock-add-rule');
  });

  it('step mock-adv-add-rule action changes match type to contains then fills pattern', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-add-rule')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('rule-match-type-'), 'contains');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-match-pattern-'), 'ping');
  });

  // ─── Step: mock-adv-response ────────────────────────────────

  it('step mock-adv-response preAction navigates to Mock mode + Rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-response preAction clicks ruleNameBtn when rule exists but card is closed', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    const ruleNameBtn = document.createElement('button');
    ruleNameBtn.className = 'ws-mock-rule-name';
    const clickSpy = vi.fn();
    ruleNameBtn.addEventListener('click', clickSpy);
    document.body.appendChild(ruleNameBtn);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('step mock-adv-response preAction sets match-type when addBtn + matchSel exist', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'mock-add-rule');
    const addClickSpy = vi.fn();
    addBtn.addEventListener('click', addClickSpy);
    document.body.appendChild(addBtn);

    const matchSel = document.createElement('select');
    matchSel.setAttribute('data-testid', 'rule-match-type-0');
    const changeListener = vi.fn();
    matchSel.addEventListener('change', changeListener);
    document.body.appendChild(matchSel);

    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(addClickSpy).toHaveBeenCalled();
    expect(changeListener).toHaveBeenCalled();
  });

  // ─── Step: mock-adv-delay ────────────────────────────────────

  it('step mock-adv-delay preAction clicks ruleNameBtn when rule exists but card closed (lines 218-219)', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    const ruleNameBtn = document.createElement('button');
    ruleNameBtn.className = 'ws-mock-rule-name';
    const clickSpy = vi.fn();
    ruleNameBtn.addEventListener('click', clickSpy);
    document.body.appendChild(ruleNameBtn);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('step mock-adv-delay preAction sets match-type when addBtn + matchSel exist (lines 225-227)', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'mock-add-rule');
    const addClickSpy = vi.fn();
    addBtn.addEventListener('click', addClickSpy);
    document.body.appendChild(addBtn);

    const matchSel = document.createElement('select');
    matchSel.setAttribute('data-testid', 'rule-match-type-0');
    const changeListener = vi.fn();
    matchSel.addEventListener('change', changeListener);
    document.body.appendChild(matchSel);

    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(addClickSpy).toHaveBeenCalled();
    expect(changeListener).toHaveBeenCalled();
  });

  it('step mock-adv-response changes response type to template then fills response data', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('rule-response-type-'), 'template');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-response-data-'), expect.stringContaining('pong'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-response-data-'), expect.stringContaining('{{timestamp}}'));
  });

  it('step mock-adv-response highlights the response type selector (always visible when card is open)', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    expect(step.highlight).toContain('rule-response-type-');
  });

  it('step mock-adv-response description explains template variables', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    expect(step.description).toContain('{{timestamp}}');
    expect(step.description).toContain('{{uuid}}');
    expect(step.description).toContain('{{message}}');
  });

  // ─── Step: mock-adv-delay ───────────────────────────────────

  it('step mock-adv-delay preAction navigates to Mock mode + Rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-delay action fills delay input with 200 via ctx.fill', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('rule-delay-'), '200');
  });

  it('step mock-adv-delay highlights delay input', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    expect(step.highlight).toContain('rule-delay-');
  });

  // ─── Step: mock-adv-test-preview ────────────────────────────

  it('step mock-adv-test-preview preAction navigates to Mock mode + Rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-test-preview')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-test-preview calls ctx.fill on test input with ping', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-test-preview')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('mock-test-input'), 'ping');
  });

  it('step mock-adv-test-preview highlights the test section', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-test-preview')!;
    expect(step.highlight).toContain('mock-test-section');
  });

  it('step mock-adv-response preAction skips block when response-type already present (line 170 false)', async () => {
    // When MOCK_RULE_RESPONSE_TYPE_FIRST exists → !document.querySelector(...) is false → skip block
    const el = document.createElement('select');
    el.setAttribute('data-testid', 'rule-response-type-0');
    document.body.appendChild(el);
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-response')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // No ruleNameBtn or addBtn click expected — the block was skipped
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  it('step mock-adv-delay preAction skips block when response-type already present (line 215 false)', async () => {
    const el = document.createElement('select');
    el.setAttribute('data-testid', 'rule-response-type-0');
    document.body.appendChild(el);
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-delay')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  // ─── Step: mock-adv-toggle ──────────────────────────────────

  it('step mock-adv-toggle preAction navigates to Mock mode + Rules tab', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-toggle')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock-tab-rules'));
  });

  it('step mock-adv-toggle preAction clicks addBtn when no toggle label in DOM (lines 276-277 true)', async () => {
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'mock-add-rule');
    const clickSpy = vi.fn();
    addBtn.addEventListener('click', clickSpy);
    document.body.appendChild(addBtn);
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-toggle')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('step mock-adv-toggle action calls ctx.click on toggle', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-toggle')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('rule-toggle-'));
  });

  it('step mock-adv-toggle highlights the rule toggle', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-toggle')!;
    expect(step.highlight).toContain('rule-toggle-');
  });

  // ─── Step: mock-adv-fallback ────────────────────────────────

  it('step mock-adv-fallback preAction switches to Mock mode', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-fallback')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  it('step mock-adv-fallback has no action (informational)', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-fallback')!;
    expect(step.action).toBeUndefined();
  });

  it('step mock-adv-fallback highlights fallback select', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-fallback')!;
    expect(step.highlight).toContain('mock-fallback-select');
  });

  it('step mock-adv-fallback description explains all three fallback modes', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-fallback')!;
    expect(step.description).toContain('echo');
    expect(step.description).toContain('ignore');
    expect(step.description).toContain('close');
  });

  // ─── Step: mock-adv-live ────────────────────────────────────

  it('step mock-adv-live action sends ping and a non-matching message', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ping');
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'hello world');
  });

  it('step mock-adv-live preAction starts mock server and connects', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(btn);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('WebSocket URL'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-status-dot'));
  });

  it('step mock-adv-live preAction skips connect when already connected', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    // Add STATUS_CONNECTED element so guard triggers (already connected)
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
  });

  it('step mock-adv-live preAction navigates to Events tab before Compose', async () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    const ctx = makeCtx();
    const calls: string[] = [];
    (ctx.click as ReturnType<typeof vi.fn>).mockImplementation((sel: string) => {
      calls.push(sel);
      return Promise.resolve();
    });
    await step.preAction!(ctx);
    const eventsIdx = calls.findIndex(s => s.includes('right-tab-events'));
    const composeIdx = calls.findLastIndex(s => s.includes('left-tab-compose'));
    expect(eventsIdx).toBeGreaterThanOrEqual(0);
    expect(composeIdx).toBeGreaterThan(eventsIdx);
  });

  it('step mock-adv-live highlights the send button', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    expect(step.highlight).toContain('send-btn');
  });

  it('step mock-adv-live has verify for message row', () => {
    const step = wsMockServerAdvancedLesson.steps.find(s => s.id === 'mock-adv-live')!;
    expect(step.verify).toBeTruthy();
  });

  // ─── Setup / Cleanup ─────────────────────────────────────────

  it('setup starts mock server and switches to client mode', async () => {
    const ctx = makeCtx();
    await wsMockServerAdvancedLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('cleanup disconnects, stops mock server, returns to client mode', async () => {
    const ctx = makeCtx();
    await wsMockServerAdvancedLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('cleanup deleteFirstRule clicks delete button when rule exists (line 39 true branch)', async () => {
    // Add a rule delete button that removes itself on click (prevents infinite while loop)
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'rule-delete-0');
    const clickSpy = vi.fn();
    btn.addEventListener('click', () => {
      clickSpy();
      btn.remove(); // Remove from DOM so deleteFirstRule() returns false next iteration
    });
    document.body.appendChild(btn);

    const ctx = makeCtx();
    await wsMockServerAdvancedLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── ws-workspace ───────────────────────────────────────────────

