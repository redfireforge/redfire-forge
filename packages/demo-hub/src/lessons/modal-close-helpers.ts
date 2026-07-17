/**
 * Shared quiet modal-dismiss helpers for demo lesson preAction guards.
 */

export interface QuietDemoDelayContext {
  delay: (ms: number) => Promise<void>;
}

/** Click the first matching element if present; returns whether a click occurred. */
export async function clickElementQuiet(
  ctx: QuietDemoDelayContext,
  selector: string,
  delayMs = 200,
): Promise<boolean> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.click();
  await ctx.delay(delayMs);
  return true;
}

/** Click a modal close/cancel button without ripple — no-op when absent. */
export async function closeModalByButtonQuiet(
  ctx: QuietDemoDelayContext,
  buttonSelector: string,
  delayMs = 350,
): Promise<void> {
  await clickElementQuiet(ctx, buttonSelector, delayMs);
}
