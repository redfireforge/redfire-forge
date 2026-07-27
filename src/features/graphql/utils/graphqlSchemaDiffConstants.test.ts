import { describe, it, expect } from 'vitest';
import { SEVERITY_CSS, SEVERITY_LABEL, ackSectionChangeRowNoop } from './graphqlSchemaDiffConstants';

describe('graphqlSchemaDiffConstants', () => {
  it('exports SEVERITY_CSS with all criticality keys', () => {
    expect(SEVERITY_CSS.BREAKING).toBe('gql-diff-badge--breaking');
    expect(SEVERITY_CSS.DANGEROUS).toBe('gql-diff-badge--dangerous');
    expect(SEVERITY_CSS.SAFE).toBe('gql-diff-badge--safe');
    expect(SEVERITY_CSS.DEPRECATED).toBe('gql-diff-badge--deprecated');
  });

  it('exports SEVERITY_LABEL with all criticality keys', () => {
    expect(SEVERITY_LABEL.BREAKING).toBe('Breaking');
    expect(SEVERITY_LABEL.SAFE).toBe('Safe');
  });

  it('ackSectionChangeRowNoop is a no-op function', () => {
    expect(ackSectionChangeRowNoop()).toBeUndefined();
  });
});
