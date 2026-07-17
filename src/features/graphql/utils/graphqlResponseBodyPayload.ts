import type { GraphqlResponse } from '../../../shared/types/graphql';

export interface GraphqlResponseBodyPayloadOptions {
  /** When true, omit `extensions` from the serialized body (data + errors only). */
  dataOnly?: boolean;
}

/** Builds the JSON object shown in the Body tab and copied via Copy. */
export function buildGraphqlResponseBodyPayload(
  response: GraphqlResponse,
  options: GraphqlResponseBodyPayloadOptions = {},
): Record<string, unknown> {
  const { dataOnly = false } = options;
  const payload: Record<string, unknown> = {};
  if (response.data !== undefined) payload.data = response.data;
  if (response.errors && response.errors.length > 0) payload.errors = response.errors;
  if (!dataOnly && response.extensions) payload.extensions = response.extensions;
  return payload;
}

/** Pretty-prints the response body for display/copy; returns empty string when response is null. */
export function serializeGraphqlResponseBody(
  response: GraphqlResponse | null,
  options: GraphqlResponseBodyPayloadOptions = {},
): string {
  if (!response) return '';
  const payload = buildGraphqlResponseBodyPayload(response, options);
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return '// Could not serialize response body — it may contain non-JSON values';
  }
}
