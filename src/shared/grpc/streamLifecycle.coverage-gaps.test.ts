import { describe, expect, it } from 'vitest';
import {
  canTransitionGrpcStreamLifecycle,
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
});
