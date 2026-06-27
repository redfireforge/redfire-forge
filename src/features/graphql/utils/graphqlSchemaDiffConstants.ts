import type { GraphqlSchemaDiffChange } from '../../../shared/types/graphql';

export const SEVERITY_CSS: Record<GraphqlSchemaDiffChange['criticality'], string> = {
  BREAKING:   'gql-diff-badge--breaking',
  DANGEROUS:  'gql-diff-badge--dangerous',
  SAFE:       'gql-diff-badge--safe',
  DEPRECATED: 'gql-diff-badge--deprecated',
};

export const SEVERITY_LABEL: Record<GraphqlSchemaDiffChange['criticality'], string> = {
  BREAKING:   'Breaking',
  DANGEROUS:  'Dangerous',
  SAFE:       'Safe',
  DEPRECATED: 'Deprecated',
};
