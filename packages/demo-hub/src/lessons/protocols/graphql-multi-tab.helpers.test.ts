/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql14'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  GQL14_LESSON_ID: 'gql-multi-tab',
}));

import {
  setupGraphqlMultiTabBeforeEach,
  teardownGraphqlMultiTabAfterEach,
  LESSON14_TAB2_BADGE,
  stubMonacoEditor,
  GQL14_DEMO,
  stubMultiTabDom,
} from './graphql-multi-tab.testHelpers';
import { gqlMultiTabLesson } from './graphql-multi-tab';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  LESSON14_TAB2_ENDPOINT,
  activateGqlTabByIndex,
  ensureGqlTabCount,
  setActiveTabEndpoint,
  introspectActiveTabQuiet,
  executeOnActiveTabQuiet,
  ensureLesson14Tab1Configured,
  ensureLesson14Tab2Added,
  demonstrateLesson14AddSecondTab,
  ensureLesson14Tab2Configured,
  ensureLesson14Tab2Executed,
  ensureLesson14SwitchedToTab1,
  ensureLesson14Tab2BadgeHighlight,
  ensureLesson14TabsRenamed,
  ensureLesson14TabProfileLinks,
  ensureLesson14ProfileAuthHintVisible,
  LESSON14_TAB2_BEARER_TOKEN,
  ensureLesson14TabPolling,
  LESSON14_STAGING_PROFILE_NAME,
  LESSON14_PRODUCTION_PROFILE_NAME,
  renameDemoTabByIndex,
  LESSON14_STAGING_LABEL,
  LESSON14_PRODUCTION_LABEL,
  gqlMultiTabLessonSetup,
  gqlMultiTabLessonCleanup,
} from './graphql-lesson-helpers';

describe('gql-multi-tab lesson — helpers', () => {
  beforeEach(() => {
    setupGraphqlMultiTabBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlMultiTabAfterEach();
  });

// ── Helper unit tests ──────────────────────────────────────────────────────

  it('activateGqlTabByIndex quietly activates the nth tab when not already active', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    const tab0 = document.querySelector<HTMLElement>('[data-testid="gql-tab-0"]')!;
    tab0.setAttribute('aria-selected', 'false');
    const clickSpy = vi.spyOn(tab0, 'click');
    await activateGqlTabByIndex(ctx, 0);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('activateGqlTabByIndex skips click when tab is already active', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    const tab1 = document.querySelector<HTMLElement>('[data-testid="gql-tab-1"]')!;
    const clickSpy = vi.spyOn(tab1, 'click');
    await activateGqlTabByIndex(ctx, 1);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('activateGqlTabByIndex does nothing when index out of range', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    await activateGqlTabByIndex(ctx, 5);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureGqlTabCount adds tabs until target is reached', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    document.querySelector(GQL.TAB_ADD_BTN)!.addEventListener('click', () => {
      document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
        'beforeend',
        `<button role="tab" data-demo-lesson="${GQL14_DEMO}">Query 2</button>`,
      );
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureGqlTabCount(ctx, 2);
    expect(document.querySelectorAll(`[data-demo-lesson="${GQL14_DEMO}"]`).length).toBe(2);
  });

  it('ensureGqlTabCount skips when count already meets target', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    await ensureGqlTabCount(ctx, 2);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('setActiveTabEndpoint fills the endpoint input and blurs', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    await setActiveTabEndpoint(ctx, GQL_DEMO_HTTP);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('introspectActiveTabQuiet skips when schema badge already present', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    await introspectActiveTabQuiet(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('introspectActiveTabQuiet clicks introspect when no badge', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar"><button role="tab" aria-selected="true">Q1</button></div>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
      <button data-testid="gql-introspect-btn"></button>
    `;
    const btn = document.querySelector<HTMLElement>(GQL.INTROSPECT_BTN)!;
    const clickSpy = vi.spyOn(btn, 'click');
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-schema-badge-ok"></span>');
    });
    await introspectActiveTabQuiet(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('executeOnActiveTabQuiet skips when response body contains health', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    stubMonacoEditor('query { health }');
    await executeOnActiveTabQuiet(ctx, 'query { health }');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('executeOnActiveTabQuiet executes when response body is empty', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar"><button role="tab" aria-selected="true">Q1</button></div>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_HTTP}" />
      <button data-testid="gql-execute-btn"></button>
      <div data-testid="gql-response-body"></div>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    stubMonacoEditor('');
    const btn = document.querySelector<HTMLElement>(GQL.EXECUTE_BTN)!;
    const clickSpy = vi.spyOn(btn, 'click');
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await executeOnActiveTabQuiet(ctx, 'query { health }');
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson14Tab1Configured activates tab 0, sets page default, then clears override', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab1Configured(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENDPOINT_RESET_BTN);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('ensureLesson14Tab1Configured guard skips on repeat', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab1Configured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson14Tab1Configured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('demonstrateLesson14AddSecondTab clicks TAB_ADD_BTN without revisiting Tab 1 endpoint', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          `<button role="tab" data-demo-lesson="${GQL14_DEMO}" data-testid="gql-tab-1">Query 2</button>`,
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson14AddSecondTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENDPOINT_RESET_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith('[data-lesson-target="gql14-tab-0"]');
  });

  it('demonstrateLesson14AddSecondTab guard skips when 2 tabs already exist', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson14AddSecondTab(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('ensureLesson14Tab2Added clicks TAB_ADD_BTN to create Tab 2', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    stubMonacoEditor('query { health }');
    document.querySelector(GQL.TAB_ADD_BTN)!.addEventListener('click', () => {
      document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
        'afterbegin',
        `<button role="tab" data-demo-lesson="${GQL14_DEMO}" data-testid="gql-tab-1">Query 2</button>`,
      );
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson14Tab2Added(ctx);
    expect(document.querySelectorAll(`[data-demo-lesson="${GQL14_DEMO}"]`).length).toBe(2);
  });

  it('ensureLesson14Tab2Added guard skips when 2 tabs already exist', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab1Configured(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14Tab2Added(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('ensureLesson14Tab2Configured sets the direct-URL endpoint override on Tab 2', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab2Configured(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, LESSON14_TAB2_ENDPOINT);
  });

  it('ensureLesson14Tab2Configured guard skips on repeat', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab2Configured(ctx);
    vi.mocked(ctx.fill).mockClear();
    await ensureLesson14Tab2Configured(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, LESSON14_TAB2_ENDPOINT);
  });

  it('ensureLesson14Tab2Executed runs execute on Tab 2', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('');
    document.querySelector(GQL.RESPONSE_BODY)!.textContent = '';
    const btn = document.querySelector<HTMLElement>(GQL.EXECUTE_BTN)!;
    const clickSpy = vi.spyOn(btn, 'click');
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson14Tab2Executed(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureLesson14SwitchedToTab1 activates Tab 0 after Tab 2 executed', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab2Executed(ctx);
    document.querySelector<HTMLElement>('[data-testid="gql-tab-0"]')!.setAttribute('aria-selected', 'false');
    document.querySelector<HTMLElement>('[data-testid="gql-tab-1"]')!.setAttribute('aria-selected', 'true');
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14SwitchedToTab1(ctx);
    // First recovery path uses the visible switch helper (ctx.click + spotlight).
    expect(ctx.click).toHaveBeenCalledWith('[data-lesson-target="gql14-tab-0"]');
  });

  it('ensureLesson14SwitchedToTab1 guard skips on repeat', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab2Executed(ctx);
    await ensureLesson14SwitchedToTab1(ctx);
    document.querySelector<HTMLElement>('[data-testid="gql-tab-0"]')!.setAttribute('aria-selected', 'true');
    document.querySelector<HTMLElement>('[data-testid="gql-tab-1"]')!.setAttribute('aria-selected', 'false');
    const tab0 = document.querySelector<HTMLElement>('[data-testid="gql-tab-0"]')!;
    const clickSpy = vi.spyOn(tab0, 'click');
    await ensureLesson14SwitchedToTab1(ctx);
    // Already on tab 0 after first switch — quiet activate is a no-op.
    expect(clickSpy).not.toHaveBeenCalled();
  });

  // ── Step actions ───────────────────────────────────────────────────────────

  it('gql14-intro preAction closes the history panel and waits for the tab bar', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <div data-testid="gql-tab-bar"></div>
    `;
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-intro')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.TAB_BAR, 5000);
  });

  it('gql14-intro action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-intro')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql14-tab1-endpoint action inherits page default without duplicating env-var on tab', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
    stubMonacoEditor('query { health }');
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab1-endpoint')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ENDPOINT_RESET_BTN);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('gql14-add-tab2 action is demonstrateLesson14AddSecondTab (click + only)', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(1);
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          `<button role="tab" data-demo-lesson="${GQL14_DEMO}">Query 2</button>`,
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-add-tab2')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ENDPOINT_RESET_BTN);
  });

  it('gql14-tab2-endpoint action fills direct URL on Tab 2', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab2-endpoint')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_HTTP);
  });

  it('gql14-switch-responses action switches Tab 2 → Tab 1 without re-executing', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    // Seed a response body so quiet executeOnActiveTabQuiet can skip when present.
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-testid="gql-response-body">{"data":{"health":"ok"}}</div>',
    );
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith('[data-lesson-target="gql14-tab-0"]');
  });

  it('gql14-tab-badge action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab-badge')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
    expect(document.querySelector(LESSON14_TAB2_BADGE)).toBeTruthy();
  });

  it('ensureLesson14Tab2BadgeHighlight tags demo Tab 2 button', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab2BadgeHighlight(ctx);
    const tab2 = document.querySelector('[data-testid="gql-tab-1"]');
    expect(tab2?.getAttribute('data-lesson-target')).toBe('gql14-tab2-badge');
  });

  it('gql14-real-world preAction renames tabs; action switches with spotlights', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-real-world')!;
    await step.preAction!(ctx);

    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label');
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label');
    expect(tab0Label?.textContent).toBe(LESSON14_STAGING_LABEL);
    expect(tab1Label?.textContent).toBe(LESSON14_PRODUCTION_LABEL);

    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql14-per-tab-auth action executes and opens Metadata on both tabs', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-auth-badge-btn"></button>
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer" selected>Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="${LESSON14_TAB2_BEARER_TOKEN}" />
      </div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-request-headers"></div>
    `);
    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0Label.textContent = LESSON14_STAGING_LABEL;
    tab1Label.textContent = LESSON14_PRODUCTION_LABEL;
    stubMonacoEditor('query { health }');
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-per-tab-auth')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
  });

  it('renameDemoTabByIndex commits label via Enter', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    await renameDemoTabByIndex(ctx, 0, LESSON14_STAGING_LABEL);
    const label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label');
    expect(label?.textContent).toBe(LESSON14_STAGING_LABEL);
  });

  it('ensureLesson14TabsRenamed guard skips when labels already set', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0Label.textContent = LESSON14_STAGING_LABEL;
    tab1Label.textContent = LESSON14_PRODUCTION_LABEL;

    await ensureLesson14TabsRenamed(ctx);
    const rename0 = document.querySelector<HTMLInputElement>('[data-testid="gql-tab-rename-0"]')!;
    const rename1 = document.querySelector<HTMLInputElement>('[data-testid="gql-tab-rename-1"]')!;
    expect(rename0.value).toBe('Query 1');
    expect(rename1.value).toBe('Demo: Multi-Tab Works…');
  });

  it('ensureLesson14ProfileAuthHintVisible opens Auth panel with profile hint', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" />
        <button data-testid="gql-profile-save-btn"></button>
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list">
          <li class="gql-profile-row">
            <span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span>
            <button class="gql-profile-btn--load">Load</button>
          </li>
          <li class="gql-profile-row">
            <span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span>
            <button class="gql-profile-btn--load">Load</button>
          </li>
        </ul>
      </div>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <p data-testid="gql-auth-inherit-banner">Editing profile <strong>${LESSON14_PRODUCTION_PROFILE_NAME}</strong></p>
      </div>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <pre data-testid="gql-response-body">{"data":{"health":"ok"}}</pre>
      <input data-testid="gql-tab-rename-0" value="Staging" />
      <input data-testid="gql-tab-rename-1" value="Production" />
    `);
    stubMonacoEditor();
    await ensureLesson14ProfileAuthHintVisible(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_INHERIT_BANNER, 5000);
  });

  it('gql14-profiles-load action clicks Load on both profiles', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    const profileRowsHtml = `
      <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span><span class="gql-profile-row__unused-hint">Not linked to any tab</span><button class="gql-profile-btn--load" aria-label="Load profile: ${LESSON14_STAGING_PROFILE_NAME}">Load</button></li>
      <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span><span class="gql-profile-row__unused-hint">Not linked to any tab</span><button class="gql-profile-btn--load" aria-label="Load profile: ${LESSON14_PRODUCTION_PROFILE_NAME}">Load</button></li>`;
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" />
        <button data-testid="gql-profile-save-btn"></button>
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list">${profileRowsHtml}</ul>
      </div>
      <input data-testid="gql-tab-rename-0" value="Staging" />
      <input data-testid="gql-tab-rename-1" value="Production" />
    `);
    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0Label.textContent = LESSON14_STAGING_LABEL;
    tab1Label.textContent = LESSON14_PRODUCTION_LABEL;
    stubMonacoEditor();
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profiles-load')!;
    await step.preAction!(ctx);
    document.querySelector(GQL.PROFILE_MODAL)?.remove();
    const w = window as unknown as Record<string, unknown>;
    w.__demoOpenGqlProfileModal = () => {
      if (document.querySelector(GQL.PROFILE_MODAL)) return true;
      document.body.insertAdjacentHTML('beforeend', `
        <div data-testid="gql-profile-modal">
          <button data-testid="gql-profile-close-btn"></button>
          <ul class="gql-profile-list">${profileRowsHtml}</ul>
        </div>`);
      return true;
    };
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.profileLoadBtn(LESSON14_STAGING_PROFILE_NAME)
        || sel === GQL.profileLoadBtn(LESSON14_PRODUCTION_PROFILE_NAME)) {
        const row = document.querySelector(sel)?.closest('.gql-profile-row');
        row?.querySelector('.gql-profile-row__unused-hint')?.remove();
        row?.querySelector('.gql-profile-btn--load')?.replaceWith(
          '<span class="gql-profile-loaded-badge" data-testid="gql-profile-loaded-badge">Loaded</span>',
        );
      }
    });
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    delete w.__demoOpenGqlProfileModal;
    expect(ctx.click).toHaveBeenCalledWith(GQL.profileLoadBtn(LESSON14_STAGING_PROFILE_NAME));
    expect(ctx.click).toHaveBeenCalledWith(GQL.profileLoadBtn(LESSON14_PRODUCTION_PROFILE_NAME));
    expect(ctx.delay).toHaveBeenCalledWith(900);
  });

  it('gql14-profile-auth action opens Auth panel on Production tab', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list">
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
        </ul>
      </div>
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <p data-testid="gql-auth-inherit-banner">Editing profile <strong>${LESSON14_PRODUCTION_PROFILE_NAME}</strong></p>
      </div>
      <input data-testid="gql-tab-rename-0" value="Staging" />
      <input data-testid="gql-tab-rename-1" value="Production" />
    `);
    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0Label.textContent = LESSON14_STAGING_LABEL;
    tab1Label.textContent = LESSON14_PRODUCTION_LABEL;
    stubMonacoEditor();
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profile-auth')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.AUTH_BADGE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_INHERIT_BANNER, 2_500);
    expect(ctx.delay).toHaveBeenCalledWith(800);
  });

  it('ensureLesson14TabProfileLinks guard skips when profiles already linked', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" />
        <button data-testid="gql-profile-save-btn"></button>
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list">
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
        </ul>
      </div>
      <input data-testid="gql-tab-rename-0" value="Staging" />
      <input data-testid="gql-tab-rename-1" value="Production" />
    `);
    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0Label.textContent = LESSON14_STAGING_LABEL;
    tab1Label.textContent = LESSON14_PRODUCTION_LABEL;
    stubMonacoEditor();
    await ensureLesson14TabProfileLinks(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14TabProfileLinks(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.PROFILE_BADGE);
  });

  it('gql14-polling action opens polling popover via POLLING_CONFIG_BTN', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" />
        <button data-testid="gql-profile-save-btn"></button>
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list">
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
        </ul>
      </div>
      <button data-testid="gql-polling-config-btn"></button>
      <div data-testid="gql-polling-popover">
        <button data-testid="gql-polling-toggle" aria-checked="false" role="switch"></button>
        <button aria-label="Close polling config"></button>
      </div>
      <input data-testid="gql-tab-rename-0" value="Staging" />
      <input data-testid="gql-tab-rename-1" value="Production" />
    `);
    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0Label.textContent = LESSON14_STAGING_LABEL;
    tab1Label.textContent = LESSON14_PRODUCTION_LABEL;
    stubMonacoEditor();
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-polling')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.POLLING_CONFIG_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.POLLING_POPOVER, 2_500);
    expect(ctx.delay).toHaveBeenCalledWith(800);
  });

  it('gql14-polling action falls back to POLLING_CONFIG_BTN_STANDALONE', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" />
        <button data-testid="gql-profile-save-btn"></button>
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list">
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
        </ul>
      </div>
      <button data-testid="gql-polling-config-btn-standalone"></button>
      <div data-testid="gql-polling-popover">
        <button data-testid="gql-polling-toggle" aria-checked="false" role="switch"></button>
        <button aria-label="Close polling config"></button>
      </div>
      <input data-testid="gql-tab-rename-0" value="Staging" />
      <input data-testid="gql-tab-rename-1" value="Production" />
    `);
    document.querySelector(GQL.POLLING_CONFIG_BTN)?.remove();
    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label')!;
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label')!;
    tab0Label.textContent = LESSON14_STAGING_LABEL;
    tab1Label.textContent = LESSON14_PRODUCTION_LABEL;
    stubMonacoEditor();
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-polling')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.POLLING_CONFIG_BTN_STANDALONE);
  });

  it('ensureLesson14TabPolling enables polling on tab 0 and disables on tab 1', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <input data-testid="gql-profile-name-input" />
        <button data-testid="gql-profile-save-btn"></button>
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list">
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
          <li class="gql-profile-row"><span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span><button class="gql-profile-btn--load">Load</button></li>
        </ul>
      </div>
      <button data-testid="gql-polling-config-btn"></button>
      <div data-testid="gql-polling-popover">
        <button data-testid="gql-polling-toggle" aria-checked="false" role="switch"></button>
        <button aria-label="Close polling config"></button>
      </div>
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <pre data-testid="gql-response-body">{"data":{"health":"ok"}}</pre>
      <input data-testid="gql-tab-rename-0" value="Staging" />
      <input data-testid="gql-tab-rename-1" value="Production" />
    `);
    stubMonacoEditor();
    await ensureLesson14TabPolling(ctx);
    const toggleCallsAfterFirst = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === GQL.POLLING_TOGGLE,
    );
    expect(toggleCallsAfterFirst.length).toBe(1);
    await ensureLesson14TabPolling(ctx);
    const toggleCallsAfterSecond = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === GQL.POLLING_TOGGLE,
    );
    expect(toggleCallsAfterSecond.length).toBe(1);
  });

  // ── Setup / cleanup ────────────────────────────────────────────────────────

  it('gqlMultiTabLessonSetup creates demo workspace with tabBudget 2', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <div data-testid="gql-tab-bar">
        <button role="tab" data-demo-lesson="gql-multi-tab" aria-selected="true">Demo</button>
      </div>
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list"></ul>
      </div>
    `;
    await gqlMultiTabLessonSetup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-multi-tab',
      'Multi-Tab Workspaces',
      2,
    );
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.PROFILE_BADGE, 5000);
  });

  it('gqlMultiTabLessonCleanup closes demo tabs', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-profile-badge"></button>
      <div data-testid="gql-profile-modal">
        <button data-testid="gql-profile-close-btn"></button>
        <ul class="gql-profile-list"></ul>
      </div>
    `;
    await gqlMultiTabLessonCleanup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.PROFILE_CLOSE_BTN);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-multi-tab');
  });

  it('LESSON14_TAB2_ENDPOINT equals the Docker demo HTTP URL', () => {
    expect(LESSON14_TAB2_ENDPOINT).toBe(GQL_DEMO_HTTP);
  });
});
