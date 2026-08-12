/**
 * API Mock Studio — advanced response selection (Phase 7B-7C).
 * Handles sequence, weighted, and state-gated response modes.
 */
import type { ApiMockRouteV1, ApiMockResponseVariantV1 } from './contracts';
import type { ScenarioState } from './scenarioRuntime';
import { getState } from './scenarioRuntime';

export interface SequenceState {
  positions: Record<string, number>;
}

export function createSequenceState(): SequenceState {
  return { positions: {} };
}

/** Select the next response in sequence for the given route. */
export function selectSequenceResponse(
  route: ApiMockRouteV1,
  seqState: SequenceState,
  exhaustionPolicy: 'cycle' | 'hold_last' = 'cycle',
): ApiMockResponseVariantV1 | undefined {
  const enabled = route.responses.filter(r => r.enabled);
  if (enabled.length === 0) return undefined;

  const pos = seqState.positions[route.id] ?? 0;
  const idx = exhaustionPolicy === 'cycle' ? pos % enabled.length : Math.min(pos, enabled.length - 1);
  seqState.positions[route.id] = pos + 1;
  return enabled[idx];
}

/** Reset sequence position for a specific route or all routes. */
export function resetSequence(seqState: SequenceState, routeId?: string): void {
  if (routeId) delete seqState.positions[routeId];
  else seqState.positions = {};
}

/** Select a response using weighted probability. */
export function selectWeightedResponse(
  route: ApiMockRouteV1,
  seed?: string,
): ApiMockResponseVariantV1 | undefined {
  const eligible = route.responses.filter(r => r.enabled && (r.weight ?? 0) > 0);
  if (eligible.length === 0) return undefined;

  const totalWeight = eligible.reduce((sum, r) => sum + (r.weight ?? 0), 0);
  if (totalWeight <= 0) return eligible[0];

  const roll = seed ? seededRandom(seed, 0, totalWeight - 1) : Math.floor(Math.random() * totalWeight);
  let cumulative = 0;
  for (const variant of eligible) {
    cumulative += variant.weight ?? 0;
    if (roll < cumulative) return variant;
  }
  return eligible[eligible.length - 1];
}

/** Select a response based on scenario state guards. */
export function selectStateResponse(
  route: ApiMockRouteV1,
  scenario: ScenarioState,
  stateKey: string,
): ApiMockResponseVariantV1 | undefined {
  const current = getState(scenario, stateKey);
  const enabled = route.responses.filter(r => r.enabled);
  const guarded = enabled.find(r => r.transition?.currentState === current);
  if (guarded) return guarded;
  return enabled.find(r => !r.transition?.currentState);
}

/** Check if a variant is eligible based on match count and expiry limits. */
export function isVariantEligible(
  variant: ApiMockResponseVariantV1,
  matchCount: number,
  now: Date = new Date(),
): { eligible: boolean; reason?: string } {
  if (variant.behavior.maxMatches != null && matchCount >= variant.behavior.maxMatches) {
    return { eligible: false, reason: `Match limit ${variant.behavior.maxMatches} reached` };
  }
  if (variant.behavior.expiresAt) {
    const expiry = new Date(variant.behavior.expiresAt);
    if (now >= expiry) {
      return { eligible: false, reason: `Expired at ${variant.behavior.expiresAt}` };
    }
  }
  if (variant.behavior.probability != null && variant.behavior.probability < 1) {
    const roll = Math.random();
    if (roll > variant.behavior.probability) {
      return { eligible: false, reason: `Probability ${variant.behavior.probability} not met (rolled ${roll.toFixed(3)})` };
    }
  }
  return { eligible: true };
}

function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return min + ((hash & 0x7fffffff) % (max - min + 1));
}
