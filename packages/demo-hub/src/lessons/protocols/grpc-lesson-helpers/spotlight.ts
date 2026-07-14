import type { DemoActionContext } from '../../../types';
import { GRPC } from '@shared/selectors';
import { showSpotlightRing } from '../../../demoRipple';
import { firstVisibleElement } from '../../../utils/domVisibility';
import { isGrpcHybridComposerActive } from './echoComposer';

/**
 * Draw a persistent spotlight box around the element matching `selector`, hold
 * for `holdMs` so the viewer can digest the target, then remove it.
 */
export async function spotlightAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 700,
): Promise<void> {
  const el = firstVisibleElement(selector) ?? document.querySelector<HTMLElement>(selector);
  if (!el) return;
  await spotlightElementAndPause(ctx, el, holdMs);
}

/** Same as {@link spotlightAndPause} but takes a resolved element directly. */
export async function spotlightElementAndPause(
  ctx: DemoActionContext,
  el: HTMLElement,
  holdMs = 700,
): Promise<void> {
  const removeRing = showSpotlightRing(el);
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
    await spotlightAndPause(ctx, GRPC.REQUEST_JSON_COMPACT, 800);
    await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 900);
  } else {
    await spotlightAndPause(ctx, GRPC.PROTO_FORM, 750);
    await spotlightAndPause(ctx, GRPC.PROTO_GUIDED_CARD_CORE, 750);
  }
}

/**
 * Spotlight an element while hiding the call panel (response output box) to avoid distraction.
 * Restores the call panel visibility after the spotlight completes.
 */
export async function spotlightAndPauseWithCallPanelHidden(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 700,
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
