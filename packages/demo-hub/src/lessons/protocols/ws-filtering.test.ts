/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../demoRipple', () => ({ showSpotlightRing: vi.fn(() => vi.fn()), purgeAllSpotlightRings: vi.fn() }));

import { wsFilteringLesson } from './ws-filtering';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('ws-filtering lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsFilteringLesson.id).toBe('ws-filtering');
    expect(wsFilteringLesson.domainId).toBe('protocols');
    expect(wsFilteringLesson.name).toBe('Filtering, Diff & Schema');
    expect(wsFilteringLesson.steps.length).toBe(9);
    expect(wsFilteringLesson.concept.title).toBeTruthy();
    expect(wsFilteringLesson.concept.body).toBeTruthy();
    expect(wsFilteringLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsFilteringLesson.setup).toBe('function');
    expect(typeof wsFilteringLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsFilteringLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsFilteringLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = wsFilteringLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(5);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('Text Search');
    expect(termNames).toContain('Regex Search');
    expect(termNames).toContain('JSONPath');
    expect(termNames).toContain('Diff');
    expect(termNames).toContain('JSON Schema');
  });

  it('has a diagram', () => {
    expect(wsFilteringLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsFilteringLesson.category).toBe('websocket');
  });

  it('has correct step IDs in order', () => {
    const ids = wsFilteringLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'filter-search', 'filter-direction', 'filter-bar', 'diff-compare',
      'diff-view', 'diff-close', 'schema-intro', 'schema-add', 'schema-validate',
    ]);
  });

  it('estimated time is 4 minutes', () => {
    expect(wsFilteringLesson.estimatedMinutes).toBe(4);
  });

  // ── filter-search ──────────────────────────────────────────────

  it('step filter-search highlights the search mode pills group', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-search')!;
    expect(step.highlight).toContain('search-mode-pills');
  });

  it('step filter-search action navigates to Events tab when needed', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-search')!;
    const ctx = makeCtx();
    // No SEARCH_INPUT in DOM → ensureEventsTab clicks events tab
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step filter-search action skips tab click when already on Events tab', async () => {
    // Add search input to simulate Events tab being active
    const el = document.createElement('input');
    el.setAttribute('data-testid', 'search-input');
    document.body.appendChild(el);
    makeVisible(el);
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-search')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step filter-search action fills search input', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-search')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'greeting');
  });

  // ── filter-direction ───────────────────────────────────────────

  it('step filter-direction has preAction', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-direction')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step filter-direction preAction navigates to Events tab when not visible', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-direction')!;
    const ctx = makeCtx();
    // No SEARCH_INPUT → must navigate
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step filter-direction action selects sent direction', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-direction')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('direction-filter'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('direction-filter-opt-sent'));
  });

  // ── filter-bar ─────────────────────────────────────────────────

  it('step filter-bar preAction navigates to Events tab first', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-bar')!;
    const ctx = makeCtx();
    // No SEARCH_INPUT → ensureEventsTab fires before reset
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step filter-bar preAction resets direction and search', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-bar')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('direction-filter'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('direction-filter-opt-all'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), '');
  });

  it('step filter-bar action clicks filter toggle', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-bar')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step filter-bar has verify selector', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'filter-bar')!;
    expect(step.verify).toBeTruthy();
  });

  // ── diff-compare ───────────────────────────────────────────────

  it('step diff-compare preAction navigates to Events tab', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-compare')!;
    const ctx = makeCtx();
    // No SEARCH_INPUT → must navigate to Events tab
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step diff-compare preAction closes filter bar when open', async () => {
    // Put SEARCH_INPUT in DOM so ensureEventsTab doesn't navigate
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    document.body.appendChild(search);
    makeVisible(search);
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'filter-bar');
    document.body.appendChild(bar);
    makeVisible(bar);

    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-compare')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('filter-toggle'));
  });

  it('step diff-compare action clicks compare button', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-compare')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step diff-compare has verify selector for banner', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-compare')!;
    expect(step.verify).toBeTruthy();
  });

  // ── diff-view ──────────────────────────────────────────────────

  it('step diff-view has preAction', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step diff-view preAction navigates to Events tab when not visible', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step diff-view preAction enters compare mode when not active', async () => {
    // Put SEARCH_INPUT in DOM (Events tab active), no COMPARE_BANNER
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    document.body.appendChild(search);
    makeVisible(search);
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('compare-btn'));
  });

  it('step diff-view preAction closes existing diff modal', async () => {
    // Simulate diff modal already open
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    document.body.appendChild(search);
    makeVisible(search);
    const modal = document.createElement('div');
    modal.setAttribute('data-testid', 'diff-modal');
    document.body.appendChild(modal);
    makeVisible(modal);
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'diff-close');
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);
    const closeSpy = vi.fn();
    closeBtn.addEventListener('click', closeSpy);

    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('step diff-view preAction closes filter bar when open', async () => {
    // Simulate filter bar being open — must be closed before comparing
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    document.body.appendChild(search);
    makeVisible(search);
    const filterBar = document.createElement('div');
    filterBar.setAttribute('data-testid', 'filter-bar');
    document.body.appendChild(filterBar);
    makeVisible(filterBar);

    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should click filter toggle to close the open filter bar
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('filter-toggle'));
  });

  it('step diff-view preAction clears non-empty search input', async () => {
    // Simulate search input with a value — should be cleared before comparison
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    search.value = 'hello';
    document.body.appendChild(search);
    makeVisible(search);

    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should fill search with empty string to reset it
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('search-input'),
      '',
    );
  });

  it('step diff-view action clicks message rows when available', async () => {
    for (let i = 0; i < 7; i++) {
      const row = document.createElement('div');
      row.className = 'ws-message-row';
      document.body.appendChild(row);
      makeVisible(row);
    }
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    const clickSpy = vi.fn();
    document.querySelectorAll('.ws-message-row').forEach(row => {
      (row as HTMLElement).addEventListener('click', clickSpy);
    });
    await step.action!(ctx);
    // Rows 1 and 5 should be clicked (two greeting messages)
    expect(clickSpy).toHaveBeenCalledTimes(2);
    // Rule 5: should use waitFor for diff modal, not just delay
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('diff-modal'), expect.any(Number));
  });

  it('step diff-view action does nothing when fewer than 6 rows', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should not throw
  });

  it('step diff-view has verify selector for diff modal', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-view')!;
    expect(step.verify).toBeTruthy();
  });

  // ── diff-close ─────────────────────────────────────────────────

  it('step diff-close has preAction', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step diff-close preAction navigates to Events tab when not visible', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    // No SEARCH_INPUT → ensureDiffOpen → ensureEventsTab must click events tab
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step diff-close preAction enters compare mode when banner absent', async () => {
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    document.body.appendChild(search);
    makeVisible(search);
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('compare-btn'));
  });

  it('step diff-close preAction skips setup when diff already open', async () => {
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    document.body.appendChild(search);
    makeVisible(search);
    const modal = document.createElement('div');
    modal.setAttribute('data-testid', 'diff-modal');
    document.body.appendChild(modal);
    makeVisible(modal);
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Diff already open → ensureDiffOpen returns early; no compare-btn click
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('compare-btn'));
  });

  it('step diff-close preAction (ensureDiffOpen) closes filter bar when open', async () => {
    // Filter bar open → ensureDiffOpen must close it before looking for rows
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    const filterBar = document.createElement('div');
    filterBar.setAttribute('data-testid', 'filter-bar');
    document.body.append(search, filterBar);
    makeVisible(search);
    makeVisible(filterBar);

    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should close the filter bar via filter-toggle-btn click
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('filter-toggle'));
  });

  it('step diff-close preAction (ensureDiffOpen) clears non-empty search', async () => {
    // Search input has a value → ensureDiffOpen must clear it so all rows are visible
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    search.value = 'hello';
    document.body.appendChild(search);
    makeVisible(search);

    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('search-input'),
      '',
    );
  });

  it('step diff-close preAction (ensureDiffOpen) clicks rows when 6+ message rows exist', async () => {
    // Set up: SEARCH_INPUT, COMPARE_BANNER (skip compare-btn click), 7 MESSAGE_ROW elements
    // No DIFF_MODAL → ensureDiffOpen proceeds past the early return and clicks rows
    const search = document.createElement('input');
    search.setAttribute('data-testid', 'search-input');
    // Compare mode already active → no compare-btn click needed
    const banner = document.createElement('div');
    banner.setAttribute('data-testid', 'compare-banner');
    document.body.append(search, banner);
    makeVisible(search);
    makeVisible(banner);
    // Add 7 message rows
    const clickedRows: number[] = [];
    for (let i = 0; i < 7; i++) {
      const row = document.createElement('div');
      row.className = 'ws-message-row';
      const idx = i;
      row.addEventListener('click', () => clickedRows.push(idx));
      document.body.appendChild(row);
      makeVisible(row);
    }

    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // ensureDiffOpen should have clicked rows[1] and rows[5]
    expect(clickedRows).toContain(1);
    expect(clickedRows).toContain(5);
  });

  it('step diff-close action clicks close button', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'diff-close')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('diff-close'));
  });

  // ── schema-intro ───────────────────────────────────────────────

  it('step schema-intro has preAction', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step schema-intro preAction closes diff and compare when active', async () => {
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'diff-close');
    document.body.appendChild(closeBtn);
    makeVisible(closeBtn);
    const closeSpy = vi.fn();
    closeBtn.addEventListener('click', closeSpy);

    const cancelBtn = document.createElement('button');
    cancelBtn.setAttribute('data-testid', 'compare-cancel');
    document.body.appendChild(cancelBtn);
    makeVisible(cancelBtn);
    const cancelSpy = vi.fn();
    cancelBtn.addEventListener('click', cancelSpy);

    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(closeSpy).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('step schema-intro preAction does nothing when no diff or compare active', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    // Empty DOM — should not throw or click anything
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step schema-intro action clicks schema tab and enables toggle', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-schema'));
  });

  it('step schema-intro enables validate toggle when unchecked', async () => {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = false;
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should click: schema tab + validation toggle
    expect(ctx.click).toHaveBeenCalledTimes(2);
  });

  it('step schema-intro skips toggle click when already checked', async () => {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = true;
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Only schema tab click (toggle already checked)
    expect(ctx.click).toHaveBeenCalledTimes(1);
  });

  // ── schema-add ─────────────────────────────────────────────────

  it('step schema-add has preAction', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step schema-add preAction navigates to Schema tab', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-schema'));
  });

  it('step schema-add preAction enables validation toggle when unchecked', async () => {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = false;
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // schema tab + toggle
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-validation-toggle'));
  });

  it('step schema-add preAction skips toggle click when already checked', async () => {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = true;
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('ws-validation-toggle'));
  });

  it('step schema-add action demonstrates generate then saves', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should click: +Add, Generate, Save
    expect(ctx.click).toHaveBeenCalledTimes(3);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'Greeting Schema');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'both');
  });

  it('step schema-add has verify selector for schema card', () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-add')!;
    expect(step.verify).toBeTruthy();
  });

  // ── schema-validate ────────────────────────────────────────────

  it('step schema-validate action clicks events tab', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-validate')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  it('step schema-validate preAction creates schema when card is missing', async () => {
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-validate')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-schema'));
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'Greeting Schema');
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'both');
  });

  it('step schema-validate preAction enables toggle when schema exists but toggle is off', async () => {
    // Card exists but toggle is unchecked
    const card = document.createElement('div');
    card.setAttribute('data-testid', 'ws-schema-card');
    document.body.appendChild(card);
    makeVisible(card);
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = false;
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-validate')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should enable the toggle even though card exists
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-validation-toggle'));
    // Should NOT try to create schema
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step schema-validate preAction skips schema creation when card exists', async () => {
    const card = document.createElement('div');
    card.setAttribute('data-testid', 'ws-schema-card');
    document.body.appendChild(card);
    makeVisible(card);
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'ws-validation-toggle');
    toggle.checked = true; // already on
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const step = wsFilteringLesson.steps.find(s => s.id === 'schema-validate')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // No schema creation, no toggle click
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('ws-validation-toggle'));
  });

  // ── cleanup ────────────────────────────────────────────────────

  it('cleanup handles missing DOM elements gracefully', async () => {
    const ctx = makeCtx();
    await expect(wsFilteringLesson.cleanup!(ctx)).resolves.not.toThrow();
    // Quiet cleanup uses DOM clicks — no demo ripple ctx.click tour
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('cleanup clicks diff close when present', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'diff-close');
    document.body.appendChild(btn);
    makeVisible(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsFilteringLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanup clicks compare cancel when present', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'compare-cancel');
    document.body.appendChild(btn);
    makeVisible(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsFilteringLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanup closes filter bar when present', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'filter-bar');
    document.body.appendChild(bar);
    makeVisible(bar);
    const toggle = document.createElement('button');
    toggle.setAttribute('data-testid', 'filter-toggle-btn');
    document.body.appendChild(toggle);
    makeVisible(toggle);
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsFilteringLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup is quiet (no demo ripple clicks)', async () => {
    const ctx = makeCtx();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ running: true }),
    } as Response);
    await expect(wsFilteringLesson.setup!(ctx)).resolves.not.toThrow();
    expect(ctx.click).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ─── ws-load-testing ────────────────────────────────────────────

