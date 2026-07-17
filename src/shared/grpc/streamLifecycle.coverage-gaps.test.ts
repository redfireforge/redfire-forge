import { describe, expect, it } from 'vitest';
import {
  assertGrpcStreamLifecycleTransition,
  canTransitionGrpcStreamLifecycle,
  createInitialStreamLifecycleState,
  isGrpcStreamLifecycleInFlight,
  isGrpcStreamLifecycleTerminal,
} from './streamLifecycle';

describe('streamLifecycle coverage gaps', () => {
  it('allows no-op transitions to the same lifecycle state', () => {
    expect(canTransitionGrpcStreamLifecycle('streaming', 'streaming')).toBe(true);
    expect(canTransitionGrpcStreamLifecycle('ended', 'ended')).toBe(true);
  });

  it('rejects transitions from unknown lifecycle keys', () => {
    expect(canTransitionGrpcStreamLifecycle('unknown' as 'idle', 'starting')).toBe(false);
  });

  it('classifies ending as in-flight but not terminal', () => {
    expect(isGrpcStreamLifecycleInFlight('ending')).toBe(true);
    expect(isGrpcStreamLifecycleTerminal('ending')).toBe(false);
    expect(isGrpcStreamLifecycleTerminal('error')).toBe(true);
  });

  it('classifies cancelled as terminal and idle as not in-flight', () => {
    expect(isGrpcStreamLifecycleTerminal('cancelled')).toBe(true);
    expect(isGrpcStreamLifecycleInFlight('cancelled')).toBe(false);
    expect(isGrpcStreamLifecycleInFlight('idle')).toBe(false);
  });

  it('rejects terminal-to-terminal transitions and accepts same-state no-op on idle', () => {
    expect(canTransitionGrpcStreamLifecycle('error', 'ended')).toBe(false);
    expect(canTransitionGrpcStreamLifecycle('idle', 'idle')).toBe(true);
  });

  it('createInitialStreamLifecycleState seeds an empty stream message array', () => {
    const state = createInitialStreamLifecycleState();
    expect(Array.isArray(state.streamMessages)).toBe(true);
    expect(state.streamMessages).toHaveLength(0);
  });

  it('assertGrpcStreamLifecycleTransition throws for terminal restart attempts', () => {
    expect(() => assertGrpcStreamLifecycleTransition('cancelled', 'starting')).toThrow(/cancelled → starting/);
  });
});
