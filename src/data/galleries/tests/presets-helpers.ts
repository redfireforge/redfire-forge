/**
 * Shared builder helpers for test gallery preset factories.
 */

import type {
  FeatureGroup,
  Scenario,
  Assertion,
  TestScenario,
  ScenarioActionType,
  WsConnectActionConfig,
  WsSendActionConfig,
  WsReceiveActionConfig,
  GrpcHarnessCallActionConfig,
} from '@shared/types';

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
  /** Transport action type for non-HTTP protocols (ws, gRPC). */
  actionType?: ScenarioActionType;
  wsConnectAction?: WsConnectActionConfig;
  wsSendAction?: WsSendActionConfig;
  wsReceiveAction?: WsReceiveActionConfig;
  grpcCallAction?: GrpcHarnessCallActionConfig;
}): Scenario {
  const base: Scenario = {
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
  if (partial.actionType !== undefined) base.actionType = partial.actionType;
  if (partial.wsConnectAction !== undefined) base.wsConnectAction = partial.wsConnectAction;
  if (partial.wsSendAction !== undefined) base.wsSendAction = partial.wsSendAction;
  if (partial.wsReceiveAction !== undefined) base.wsReceiveAction = partial.wsReceiveAction;
  if (partial.grpcCallAction !== undefined) base.grpcCallAction = partial.grpcCallAction;
  return base;
}

export type { FeatureGroup };
