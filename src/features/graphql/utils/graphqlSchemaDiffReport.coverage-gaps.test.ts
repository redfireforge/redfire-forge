import { describe, it, expect } from 'vitest';
import { escapeHtml, generateHtmlReport } from './graphqlSchemaDiffReport';
import type { GraphqlSchemaDiffResult } from '@shared/types/graphql';

const baseResult: GraphqlSchemaDiffResult = {
  changes: [],
  breakingCount: 0,
  dangerousCount: 0,
  safeCount: 0,
  deprecatedCount: 0,
};

describe('graphqlSchemaDiffReport — coverage gaps', () => {
  it('escapeHtml escapes special characters', () => {
    expect(escapeHtml('<script>&"')).toBe('&lt;script&gt;&amp;&quot;');
  });

  it('generateHtmlReport shows no-changes message when empty', () => {
    const html = generateHtmlReport(baseResult, 'Old', 'New');
    expect(html).toContain('No changes');
  });

  it('generateHtmlReport renders all criticality pills and acknowledged note', () => {
    const result: GraphqlSchemaDiffResult = {
      changes: [
        {
          path: 'Query.user',
          description: 'Removed field',
          criticality: 'BREAKING',
          acknowledged: true,
          acknowledgeNote: 'Shipped v2',
        },
        {
          path: 'User.email',
          description: 'Nullable',
          criticality: 'DANGEROUS',
          acknowledged: false,
        },
        {
          path: 'Query.legacy',
          description: 'Deprecated',
          criticality: 'DEPRECATED',
          acknowledged: false,
        },
        {
          path: 'Query.ok',
          description: 'Added',
          criticality: 'SAFE',
          acknowledged: false,
        },
      ],
      breakingCount: 1,
      dangerousCount: 1,
      safeCount: 1,
      deprecatedCount: 1,
    };
    const html = generateHtmlReport(result, 'A <old>', 'B & new');
    expect(html).toContain('Breaking');
    expect(html).toContain('Dangerous');
    expect(html).toContain('Deprecated');
    expect(html).toContain('Safe');
    expect(html).toContain('Acknowledged');
    expect(html).toContain('Shipped v2');
    expect(html).toContain('&lt;old&gt;');
  });
});
