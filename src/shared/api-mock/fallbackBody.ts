/**
 * Fallback / ambiguity response bodies are static settings, not response
 * variants, so they never went through the template engine — `{{requestId}}`
 * was served literally. These bodies support a tiny fixed placeholder set.
 */

export interface FallbackTemplateVars {
  /** Correlation id — must equal the journal transaction id for the request. */
  requestId: string;
  /** Number of rules that tied, for the ambiguity response. */
  competingRuleCount?: number;
}

const PLACEHOLDER = /\{\{\s*(requestId|competingRuleCount)\s*\}\}/g;

export function renderFallbackBody(body: string, vars: FallbackTemplateVars): string {
  if (!body.includes('{{')) return body;
  return body.replace(PLACEHOLDER, (_m, name: string) =>
    name === 'requestId' ? vars.requestId : String(vars.competingRuleCount ?? 0));
}

/**
 * `candidates` is every evaluated rule. The ambiguity template wants how many
 * actually matched — otherwise an 8-rule library reports `competingRules: 8`
 * for a 2-rule collision.
 */
export function countCompetingRules(explanation?: {
  policyDecision?: { matchedCount?: number };
  candidates?: Array<{ overallMatch?: boolean }>;
}): number {
  const matched = explanation?.policyDecision?.matchedCount;
  if (typeof matched === 'number') return matched;
  return explanation?.candidates?.filter(c => c.overallMatch).length ?? 0;
}

/** Journal ids and fallback correlation ids come from here so they always match. */
export function newTransactionId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
