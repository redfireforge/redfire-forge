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
    if (!scenario.wsSendAction.connectionRef && !scenario.wsSendAction.url?.trim()) {
      errors.push('wsSendAction requires either connectionRef or url');
    }
    return errors;
  }

  if (wsType === 'wsReceive') {
    if (!scenario.wsReceiveAction) {
      return ['wsReceiveAction is required when actionType is "wsReceive"'];
    }
    const errors: string[] = [];
    if (!scenario.wsReceiveAction.connectionRef && !scenario.wsReceiveAction.url?.trim()) {
      errors.push('wsReceiveAction requires either connectionRef or url');
    }
    const mc = scenario.wsReceiveAction.matchCriteria;
    if (mc?.jsonPathValue !== undefined && !mc?.jsonPathMatch) {
      errors.push('wsReceiveAction.matchCriteria.jsonPathValue requires matchCriteria.jsonPathMatch to be set');
    }
    return errors;
  }

  return [];
}
