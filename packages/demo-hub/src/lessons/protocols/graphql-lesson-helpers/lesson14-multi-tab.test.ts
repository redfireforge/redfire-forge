/**
 * @vitest-environment jsdom
 * Direct branch-coverage tests for lesson14-multi-tab helpers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';

vi.mock('../../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters')>();
  return {
    ...actual,
    purgeGqlDemoConnectionProfiles: vi.fn().mockResolvedValue(0),
  };
});

import { purgeGqlDemoConnectionProfiles } from '../../../adapters';
import {
  resetGqlLesson14SessionFlags,
  ensureLesson14ProfileAuthHintVisible,
  ensureLesson14TabProfileLinks,
  ensureLesson14Tab2BadgeHighlight,
  ensureLesson14IntroReady,
  ensureLesson14PerTabAuthConfigured,
  LESSON14_TAB2_BEARER_TOKEN,
  purgeLesson14ConnectionProfiles,
  LESSON14_STAGING_PROFILE_NAME,
  LESSON14_PRODUCTION_PROFILE_NAME,
  renameDemoTabByIndex,
  ensureTabProfileLink,
  ensureTabPolling,
  demonstrateLesson14TabPolling,
  demonstrateLesson14ProfileLinks,
  demonstrateLesson14SaveProfiles,
  demonstrateLesson14LoadProfiles,
  demonstrateLesson14LoadProfilesOnly,
  demonstrateLesson14ProfileAuthLink,
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
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
        <p data-testid="gql-auth-inherit-banner">Editing profile ${LESSON14_PRODUCTION_PROFILE_NAME}</p>
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

  it('ensureLesson14IntroReady closes an open history panel before focusing the tab bar', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <div data-testid="gql-tab-bar"></div>
    `;
    await ensureLesson14IntroReady(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.TAB_BAR, 5000);
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
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON14_STAGING_PROFILE_NAME);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON14_PRODUCTION_PROFILE_NAME);
  });

  it('demonstrateLesson14SaveProfiles pauses after save for Not linked hint', async () => {
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
          </li>`);
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson14SaveProfiles(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON14_STAGING_PROFILE_NAME);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.PROFILE_NAME_INPUT, LESSON14_PRODUCTION_PROFILE_NAME);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
  });

  it('demonstrateLesson14LoadProfiles clicks Load with ripple and pauses on Used by', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.body.insertAdjacentHTML('beforeend', `
      <p data-testid="gql-auth-inherit-banner">Editing profile</p>
    `);
    document.querySelector('.gql-profile-list')!.insertAdjacentHTML('beforeend', `
      <li class="gql-profile-row">
        <span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span>
        <button class="gql-profile-btn--load" aria-label="Load profile: ${LESSON14_STAGING_PROFILE_NAME}">Load</button>
      </li>
      <li class="gql-profile-row">
        <span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span>
        <button class="gql-profile-btn--load" aria-label="Load profile: ${LESSON14_PRODUCTION_PROFILE_NAME}">Load</button>
      </li>
    `);
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson14LoadProfiles(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.profileLoadBtn(LESSON14_STAGING_PROFILE_NAME));
    expect(ctx.click).toHaveBeenCalledWith(GQL.profileLoadBtn(LESSON14_PRODUCTION_PROFILE_NAME));
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_INHERIT_BANNER, 5000);
  });

  it('demonstrateLesson14LoadProfilesOnly clicks Load without opening Auth', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector('.gql-profile-list')!.insertAdjacentHTML('beforeend', `
      <li class="gql-profile-row">
        <span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span>
        <button class="gql-profile-btn--load" aria-label="Load profile: ${LESSON14_STAGING_PROFILE_NAME}">Load</button>
      </li>
      <li class="gql-profile-row">
        <span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span>
        <button class="gql-profile-btn--load" aria-label="Load profile: ${LESSON14_PRODUCTION_PROFILE_NAME}">Load</button>
      </li>
    `);
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson14SaveProfiles(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson14LoadProfilesOnly(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.profileLoadBtn(LESSON14_STAGING_PROFILE_NAME));
    expect(ctx.click).toHaveBeenCalledWith(GQL.profileLoadBtn(LESSON14_PRODUCTION_PROFILE_NAME));
  });

  it('demonstrateLesson14ProfileAuthLink opens inherit banner on Production tab', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>`;
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson14LoadProfilesOnly(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson14ProfileAuthLink(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_INHERIT_BANNER, 5000);
    expect(ctx.delay).toHaveBeenCalledWith(2500);
  });

  it('demonstrateLesson14ProfileLinks pauses on profile modal for Used by pills', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.body.insertAdjacentHTML('beforeend', `
      <p data-testid="gql-auth-inherit-banner">Editing profile</p>
    `);
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
    await demonstrateLesson14ProfileLinks(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_BADGE);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.PROFILE_MODAL, 5000);
    expect(ctx.delay).toHaveBeenCalledWith(2500);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_INHERIT_BANNER, 5000);
  });

  it('ensureLesson14PerTabAuthConfigured sets No Auth on tab 1 and Bearer on tab 2', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
      </div>
    `);
    const tab0 = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1 = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0.textContent = 'Staging';
    tab1.textContent = 'Production';
    await ensureLesson14PerTabAuthConfigured(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'none');
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON14_TAB2_BEARER_TOKEN);
    vi.mocked(ctx.selectOption).mockClear();
    await ensureLesson14PerTabAuthConfigured(ctx);
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('ensureLesson14ProfileAuthHintVisible opens auth panel via badge when auth tab inactive', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="false"></button>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <p data-testid="gql-auth-inherit-banner">Editing profile</p>
      </div>
    `);
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span><button class="gql-profile-btn--load">Load</button></li>`;
    const tab0 = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1 = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0.textContent = 'Staging';
    tab1.textContent = 'Production';
    await ensureTabProfileLink(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14ProfileAuthHintVisible(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('ensureLesson14ProfileAuthHintVisible keeps auth tab open when already active', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-bottom-tab-variables"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <p data-testid="gql-auth-inherit-banner">Editing profile</p>
      </div>
    `);
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span><button class="gql-profile-btn--load">Load</button></li>`;
    await ensureTabProfileLink(ctx);
    vi.mocked(ctx.click).mockClear();
    document.querySelector<HTMLElement>(GQL.BOTTOM_TAB_AUTH)?.setAttribute('aria-selected', 'true');
    await ensureLesson14ProfileAuthHintVisible(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BOTTOM_TAB_VARS);
  });

  it('ensureLesson14ProfileAuthHintVisible opens auth panel via badge when panel closed', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span><button class="gql-profile-btn--load">Load</button></li>`;
    await ensureTabProfileLink(ctx);
    document.querySelector(GQL.AUTH_PANEL)?.remove();
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

  it('closeProfileModalIfOpen is a no-op when profile modal is closed', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    vi.mocked(ctx.click).mockClear();
    await purgeLesson14ConnectionProfiles(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
  });

  it('demonstrateLesson14TabPolling uses fast path when polling already configured', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-polling-config-btn"></button>
      <div data-testid="gql-polling-popover">
        <button data-testid="gql-polling-popover-close"></button>
        <button data-testid="gql-polling-toggle" aria-checked="true"></button>
      </div>`);
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">Staging</span><button class="gql-profile-btn--load">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">Production</span><button class="gql-profile-btn--load">Load</button></li>`;
    await ensureTabPolling(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson14TabPolling(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.POLLING_TOGGLE);
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

  it('purgeLesson14ConnectionProfiles purges storage and closes an open modal', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    await purgeLesson14ConnectionProfiles(ctx);
    expect(purgeGqlDemoConnectionProfiles).toHaveBeenCalledWith([
      LESSON14_STAGING_PROFILE_NAME,
      LESSON14_PRODUCTION_PROFILE_NAME,
    ]);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
  });

  it('saveCurrentTabAsProfile skips when profile row already exists', async () => {
    const ctx = makeCtx();
    stubTwoTabDom();
    stubProfileDom();
    document.querySelector('.gql-profile-list')!.innerHTML = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span></li>`;
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
