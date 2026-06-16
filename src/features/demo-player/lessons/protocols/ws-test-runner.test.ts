/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsTestRunnerLesson } from './ws-test-runner';
import { makeCtx } from './ws-test-utils';

describe('ws-test-runner lesson', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Metadata ──

  it('has correct id and domainId', () => {
    expect(wsTestRunnerLesson.id).toBe('ws-test-runner');
    expect(wsTestRunnerLesson.domainId).toBe('protocols');
  });

  it('has correct category', () => {
    expect(wsTestRunnerLesson.category).toBe('websocket');
  });

  it('has name and description', () => {
    expect(wsTestRunnerLesson.name).toBe('Run WS Workflow in Harness');
    expect(wsTestRunnerLesson.description.length).toBeGreaterThan(10);
  });

  it('sets estimated minutes', () => {
    expect(wsTestRunnerLesson.estimatedMinutes).toBe(3);
  });

  it('initialTab is not set (avoids auto-exit on tab switch to results)', () => {
    expect(wsTestRunnerLesson.initialTab).toBeUndefined();
  });

  // ── Concept ──

  it('concept title mentions Workflow Runner', () => {
    expect(wsTestRunnerLesson.concept.title).toContain('Workflow Runner');
  });

  it('concept body contrasts Quick Test with Workflow Runner', () => {
    const body = wsTestRunnerLesson.concept.body;
    expect(body).toContain('Quick Test');
    expect(body).toContain('Workflow Runner');
  });

  it('concept body explains Initial Variables', () => {
    const body = wsTestRunnerLesson.concept.body;
    expect(body).toContain('Initial Variables');
    expect(body).toContain('wsUrl');
  });

  it('concept body mentions Results Dashboard', () => {
    expect(wsTestRunnerLesson.concept.body).toContain('Results Dashboard');
  });

  it('has 4 key terms', () => {
    expect(wsTestRunnerLesson.concept.keyTerms).toBeDefined();
    expect(wsTestRunnerLesson.concept.keyTerms!.length).toBe(4);
  });

  it('keyTerms cover Workflow Runner, Initial Variables, Completion Banner, Results Dashboard', () => {
    const terms = wsTestRunnerLesson.concept.keyTerms!.map(k => k.term);
    expect(terms).toContain('Workflow Runner');
    expect(terms).toContain('Initial Variables');
    expect(terms).toContain('Completion Banner');
    expect(terms).toContain('Results Dashboard');
  });

  it('has SVG diagram', () => {
    expect(wsTestRunnerLesson.concept.diagram).toBeDefined();
    expect(wsTestRunnerLesson.concept.diagram).toContain('<svg');
    expect(wsTestRunnerLesson.concept.diagram).toContain('</svg>');
  });

  it('diagram shows workflow picker, run, and results flow', () => {
    const d = wsTestRunnerLesson.concept.diagram!;
    expect(d).toContain('Picker');
    expect(d).toContain('Run');
    expect(d).toContain('Results');
  });

  it('diagram shows WS node chain', () => {
    const d = wsTestRunnerLesson.concept.diagram!;
    expect(d).toContain('Connect');
    expect(d).toContain('Send');
    expect(d).toContain('Receive');
  });

  // ── Steps ──

  it('has 6 steps', () => {
    expect(wsTestRunnerLesson.steps).toHaveLength(6);
  });

  it('all steps have unique IDs', () => {
    const ids = wsTestRunnerLesson.steps.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all steps have title and description', () => {
    for (const s of wsTestRunnerLesson.steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it('all steps have highlight', () => {
    for (const s of wsTestRunnerLesson.steps) {
      expect(s.highlight).toBeDefined();
    }
  });

  it('all steps have pauseAfter', () => {
    for (const s of wsTestRunnerLesson.steps) {
      expect(s.pauseAfter).toBe(true);
    }
  });

  it('step 1 (wfhr-open) highlights workflow-picker', () => {
    const s = wsTestRunnerLesson.steps[0];
    expect(s.id).toBe('wfhr-open');
    expect(s.highlight).toBe('.workflow-picker');
    expect(s.description).toContain('Workflow Runner');
  });

  it('step 2 (wfhr-pick) highlights workflow-select and verifies vars section', () => {
    const s = wsTestRunnerLesson.steps[1];
    expect(s.id).toBe('wfhr-pick');
    expect(s.highlight).toContain('workflow-select');
    expect(s.verify).toBe('.workflow-vars-section');
    expect(s.description).toContain('WS Echo Demo');
    expect(s.action).toBeDefined();
  });

  it('step 2 (wfhr-pick) action uses ctx.click for the trigger (shows ripple)', async () => {
    const s = wsTestRunnerLesson.steps[1];
    const ctx = makeCtx();
    await s.action!(ctx);
    // Trigger open uses ctx.click so the user sees the ripple
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="workflow-select"]');
  });

  it('step 2 (wfhr-pick) action uses ctx.waitFor for dropdown panel before selecting item', async () => {
    const s = wsTestRunnerLesson.steps[1];
    const ctx = makeCtx();
    // Add item so selection succeeds
    const panel = document.createElement('div');
    panel.className = 'wfp-dropdown-panel';
    const item = document.createElement('div');
    item.className = 'wfp-dropdown-item';
    item.textContent = 'WS Echo Demo';
    panel.appendChild(item);
    document.body.appendChild(panel);
    await s.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith('.wfp-dropdown-panel');
    document.body.removeChild(panel);
  });

  it('step 3 (wfhr-variables) highlights workflow-vars-section and has preAction guard', () => {
    const s = wsTestRunnerLesson.steps[2];
    expect(s.id).toBe('wfhr-variables');
    expect(s.highlight).toBe('.workflow-vars-section');
    expect(s.description).toContain('wsUrl');
    expect(s.preAction).toBeDefined();
  });

  it('step 3 (wfhr-variables) preAction skips selection when vars section is already visible', async () => {
    const vars = document.createElement('div');
    vars.className = 'workflow-vars-section';
    document.body.appendChild(vars);
    const ctx = makeCtx();
    await wsTestRunnerLesson.steps[2].preAction!(ctx);
    // No click should have happened since vars section exists
    expect(ctx.click).not.toHaveBeenCalled();
    document.body.removeChild(vars);
  });

  it('step 3 (wfhr-variables) preAction selects WS Echo Demo when vars section is missing', async () => {
    // No workflow-vars-section in DOM → preAction must open picker and select item
    const trigger = document.createElement('div');
    trigger.setAttribute('data-testid', 'workflow-select');
    document.body.appendChild(trigger);
    const panel = document.createElement('div');
    panel.className = 'wfp-dropdown-panel';
    const item = document.createElement('div');
    item.className = 'wfp-dropdown-item';
    item.textContent = 'WS Echo Demo';
    panel.appendChild(item);
    document.body.appendChild(panel);
    const ctx = makeCtx();
    await wsTestRunnerLesson.steps[2].preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="workflow-select"]');
    document.body.removeChild(trigger);
    document.body.removeChild(panel);
  });

  it('step 4 (wfhr-run) has action, preAction guard, and verifies completion section', () => {
    const s = wsTestRunnerLesson.steps[3];
    expect(s.id).toBe('wfhr-run');
    expect(s.highlight).toContain('form-actions');
    expect(s.verify).toBe('.completion-section');
    expect(s.action).toBeDefined();
    expect(s.preAction).toBeDefined();
  });

  it('step 4 (wfhr-run) preAction skips selection when config-form already exists', async () => {
    const form = document.createElement('div');
    form.className = 'config-form';
    document.body.appendChild(form);
    const ctx = makeCtx();
    await wsTestRunnerLesson.steps[3].preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    document.body.removeChild(form);
  });

  it('step 4 (wfhr-run) preAction selects WS Echo Demo when config-form is missing', async () => {
    // No config-form in DOM → preAction must open picker and select item
    const trigger = document.createElement('div');
    trigger.setAttribute('data-testid', 'workflow-select');
    document.body.appendChild(trigger);
    const panel = document.createElement('div');
    panel.className = 'wfp-dropdown-panel';
    const item = document.createElement('div');
    item.className = 'wfp-dropdown-item';
    item.textContent = 'WS Echo Demo';
    panel.appendChild(item);
    document.body.appendChild(panel);
    const ctx = makeCtx();
    await wsTestRunnerLesson.steps[3].preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="workflow-select"]');
    document.body.removeChild(trigger);
    document.body.removeChild(panel);
  });

  it('step 4 (wfhr-run) action scrolls completion section into view after workflow finishes', async () => {
    const runBtn = document.createElement('button');
    runBtn.className = 'btn btn-primary';
    const formActions = document.createElement('div');
    formActions.className = 'form-actions';
    const configForm = document.createElement('div');
    configForm.className = 'config-form';
    formActions.appendChild(runBtn);
    configForm.appendChild(formActions);
    document.body.appendChild(configForm);

    // Add completion section so polling terminates immediately
    const completion = document.createElement('div');
    completion.className = 'completion-section';
    // jsdom does not implement scrollIntoView — define it before spying
    completion.scrollIntoView = vi.fn();
    document.body.appendChild(completion);

    const ctx = makeCtx();
    await wsTestRunnerLesson.steps[3].action!(ctx);
    expect(completion.scrollIntoView).toHaveBeenCalled();

    document.body.removeChild(configForm);
    document.body.removeChild(completion);
  });

  it('step 5 (wfhr-complete) highlights completion banner and has action + verify', () => {
    const s = wsTestRunnerLesson.steps[4];
    expect(s.id).toBe('wfhr-complete');
    expect(s.highlight).toBe('.completion-section');
    expect(s.description).toContain('View Full Results');
    // action clicks "View Full Results →" with ripple
    expect(s.action).toBeDefined();
    // verify waits for results tab to appear after navigation
    expect(s.verify).toBe('.results-run-filter-tabs');
    // no preAction — navigation happens in action itself
    expect(s.preAction).toBeUndefined();
  });

  it('step 5 (wfhr-complete) action uses ctx.click on completion-section btn-primary', async () => {
    const s = wsTestRunnerLesson.steps[4];
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    const section = document.createElement('div');
    section.className = 'completion-section';
    section.appendChild(btn);
    document.body.appendChild(section);
    const ctx = makeCtx();
    await s.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('.completion-section .btn-primary');
  });

  it('step 6 (wfhr-results) has preAction guard and highlights results filter tabs', () => {
    const s = wsTestRunnerLesson.steps[5];
    expect(s.id).toBe('wfhr-results');
    expect(s.highlight).toBe('.results-run-filter-tabs');
    expect(s.preAction).toBeDefined();
    expect(s.description).toContain('Results Dashboard');
  });

  it('step 6 (wfhr-results) preAction skips navigation when results tab is already active', async () => {
    const tabs = document.createElement('div');
    tabs.className = 'results-run-filter-tabs';
    document.body.appendChild(tabs);
    const ctx = makeCtx();
    await wsTestRunnerLesson.steps[5].preAction!(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    document.body.removeChild(tabs);
  });

  it('step 6 (wfhr-results) preAction navigates to results when results tab is absent', async () => {
    // No results-run-filter-tabs → preAction must navigate
    const ctx = makeCtx();
    await wsTestRunnerLesson.steps[5].preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('results');
  });

  it('step 3 description mentions mock server and ws://localhost:9876', () => {
    const s = wsTestRunnerLesson.steps[2];
    expect(s.description).toContain('ws://localhost:9876');
  });

  it('step 4 description mentions WS nodes executing', () => {
    const s = wsTestRunnerLesson.steps[3];
    expect(s.description).toContain('Connect');
    expect(s.description).toContain('Send');
    expect(s.description).toContain('Receive');
  });

  it('step 6 description mentions Workflow Results Explorer', () => {
    const s = wsTestRunnerLesson.steps[5];
    expect(s.description).toContain('Workflow Results Explorer');
  });

  // ── Setup / Cleanup ──

  it('setup starts mock server and navigates to workflow-runner', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
    const ctx = makeCtx();
    await wsTestRunnerLesson.setup!(ctx);
    expect(fetchSpy).toHaveBeenCalledWith('/api/ws/mock/start', expect.objectContaining({ method: 'POST' }));
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('setup seeds WS Echo Demo via __wfInsertWorkflow when bridge is available', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
    const wfDelete = vi.fn();
    const wfInsert = vi.fn();
    (window as unknown as Record<string, unknown>).__wfDeleteByName = wfDelete;
    (window as unknown as Record<string, unknown>).__wfInsertWorkflow = wfInsert;
    const ctx = makeCtx();
    await wsTestRunnerLesson.setup!(ctx);
    expect(wfDelete).toHaveBeenCalledWith('WS Echo Demo');
    expect(wfInsert).toHaveBeenCalledTimes(1);
    const seeded = wfInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(seeded.name).toBe('WS Echo Demo');
    expect((seeded.variables as Record<string, string>).wsUrl).toBe('ws://localhost:9876');
    expect((seeded.nodes as unknown[]).length).toBeGreaterThanOrEqual(4);
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;
  });

  it('setup gracefully skips seeding when bridge is not available', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
    const ctx = makeCtx();
    // No __wfInsertWorkflow on window — should not throw
    await expect(wsTestRunnerLesson.setup!(ctx)).resolves.toBeUndefined();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('cleanup stops mock server (App.tsx handles navigation, no navigateToTab in cleanup)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
    const ctx = makeCtx();
    await wsTestRunnerLesson.cleanup!(ctx);
    expect(fetchSpy).toHaveBeenCalledWith('/api/ws/mock/stop', expect.objectContaining({ method: 'POST' }));
    // App.tsx navigates to demo-hub after cleanup; cleanup itself does not call navigateToTab.
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('setup gracefully handles fetch error (mock server already running)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('already running'));
    const ctx = makeCtx();
    await expect(wsTestRunnerLesson.setup!(ctx)).resolves.toBeUndefined();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow-runner');
  });
});

