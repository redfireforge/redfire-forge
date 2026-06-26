/** Demo-player bridge: lock GraphQL Studio connection-bar modals per lesson step. */

import { getDemoBridgeWindow } from './bridgeWindow';

export interface GqlModalLockState {
  envAllowed: boolean;
  profileAllowed: boolean;
}

export const GQL_MODAL_LOCK_OPEN: GqlModalLockState = {
  envAllowed: true,
  profileAllowed: true,
};

/** Only the step's spotlight target may open its modal during a live demo. */
export function resolveGqlModalLockForStepHighlight(highlight?: string): GqlModalLockState {
  if (!highlight) {
    return { envAllowed: false, profileAllowed: false };
  }
  return {
    envAllowed: highlight.includes('gql-env-badge') || highlight.includes('gql-env-modal'),
    profileAllowed: highlight.includes('gql-profile-badge') || highlight.includes('gql-profile-modal'),
  };
}

export function syncGqlModalLock(lock: GqlModalLockState): void {
  getDemoBridgeWindow().__demoSetGqlModalLock?.(lock);
}
