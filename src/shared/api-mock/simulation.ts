/**
 * API Mock Studio — side-effect-free simulation engine (Phase 1F).
 */
import type {
  ApiMockRouteV1,
  ApiMockServerSettingsV1,
  ApiMockSimulationSampleV1,
  ApiMockSimulationResultV1,
} from './contracts';
import { selectRoute } from './routeSelector';
import { DEFAULT_SETTINGS } from './defaults';

export interface SimulationInput {
  routes: ApiMockRouteV1[];
  settings?: Partial<ApiMockServerSettingsV1>;
  basePath?: string;
  generation?: number;
}

export function simulateSingle(
  sample: ApiMockSimulationSampleV1,
  input: SimulationInput,
): ApiMockSimulationResultV1 {
  const settings = mergeSettings(input.settings);
  const result = selectRoute(input.routes, sample.request, settings, input.basePath ?? '');
  const passed = sample.expected ? checkExpectations(sample.expected, result) : undefined;
  return {
    sampleId: sample.id,
    generation: input.generation ?? 'draft',
    passed,
    outcome: result.outcome,
    trace: result.explanation,
  };
}

export function simulateBatch(
  samples: ApiMockSimulationSampleV1[],
  input: SimulationInput,
): ApiMockSimulationResultV1[] {
  return samples.map(s => simulateSingle(s, input));
}

function checkExpectations(
  expected: NonNullable<ApiMockSimulationSampleV1['expected']>,
  result: ReturnType<typeof selectRoute>,
): boolean {
  if (expected.outcome && expected.outcome !== result.outcome) return false;
  if (expected.routeId && expected.routeId !== result.selectedRouteId) return false;
  if (expected.responseId && expected.responseId !== result.selectedResponseId) return false;
  if (expected.status != null) {
    const actualStatus = result.explanation.policyDecision.outcome === 'matched'
      ? undefined
      : result.explanation.policyDecision.outcome === 'ambiguous' ? 409 : 404;
    if (actualStatus != null && actualStatus !== expected.status) return false;
  }
  return true;
}

function mergeSettings(partial?: Partial<ApiMockServerSettingsV1>): ApiMockServerSettingsV1 {
  if (!partial) return DEFAULT_SETTINGS;
  return {
    selection: partial.selection ?? DEFAULT_SETTINGS.selection,
    fallback: partial.fallback ?? DEFAULT_SETTINGS.fallback,
    cors: partial.cors ?? DEFAULT_SETTINGS.cors,
    limits: partial.limits ?? DEFAULT_SETTINGS.limits,
    journal: partial.journal ?? DEFAULT_SETTINGS.journal,
    redaction: partial.redaction ?? DEFAULT_SETTINGS.redaction,
  };
}
