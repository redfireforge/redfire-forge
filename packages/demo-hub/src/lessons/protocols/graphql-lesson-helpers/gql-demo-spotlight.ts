import type { DemoActionContext } from '../../../types';
import { showSpotlightRing } from '../../../demoRipple';
import { resumeDemoAutoScroll, scrollDemoTargetIntoView } from '../../../demoSpotlightUtils';

/**
 * Hold a steady spotlight on a selector (no pulse) so the viewer can read the target.
 * Used inside lesson actions after a visible change — not during the reading-phase ring.
 */
export async function spotlightAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs = 1200,
): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) {
    await ctx.delay(holdMs);
    return;
  }
  // Teaching beats must always be able to scroll — clear a prior user-scroll pause.
  resumeDemoAutoScroll();
  scrollDemoTargetIntoView(el, { block: 'center' });
  // Brief settle so the eye can follow the scroll before the ring locks on.
  await ctx.delay(280);
  const removeRing = showSpotlightRing(el, { steady: true });
  try {
    await ctx.delay(holdMs);
  } finally {
    removeRing();
  }
}
