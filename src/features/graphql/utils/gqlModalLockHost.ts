/**
 * Persistent GraphQL modal-lock host — survives GraphqlStudioPage remounts.
 *
 * Demo Hub calls `syncGqlModalLock` while the studio may be unmounted (tab switch,
 * HMR, lazy Suspense). React hook state must not be the only subscriber.
 */

import type { GqlModalLockState } from '@redfireforge/demo-hub/adapters/gqlModalLockBridge';
import { GQL_MODAL_LOCK_OPEN } from '@redfireforge/demo-hub/adapters/gqlModalLockBridge';

type LockListener = () => void;

const lockListeners = new Set<LockListener>();
let lockSnapshot: GqlModalLockState = GQL_MODAL_LOCK_OPEN;

/** Env and Profiles stay clickable during live demos. */
export function normalizeGqlModalLock(_lock: GqlModalLockState): GqlModalLockState {
  return GQL_MODAL_LOCK_OPEN;
}

export function getGqlModalLockSnapshot(): GqlModalLockState {
  return lockSnapshot;
}

export function publishGqlModalLock(lock: GqlModalLockState): void {
  lockSnapshot = normalizeGqlModalLock(lock);
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__demoGqlModalLockState = lockSnapshot;
  }
  lockListeners.forEach((listener) => listener());
}

export function subscribeGqlModalLock(listener: LockListener): () => void {
  lockListeners.add(listener);
  return () => lockListeners.delete(listener);
}

/** Wire window bridge once at app boot (GraphqlStudioPage is eagerly imported by App). */
export function installGqlModalLockBridge(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  w.__demoSetGqlModalLock = publishGqlModalLock;
  const persisted = w.__demoGqlModalLockState as GqlModalLockState | undefined;
  if (persisted) {
    publishGqlModalLock(persisted);
  }
}

/** Test helper — reset module snapshot between tests. */
export function resetGqlModalLockHostForTests(): void {
  publishGqlModalLock({ envAllowed: true, profileAllowed: true });
}

installGqlModalLockBridge();
