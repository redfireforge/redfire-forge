/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sseStudioLesson } from './sse-studio';
import { makeCtx } from './ws-test-utils';

describe('sse-studio lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(sseStudioLesson.id).toBe('sse-studio');
    expect(sseStudioLesson.domainId).toBe('protocols');
    expect(sseStudioLesson.name).toBe('SSE Studio');
    expect(sseStudioLesson.steps.length).toBe(7);
    expect(sseStudioLesson.concept.title).toBeTruthy();
    expect(sseStudioLesson.concept.body).toBeTruthy();
    expect(sseStudioLesson.initialTab).toBe('sse-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof sseStudioLesson.setup).toBe('function');
    expect(typeof sseStudioLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of sseStudioLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of sseStudioLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = sseStudioLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(3);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('SSE');
    expect(termNames).toContain('EventSource');
  });

  it('has a diagram', () => {
    expect(sseStudioLesson.concept.diagram).toBeTruthy();
  });

  it('has category set to sse', () => {
    expect(sseStudioLesson.category).toBe('sse');
  });

  it('has correct step IDs in order', () => {
    const ids = sseStudioLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'sse-nav', 'sse-connect', 'sse-events', 'sse-detail',
      'sse-filter', 'sse-console', 'sse-disconnect',
    ]);
  });

  it('estimated time is 2 minutes', () => {
    expect(sseStudioLesson.estimatedMinutes).toBe(2);
  });

  it('step sse-nav has no action', () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-nav')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  it('step sse-connect action fills URL and clicks connect with waitFor (Rule 5)', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'http://localhost:3001/api/sse-test');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
    // Must use waitFor rather than a fixed delay (Rule 5)
    expect(ctx.waitFor).toHaveBeenCalledWith('.sse-state-dot.sse-state-connected');
  });

  it('step sse-connect action disconnects first when already connected (replay guard)', async () => {
    // Simulate already-connected state
    document.body.innerHTML = '<span class="sse-state-dot sse-state-connected"></span>';
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should have clicked the button at least twice (disconnect + reconnect)
    const connectBtnCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: string[]) => c[0]?.includes('sse-connect-btn')
    );
    expect(connectBtnCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('step sse-events preAction ensures connection and navigates to events tab (Rule 4)', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-events')!;
    const ctx = makeCtx();
    // No connected dot in DOM → ensureSseConnected should run
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('.sse-state-dot.sse-state-connected');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-right-tab-events"]');
  });

  it('step sse-events preAction skips connect when already connected', async () => {
    document.body.innerHTML = '<span class="sse-state-dot sse-state-connected"></span>';
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-events')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-right-tab-events"]');
  });

  it('step sse-detail has a preAction that ensures connection and navigates to events tab (Rule 4)', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-detail')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('.sse-state-dot.sse-state-connected');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-right-tab-events"]');
  });

  it('step sse-detail action clicks first event row when present', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-detail')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-event-row"]');
  });

  it('step sse-filter has a preAction that ensures connection and navigates to events tab (Rule 4)', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-filter')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('.sse-state-dot.sse-state-connected');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-right-tab-events"]');
  });

  it('step sse-filter action fills search input', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'greeting');
  });

  it('step sse-console preAction ensures connection for lifecycle log entries (Rule 4)', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-console')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('.sse-state-dot.sse-state-connected');
  });

  it('step sse-console action clicks console tab', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-console')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-right-tab-console"]');
  });

  it('step sse-disconnect has a preAction that ensures connection (Rule 4)', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-disconnect')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('.sse-state-dot.sse-state-connected');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-right-tab-events"]');
  });

  it('step sse-disconnect action clicks disconnect button', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-disconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-connect-btn"]');
  });

  it('cleanup handles missing DOM elements gracefully', async () => {
    const ctx = makeCtx();
    await sseStudioLesson.cleanup!(ctx);
    // Should not throw with no DOM elements
  });

  it('cleanup disconnects when connected', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'sse-connect-btn');
    btn.textContent = 'Disconnect';
    document.body.appendChild(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await sseStudioLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup disconnects if already connected', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'sse-connect-btn');
    btn.textContent = 'Disconnect';
    document.body.appendChild(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await sseStudioLesson.setup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup clears events when clear button is enabled', async () => {
    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    document.body.appendChild(clearBtn);
    const clickSpy = vi.spyOn(clearBtn, 'click');

    await sseStudioLesson.setup!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup switches to events and connect tabs', async () => {
    const eventsTab = document.createElement('button');
    eventsTab.setAttribute('data-testid', 'sse-right-tab-events');
    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'sse-left-tab-connect');
    document.body.append(eventsTab, connectTab);
    const eventsSpy = vi.spyOn(eventsTab, 'click');
    const connectSpy = vi.spyOn(connectTab, 'click');

    await sseStudioLesson.setup!(makeCtx());
    expect(eventsSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
  });

  it('cleanup clears events when clear button is enabled', async () => {
    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    document.body.appendChild(clearBtn);
    const clickSpy = vi.spyOn(clearBtn, 'click');

    await sseStudioLesson.cleanup!(makeCtx());
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step sse-events preAction waits for events to arrive (delay after connect)', async () => {
    // When connected, ensureSseConnected returns immediately; the delay for events should still fire
    document.body.innerHTML = '<span class="sse-state-dot sse-state-connected"></span>';
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-events')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should have called delay (for events to arrive) — the 1500ms pause after tab navigation
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('step sse-console preAction clears search input and ensures connection', async () => {
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-console')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Must ensure connection (so console has lifecycle entries)
    expect(ctx.waitFor).toHaveBeenCalledWith('.sse-state-dot.sse-state-connected');
    // Must attempt to clear stale search text
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('sse-search'), '');
  });

  it('step sse-disconnect preAction navigates to events tab (now in preAction, not action)', async () => {
    document.body.innerHTML = '<span class="sse-state-dot sse-state-connected"></span>';
    const step = sseStudioLesson.steps.find(s => s.id === 'sse-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="sse-right-tab-events"]');
  });
});

// ─── ws-workflow-builder ────────────────────────────────────────

