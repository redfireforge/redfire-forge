import type { WebhookTriggerNodeData } from '../src/types/workflow.js';

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
 * For more complex JSONPath, consider using a library like jsonpath-plus.
 */
function evaluateJsonPath(path: string, data: unknown): unknown {
  // Remove leading $. if present
  const cleanPath = path.replace(/^\$\.?/, '');
  
  if (!cleanPath) {
    return data;
  }

  // Split path by dots and brackets
  const parts = cleanPath.split(/\.|\[|\]/).filter(Boolean);
  
  let current: any = data;
  
  for (const part of parts) {
    // Remove quotes from string keys
    const key = part.replace(/^['"]|['"]$/g, '');
    
    if (current == null) {
      return undefined;
    }
    
    current = current[key];
  }
  
  return current;
}
