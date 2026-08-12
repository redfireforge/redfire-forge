import { describe, it, expect } from 'vitest';
import { createInitialState, getState, getCounter, applyTransition, resetState } from './scenarioRuntime';

describe('scenarioRuntime', () => {
  it('starts with empty state', () => {
    const s = createInitialState();
    expect(getState(s, 'flow')).toBe('');
    expect(getCounter(s, 'hits')).toBe(0);
  });

  it('applies a transition', () => {
    const s = createInitialState();
    const result = applyTransition(s, 'flow', { targetState: 'active' });
    expect(result.applied).toBe(true);
    expect(result.newState).toBe('active');
    expect(getState(s, 'flow')).toBe('active');
  });

  it('guards on currentState', () => {
    const s = createInitialState();
    applyTransition(s, 'flow', { targetState: 'active' });
    const result = applyTransition(s, 'flow', { currentState: 'inactive', targetState: 'done' });
    expect(result.applied).toBe(false);
    expect(result.reason).toContain('Guard failed');
    expect(getState(s, 'flow')).toBe('active');
  });

  it('applies counter updates', () => {
    const s = createInitialState();
    applyTransition(s, 'flow', { targetState: 'a', counterUpdates: [{ key: 'hits', delta: 1 }] });
    expect(getCounter(s, 'hits')).toBe(1);
    applyTransition(s, 'flow', { targetState: 'b', counterUpdates: [{ key: 'hits', delta: 3 }] });
    expect(getCounter(s, 'hits')).toBe(4);
  });

  it('resets all state', () => {
    const s = createInitialState();
    applyTransition(s, 'flow', { targetState: 'active', counterUpdates: [{ key: 'n', delta: 5 }] });
    resetState(s);
    expect(getState(s, 'flow')).toBe('');
    expect(getCounter(s, 'n')).toBe(0);
  });

  it('handles multiple independent state keys', () => {
    const s = createInitialState();
    applyTransition(s, 'auth', { targetState: 'logged_in' });
    applyTransition(s, 'order', { targetState: 'pending' });
    expect(getState(s, 'auth')).toBe('logged_in');
    expect(getState(s, 'order')).toBe('pending');
  });

  it('guard passes when currentState matches', () => {
    const s = createInitialState();
    applyTransition(s, 'flow', { targetState: 'step1' });
    const result = applyTransition(s, 'flow', { currentState: 'step1', targetState: 'step2' });
    expect(result.applied).toBe(true);
    expect(getState(s, 'flow')).toBe('step2');
  });
});
