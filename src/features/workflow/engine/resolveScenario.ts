import type { Scenario, KeyValue } from '../../../shared/types';
import type { VariableContext } from './variableContext';

/**
 * Query strings are often built with `encodeURIComponent('{{name}}')` → `%7B%7Bname%7D%7D`.
 * `VariableContext.resolve` only matches literal `{{…}}`, so normalize before substitution.
 */
export function decodeUrlEncodedTemplateBraces(s: string): string {
  if (!s.includes('%7B%7B')) return s;
  return s.replace(/%7B%7B/g, '{{').replace(/%7D%7D/g, '}}');
}

/**
 * Pure preprocessor: substitutes all {{var}} placeholders in a Scenario's
 * URL, headers, body, body form values, and auth fields.
 * Returns a new Scenario — never mutates the original.
 */
export function resolveScenario(scenario: Scenario, ctx: VariableContext): Scenario {
  const r = ctx.resolve.bind(ctx);
  return {
    ...scenario,
    url: r(decodeUrlEncodedTemplateBraces(scenario.url)),
    headers: resolveKVs(scenario.headers, r),
    body: r(scenario.body),
    bodyForm: scenario.bodyForm ? resolveKVs(scenario.bodyForm, r) : scenario.bodyForm,
    auth: {
      ...scenario.auth,
      token: scenario.auth.token ? r(scenario.auth.token) : scenario.auth.token,
      apiKeyValue: scenario.auth.apiKeyValue ? r(scenario.auth.apiKeyValue) : scenario.auth.apiKeyValue,
      username: scenario.auth.username ? r(scenario.auth.username) : scenario.auth.username,
      password: scenario.auth.password ? r(scenario.auth.password) : scenario.auth.password,
      clientId: scenario.auth.clientId ? r(scenario.auth.clientId) : scenario.auth.clientId,
      clientSecret: scenario.auth.clientSecret ? r(scenario.auth.clientSecret) : scenario.auth.clientSecret,
    },
  };
}

function resolveKVs(kvs: KeyValue[], resolve: (s: string) => string): KeyValue[] {
  return kvs.map(kv => ({ key: kv.key, value: resolve(kv.value) }));
}
