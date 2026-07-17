import type {
  Scenario,
  WsActionType,
  ScenarioActionType,
  WsConnectActionConfig,
  WsSendActionConfig,
  WsReceiveActionConfig,
} from '../types';
import { isWsActionType } from '../types';

// ─── Default builders ──────────────────────────────────────────────────────────

/**
 * Returns a minimal `WsConnectActionConfig` with a URL and documented defaults.
 */
export function createDefaultWsConnectAction(url = ''): WsConnectActionConfig {
  return {
    url,
    timeoutMs: 10_000,
  };
}

/**
 * Returns a minimal `WsSendActionConfig` with documented defaults.
 */
export function createDefaultWsSendAction(message = ''): WsSendActionConfig {
  return {
    message,
    messageType: 'text',
    waitForResponse: false,
    responseTimeoutMs: 5_000,
  };
}

/**
 * Returns a minimal `WsReceiveActionConfig` with documented defaults.
 */
export function createDefaultWsReceiveAction(): WsReceiveActionConfig {
  return {
    timeoutMs: 10_000,
  };
}

// ─── Scenario normalization ────────────────────────────────────────────────────

/**
 * Ensures a Scenario object has all required fields with safe defaults.
 * Imported / manually-constructed test objects may lack `auth`, `body`, or
 * `validation`, which would crash the rendering and execution code.
 * Mutates in place and returns the same object for convenience.
 */
export function ensureScenarioDefaults(scenario: Scenario): Scenario {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const s = scenario as any;
  if (!s.auth) s.auth = { type: 'none' };
  if (s.body == null) s.body = '';
  if (!s.validation) s.validation = { mode: 'none' };
  if (!s.headers) s.headers = [];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return scenario;
}

// ─── Type guards ────────────────────────────────────────────────────────────────

/**
 * Returns `true` when the scenario uses a WebSocket transport action
 * (`'wsConnect'`, `'wsSend'`, or `'wsReceive'`).
 * Absent `actionType` is treated as `'http'` (backward-compatible default).
 */
export function isWsScenario(scenario: Scenario): boolean {
  return isWsActionType(scenario.actionType);
}

/**
 * Resolves the effective action type for a scenario.
 * Absent `actionType` returns `'http'` for backward compatibility.
 */
export function resolveWsActionType(scenario: Scenario): ScenarioActionType {
  return scenario.actionType ?? 'http';
}

/**
 * If the scenario has a WS action type, returns the specific `WsActionType`.
 * Otherwise returns `undefined`.
 */
export function getWsActionType(scenario: Scenario): WsActionType | undefined {
  return isWsActionType(scenario.actionType) ? scenario.actionType : undefined;
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates a WebSocket scenario's action configuration.
 *
 * Returns an array of human-readable error messages.
 * An empty array means the configuration is valid.
 *
 * Non-WS scenarios always return `[]`.
 */
export function validateWsActionConfig(scenario: Scenario): string[] {
  const wsType = getWsActionType(scenario);
  if (!wsType) return [];

  if (wsType === 'wsConnect') {
    if (!scenario.wsConnectAction) {
      return ['wsConnectAction is required when actionType is "wsConnect"'];
    }
    const errors: string[] = [];
    if (!scenario.wsConnectAction.url.trim()) {
      errors.push('wsConnectAction.url is required');
    }
    return errors;
  }

  if (wsType === 'wsSend') {
    if (!scenario.wsSendAction) {
      return ['wsSendAction is required when actionType is "wsSend"'];
    }
    const errors: string[] = [];
    if (!scenario.wsSendAction.connectionRef?.trim()) {
      errors.push('wsSendAction requires connectionRef (reference a wsConnect test\'s Connection ID)');
    }
    return errors;
  }

  if (wsType === 'wsReceive') {
    if (!scenario.wsReceiveAction) {
      return ['wsReceiveAction is required when actionType is "wsReceive"'];
    }
    const errors: string[] = [];
    if (!scenario.wsReceiveAction.connectionRef?.trim()) {
      errors.push('wsReceiveAction requires connectionRef (reference a wsConnect test\'s Connection ID)');
    }
    const mc = scenario.wsReceiveAction.matchCriteria;
    if (mc?.jsonPathValue !== undefined && !mc?.jsonPathMatch) {
      errors.push('wsReceiveAction.matchCriteria.jsonPathValue requires matchCriteria.jsonPathMatch to be set');
    }
    return errors;
  }

  return [];
}
