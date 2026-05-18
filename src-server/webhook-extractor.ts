import type { WebhookTriggerNodeData } from '../src/features/workflow/types/workflow';

/**
 * Extract variables from webhook request using JSONPath.
 * Supports extracting from body, headers, and query params.
 */
export function extractWebhookVariables(
  extractConfig: WebhookTriggerNodeData['extractVariables'],
  request: {
    body: unknown;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[] | undefined>;
  }
): Record<string, unknown> {
  if (!extractConfig || extractConfig.length === 0) {
    return {};
  }

  const extracted: Record<string, unknown> = {};

  for (const { name, jsonPath } of extractConfig) {
    try {
      const value = evaluateJsonPath(jsonPath, request);
      if (value !== undefined) {
        extracted[name] = value;
      }
    } catch (error) {
      console.warn(`Failed to extract variable "${name}" with JSONPath "${jsonPath}":`, error);
    }
  }

  return extracted;
}

/**
 * Simple JSONPath evaluator (supports basic paths like $.body.orderId, $.headers.x-user-id, $.query.page)
 * If path doesn't start with body/headers/query, it defaults to extracting from body (e.g., $.userId → $.body.userId)
 */
function evaluateJsonPath(path: string, data: unknown): unknown {
  // Remove leading $. if present
  let cleanPath = path.replace(/^\$\.?/, '');
  
  if (!cleanPath) {
    return data;
  }

  // If path doesn't start with body/headers/query, default to body
  if (!cleanPath.startsWith('body') && !cleanPath.startsWith('headers') && !cleanPath.startsWith('query')) {
    cleanPath = `body.${cleanPath}`;
  }

  // Split path by dots and brackets
  const parts = cleanPath.split(/\.|\[|\]/).filter(Boolean);
  
  // Prevent prototype pollution / internal property access
  const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  let current: unknown = data;
  
  for (const part of parts) {
    // Remove quotes from string keys
    const key = part.replace(/^['"]|['"]$/g, '');
    
    if (BLOCKED_KEYS.has(key)) {
      return undefined;
    }

    if (current == null) {
      return undefined;
    }
    
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}
