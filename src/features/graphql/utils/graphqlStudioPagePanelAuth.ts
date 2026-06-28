/**
 * Auth panel scope helpers for GraphqlStudioPage — page-default vs tab/profile auth.
 */
import type { GraphqlAuth } from '../../../shared/types/graphql';

export function resolveUsesPageDefaultAuth(
  tabsLength: number,
  hasActiveTabAuthOverride: boolean,
  hasActiveTabProfileLink: boolean,
): boolean {
  return tabsLength === 1 && !hasActiveTabAuthOverride && !hasActiveTabProfileLink;
}

export function resolveStoredAuthForPanel(
  usesPageDefaultAuth: boolean,
  pageAuth: GraphqlAuth | null,
  tabAuthDefined: boolean,
  tabAuth: GraphqlAuth | null | undefined,
  linkedProfileAuth: GraphqlAuth | null | undefined,
): GraphqlAuth | null | undefined {
  if (usesPageDefaultAuth) return pageAuth;
  if (tabAuthDefined) return tabAuth;
  return linkedProfileAuth;
}
