/**
 * gRPC stream tab lifecycle state machine (Phase 2A).
 *
 * idle → starting → streaming → ending → ended | cancelled | error
 */

export type GrpcStreamLifecycle =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'ending'
  | 'ended'
  | 'cancelled'
  | 'error';

const TERMINAL: ReadonlySet<GrpcStreamLifecycle> = new Set([
  'ended',
  'cancelled',
  'error',
]);

const IN_FLIGHT: ReadonlySet<GrpcStreamLifecycle> = new Set([
  'starting',
  'streaming',
  'ending',
]);

/** Allowed transitions: from → Set<to> */
const TRANSITIONS: Readonly<Record<GrpcStreamLifecycle, ReadonlySet<GrpcStreamLifecycle>>> = {
  idle: new Set(['starting']),
  starting: new Set(['streaming', 'cancelled', 'error']),
  streaming: new Set(['ending', 'cancelled', 'error', 'ended']),
  ending: new Set(['ended', 'cancelled', 'error']),
  ended: new Set(),
  cancelled: new Set(),
  error: new Set(),
};

export function isGrpcStreamLifecycleInFlight(lifecycle: GrpcStreamLifecycle): boolean {
  return IN_FLIGHT.has(lifecycle);
}

export function isGrpcStreamLifecycleTerminal(lifecycle: GrpcStreamLifecycle): boolean {
  return TERMINAL.has(lifecycle);
}

export function canTransitionGrpcStreamLifecycle(
  from: GrpcStreamLifecycle,
  to: GrpcStreamLifecycle,
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function assertGrpcStreamLifecycleTransition(
  from: GrpcStreamLifecycle,
  to: GrpcStreamLifecycle,
): void {
  if (!canTransitionGrpcStreamLifecycle(from, to)) {
    throw new Error(`Invalid stream lifecycle transition: ${from} → ${to}`);
  }
}

export function createInitialStreamLifecycleState(): {
  streamLifecycle: GrpcStreamLifecycle;
  streamMessages: [];
  lastSequence: number;
} {
  return {
    streamLifecycle: 'idle',
    streamMessages: [],
    lastSequence: 0,
  };
}
