/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { thDataSourceAdvancedLesson } from './th-data-source-advanced';

function buildCtx() {
  return {
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    navigateToTab: vi.fn(),
    waitFor: vi.fn(async () => {}),
    delay: vi.fn(async () => {}),
  };
}

function mountFromApiToolbar(): {
  fromApiBtn: HTMLButtonElement;
  mapperShell: HTMLDivElement;
  mapperShown: () => number;
} {
  const toolbar = document.createElement('div');
  toolbar.className = 'data-source-toolbar-unified';

  const fromApiBtn = document.createElement('button');
  fromApiBtn.className = 'data-source-toolbar-btn';
  fromApiBtn.title = 'Fetch a live API response and map fields into data-source rows';
  fromApiBtn.textContent = '⬇ From API';
  toolbar.appendChild(fromApiBtn);
  document.body.appendChild(toolbar);

  let shown = 0;
  const mapperShell = document.createElement('div');
  mapperShell.className = 'dm-modal-shell';
  const mapperCancel = document.createElement('button');
  mapperCancel.className = 'dm-modal-btn--secondary';
  mapperCancel.textContent = 'Cancel';
  mapperCancel.addEventListener('click', () => {
    mapperShell.remove();
  });
  mapperShell.appendChild(mapperCancel);

  fromApiBtn.addEventListener('click', () => {
    shown += 1;
    if (!document.body.contains(mapperShell)) document.body.appendChild(mapperShell);
    if (!mapperShell.querySelector('.dm-panel--source')) {
      const source = document.createElement('div');
      source.className = 'dm-panel--source';
      const tree = document.createElement('div');
      tree.className = 'dm-tree-container';
      tree.textContent = 'id';
      source.appendChild(tree);
      mapperShell.appendChild(source);
    }
  });

  return { fromApiBtn, mapperShell, mapperShown: () => shown };
}

function mountMapColumnsToolbar(): {
  mapColumnsBtn: HTMLButtonElement;
  mapperShown: () => number;
} {
  const toolbar = document.createElement('div');
  toolbar.className = 'data-source-toolbar-unified';

  const mapColumnsBtn = document.createElement('button');
  mapColumnsBtn.className = 'data-source-toolbar-btn';
  mapColumnsBtn.title = 'Data Mapper: drag columns to URL path, query, body, header, or validate slots';
  mapColumnsBtn.textContent = '🔗 Map Columns';
  toolbar.appendChild(mapColumnsBtn);

  const distSelect = document.createElement('div');
  distSelect.className = 'data-source-toolbar-select';
  const distTrigger = document.createElement('button');
  distTrigger.className = 'cs-trigger';
  distTrigger.textContent = 'Sequential';
  distSelect.appendChild(distTrigger);
  toolbar.appendChild(distSelect);

  const validateSelect = document.createElement('div');
  validateSelect.className = 'data-source-toolbar-select';
  const validateTrigger = document.createElement('button');
  validateTrigger.className = 'cs-trigger';
  validateTrigger.textContent = 'Validate: Sample Rows Only';
  validateSelect.appendChild(validateTrigger);
  toolbar.appendChild(validateSelect);

  document.body.appendChild(toolbar);

  let shown = 0;
  const mapperShell = document.createElement('div');
  mapperShell.className = 'dm-modal-shell';
  const mapperCancel = document.createElement('button');
  mapperCancel.className = 'dm-modal-btn--secondary';
  mapperCancel.textContent = 'Cancel';
  mapperCancel.addEventListener('click', () => {
    mapperShell.remove();
  });
  mapperShell.appendChild(mapperCancel);

  mapColumnsBtn.addEventListener('click', () => {
    shown += 1;
    if (!document.body.contains(mapperShell)) document.body.appendChild(mapperShell);
  });

  distTrigger.addEventListener('click', () => {
    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    ['Sequential', 'Random', 'Round Robin'].forEach((label) => {
      const item = document.createElement('div');
      item.className = 'cs-item';
      item.textContent = label;
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
  });

  validateTrigger.addEventListener('click', () => {
    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    ['Validate: No Rows', 'Validate: Sample Rows Only', 'Validate: All Rows'].forEach((label) => {
      const item = document.createElement('div');
      item.className = 'cs-item';
      item.textContent = label;
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
  });

  return { mapColumnsBtn, mapperShown: () => shown };
}

describe('th-data-source-advanced lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has six steps ending with Map Columns & Row Modes', () => {
    expect(thDataSourceAdvancedLesson.steps).toHaveLength(6);
    expect(thDataSourceAdvancedLesson.steps.map((s) => s.id)).toEqual([
      'th18-add-name-column',
      'th18-row-detail',
      'th18-verify-modal',
      'th18-contract-panel',
      'th18-from-api',
      'th18-map-columns-modes',
    ]);
    expect(thDataSourceAdvancedLesson.steps.some((step) => step.id === 'th18-shared-ds')).toBe(false);
    expect(thDataSourceAdvancedLesson.estimatedMinutes).toBe(7);
  });

  it('step th18-from-api opens the mapper once and cancels without Escape', async () => {
    const step = thDataSourceAdvancedLesson.steps.find((s) => s.id === 'th18-from-api');
    expect(step).toBeTruthy();
    if (!step?.action) throw new Error('th18-from-api action missing');

    const { mapperShown } = mountFromApiToolbar();
    const keydownSpy = vi.spyOn(document, 'dispatchEvent');
    const ctx = buildCtx();

    await step.action(ctx as never);

    expect(mapperShown()).toBe(1);

    const escapeEvents = keydownSpy.mock.calls
      .map((args) => args[0])
      .filter((evt): evt is Event => evt instanceof Event)
      .filter((evt) => evt.type === 'keydown' && (evt as KeyboardEvent).key === 'Escape');
    expect(escapeEvents.length).toBe(0);
  });

  it('step th18-map-columns-modes does not dispatch Escape while touring menus', async () => {
    const step = thDataSourceAdvancedLesson.steps.find((s) => s.id === 'th18-map-columns-modes');
    expect(step).toBeTruthy();
    if (!step?.action) throw new Error('th18-map-columns-modes action missing');

    const { mapperShown } = mountMapColumnsToolbar();
    const keydownSpy = vi.spyOn(document, 'dispatchEvent');
    const ctx = buildCtx();

    await step.action(ctx as never);

    expect(mapperShown()).toBe(1);

    const escapeEvents = keydownSpy.mock.calls
      .map((args) => args[0])
      .filter((evt): evt is Event => evt instanceof Event)
      .filter((evt) => evt.type === 'keydown' && (evt as KeyboardEvent).key === 'Escape');
    expect(escapeEvents.length).toBe(0);
  });

  it('step th18-map-columns-modes does not remove unrelated role=listbox overlays', async () => {
    const step = thDataSourceAdvancedLesson.steps.find((s) => s.id === 'th18-map-columns-modes');
    expect(step).toBeTruthy();
    if (!step?.action) throw new Error('th18-map-columns-modes action missing');

    mountMapColumnsToolbar();

    const unrelatedListbox = document.createElement('div');
    unrelatedListbox.setAttribute('role', 'listbox');
    unrelatedListbox.setAttribute('data-testid', 'unrelated-listbox-overlay');
    document.body.appendChild(unrelatedListbox);

    const ctx = buildCtx();
    await step.action(ctx as never);

    expect(document.querySelector('[data-testid="unrelated-listbox-overlay"]')).toBe(unrelatedListbox);
    expect(document.body.contains(unrelatedListbox)).toBe(true);
  });
});
