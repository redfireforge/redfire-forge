/**
 * Predicate operators that exist on the contract but do not evaluate yet.
 * P2 implemented JSON Schema / XML Schema / multipart / binary_sha256;
 * this list is empty so imported leaves and the Match picker stay in sync.
 */
import type { ApiMockPredicateOperator } from './contracts';

export const UNAVAILABLE_PREDICATE_OPERATORS: readonly ApiMockPredicateOperator[] = [];

export function isUnavailablePredicateOperator(operator: string): boolean {
  return (UNAVAILABLE_PREDICATE_OPERATORS as readonly string[]).includes(operator);
}
