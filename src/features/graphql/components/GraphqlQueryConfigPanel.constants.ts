import type { GraphqlAuth } from '@shared/types/graphql';
import type { GraphqlOutputBinding } from '@workflow/types/workflow';

export const OUTPUT_FIELD_OPTIONS: GraphqlOutputBinding['field'][] = [
  'data', 'errors', 'latencyMs', 'httpStatus', 'operationName',
];

export const GQL_WF_AUTH_TYPE_OPTIONS: Array<{
  value: GraphqlAuth['type'] | 'none';
  label: string;
  disabled?: boolean;
}> = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apiKey', label: 'API Key' },
  { value: 'custom', label: 'Custom Header' },
];

export function makeHeaderId(): string {
  return Math.random().toString(36).slice(2, 10);
}
