/**
 * Mock server rule matching engine.
 * Shared between frontend (test preview) and server (runtime evaluation).
 */
import type { WsMockRule, WsMockMatch, WsMockResponse, WsMockFallbackMode } from '@shared/websocket/types';
import { tryParseJson } from '@shared/utils/helpers';

export interface RuleMatchResult {
  matched: boolean;
  rule?: WsMockRule;
  response?: WsMockResponse;
  fallback?: boolean;
}

/**
 * Evaluate a JSONPath-style match: `$.path` (existence) or `$.path=value` (equality).
 * Supports simple dot-notation paths only (e.g. `$.user.name`, `$.items[0].id`).
 */
function matchJsonPath(pattern: string, message: string): boolean {
  const parsed = tryParseJson(message);
  if (parsed === undefined) return false;

  const eqIdx = pattern.indexOf('=');
  const pathPart = eqIdx >= 0 ? pattern.slice(0, eqIdx) : pattern;
  const valuePart = eqIdx >= 0 ? pattern.slice(eqIdx + 1) : undefined;

  const segments = pathPart
    .replace(/^\$\.?/, '')
    .split(/\.|\[(\d+)\]/)
    .filter(Boolean);

  let current: unknown = parsed;
  for (const seg of segments) {
    if (current === null || current === undefined) return false;
    if (typeof current !== 'object') return false;
    current = (current as Record<string, unknown>)[seg];
  }

  if (valuePart === undefined) {
    return current !== undefined && current !== null;
  }

  if (current === null || current === undefined) return false;
  return String(current) === valuePart;
}

/**
 * Test whether a single match condition succeeds against a message.
 */
export function evaluateMatch(match: WsMockMatch, message: string): boolean {
  switch (match.type) {
    case 'any':
      return true;

    case 'exact':
      return message === match.pattern;

    case 'contains':
      return message.includes(match.pattern);

    case 'regex': {
      try {
        const re = new RegExp(match.pattern);
        return re.test(message);
      } catch {
        return false;
      }
    }

    case 'jsonpath':
      return matchJsonPath(match.pattern, message);

    default:
      return false;
  }
}

/**
 * Evaluate all rules against a message and return the first match.
 * If no rule matches, returns a fallback-based result.
 */
export function evaluateRules(
  rules: WsMockRule[],
  message: string,
  fallback: WsMockFallbackMode,
): RuleMatchResult {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (evaluateMatch(rule.match, message)) {
      return { matched: true, rule, response: rule.response };
    }
  }

  switch (fallback) {
    case 'echo':
      return {
        matched: false,
        fallback: true,
        response: { type: 'echo' },
      };
    case 'close':
      return {
        matched: false,
        fallback: true,
        response: { type: 'close', closeCode: 1000, closeReason: 'No matching rule' },
      };
    case 'ignore':
    default:
      return { matched: false, fallback: true };
  }
}

/**
 * Expand template variables in a response string.
 */
export function expandTemplate(
  template: string,
  vars: { message: string; clientId: string; counter: number },
): string {
  return template
    .replace(/\{\{message\}\}/g, vars.message)
    .replace(/\{\{clientId\}\}/g, vars.clientId)
    .replace(/\{\{counter\}\}/g, String(vars.counter))
    .replace(/\{\{timestamp\}\}/g, new Date().toISOString());
}
