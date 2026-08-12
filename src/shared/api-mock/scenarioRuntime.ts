/**
 * API Mock Studio — scenario state and counter runtime (Phase 7A).
 * Per-server state machine with atomic transitions. Pure logic, no I/O.
 */

export interface ScenarioState {
  states: Record<string, string>;
  counters: Record<string, number>;
}

export function createInitialState(): ScenarioState {
  return { states: {}, counters: {} };
}

export function getState(scenario: ScenarioState, key: string): string {
  return scenario.states[key] ?? '';
}

export function getCounter(scenario: ScenarioState, key: string): number {
  return scenario.counters[key] ?? 0;
}

export interface TransitionRequest {
  currentState?: string;
  targetState: string;
  counterUpdates?: Array<{ key: string; delta: number }>;
}

export interface TransitionResult {
  applied: boolean;
  reason?: string;
  previousState?: string;
  newState?: string;
}

/**
 * Atomically apply a state transition. Guard on currentState if specified.
 * Returns whether the transition was applied.
 */
export function applyTransition(
  scenario: ScenarioState,
  stateKey: string,
  transition: TransitionRequest,
): TransitionResult {
  const current = scenario.states[stateKey] ?? '';

  if (transition.currentState != null && transition.currentState !== current) {
    return { applied: false, reason: `Guard failed: expected "${transition.currentState}", got "${current}"`, previousState: current };
  }

  const previousState = current;
  scenario.states[stateKey] = transition.targetState;

  if (transition.counterUpdates) {
    for (const { key, delta } of transition.counterUpdates) {
      scenario.counters[key] = (scenario.counters[key] ?? 0) + delta;
    }
  }

  return { applied: true, previousState, newState: transition.targetState };
}

export function resetState(scenario: ScenarioState): void {
  scenario.states = {};
  scenario.counters = {};
}
