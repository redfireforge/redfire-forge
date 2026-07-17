import { describe, expect, it } from 'vitest';
import {
  assertGrpcStreamLifecycleTransition,
  canTransitionGrpcStreamLifecycle,
  createInitialStreamLifecycleState,
  isGrpcStreamLifecycleInFlight,
  isGrpcStreamLifecycleTerminal,
} from './streamLifecycle';

describe('streamLifecycle (Phase 2A)', () => {
  it('creates idle initial stream tab fields', () => {
    expect(createInitialStreamLifecycleState()).toEqual({
      streamLifecycle: 'idle',
      streamMessages: [],
      lastSequence: 0,
    });
  });

  it('identifies in-flight and terminal lifecycles', () => {
    expect(isGrpcStreamLifecycleInFlight('starting')).toBe(true);
    expect(isGrpcStreamLifecycleInFlight('streaming')).toBe(true);
    expect(isGrpcStreamLifecycleInFlight('idle')).toBe(false);
    expect(isGrpcStreamLifecycleTerminal('ended')).toBe(true);
    expect(isGrpcStreamLifecycleTerminal('streaming')).toBe(false);
  });

  it('allows valid lifecycle transitions', () => {
    expect(canTransitionGrpcStreamLifecycle('idle', 'starting')).toBe(true);
    expect(canTransitionGrpcStreamLifecycle('starting', 'streaming')).toBe(true);
    expect(canTransitionGrpcStreamLifecycle('streaming', 'ending')).toBe(true);
    expect(canTransitionGrpcStreamLifecycle('ending', 'ended')).toBe(true);
    expect(canTransitionGrpcStreamLifecycle('streaming', 'cancelled')).toBe(true);
  });

  it('rejects invalid lifecycle transitions', () => {
    expect(canTransitionGrpcStreamLifecycle('idle', 'streaming')).toBe(false);
    expect(canTransitionGrpcStreamLifecycle('ended', 'starting')).toBe(false);
    expect(canTransitionGrpcStreamLifecycle('cancelled', 'streaming')).toBe(false);
  });

  it('allows server streaming to end directly without an explicit ending phase', () => {
    expect(canTransitionGrpcStreamLifecycle('streaming', 'ended')).toBe(true);
  });

  it('assertGrpcStreamLifecycleTransition throws on invalid edges', () => {
    expect(() => assertGrpcStreamLifecycleTransition('idle', 'starting')).not.toThrow();
    expect(() => assertGrpcStreamLifecycleTransition('idle', 'streaming')).toThrow(
      /Invalid stream lifecycle transition: idle → streaming/,
    );
  });
});
