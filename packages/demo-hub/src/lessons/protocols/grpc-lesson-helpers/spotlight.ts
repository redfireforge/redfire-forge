import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { purgeAllSpotlightRings, showSpotlightRing } from '../../../demoRipple';
import { resumeDemoAutoScroll, scrollDemoTargetIntoView } from '../../../demoSpotlightUtils';
import { firstVisibleElement } from '../../../utils/domVisibility';
import { isGrpcHybridComposerActive } from './echoComposer';

const JSON_CONTENT_WAIT_MAX_MS = 1_200;
const JSON_CONTENT_POLL_MS = 80;

function hasNonEmptyJsonText(value: string | null | undefined): boolean {
  return (value ?? '').trim().length > 0;
}

async function waitForNonEmptyJsonText(
  ctx: DemoActionContext,
  readText: () => string | null | undefined,
): Promise<void> {
  if (hasNonEmptyJsonText(readText())) return;

  const maxAttempts = Math.max(1, Math.floor(JSON_CONTENT_WAIT_MAX_MS / JSON_CONTENT_POLL_MS));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await ctx.delay(JSON_CONTENT_POLL_MS);
    if (hasNonEmptyJsonText(readText())) {
      return;
    }
  }
}

/**
 * Draw a steady spotlight box around the element matching `selector`, hold
 * for `holdMs` so the viewer can digest the target, then remove it.
 *
 * Uses `{ steady: true }` (no pulse) and purges any prior imperative rings so
 * rapid multi-beat tours read as a moving highlight, not a flash.
 */
export async function spotlightAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 900,
): Promise<void> {
  const el = firstVisibleElement(selector) ?? document.querySelector<HTMLElement>(selector);
  if (!el) return;
  await spotlightElementAndPause(ctx, el, holdMs);
}

/** Same as {@link spotlightAndPause} but takes a resolved element directly. */
export async function spotlightElementAndPause(
  ctx: DemoActionContext,
  el: HTMLElement,
  holdMs = 900,
): Promise<void> {
  purgeAllSpotlightRings();
  // Scroll nested modal/panel containers first — otherwise clipped targets
  // (e.g. Client Key "Set" at the bottom of the TLS modal) draw rings off-screen.
  resumeDemoAutoScroll();
  scrollDemoTargetIntoView(el, { block: 'center' });
  await ctx.delay(280);
  const removeRing = showSpotlightRing(el, { steady: true });
  try {
    await ctx.delay(holdMs);
  } finally {
    removeRing();
  }
}

/** Spotlight the active request composer (hybrid JSON or classic proto form). */
export async function spotlightGrpcRequestComposer(ctx: DemoActionContext): Promise<void> {
  await spotlightAndPause(ctx, GRPC.REQUEST_TAB_FORM, 750);
  if (isGrpcHybridComposerActive()) {
    await spotlightRequestJsonContentTight(ctx, 900);
  } else {
    await spotlightAndPause(ctx, GRPC.PROTO_GUIDED_CARD_CORE, 750);
  }
}

/**
 * Spotlight only the visible JSON text content inside the request textarea,
 * not the full-height textarea container.  The textarea stretches to fill its
 * flex parent (`height: 100%`), so a normal spotlight ring wraps the entire
 * editor area.  This helper computes the actual content height (lines × line-
 * height + padding) and places a tight ring matching the response body style.
 */
export async function spotlightRequestJsonContentTight(
  ctx: DemoActionContext,
  holdMs = 1100,
): Promise<void> {
  const textarea = document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON);
  if (!textarea) {
    await spotlightAndPause(ctx, GRPC.REQUEST_JSON, holdMs);
    return;
  }

  await waitForNonEmptyJsonText(ctx, () => textarea.value);

  const style = getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 12;
  const paddingBottom = parseFloat(style.paddingBottom) || 12;
  const lines = (textarea.value || '').split('\n').length;
  const contentHeight = Math.ceil(lines * lineHeight + paddingTop + paddingBottom);

  const rect = textarea.getBoundingClientRect();
  const clampedHeight = Math.min(contentHeight, rect.height);

  const proxy = document.createElement('div');
  proxy.style.cssText =
    `position:fixed;top:${rect.top}px;left:${rect.left}px;` +
    `width:${rect.width}px;height:${clampedHeight}px;` +
    `pointer-events:none;opacity:0;`;
  document.body.appendChild(proxy);

  purgeAllSpotlightRings();
  const removeRing = showSpotlightRing(proxy, { steady: true });
  try {
    await ctx.delay(holdMs);
  } finally {
    removeRing();
    proxy.remove();
  }
}

/**
 * Spotlight only the visible JSON text content inside the response body `pre`,
 * not the full response panel box.
 */
export async function spotlightResponseJsonContentTight(
  ctx: DemoActionContext,
  holdMs = 1100,
): Promise<void> {
  const body = document.querySelector<HTMLElement>(GRPC.RESPONSE_BODY);
  if (!body) {
    await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, holdMs);
    return;
  }

  await waitForNonEmptyJsonText(ctx, () => body.textContent);

  const style = getComputedStyle(body);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 10;
  const paddingBottom = parseFloat(style.paddingBottom) || 10;
  const text = body.textContent ?? '';
  const lines = text.length > 0 ? text.split('\n').length : 1;
  const contentHeight = Math.ceil(lines * lineHeight + paddingTop + paddingBottom);

  const rect = body.getBoundingClientRect();
  const clampedHeight = Math.min(contentHeight, rect.height);

  const proxy = document.createElement('div');
  proxy.style.cssText =
    `position:fixed;top:${rect.top}px;left:${rect.left}px;` +
    `width:${rect.width}px;height:${clampedHeight}px;` +
    `pointer-events:none;opacity:0;`;
  document.body.appendChild(proxy);

  purgeAllSpotlightRings();
  const removeRing = showSpotlightRing(proxy, { steady: true });
  try {
    await ctx.delay(holdMs);
  } finally {
    removeRing();
    proxy.remove();
  }
}

/**
 * Spotlight an element while hiding the call panel (response output box) to avoid distraction.
 * Restores the call panel visibility after the spotlight completes.
 */
export async function spotlightAndPauseWithCallPanelHidden(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 900,
): Promise<void> {
  const callPanel = document.querySelector<HTMLElement>(GRPC.CALL_PANEL);
  const wasCallPanelVisible = callPanel && callPanel.style.display !== 'none';
  
  if (callPanel) {
    callPanel.style.display = 'none';
  }
  
  try {
    await spotlightAndPause(ctx, selector, holdMs);
  } finally {
    if (callPanel && wasCallPanelVisible) {
      callPanel.style.display = '';
    }
  }
}
