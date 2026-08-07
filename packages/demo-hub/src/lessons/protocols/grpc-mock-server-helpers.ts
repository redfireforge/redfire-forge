/**
 * GRPC-13 Mock Server lesson — DOM helpers, demo constants, and quiet state guards.
 */
import { GRPC } from '@shared/selectors';
import { clearLiveDemoPanelFromTarget } from '../../demoSpotlightUtils';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { spotlightElementAndPause } from './grpc-lesson-helpers';
import type { DemoActionContext } from '../../types';

// ---------------------------------------------------------------------------
// Demo constants
// ---------------------------------------------------------------------------

/** Body-path equals rule: fires when request body has message == "ping". */
export const PING_RULE_NAME = 'Ping match';
export const PING_BODY_PATH = 'message';
export const PING_MATCH_VALUE = 'ping';
export const PING_RESPONSE_BODY = '{"message":"pong"}';

/** Fallback rule: fires when request body has any message field. */
export const FALLBACK_RULE_NAME = 'Fallback';
export const FALLBACK_BODY_PATH = 'message';
export const FALLBACK_STATUS_CODE = 13; // gRPC INTERNAL

/** Test messages for the two rules. */
export const TEST_MESSAGE_PING = 'ping';
export const TEST_MESSAGE_OTHER = 'other-request';

/** Spotlight hold durations for the dry-run tester walkthrough. */
export const GRPC13_DRY_RUN_SPOTLIGHT_MS = 1_000;
/** Match / No-match result — keep slightly longer so the payoff is readable. */
export const GRPC13_DRY_RUN_PAYOFF_MS = 1_400;

/** Global latency for the runtime demo. */
export const DEMO_LATENCY_MS = 100;
export const DEMO_JITTER_MS = 20;

// ---------------------------------------------------------------------------
// Mock runtime state tracking
// ---------------------------------------------------------------------------

/**
 * Tracks whether the demo mock runtime is currently running during this lesson.
 * The mock rule cards only render on the Advanced > Mock server tab, so later
 * steps (which run on the Studio tab) cannot reliably detect the running state
 * from the DOM. This flag lets those steps skip the visible navigate-to-mock
 * dance when the mock is already running — avoiding a jarring
 * Studio → Advanced → Studio bounce at step start.
 */
let demoMockRunning = false;

/** Record whether the demo mock runtime is running (called by start/stop helpers). */
export function markDemoMockRunning(running: boolean): void {
  demoMockRunning = running;
}

/** True when the demo mock runtime has been started this lesson run. */
export function isDemoMockRunning(): boolean {
  return demoMockRunning;
}

// ---------------------------------------------------------------------------
// Navigation & DOM helpers
// ---------------------------------------------------------------------------

/** Navigate to Advanced sub-nav and select the Mock server tab. */
export async function navigateToMockServerPanelQuiet(ctx: DemoActionContext): Promise<void> {
  const advBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (!advBtn) {
    await navigateToGrpcStudio(ctx);
    await ctx.delay(80);
  }
  const advEl = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (advEl && advEl.getAttribute('aria-selected') !== 'true') {
    advEl.click();
    await ctx.delay(60);
  }
  const mockTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('mock_server'));
  if (mockTab && mockTab.getAttribute('aria-selected') !== 'true') {
    mockTab.click();
    await ctx.delay(60);
  }
  try {
    await ctx.waitFor(GRPC.MOCK_SERVER_PANEL, 4_000);
  } catch { /* panel mounts with Advanced tab */ }
}

/** Switch the mock authoring sub-tab (builder | json | runtime). */
export async function selectMockAuthoringTab(
  ctx: DemoActionContext,
  tab: 'builder' | 'json' | 'runtime',
): Promise<void> {
  const sel = tab === 'builder' ? GRPC.MOCK_TAB_BUILDER
    : tab === 'json' ? GRPC.MOCK_TAB_JSON
    : GRPC.MOCK_TAB_RUNTIME;
  const btn = document.querySelector<HTMLButtonElement>(sel);
  if (btn && btn.getAttribute('aria-selected') !== 'true') {
    btn.click();
    await ctx.delay(350);
  }
}

/**
 * Clearance below the Advanced nav so the spotlight ring isn't clipped when a
 * control sits near the top of `.grpc-advanced-content`.
 */
const MOCK_SCROLL_TOP_PAD_PX = 96;

/**
 * Scroll a mock-server control into the advanced content viewport so Reading /
 * Acting spotlights aren't clipped by the Advanced nav / fold.
 *
 * Prefer the advanced content scroller (not window.scrollIntoView) and keep a
 * top pad so tabs like Runtime aren't flush under the feature-tab bar.
 */
export async function scrollMockControlIntoView(
  ctx: DemoActionContext,
  selectorOrEl: string | HTMLElement,
  block: ScrollLogicalPosition = 'center',
): Promise<void> {
  const el = typeof selectorOrEl === 'string'
    ? document.querySelector<HTMLElement>(selectorOrEl)
    : selectorOrEl;
  if (!el) return;

  const scrollParent =
    document.querySelector<HTMLElement>('.grpc-advanced-content')
    ?? findScrollableParent(el);

  if (scrollParent && scrollParent.contains(el)) {
    const elRect = el.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    const offsetTop = elRect.top - parentRect.top + scrollParent.scrollTop;
    let targetScroll: number;
    if (block === 'end') {
      targetScroll = offsetTop - scrollParent.clientHeight + elRect.height + 24;
    } else if (block === 'nearest' || block === 'start') {
      // Sit below the Advanced nav with room for the spotlight ring.
      targetScroll = offsetTop - MOCK_SCROLL_TOP_PAD_PX;
    } else {
      targetScroll = offsetTop - scrollParent.clientHeight / 2 + elRect.height / 2;
    }
    // Never pin the target (or its ring) flush under the Advanced nav clip.
    const maxScrollForTopPad = Math.max(0, offsetTop - MOCK_SCROLL_TOP_PAD_PX);
    targetScroll = Math.min(targetScroll, maxScrollForTopPad);

    const maxScroll = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
    scrollParent.scrollTo({
      top: Math.max(0, Math.min(targetScroll, maxScroll)),
      behavior: 'smooth',
    });
    await ctx.delay(350);
    clearLiveDemoPanelFromTarget(el);
    return;
  }

  el.scrollIntoView({ behavior: 'smooth', block: block === 'nearest' ? 'center' : block, inline: 'nearest' });
  await ctx.delay(350);
  clearLiveDemoPanelFromTarget(el);
}

/** Get the ruleId and leaf nodeId for the LAST rule in the builder. */
export function getLastRuleIds(): { ruleId: string; nodeId: string } | null {
  const ruleEls = document.querySelectorAll<HTMLElement>('[data-testid^="grpc-mock-builder-rule-"]');
  const lastRule = ruleEls[ruleEls.length - 1];
  if (!lastRule) return null;
  const ruleId = lastRule.getAttribute('data-testid')!.replace('grpc-mock-builder-rule-', '');
  const leafKindEl = lastRule.querySelector<HTMLSelectElement>('[data-testid^="grpc-mock-builder-leaf-kind-"]');
  const nodeId = leafKindEl?.getAttribute('data-testid')?.replace('grpc-mock-builder-leaf-kind-', '') ?? '';
  return { ruleId, nodeId };
}

/**
 * Set a select / CustomSelect value quietly.
 * Predicate kind + status code in the Mock builder are CustomSelect
 * (`.cs-wrapper`) — calling HTMLSelectElement's value setter on that div
 * throws TypeError: Illegal invocation (and never updates React state).
 */
export function setSelectValue(selector: string, value: string): void {
  const el = document.querySelector(selector);
  if (!el) return;

  // Prefer CustomSelect — data-testid lives on the `.cs-wrapper` div.
  const wrapper = el.classList.contains('cs-wrapper')
    ? el
    : el.closest('.cs-wrapper');
  if (wrapper) {
    if (wrapper.getAttribute('data-value') === value) return;
    wrapper.dispatchEvent(
      new CustomEvent('custom-select:set-value', { detail: { value }, bubbles: true }),
    );
    return;
  }

  if (!(el instanceof HTMLSelectElement)) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * True when the builder has the demo Ping + Fallback body-path rules.
 * Count alone is not enough — failed CustomSelect writes leave two cards that
 * still say Method equals Echo, and dry-run then reports No match.
 */
export function mockBuilderHasDemoBodyPathRules(): boolean {
  const ruleCount = document.querySelectorAll(GRPC.MOCK_BUILDER_RULE).length;
  if (ruleCount < 2) return false;

  const kindValues = Array.from(
    document.querySelectorAll('[data-testid^="grpc-mock-builder-leaf-kind-"]'),
  ).map((el) => el.getAttribute('data-value'));

  if (kindValues.length > 0) {
    return kindValues.includes('body_path_equals') && kindValues.includes('body_path_exists');
  }

  // Collapsed cards: leaf editors unmounted — use summary / method leftovers.
  const stillDefaultMethod = Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-testid^="grpc-mock-builder-leaf-method-"]'),
  ).some((el) => el.value.trim() === 'Echo');
  if (stillDefaultMethod) return false;

  const blob = Array.from(document.querySelectorAll(GRPC.MOCK_BUILDER_RULE))
    .map((el) => el.textContent ?? '')
    .join('\n');
  return /body\.message|message\s*==\s*["']ping["']/i.test(blob)
    && /body\.message\s+exists|path exists/i.test(blob);
}

/** Set a React-controlled input or textarea value. */
export function setMockInputValue(selector: string, value: string): void {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function findScrollableParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY, overflow } = getComputedStyle(node);
    const scrollable = /auto|scroll/.test(`${overflowY} ${overflow}`);
    if (scrollable && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Keep a target element visible below the sticky mock Authoring tabs.
 * This avoids the second rule being clipped under the fixed tabs row.
 */
export async function scrollBelowMockAuthoringTabs(ctx: DemoActionContext, el: HTMLElement): Promise<void> {
  const scrollParent = findScrollableParent(el);
  if (!scrollParent) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await ctx.delay(450);
    return;
  }

  const tabs = document.querySelector<HTMLElement>('.grpc-mock-authoring-tabs');
  const parentRect = scrollParent.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const tabsBottomInParent = tabs
    ? Math.max(0, tabs.getBoundingClientRect().bottom - parentRect.top)
    : 0;
  const safeTop = tabsBottomInParent + 12;
  const safeBottom = scrollParent.clientHeight - 12;
  const elTopInParent = elRect.top - parentRect.top;
  const elBottomInParent = elRect.bottom - parentRect.top;

  // Only scroll when the target is clipped by the sticky header band
  // or falls below the visible area.
  if (elTopInParent >= safeTop && elBottomInParent <= safeBottom) {
    return;
  }

  const targetTop = (elRect.top - parentRect.top + scrollParent.scrollTop) - safeTop;
  scrollParent.scrollTo({
    top: Math.max(0, Math.min(targetTop, scrollParent.scrollHeight - scrollParent.clientHeight)),
    behavior: 'smooth',
  });
  await ctx.delay(450);
}

/** Scroll target into view first, then hold spotlight long enough for human reading. */
export async function scrollAndSpotlight(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 1000,
): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  await scrollBelowMockAuthoringTabs(ctx, el);
  clearLiveDemoPanelFromTarget(el);
  await spotlightElementAndPause(ctx, el, holdMs, { skipScroll: true });
}

/**
 * Scroll a mock control into the advanced viewport, then spotlight without
 * a second scroll pass (avoids double-scroll delays in builder steps).
 */
export async function scrollMockAndSpotlight(
  ctx: DemoActionContext,
  selectorOrEl: string | HTMLElement,
  holdMs: number,
  block: ScrollLogicalPosition = 'center',
): Promise<void> {
  await scrollMockControlIntoView(ctx, selectorOrEl, block);
  const el = typeof selectorOrEl === 'string'
    ? document.querySelector<HTMLElement>(selectorOrEl)
    : selectorOrEl;
  if (!el) return;
  await spotlightElementAndPause(ctx, el, holdMs, { skipScroll: true });
}

/** Quietly stop the mock runtime if it is running. */
export async function stopMockQuiet(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(GRPC.MOCK_STOP)) {
    const stopBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_STOP);
    stopBtn?.click();
    await ctx.delay(500);
  }
  markDemoMockRunning(false);
}

/** Quietly start the mock runtime if it is not already running. */
export async function startMockQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToMockServerPanelQuiet(ctx);
  if (document.querySelector(GRPC.MOCK_STOP)) {
    markDemoMockRunning(true);
    return; // already running
  }
  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_START);
  if (startBtn && !startBtn.disabled) {
    startBtn.click();
    await ctx.delay(600);
    markDemoMockRunning(true);
  }
}

/**
 * Count builder rule cards. Selects Builder first — Runtime/JSON hide the cards
 * from the DOM, which would falsely report 0 rules and trigger a JSON-tab flash.
 */
export async function countMockBuilderRulesQuiet(ctx: DemoActionContext): Promise<number> {
  await selectMockAuthoringTab(ctx, 'builder');
  await ctx.delay(100);
  return document.querySelectorAll(GRPC.MOCK_BUILDER_RULE).length;
}

/**
 * Silently reset the mock rule set to the two demo rules.
 * Uses the JSON tab to patch the full rules JSON at once — avoids
 * repeated builder clicks that would be slow in preAction guards.
 * Callers should prefer {@link countMockBuilderRulesQuiet} before invoking this
 * so forward-play from Runtime does not flash the JSON editor.
 */
export async function ensureDemoRulesQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToMockServerPanelQuiet(ctx);
  await selectMockAuthoringTab(ctx, 'builder');
  await ctx.delay(80);
  // Require the body-path predicates — not merely two cards. A failed
  // CustomSelect write leaves Method-equals Echo stubs that dry-run rejects.
  if (mockBuilderHasDemoBodyPathRules()) return;

  await selectMockAuthoringTab(ctx, 'json');
  await ctx.delay(120);

  // Build the demo rule set JSON directly.
  const rulesJson = JSON.stringify({
    version: 1,
    rules: [
      {
        id: 'demo-ping-rule',
        name: PING_RULE_NAME,
        enabled: true,
        priority: 1,
        predicate: {
          type: 'leaf',
          kind: 'body_path_equals',
          path: PING_BODY_PATH,
          value: PING_MATCH_VALUE,
        },
        response: {
          body: JSON.parse(PING_RESPONSE_BODY),
          statusCode: 0,
        },
      },
      {
        id: 'demo-fallback-rule',
        name: FALLBACK_RULE_NAME,
        enabled: true,
        priority: 2,
        predicate: {
          type: 'leaf',
          kind: 'body_path_exists',
          path: FALLBACK_BODY_PATH,
        },
        response: {
          statusCode: FALLBACK_STATUS_CODE,
        },
      },
    ],
  }, null, 2);

  setMockInputValue(GRPC.MOCK_RULES_JSON, rulesJson);
  await ctx.delay(200);
  // Switch back to Builder so the viewer sees the rule cards.
  await selectMockAuthoringTab(ctx, 'builder');
  await ctx.delay(120);
}
