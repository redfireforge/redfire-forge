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

  it('step th21-curl-import closes the auto-opened "Create Parameterized Copy" wizard before spotlighting the URL bar', async () => {
    // The real app's handleImportCurl() always opens the `.ds-setup-dialog`
    // variable wizard after "Import & Apply". This reproduces that side effect
    // and asserts the lesson closes it (via Cancel) instead of leaving it open
    // on top of — and hiding — the URL bar it spotlights next.
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

    expect(document.querySelector('.ds-setup-dialog')).toBeNull();
  });
});
