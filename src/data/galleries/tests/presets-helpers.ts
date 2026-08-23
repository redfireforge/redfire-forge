/**
 * Shared builder helpers for test gallery preset factories.
 */

import type { FeatureGroup, Scenario, Assertion, TestScenario } from '@shared/types';

export const noAuth = { type: 'none' as const };

export function ts(partial: Omit<TestScenario, 'kind'>): TestScenario {
  return { ...partial, kind: 'standard' };
}

export function s(partial: Pick<Scenario, 'id' | 'name' | 'url' | 'method'> & {
  assertions?: Assertion[];
  body?: string;
  bodyType?: Scenario['bodyType'];
  headers?: Scenario['headers'];
  extractions?: Scenario['extractions'];
  sampleJson?: string;
}): Scenario {
  return {
    headers: partial.headers ?? [],
    body: partial.body ?? '',
    bodyType: partial.bodyType,
    auth: noAuth,
    extractions: partial.extractions,
    validation: {
      mode: partial.assertions ? 'full' : 'none',
      assertions: partial.assertions,
      sampleJson: partial.sampleJson,
    },
    id: partial.id,
    name: partial.name,
    url: partial.url,
    method: partial.method,
  };
}

export type { FeatureGroup };
