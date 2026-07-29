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

  it('ends with Data Mapper Integrations as step 5', () => {
    expect(thDataSourceAdvancedLesson.steps).toHaveLength(5);
    expect(thDataSourceAdvancedLesson.steps.at(-1)?.id).toBe('th18-toolbar-mappers');
    expect(thDataSourceAdvancedLesson.steps.some((step) => step.id === 'th18-shared-ds')).toBe(false);
  });

  it('step th18-toolbar-mappers does not dispatch Escape while closing custom select menus', async () => {
    const step = thDataSourceAdvancedLesson.steps.find((s) => s.id === 'th18-toolbar-mappers');
    expect(step).toBeTruthy();
    if (!step?.action) throw new Error('th18-toolbar-mappers action missing');

    // Toolbar shell and buttons required by the step action.
    const toolbar = document.createElement('div');
    toolbar.className = 'data-source-toolbar-unified';

    const fromApiBtn = document.createElement('button');
    fromApiBtn.className = 'data-source-toolbar-btn';
    fromApiBtn.title = 'Send a request and populate rows from an array in the response';
    fromApiBtn.textContent = '⬇ From API';
    toolbar.appendChild(fromApiBtn);

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

    // Mapper shell shown after From API and Map Columns clicks.
    let mapperShown = 0;
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
      mapperShown += 1;
      if (!document.body.contains(mapperShell)) document.body.appendChild(mapperShell);
    });
    mapColumnsBtn.addEventListener('click', () => {
      mapperShown += 1;
      if (!document.body.contains(mapperShell)) document.body.appendChild(mapperShell);
    });

    // Open CustomSelect menus on trigger click, like production component.
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

    const keydownSpy = vi.spyOn(document, 'dispatchEvent');
    const ctx = buildCtx();

    await step.action(ctx as never);

    // Mapper opened in both beats.
    expect(mapperShown).toBe(2);

    // Ensure no global Escape keyboard dispatch was emitted by this action.
    const dispatchedEvents = keydownSpy.mock.calls
      .map((args) => args[0])
      .filter((evt): evt is Event => evt instanceof Event);

    const escapeEvents = dispatchedEvents.filter(
      (evt) => evt.type === 'keydown' && (evt as KeyboardEvent).key === 'Escape',
    );
    expect(escapeEvents.length).toBe(0);
  });

  it('step th18-toolbar-mappers does not remove unrelated role=listbox overlays', async () => {
    const step = thDataSourceAdvancedLesson.steps.find((s) => s.id === 'th18-toolbar-mappers');
    expect(step).toBeTruthy();
    if (!step?.action) throw new Error('th18-toolbar-mappers action missing');

    const toolbar = document.createElement('div');
    toolbar.className = 'data-source-toolbar-unified';

    const fromApiBtn = document.createElement('button');
    fromApiBtn.className = 'data-source-toolbar-btn';
    fromApiBtn.title = 'Send a request and populate rows from an array in the response';
    fromApiBtn.textContent = '⬇ From API';
    toolbar.appendChild(fromApiBtn);

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

    // Unrelated overlay that must survive this lesson step action.
    const unrelatedListbox = document.createElement('div');
    unrelatedListbox.setAttribute('role', 'listbox');
    unrelatedListbox.setAttribute('data-testid', 'unrelated-listbox-overlay');
    document.body.appendChild(unrelatedListbox);

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
      if (!document.body.contains(mapperShell)) document.body.appendChild(mapperShell);
    });
    mapColumnsBtn.addEventListener('click', () => {
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

    const ctx = buildCtx();
    await step.action(ctx as never);

    expect(document.querySelector('[data-testid="unrelated-listbox-overlay"]')).toBe(unrelatedListbox);
    expect(document.body.contains(unrelatedListbox)).toBe(true);
  });
});
