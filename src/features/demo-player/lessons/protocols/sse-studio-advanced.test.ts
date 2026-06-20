/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sseStudioAdvancedLesson } from './sse-studio-advanced';
import { makeCtx } from './ws-test-utils';

describe('sse-studio-advanced lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(sseStudioAdvancedLesson.id).toBe('sse-studio-advanced');
    expect(sseStudioAdvancedLesson.domainId).toBe('protocols');
    expect(sseStudioAdvancedLesson.name).toBe('SSE Advanced Features');
    expect(sseStudioAdvancedLesson.steps.length).toBe(8);
    expect(sseStudioAdvancedLesson.concept.title).toBeTruthy();
    expect(sseStudioAdvancedLesson.concept.body).toBeTruthy();
    expect(sseStudioAdvancedLesson.initialTab).toBe('sse-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof sseStudioAdvancedLesson.setup).toBe('function');
    expect(typeof sseStudioAdvancedLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of sseStudioAdvancedLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of sseStudioAdvancedLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = sseStudioAdvancedLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBe(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('Bookmark');
    expect(termNames).toContain('Last-Event-ID');
    expect(termNames).toContain('Auto-Reconnect');
    expect(termNames).toContain('Stats Footer');
  });

  it('has a diagram', () => {
    expect(sseStudioAdvancedLesson.concept.diagram).toBeTruthy();
  });

  it('has category set to sse', () => {
    expect(sseStudioAdvancedLesson.category).toBe('sse');
  });

  it('has correct step IDs in order', () => {
    const ids = sseStudioAdvancedLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'sse-adv-intro', 'sse-adv-bookmark', 'sse-adv-bookmark-filter',
      'sse-adv-stats', 'sse-adv-reconnect', 'sse-adv-last-event-id',
      'sse-adv-clear', 'sse-adv-disconnect',
    ]);
  });

  it('estimated time is 5 minutes', () => {
    expect(sseStudioAdvancedLesson.estimatedMinutes).toBe(5);
  });

  // ─── Step: sse-adv-intro ──────────────────────────────────

  it('step sse-adv-intro highlights SSE studio', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-intro')!;
    expect(step.highlight).toContain('sse-studio');
  });

  it('step sse-adv-intro preAction fills URL and connects', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('sse-url-input'),
      expect.stringContaining('sse-test'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-intro preAction skips connect when already connected', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    document.body.appendChild(connectBtn);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ─── Step: sse-adv-bookmark ───────────────────────────────

  it('step sse-adv-bookmark highlights event row', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    expect(step.highlight).toContain('sse-event-row');
  });

  it('step sse-adv-bookmark preAction connects if not already connected', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('sse-url-input'),
      expect.stringContaining('sse-test'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-bookmark preAction skips connect when already connected with events', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    document.body.appendChild(connectBtn);

    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    document.body.appendChild(row);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-bookmark action clicks bookmark star', async () => {
    // Build mock DOM with event rows and bookmark buttons
    const row1 = document.createElement('div');
    row1.setAttribute('data-testid', 'sse-event-row');
    const star1 = document.createElement('button');
    star1.className = 'sse-bookmark-btn';
    const star1Spy = vi.fn();
    star1.addEventListener('click', star1Spy);
    row1.appendChild(star1);
    document.body.appendChild(row1);

    const row2 = document.createElement('div');
    row2.setAttribute('data-testid', 'sse-event-row');
    document.body.appendChild(row2);

    const row3 = document.createElement('div');
    row3.setAttribute('data-testid', 'sse-event-row');
    const star3 = document.createElement('button');
    star3.className = 'sse-bookmark-btn';
    const star3Spy = vi.fn();
    star3.addEventListener('click', star3Spy);
    row3.appendChild(star3);
    document.body.appendChild(row3);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(star1Spy).toHaveBeenCalled();
    expect(star3Spy).toHaveBeenCalled();
  });

  it('step sse-adv-bookmark action is no-op when no event rows in DOM (line 197 false)', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await expect(step.action!(ctx)).resolves.not.toThrow();
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('step sse-adv-bookmark action skips star when firstRow has no star button (line 199 false)', async () => {
    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    document.body.appendChild(row); // No star button inside
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).not.toHaveBeenCalledWith(600);
  });

  it('step sse-adv-bookmark action skips 3rd star when third row has no star button (line 209 false)', async () => {
    // 3 rows but none have star buttons → rows.length >= 3 true, starBtn false
    for (let i = 0; i < 3; i++) {
      const row = document.createElement('div');
      row.setAttribute('data-testid', 'sse-event-row');
      document.body.appendChild(row);
    }
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).not.toHaveBeenCalledWith(600);
  });

  // ─── Step: sse-adv-bookmark-filter ────────────────────────

  it('step sse-adv-bookmark-filter highlights bookmark filter', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark-filter')!;
    expect(step.highlight).toContain('sse-bookmark-filter');
  });

  it('step sse-adv-bookmark-filter preAction ensures connection', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
  });

  it('step sse-adv-bookmark-filter preAction clicks unbookmarked star when present', async () => {
    // Set up a connected SSE with an event row that has an inactive bookmark star
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    document.body.appendChild(connectBtn);

    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    const star = document.createElement('button');
    star.className = 'sse-bookmark-btn'; // no 'active' class — not yet bookmarked
    star.onclick = vi.fn();
    row.appendChild(star);
    document.body.appendChild(row);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(star.onclick).toHaveBeenCalled();
  });

  it('step sse-adv-bookmark-filter preAction skips star when already bookmarked', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    document.body.appendChild(connectBtn);

    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    const star = document.createElement('button');
    star.className = 'sse-bookmark-btn active'; // already bookmarked
    star.onclick = vi.fn();
    row.appendChild(star);
    document.body.appendChild(row);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark-filter')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(star.onclick).not.toHaveBeenCalled();
  });

  it('step sse-adv-bookmark-filter action toggles filter on and off', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-bookmark-filter')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-bookmark-filter'));
    expect(ctx.click).toHaveBeenCalledTimes(2);
  });

  // ─── Step: sse-adv-stats ──────────────────────────────────

  it('step sse-adv-stats highlights status bar', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-stats')!;
    expect(step.highlight).toContain('sse-status-bar');
  });

  it('step sse-adv-stats has no action', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-stats')!;
    expect(step.action).toBeUndefined();
  });

  it('step sse-adv-stats preAction ensures Events tab is active', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-stats')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
  });

  // ─── Step: sse-adv-reconnect ──────────────────────────────

  it('step sse-adv-reconnect highlights reconnect card', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    expect(step.highlight).toContain('sse-reconnect-card');
  });

  it('step sse-adv-reconnect preAction disconnects when connected, then navigates to Connect tab', async () => {
    // Simulate connected state
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'sse-connect-btn');
    btn.textContent = 'Disconnect';
    document.body.appendChild(btn);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // Should navigate to Connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-left-tab-connect'));
  });

  it('step sse-adv-reconnect preAction skips disconnect when already disconnected', async () => {
    // No connect button with "Disconnect" text → already disconnected
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // Should still navigate to Connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-left-tab-connect'));
  });

  it('step sse-adv-reconnect action is no-op when no checkbox in DOM (line 283 false)', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    const ctx = makeCtx();
    await expect(step.action!(ctx)).resolves.not.toThrow();
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('reconnect-toggle'));
  });

  it('step sse-adv-reconnect action toggles the checkbox via ctx.click with ripple', async () => {
    // Build mock DOM with reconnect toggle using testid (checked → toggles off then on)
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-testid', 'sse-reconnect-toggle');
    checkbox.checked = true;
    document.body.appendChild(checkbox);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // Action uses ctx.click (with ripple) twice: toggle off then back on
    const clicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('sse-reconnect-toggle'));
    expect(clicks.length).toBe(2);
  });

  it('step sse-adv-reconnect action clicks once when checkbox is unchecked', async () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-testid', 'sse-reconnect-toggle');
    checkbox.checked = false;
    document.body.appendChild(checkbox);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-reconnect')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    const clicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: string[]) => c[0].includes('sse-reconnect-toggle'));
    expect(clicks.length).toBe(1);
  });

  // ─── Step: sse-adv-last-event-id ──────────────────────────

  it('step sse-adv-last-event-id highlights state label', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    expect(step.highlight).toContain('sse-state-label');
  });

  it('step sse-adv-last-event-id preAction switches to Events tab and connects if needed', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
    // No connect btn with "Disconnect" → should trigger connection
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('sse-url-input'),
      expect.stringContaining('sse-test'),
    );
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-last-event-id preAction skips connect when already connected', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    document.body.appendChild(connectBtn);

    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    document.body.appendChild(row);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-last-event-id action clicks an event row (line 312 true)', async () => {
    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    const clickSpy = vi.fn();
    row.addEventListener('click', clickSpy);
    document.body.appendChild(row);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(1000);
  });

  it('step sse-adv-last-event-id action is no-op when no row in DOM (line 312 false)', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-last-event-id')!;
    const ctx = makeCtx();
    await expect(step.action!(ctx)).resolves.not.toThrow();
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  // ─── Step: sse-adv-clear ──────────────────────────────────

  it('step sse-adv-clear highlights clear button', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-clear')!;
    expect(step.highlight).toContain('sse-clear-btn');
  });

  it('step sse-adv-clear preAction ensures Events tab and connection', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-clear')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
    // No connected button in DOM → should attempt to connect
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('sse-url-input'),
      expect.stringContaining('sse-test'),
    );
  });

  it('step sse-adv-clear preAction skips connect when already connected', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    document.body.appendChild(connectBtn);

    const row = document.createElement('div');
    row.setAttribute('data-testid', 'sse-event-row');
    document.body.appendChild(row);

    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-clear')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-right-tab-events'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-clear action exports then clears', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-clear')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-export-btn'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-clear-btn'));
    // Export should come before clear
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map((c: string[]) => c[0]);
    const exportIdx = calls.findIndex((c: string) => c.includes('sse-export-btn'));
    const clearIdx = calls.findIndex((c: string) => c.includes('sse-clear-btn'));
    expect(exportIdx).toBeLessThan(clearIdx);
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup runs without throwing when DOM is empty (false branches lines 50-87)', async () => {
    const ctx = makeCtx();
    await expect(sseStudioAdvancedLesson.setup!(ctx)).resolves.not.toThrow();
    expect(ctx.delay).toHaveBeenCalledWith(500);
  });

  it('setup skips disconnect when button text is not Disconnect (line 50 false)', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Connect'; // not 'Disconnect'
    const clickSpy = vi.fn();
    connectBtn.addEventListener('click', clickSpy);
    document.body.appendChild(connectBtn);
    const ctx = makeCtx();
    await sseStudioAdvancedLesson.setup!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('setup skips clear when clearBtn is disabled (line 57 false)', async () => {
    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    clearBtn.disabled = true;
    const clickSpy = vi.fn();
    clearBtn.addEventListener('click', clickSpy);
    document.body.appendChild(clearBtn);
    const ctx = makeCtx();
    await sseStudioAdvancedLesson.setup!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('cleanup runs without throwing when DOM is empty (false branches lines 80-87)', async () => {
    const ctx = makeCtx();
    await expect(sseStudioAdvancedLesson.cleanup!(ctx)).resolves.not.toThrow();
  });

  it('cleanup skips disconnect when button text is not Disconnect (line 80 false)', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Connect';
    const clickSpy = vi.fn();
    connectBtn.addEventListener('click', clickSpy);
    document.body.appendChild(connectBtn);
    const ctx = makeCtx();
    await sseStudioAdvancedLesson.cleanup!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('cleanup skips clear when clearBtn is disabled (line 87 false)', async () => {
    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    clearBtn.disabled = true;
    const clickSpy = vi.fn();
    clearBtn.addEventListener('click', clickSpy);
    document.body.appendChild(clearBtn);
    const ctx = makeCtx();
    await sseStudioAdvancedLesson.cleanup!(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('setup disconnects if connected and clears events', async () => {
    // Build mock DOM with connected state
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    connectBtn.onclick = vi.fn();
    document.body.appendChild(connectBtn);

    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    clearBtn.onclick = vi.fn();
    document.body.appendChild(clearBtn);

    const eventsTab = document.createElement('button');
    eventsTab.setAttribute('data-testid', 'sse-right-tab-events');
    eventsTab.onclick = vi.fn();
    document.body.appendChild(eventsTab);

    const connectTab = document.createElement('button');
    connectTab.setAttribute('data-testid', 'sse-left-tab-connect');
    connectTab.onclick = vi.fn();
    document.body.appendChild(connectTab);

    const ctx = makeCtx();
    await sseStudioAdvancedLesson.setup!(ctx);

    expect(connectBtn.onclick).toHaveBeenCalled();
    expect(clearBtn.onclick).toHaveBeenCalled();
    expect(eventsTab.onclick).toHaveBeenCalled();
    expect(connectTab.onclick).toHaveBeenCalled();
  });

  it('ensureConnectedWithEvents takes else-if branch when connected but no events (line 39)', async () => {
    // Set up connected state (textContent includes 'Disconnect')
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    document.body.appendChild(connectBtn);
    // No event rows in DOM → else if (!document.querySelector(SSE.EVENT_ROW)) fires

    // Use a step that calls ensureConnectedWithEvents in its preAction
    const step = sseStudioAdvancedLesson.steps.find((s) => s.id === 'sse-adv-bookmark')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // The else-if path calls ctx.delay(2000) — verify it was called
    expect(ctx.delay).toHaveBeenCalledWith(2000);
  });

  it('step action clicks closeBtn when detail panel is open (lines 334-335)', async () => {
    const step = sseStudioAdvancedLesson.steps.find((s) => s.id === 'sse-adv-clear')!;
    expect(step).toBeDefined();

    const closeBtn = document.createElement('button');
    closeBtn.className = 'sse-detail-close';
    const clickSpy = vi.fn();
    closeBtn.addEventListener('click', clickSpy);
    document.body.appendChild(closeBtn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  // ─── Step: sse-adv-disconnect ─────────────────────────────

  it('step sse-adv-disconnect highlights connect button', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-disconnect')!;
    expect(step.highlight).toContain('sse-connect-btn');
  });

  it('step sse-adv-disconnect has a preAction that navigates to connect tab', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-disconnect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-left-tab-connect'));
  });

  it('step sse-adv-disconnect action clicks disconnect when connected', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-disconnect')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'sse-connect-btn');
    btn.textContent = 'Disconnect';
    document.body.appendChild(btn);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-disconnect action skips click when already disconnected', async () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-disconnect')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'sse-connect-btn');
    btn.textContent = 'Connect';
    document.body.appendChild(btn);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('sse-connect-btn'));
  });

  it('step sse-adv-disconnect description mentions Disconnect and auto-reconnect', () => {
    const step = sseStudioAdvancedLesson.steps.find(s => s.id === 'sse-adv-disconnect')!;
    expect(step.description).toContain('Disconnect');
    expect(step.description).toContain('Auto-reconnect');
  });

  it('cleanup disconnects and clears', async () => {
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'sse-connect-btn');
    connectBtn.textContent = 'Disconnect';
    connectBtn.onclick = vi.fn();
    document.body.appendChild(connectBtn);

    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'sse-clear-btn');
    clearBtn.onclick = vi.fn();
    document.body.appendChild(clearBtn);

    const ctx = makeCtx();
    await sseStudioAdvancedLesson.cleanup!(ctx);

    expect(connectBtn.onclick).toHaveBeenCalled();
    expect(clearBtn.onclick).toHaveBeenCalled();
  });
});

// ─── ws-tls ──────────────────────────────────────────────────────

