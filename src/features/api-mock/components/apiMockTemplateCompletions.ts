/**
 * Monaco `{{` completion items for API Mock response templates.
 */
import { FAKER_HELPER_PATHS } from '@shared/api-mock/templateFaker';

export interface MockTemplateCompletion {
  label: string;
  insert: string;
  detail: string;
}

export const MOCK_TEMPLATE_COMPLETIONS: MockTemplateCompletion[] = [
  { label: 'uuid', insert: 'uuid}}', detail: 'Random UUID v4' },
  { label: 'now', insert: 'now}}', detail: 'ISO-8601 timestamp from the template clock' },
  { label: 'pathParam', insert: "pathParam 'id'}}", detail: 'Named path parameter' },
  { label: 'query', insert: "query 'q'}}", detail: 'Query string value' },
  { label: 'header', insert: "header 'x-tenant'}}", detail: 'Request header' },
  { label: 'cookie', insert: "cookie 'session'}}", detail: 'Request cookie' },
  { label: 'state', insert: "state 'flow'}}", detail: 'Scenario state' },
  { label: 'counter', insert: "counter 'hits'}}", detail: 'Scenario counter' },
  { label: 'randomInt', insert: "randomInt '1' '100'}}", detail: 'Integer in range (seeded when seed is set)' },
  { label: 'oneOf', insert: "oneOf 'a' 'b'}}", detail: 'Pick one value' },
  { label: 'repeat', insert: "repeat '3' 'ab'}}", detail: 'Repeat a string' },
  { label: 'base64', insert: "base64 'hello'}}", detail: 'Base64 encode (or decode)' },
  { label: 'jsonPath', insert: "jsonPath '$.user.name'}}", detail: 'JSONPath against the request body' },
  { label: 'request.method', insert: 'request.method}}', detail: 'HTTP method' },
  { label: 'request.path', insert: 'request.path}}', detail: 'Request path' },
  { label: 'requestId', insert: 'requestId}}', detail: 'Transaction request id' },
  ...FAKER_HELPER_PATHS.map(path => ({
    label: `faker ${path}`,
    insert: `faker '${path}'}}`,
    detail: `Faker subset · ${path}`,
  })),
];

/** Completions whose insert text should replace the `{{` prefix already typed. */
export function mockTemplateCompletionsForPrefix(prefix: string): MockTemplateCompletion[] {
  const q = prefix.trim().toLowerCase();
  if (!q) return MOCK_TEMPLATE_COMPLETIONS;
  // Every insert ends with `}}`, so a typed `}` would otherwise match the whole catalog.
  if (/^}+$/.test(q)) return [];
  return MOCK_TEMPLATE_COMPLETIONS.filter(item => (
    item.label.toLowerCase().includes(q) || item.insert.toLowerCase().includes(q)
  ));
}
