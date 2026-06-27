/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql14'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  GQL14_LESSON_ID: 'gql-multi-tab',
}));

import { gqlMultiTabLesson } from './graphql-multi-tab';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  LESSON14_TAB2_ENDPOINT,
  resetGqlLesson14SessionFlags,
  resetGqlLessonSessionFlags,
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
  ensureLesson14PerTabAuthConfigured,
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

/** Generic badge selector matching the lesson. */
const LESSON14_TAB2_BADGE = GQL.LESSON14_TAB2_BADGE;

function stubMonacoEditor(query = 'query { health }'): void {
  const w = window as unknown as {
    monaco?: {
      editor: {
        getModels: () => Array<{ getValue: () => string; setValue: (v: string) => void; uri: { toString: () => string } }>;
        getEditors: () => Array<{ getModel: () => null; setValue: (v: string) => void }>;
      };
    };
  };
  w.monaco = {
    editor: {
      getModels: () => [{
        getValue: () => query,
        setValue: (v: string) => { query = v; },
        uri: { toString: () => 'inmemory://graphql/1' },
      }],
      getEditors: () => [{ getModel: () => null, setValue: (v: string) => { query = v; } }],
    },
  };
}

const GQL14_DEMO = 'gql-multi-tab';

function wireGqlTabRenameInputs(): void {
  document.querySelectorAll<HTMLInputElement>('[data-testid^="gql-tab-rename-"]').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const tab = input.closest('[role="tab"]');
      const label = tab?.querySelector('.gql-tab-label');
      if (label) label.textContent = input.value;
    });
  });
}

function stubMultiTabDom(tabCount = 1): void {
  const tabs = Array.from({ length: tabCount }, (_, i) => {
    const labelText = i === 1 ? 'Demo: Multi-Tab Works…' : `Query ${i + 1}`;
    const subtitle = i === 1
      ? '<span class="gql-tab-subtitle">localhost:4010</span>'
      : '';
    return `
    <button role="tab" data-testid="gql-tab-${i}" data-tab-id="tab-${i}"
      data-demo-lesson="${GQL14_DEMO}"
      ${i === tabCount - 1 ? 'aria-selected="true"' : ''}>
      <span class="gql-tab-type-badge">Q</span>
      <span class="gql-tab-label">${labelText}</span>
      ${subtitle}
      <input data-testid="gql-tab-rename-${i}" class="gql-tab-rename-input" value="${labelText}" />
    </button>
  `;
  }).join('');

  document.body.innerHTML = `
    <div data-testid="gql-tab-bar">
      ${tabs}
      <button data-testid="gql-tab-add-btn">+</button>
    </div>
    <input data-testid="gql-endpoint-input" value="{{graphqlUrl}}" />
    <button data-testid="gql-endpoint-reset-btn"></button>
    <button data-testid="gql-introspect-btn"></button>
    <button data-testid="gql-execute-btn"></button>
    <span data-testid="gql-schema-badge-ok">Schema (47 types)</span>
    <div data-testid="gql-response-viewer"></div>
    <div data-testid="gql-response-body">{"data":{"health":"ok"}}</div>
    <div data-testid="gql-schema-explorer"></div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
  `;
  wireGqlTabRenameInputs();
}

describe('gql-multi-tab lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson14SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Lesson structure ───────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlMultiTabLesson.id).toBe('gql-multi-tab');
    expect(gqlMultiTabLesson.category).toBe('graphql');
    expect(gqlMultiTabLesson.name).toBe('Multi-Tab Workspaces');
    expect(gqlMultiTabLesson.steps.length).toBe(12);
    expect(gqlMultiTabLesson.estimatedMinutes).toBe(9);
    expect(gqlMultiTabLesson.tabBudget).toBe(2);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlMultiTabLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlMultiTabLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlMultiTabLesson.steps.map((s) => s.id)).toEqual([
      'gql14-intro',
      'gql14-tab1-endpoint',
      'gql14-add-tab2',
      'gql14-tab2-endpoint',
      'gql14-switch-responses',
      'gql14-tab-badge',
      'gql14-real-world',
      'gql14-per-tab-auth',
      'gql14-profiles-save',
      'gql14-profiles-load',
      'gql14-profile-auth',
      'gql14-polling',
    ]);
  });

  it('all 12 steps have pauseAfter enabled', () => {
    gqlMultiTabLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBeTruthy();
    });
  });

  it('all steps have a preAction guard', () => {
    gqlMultiTabLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ────────────────────────────────────────────────────────

  it('concept title captures multi-tab as multi-environment workspace', () => {
    expect(gqlMultiTabLesson.concept.title).toContain('Multi-Tab');
    expect(gqlMultiTabLesson.concept.title).toContain('Environments');
  });

  it('concept body explains WHY tabs beat separate windows', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('share state');
    expect(gqlMultiTabLesson.concept.body).toContain('isolated');
  });

  it('concept body explains WHY per-tab endpoint isolation matters', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('cached response');
    expect(gqlMultiTabLesson.concept.body).toContain('introspecting');
  });

  it('concept body explains WHY badge appears only on overridden tabs', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('page-level default');
    expect(gqlMultiTabLesson.concept.body).toContain('badge');
  });

  it('concept body explains WHY lesson comes after GQL-1..13', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('staging and production');
  });

  it('has exactly 6 key terms', () => {
    expect(gqlMultiTabLesson.concept.keyTerms.length).toBe(6);
  });

  it('key terms cover: Tab workspace, endpoint override, badge, response cache, page-level default, per-tab auth', () => {
    const terms = gqlMultiTabLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Tab workspace');
    expect(terms).toContain('Per-tab endpoint override');
    expect(terms).toContain('Endpoint badge');
    expect(terms).toContain('Response cache (per tab)');
    expect(terms).toContain('Page-level default endpoint');
    expect(terms).toContain('Per-tab auth override');
  });

  it('Endpoint badge key term explains absence vs presence', () => {
    const term = gqlMultiTabLesson.concept.keyTerms.find((k) => k.term === 'Endpoint badge')!;
    expect(term.definition).toContain('default');
    expect(term.definition).toContain('Absent');
  });

  // ── Diagram ────────────────────────────────────────────────────────────────

  it('diagram has 700x430 studio chrome dimensions', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram includes window chrome traffic lights', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlMultiTabLesson.concept.diagram).toContain('#febc2e');
    expect(gqlMultiTabLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows tab bar with Staging and Production tabs', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('Staging');
    expect(gqlMultiTabLesson.concept.diagram).toContain('Production');
  });

  it('diagram shows endpoint override badge on Tab 2', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain(':4010');
  });

  it('diagram shows both tab responses side by side', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('Production ▸ Response');
    expect(gqlMultiTabLesson.concept.diagram).toContain('Staging ▸ Cached');
  });

  it('diagram shows tab isolation annotation', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('own endpoint');
    expect(gqlMultiTabLesson.concept.diagram).toContain('caches persist');
  });

  it('diagram includes bottom pipeline legend', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('Open Tab 2');
    expect(gqlMultiTabLesson.concept.diagram).toContain('Compare');
  });

  // ── Step spotlights ────────────────────────────────────────────────────────

  it('gql14-intro highlights TAB_BAR', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-intro')!;
    expect(step.highlight).toBe(GQL.TAB_BAR);
  });

  it('gql14-tab1-endpoint highlights ENDPOINT_INPUT', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab1-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gql14-add-tab2 highlights TAB_ADD_BTN and verifies new Tab 2', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-add-tab2')!;
    expect(step.highlight).toBe(GQL.TAB_ADD_BTN);
    expect(step.verify).toBe(GQL.LESSON14_TAB2);
    expect(step.action).toBe(demonstrateLesson14AddSecondTab);
  });

  it('gql14-tab2-endpoint highlights ENDPOINT_INPUT and verifies schema badge', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab2-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gql14-switch-responses highlights tab bar and verifies response body', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    expect(step.highlight).toBe(GQL.TAB_BAR);
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
    expect(step.pauseAfter).toBe(6000);
  });

  it('gql14-tab-badge highlights demo Tab 2 endpoint badge', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab-badge')!;
    expect(step.highlight).toBe(LESSON14_TAB2_BADGE);
    expect(step.verify).toBe(LESSON14_TAB2_BADGE);
  });

  it('gql14-real-world highlights tab bar for Staging/Production rename', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-real-world')!;
    expect(step.highlight).toBe(GQL.TAB_BAR);
  });

  it('gql14-profiles-save highlights PROFILE_BADGE and saves with Not linked pause', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profiles-save')!;
    expect(step.highlight).toBe(GQL.PROFILE_BADGE);
    expect(step.verify).toBe(GQL.PROFILE_MODAL);
    expect(step.preAction).toBe(ensureLesson14PerTabAuthConfigured);
    expect(step.description).toContain('Not linked to any tab');
    expect(step.description).toContain('Load');
    expect(step.pauseAfter).toBe(6000);
  });

  it('gql14-profiles-load highlights PROFILE_BADGE and verifies profile modal', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profiles-load')!;
    expect(step.highlight).toBe(GQL.PROFILE_BADGE);
    expect(step.verify).toBe(GQL.PROFILE_MODAL);
    expect(step.description).toContain('Load');
    expect(step.description).toContain('Used by');
    expect(step.description).not.toContain('Editing profile');
    expect(step.pauseAfter).toBe(6500);
  });

  it('gql14-profile-auth highlights inherit banner and verifies auth panel link', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profile-auth')!;
    expect(step.highlight).toBe(GQL.AUTH_INHERIT_BANNER);
    expect(step.verify).toBe(GQL.AUTH_INHERIT_BANNER);
    expect(step.description).toContain('Editing profile');
    expect(step.pauseAfter).toBe(6000);
  });

  it('gql14-per-tab-auth highlights Auth tab and verifies auth panel', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-per-tab-auth')!;
    expect(step.highlight).toBe(GQL.BOTTOM_TAB_AUTH);
    expect(step.verify).toBe(GQL.AUTH_PANEL);
    expect(step.preAction).toBe(ensureLesson14TabsRenamed);
    expect(step.pauseAfter).toBe(6500);
  });

  it('gql14-per-tab-auth description mentions per-tab auth', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-per-tab-auth')!;
    expect(step.description.toLowerCase()).toContain('per-tab');
  });

  it('gql14-polling highlights POLLING_POPOVER and verifies polling popover', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-polling')!;
    expect(step.highlight).toBe(GQL.POLLING_POPOVER);
    expect(step.verify).toBe(GQL.POLLING_POPOVER);
    expect(step.preAction).toBe(ensureLesson14TabProfileLinks);
  });

  // ── Step verify selectors ──────────────────────────────────────────────────

  it('gql14-tab1-endpoint verify is RESPONSE_BODY', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab1-endpoint')!;
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
  });

  it('gql14-tab2-endpoint verify is SCHEMA_BADGE_OK', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab2-endpoint')!;
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gql14-add-tab2 verify is LESSON14_TAB2', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-add-tab2')!;
    expect(step.verify).toBe(GQL.LESSON14_TAB2);
  });

  it('gql14-switch-responses verify is RESPONSE_BODY', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
  });

  // ── Step description WHY content ───────────────────────────────────────────

  it('gql14-intro description explains WHY tabs beat separate windows', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-intro')!;
    expect(step.description).toContain('share state');
    expect(step.description).toContain('sidebar');
  });

  it('gql14-tab1-endpoint description explains WHY env-var is the page default', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab1-endpoint')!;
    expect(step.description).toContain('page-level default');
    expect(step.description).toContain('badge');
  });

  it('gql14-add-tab2 description explains WHY Tab 2 has no hostname subtitle yet', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-add-tab2')!;
    expect(step.description).toContain('no hostname subtitle');
    expect(step.description).toContain('schema badge');
  });

  it('gql14-tab2-endpoint description explains WHY this is a per-tab override', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab2-endpoint')!;
    expect(step.description).toContain('override');
    expect(step.description).toContain('cross-contaminate');
  });

  it('gql14-switch-responses description explains WHY per-tab caching is useful', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    expect(step.description).toContain('compare');
    expect(step.description).toContain('re-running');
  });

  it('gql14-tab-badge description explains hostname subtitle on overridden tabs', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab-badge')!;
    expect(step.description).toContain('localhost:4010');
    expect(step.description).toContain('second line');
    expect(step.description).toContain('page default');
  });

  it('gql14-real-world description explains staging vs production workflow', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-real-world')!;
    expect(step.description).toContain('Staging');
    expect(step.description).toContain('Production');
  });

  it('gql14-profiles-load description explains Load wires Used by', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profiles-load')!;
    expect(step.description).toContain('connectionId');
    expect(step.description).not.toContain('Editing profile');
  });

  it('gql14-profile-auth description explains profile-linked auth editing', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profile-auth')!;
    expect(step.description).toContain('Editing profile');
    expect(step.description).toContain(LESSON14_PRODUCTION_PROFILE_NAME);
  });

  it('gql14-polling description explains per-tab polling follows active tab', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-polling')!;
    expect(step.description).toContain('active');
    expect(step.description).toMatch(/polling/i);
  });

  // ── Helper unit tests ──────────────────────────────────────────────────────

  it('activateGqlTabByIndex tags and clicks the nth tab when not already active', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    await activateGqlTabByIndex(ctx, 0);
    expect(ctx.click).toHaveBeenCalledWith('[data-lesson-target="gql14-tab-0"]');
  });

  it('activateGqlTabByIndex skips click when tab is already active', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    vi.mocked(ctx.click).mockClear();
    await activateGqlTabByIndex(ctx, 1);
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
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          `<button role="tab" data-demo-lesson="${GQL14_DEMO}">Query 2</button>`,
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureGqlTabCount(ctx, 2);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
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
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-schema-badge-ok"></span>');
    });
    await introspectActiveTabQuiet(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
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
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await executeOnActiveTabQuiet(ctx, 'query { health }');
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
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
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'afterbegin',
          `<button role="tab" data-demo-lesson="${GQL14_DEMO}">Query 2</button>`,
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson14Tab2Added(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
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
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson14Tab2Executed(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('ensureLesson14SwitchedToTab1 activates Tab 0 after Tab 2 executed', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab2Executed(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14SwitchedToTab1(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-lesson-target="gql14-tab-0"]');
  });

  it('ensureLesson14SwitchedToTab1 guard skips on repeat', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    await ensureLesson14Tab2Executed(ctx);
    await ensureLesson14SwitchedToTab1(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson14SwitchedToTab1(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-lesson-target="gql14-tab-0"]');
    expect(ctx.click).not.toHaveBeenCalledWith('[data-lesson-target="gql14-tab-1"]');
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

  it('gql14-switch-responses action executes on Tab 2 then switches to Tab 1', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
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

  it('gql14-real-world action renames tabs to Staging and Production', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    stubMonacoEditor('query { health }');
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-real-world')!;
    await step.preAction!(ctx);
    await step.action!(ctx);

    const tab0Label = document.querySelector('[data-testid="gql-tab-0"] .gql-tab-label');
    const tab1Label = document.querySelector('[data-testid="gql-tab-1"] .gql-tab-label');
    expect(tab0Label?.textContent).toBe(LESSON14_STAGING_LABEL);
    expect(tab1Label?.textContent).toBe(LESSON14_PRODUCTION_LABEL);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('gql14-per-tab-auth action sets No Auth on tab 1 and Bearer on tab 2', async () => {
    const ctx = makeCtx();
    stubMultiTabDom(2);
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-auth-badge-btn"></button>
      <div data-testid="gql-auth-panel">
        <select data-testid="gql-auth-type-select">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer</option>
        </select>
        <input data-testid="gql-auth-bearer-input" value="" />
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
    vi.mocked(ctx.selectOption).mockClear();
    vi.mocked(ctx.fill).mockClear();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'none');
    expect(ctx.selectOption).toHaveBeenCalledWith(GQL.AUTH_TYPE_SELECT, 'bearer');
    expect(ctx.fill).toHaveBeenCalledWith(GQL.AUTH_BEARER_INPUT, LESSON14_TAB2_BEARER_TOKEN);
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
    expect(ctx.delay).toHaveBeenCalledWith(2500);
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
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.AUTH_INHERIT_BANNER, 5000);
    expect(ctx.delay).toHaveBeenCalledWith(2500);
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
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.POLLING_POPOVER, 5000);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
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
