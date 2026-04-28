/**
 * Webhook payload validation.
 *
 * Provides:
 * - Webhook filter expression evaluation (e.g. "{{webhook.type}} == payment")
 * - JSON schema-like validation for webhook payloads
 * - Pre-validation before resuming a workflow
 */

// ── Types ────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ── Webhook Filter Expression Evaluation ─────────────

/**
 * Evaluate a webhook filter expression against a webhook payload.
 *
 * Supported expressions:
 * - "{{field}} == value"       — equality check
 * - "{{field}} != value"       — inequality check
 * - "{{field}} contains value" — substring/includes check
 * - "{{field}} exists"         — field existence check
 * - "{{field}} > number"       — numeric greater-than
 * - "{{field}} < number"       — numeric less-than
 * - "{{field}} >= number"      — numeric greater-or-equal
 * - "{{field}} <= number"      — numeric less-or-equal
 * - Multiple expressions joined by " && " (all must be true)
 * - Multiple expressions joined by " || " (any must be true)
 *
 * Field paths use dot notation: {{webhook.data.type}} → payload.data.type
 */
export function evaluateWebhookFilter(
  filter: string,
  payload: Record<string, unknown>,
): ValidationResult {
  if (!filter || filter.trim().length === 0) {
    return { valid: true };
  }

  const trimmed = filter.trim();

  // Handle OR expressions (lower precedence)
  if (trimmed.includes(' || ')) {
    const parts = splitTopLevel(trimmed, ' || ');
    for (const part of parts) {
      const result = evaluateWebhookFilter(part.trim(), payload);
      if (result.valid) return { valid: true };
    }
    return { valid: false, reason: `No OR condition matched: ${trimmed}` };
  }

  // Handle AND expressions (higher precedence)
  if (trimmed.includes(' && ')) {
    const parts = splitTopLevel(trimmed, ' && ');
    for (const part of parts) {
      const result = evaluateWebhookFilter(part.trim(), payload);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  // Single expression
  return evaluateSingleExpression(trimmed, payload);
}

/**
 * Split a string by a delimiter, but only at the top level (not inside {{ }}).
 */
function splitTopLevel(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{' && str[i + 1] === '{') {
      depth++;
      current += '{{';
      i++;
    } else if (str[i] === '}' && str[i + 1] === '}') {
      depth--;
      current += '}}';
      i++;
    } else if (depth === 0 && str.slice(i, i + delimiter.length) === delimiter) {
      parts.push(current);
      current = '';
      i += delimiter.length - 1;
    } else {
      current += str[i];
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Evaluate a single filter expression.
 */
function evaluateSingleExpression(
  expr: string,
  payload: Record<string, unknown>,
): ValidationResult {
  // Extract field reference: {{field.path}}
  const fieldMatch = expr.match(/\{\{([^}]+)\}\}/);
  if (!fieldMatch) {
    return { valid: false, reason: `Invalid expression (no field reference): ${expr}` };
  }

  const fieldPath = fieldMatch[1].trim();
  const fieldValue = resolveFieldPath(fieldPath, payload);
  const afterField = expr.slice(fieldMatch.index! + fieldMatch[0].length).trim();

  // "exists" operator
  if (afterField === 'exists') {
    return fieldValue !== undefined
      ? { valid: true }
      : { valid: false, reason: `Field "${fieldPath}" does not exist` };
  }

  // Parse operator and expected value
  const operatorMatch = afterField.match(/^(==|!=|>=|<=|>|<|contains)\s+(.+)$/);
  if (!operatorMatch) {
    return { valid: false, reason: `Invalid operator in expression: ${expr}` };
  }

  const operator = operatorMatch[1];
  const expectedRaw = operatorMatch[2].trim();
  // Remove surrounding quotes if present
  const expected = expectedRaw.replace(/^["']|["']$/g, '');

  if (fieldValue === undefined) {
    return { valid: false, reason: `Field "${fieldPath}" not found in payload` };
  }

  const actual = String(fieldValue);

  switch (operator) {
    case '==':
      return actual === expected
        ? { valid: true }
        : { valid: false, reason: `${fieldPath}: "${actual}" != "${expected}"` };
    case '!=':
      return actual !== expected
        ? { valid: true }
        : { valid: false, reason: `${fieldPath}: "${actual}" == "${expected}" (expected !=)` };
    case 'contains':
      return actual.includes(expected)
        ? { valid: true }
        : { valid: false, reason: `${fieldPath}: "${actual}" does not contain "${expected}"` };
    case '>':
      return Number(actual) > Number(expected)
        ? { valid: true }
        : { valid: false, reason: `${fieldPath}: ${actual} is not > ${expected}` };
    case '<':
      return Number(actual) < Number(expected)
        ? { valid: true }
        : { valid: false, reason: `${fieldPath}: ${actual} is not < ${expected}` };
    case '>=':
      return Number(actual) >= Number(expected)
        ? { valid: true }
        : { valid: false, reason: `${fieldPath}: ${actual} is not >= ${expected}` };
    case '<=':
      return Number(actual) <= Number(expected)
        ? { valid: true }
        : { valid: false, reason: `${fieldPath}: ${actual} is not <= ${expected}` };
    default:
      return { valid: false, reason: `Unknown operator: ${operator}` };
  }
}

/**
 * Resolve a dot-notation field path against a payload object.
 * Strips the "webhook." prefix if present (so "webhook.type" and "type" both work).
 */
function resolveFieldPath(path: string, payload: Record<string, unknown>): unknown {
  // Strip "webhook." prefix
  const cleanPath = path.startsWith('webhook.') ? path.slice(8) : path;
  const parts = cleanPath.split('.');

  let current: unknown = payload;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── Payload Structure Validation ─────────────────────

/**
 * Validate that a webhook payload has expected structure.
 * Uses a simple schema: list of required fields and optional type checks.
 */
export interface PayloadFieldRule {
  /** Dot-notation field path. */
  path: string;
  /** Whether the field is required (default true). */
  required?: boolean;
  /** Expected type: 'string' | 'number' | 'boolean' | 'object' | 'array'. */
  type?: string;
}

/**
 * Validate a webhook payload against field rules.
 */
export function validatePayloadStructure(
  payload: Record<string, unknown>,
  rules: PayloadFieldRule[],
): ValidationResult {
  for (const rule of rules) {
    const value = resolveFieldPath(rule.path, payload);
    const required = rule.required !== false; // default true

    if (value === undefined) {
      if (required) {
        return { valid: false, reason: `Required field "${rule.path}" is missing` };
      }
      continue; // optional and missing — ok
    }

    if (rule.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        return {
          valid: false,
          reason: `Field "${rule.path}" expected type "${rule.type}" but got "${actualType}"`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Combined pre-validation: filter expression + required correlation ID field.
 * This is the main entry point for validating a webhook before resume.
 */
export function preValidateWebhook(
  payload: Record<string, unknown>,
  webhookFilter: string | undefined,
  correlationId: string | undefined,
): ValidationResult {
  // Must have a correlation ID in the payload or it was already extracted
  if (correlationId === undefined) {
    return { valid: false, reason: 'No correlation ID could be extracted from the webhook' };
  }

  // Evaluate filter expression
  if (webhookFilter) {
    const filterResult = evaluateWebhookFilter(webhookFilter, payload);
    if (!filterResult.valid) {
      return { valid: false, reason: `Webhook filter rejected: ${filterResult.reason}` };
    }
  }

  return { valid: true };
}
