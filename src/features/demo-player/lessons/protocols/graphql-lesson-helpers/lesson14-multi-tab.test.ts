/**
 * @vitest-environment jsdom
 * Direct branch-coverage tests for lesson14-multi-tab helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '../../../../../shared/selectors';
import {
  resetGqlLesson14SessionFlags,
  ensureLesson14ProfileAuthHintVisible,
  ensureLesson14TabProfileLinks,
  ensureLesson14Tab2BadgeHighlight,
  renameDemoTabByIndex,
  ensureTabProfileLink,
  ensureTabPolling,
} from './lesson14-multi-tab';

const GQL14_DEMO = 'gql-multi-tab';

function stubTwoTabDom(): void {
  document.body.innerHTML = `
    <div data-testid="gql-tab-bar">
      <button role="tab" data-testid="gql-tab-0" data-demo-lesson="${GQL14_DEMO}">
        <span class="gql-tab-label">Query 1</span>
        <input data-testid="gql-tab-rename-0" class="gql-tab-rename-input" value="Query 1" />
      </button>
      <button role="tab" data-testid="gql-tab-1" data-demo-lesson="${GQL14_DEMO}">
        <span class="gql-tab-label">Query 2</span>
        <input data-testid="gql-tab-rename-1" class="gql-tab-rename-input" value="Query 2" />
      </button>
    </div>
    <input data-testid="gql-endpoint-input" value="{{graphqlUrl}}" />
    <button data-testid="gql-endpoint-reset-btn"></button>
    <button data-testid="gql-introspect-btn"></button>
    <button data-testid="gql-execute-btn"></button>
    <span data-testid="gql-schema-badge-ok"></span>
    <div data-testid="gql-response-viewer"></div>
    <pre data-testid="gql-response-body">{"data":{"health":"ok"}}</pre>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
  `;
  document.querySelectorAll<HTMLInputElement>('[data-testid^="gql-tab-rename-"]').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const label = input.closest('[role="tab"]')?.querySelector('.gql-tab-label');
      if (label) label.textContent = input.value;
    });
  });
}

function stubProfileDom(): void {
  document.body.insertAdjacentHTML('beforeend', `
    <button data-testid="gql-profile-badge"></button>
    <div data-testid="gql-profile-modal">
      <input data-testid="gql-profile-name-input" />
      <button data-testid="gql-profile-save-btn"></button>
      <button data-testid="gql-profile-close-btn"></button>
      <ul class="gql-profile-list"></ul>
    </div>
    <button data-testid="gql-auth-badge-btn"></button>
    <div data-testid="gql-auth-popover">
      <button data-testid="gql-auth-popover-close"></button>
      <p data-testid="gql-auth-profile-hint">hint</p>
    </div>
    <button data-testid="gql-polling-config-btn"></button>
    <div data-testid="gql-polling-popover">
      <button data-testid="gql-polling-toggle" aria-checked="false" role="switch"></button>
      <button aria-label="Close polling config"></button>
    </div>
  `);
}

describe('lesson14-multi-tab helpers (branch coverage)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson14SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renameDemoTabByIndex returns early when tab index is missing', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    document.querySelector('[data-testid="gql-tab-1"]')?.remove();
    await renameDemoTabByIndex(ctx, 1, 'Missing');
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('renameDemoTabByIndex skips dblclick when label element absent', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')?.remove();
    await renameDemoTabByIndex(ctx, 0, 'NoLabel');
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('renameDemoTabByIndex uses generic rename input when tab id missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar">
        <button role="tab" data-demo-lesson="${GQL14_DEMO}">
          <input data-testid="gql-tab-rename-input" class="gql-tab-rename-input" value="X" />
        </button>
      </div>
    `;
    await renameDemoTabByIndex(ctx, 0, 'Generic');
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.TAB_RENAME_INPUT, 5000);
  });

  it('ensureLesson14TabProfileLinks saves profiles when rows are absent', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.PROFILE_SAVE_BTN) {
        const list = document.querySelector('.gql-profile-list')!;
        const name = (document.querySelector<HTMLInputElement>(GQL.PROFILE_NAME_INPUT)?.value ?? '').trim();
        list.insertAdjacentHTML('beforeend', `
          <li class="gql-profile-row">
            <span class="gql-profile-row__name">${name}</span>
            <button class="gql-profile-btn--load">Load</button>
          </li>`);
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson14TabProfileLinks(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, 'Staging');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, 'Production');
  });

  it('ensureLesson14ProfileAuthHintVisible closes auth popover via close button', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span><button class="gql-profile-btn--load">Load</button></li>`;
    const tab0 = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1 = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0.textContent = 'Staging';
    tab1.textContent = 'Production';
    await ensureTabProfileLink(ctx);
    document.querySelector(GQL.AUTH_POPOVER)?.setAttribute('data-open', '1');
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14ProfileAuthHintVisible(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_POPOVER_CLOSE);
  });

  it('ensureLesson14ProfileAuthHintVisible falls back to auth badge when no close btn', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector(GQL.AUTH_POPOVER_CLOSE)?.remove();
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span><button class="gql-profile-btn--load">Load</button></li>`;
    await ensureTabProfileLink(ctx);
    document.querySelector(GQL.AUTH_POPOVER)?.setAttribute('data-open', '1');
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14ProfileAuthHintVisible(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
  });

  it('ensureLesson14Tab2BadgeHighlight no-ops when second tab missing', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    document.querySelector('[data-testid="gql-tab-1"]')?.remove();
    await ensureLesson14Tab2BadgeHighlight(ctx);
    expect(document.querySelector('[data-lesson-target="gql14-tab2-badge"]')).toBeNull();
  });

  it('ensureTabPolling guard skips duplicate configuration on second call', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span><button class="gql-profile-btn--load">Load</button></li>`;
    await ensureTabPolling(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureTabPolling(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.POLLING_TOGGLE);
  });

  it('saveCurrentTabAsProfile skips when profile row already exists', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span></li>`;
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14TabProfileLinks(ctx);
    const saveCalls = vi.mocked(ctx.click).mock.calls.filter((c) => c[0] === GQL.PROFILE_SAVE_BTN);
    expect(saveCalls.length).toBe(0);
  });

  it('loadProfileOntoActiveTab no-ops when profile row is missing', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.PROFILE_SAVE_BTN) {
        document.querySelector('.gql-profile-list')!.insertAdjacentHTML('beforeend', `
          <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>`);
      }
    });
    await ensureLesson14TabProfileLinks(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_BADGE);
  });

  it('closeProfileModalIfOpen closes modal when open during profile save', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.PROFILE_SAVE_BTN) {
        document.querySelector('.gql-profile-list')!.insertAdjacentHTML('beforeend', `
          <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>`);
      }
    });
    await ensureLesson14TabProfileLinks(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
  });
});
