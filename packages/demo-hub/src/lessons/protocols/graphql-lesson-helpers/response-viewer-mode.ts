import type { DemoActionContext } from '../../../types';
import { GQL } from '@shared/selectors';
import { GQL_RV_DATA_ONLY_STORAGE_KEY } from '@graphql/hooks/useGraphqlResponseDataOnly';

function isDataOnlyToggleChecked(): boolean {
  const toggle = document.querySelector<HTMLInputElement>(GQL.RV_DATA_ONLY_TOGGLE);
  return toggle?.checked === true;
}

/** Ensures the response viewer Data only toggle matches `enabled` (Body + Copy omit extensions). */
export async function ensureResponseDataOnlyMode(
  ctx: DemoActionContext,
  enabled: boolean,
): Promise<void> {
  try {
    localStorage.setItem(GQL_RV_DATA_ONLY_STORAGE_KEY, String(enabled));
  } catch { /* silent */ }

  const toggle = document.querySelector<HTMLInputElement>(GQL.RV_DATA_ONLY_TOGGLE);
  if (!toggle) return;

  if (isDataOnlyToggleChecked() !== enabled) {
    await ctx.click(GQL.RV_DATA_ONLY_TOGGLE);
    await ctx.delay(400);
  }
}
