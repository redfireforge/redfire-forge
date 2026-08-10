/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { thSharedDataSourcesLesson } from './th-shared-data-sources';

function buildCtx() {
  return {
    click: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    navigateToTab: vi.fn(),
    waitFor: vi.fn(async () => {}),
    delay: vi.fn(async () => {}),
  };
}

describe('th-shared-data-sources lesson', () => {
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

  it('step th21-open-modal selects the lesson\'s "User Directory" data source by name, never the first (possibly real/unrelated) list item', async () => {
    // Simulate an environment that already has the user's own real, unrelated
    // shared data sources listed BEFORE the lesson's "User Directory"
    // entry — this reproduces the bug where the demo blindly selected
    // `.shared-ds-list-item` position 0 and displayed someone else's real data.
    document.body.innerHTML = `
      <button data-testid="har-shared-ds-btn">Shared Data Sources</button>
      <div class="shared-ds-modal">
        <div class="shared-ds-list-panel">
          <div class="shared-ds-list">
            <div class="shared-ds-list-item active" data-id="real-data-source-1">
              <span class="shared-ds-list-name">Data Source 1</span>
            </div>
            <div class="shared-ds-list-item" data-id="real-data-source-3">
              <span class="shared-ds-list-name">Data Source 3</span>
            </div>
            <div class="shared-ds-list-item" data-id="demo-th21-sds-users">
              <span class="shared-ds-list-name">User Directory</span>
            </div>
          </div>
        </div>
        <div class="shared-ds-editor-panel"></div>
      </div>
    `;

    const items = Array.from(document.querySelectorAll<HTMLElement>('.shared-ds-list-item'));
    const realItem1 = items[0];
    const realItem2 = items[1];
    const userDirItem = items[2];

    const realItem1Click = vi.fn();
    const realItem2Click = vi.fn();
    const userDirItemClick = vi.fn();
    realItem1.addEventListener('click', realItem1Click);
    realItem2.addEventListener('click', realItem2Click);
    userDirItem.addEventListener('click', userDirItemClick);

    const step = thSharedDataSourcesLesson.steps.find((s) => s.id === 'th21-open-modal');
    expect(step).toBeTruthy();

    const ctx = buildCtx();
    await step!.action!(ctx);

    expect(userDirItemClick).toHaveBeenCalledTimes(1);
    expect(realItem1Click).not.toHaveBeenCalled();
    expect(realItem2Click).not.toHaveBeenCalled();
  });

  it('includes a dedicated Parameterize Wizard step after cURL Import', () => {
    expect(thSharedDataSourcesLesson.steps.map((s) => s.id)).toEqual([
      'th21-open-modal',
      'th21-fetch-url',
      'th21-curl-import',
      'th21-param-wizard',
      'th21-auth-config',
      'th21-data-grid-used-by',
      'th21-create-test',
    ]);
    expect(thSharedDataSourcesLesson.estimatedMinutes).toBe(8);
  });

  it('step th21-curl-import leaves the Create Parameterized Copy wizard open', async () => {
    document.body.innerHTML = `
      <div class="shared-ds-modal">
        <div class="shared-ds-fetch-actions">
          <button>cURL Import</button>
        </div>
        <div class="shared-ds-curl-import">
          <textarea class="shared-ds-curl-input"></textarea>
          <button>Import &amp; Apply</button>
          <button>Cancel</button>
        </div>
        <div class="shared-ds-fetch-url-bar">https://jsonplaceholder.typicode.com/users/{{userId}}</div>
      </div>
    `;

    const importBtn = Array.from(
      document.querySelectorAll<HTMLElement>('.shared-ds-curl-import button'),
    ).find((b) => b.textContent?.includes('Import'))!;

    importBtn.addEventListener('click', () => {
      const wizard = document.createElement('div');
      wizard.className = 'ds-setup-dialog';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => wizard.remove());
      wizard.appendChild(cancelBtn);
      document.body.appendChild(wizard);
    }, { once: true });

    const step = thSharedDataSourcesLesson.steps.find((s) => s.id === 'th21-curl-import');
    expect(step).toBeTruthy();

    const ctx = buildCtx();
    await step!.action!(ctx);

    expect(document.querySelector('.ds-setup-dialog')).toBeTruthy();
  });

  it('step th21-param-wizard walks Next through Review then Cancels', async () => {
    const wizard = document.createElement('div');
    wizard.className = 'ds-setup-dialog';

    const clicked: string[] = [];
    const addBtn = (label: string) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        clicked.push(label);
        if (label === 'Cancel') wizard.remove();
      });
      wizard.appendChild(btn);
    };

    addBtn('Next: Columns');
    addBtn('Next: Validate Fields');
    addBtn('Next: Column Order');
    addBtn('Next: Review');
    addBtn('Cancel');
    document.body.appendChild(wizard);

    // URL bar shown after Cancel
    const urlBar = document.createElement('div');
    urlBar.className = 'shared-ds-fetch-url-bar';
    urlBar.textContent = 'https://jsonplaceholder.typicode.com/users/{{userId}}';
    document.body.appendChild(urlBar);

    const step = thSharedDataSourcesLesson.steps.find((s) => s.id === 'th21-param-wizard');
    expect(step).toBeTruthy();

    const ctx = buildCtx();
    await step!.action!(ctx);

    expect(clicked).toEqual([
      'Next: Columns',
      'Next: Validate Fields',
      'Next: Column Order',
      'Next: Review',
      'Cancel',
    ]);
    expect(document.querySelector('.ds-setup-dialog')).toBeNull();
  });
});
