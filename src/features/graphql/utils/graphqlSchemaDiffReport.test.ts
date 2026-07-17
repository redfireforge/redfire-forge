import { describe, it, expect } from 'vitest';
import { escapeHtml, generateHtmlReport } from './graphqlSchemaDiffReport';
import type { GraphqlSchemaDiffResult } from '../../../shared/types/graphql';

const baseResult: GraphqlSchemaDiffResult = {
  changes: [
    {
      path: 'Query.oldField',
      description: 'Removed field',
      criticality: 'BREAKING',
      acknowledged: false,
    },
    {
      path: 'Query.newField',
      description: 'Added field',
      criticality: 'SAFE',
      acknowledged: true,
      acknowledgeNote: 'Shipped in v2',
    },
    {
      path: 'User.email',
      description: 'Type changed',
      criticality: 'DANGEROUS',
      acknowledged: false,
    },
    {
      path: 'Order.status',
      description: 'Deprecated',
      criticality: 'DEPRECATED',
      acknowledged: true,
    },
  ],
  summary: { breaking: 1, safe: 1, dangerous: 1, deprecated: 1 },
};

describe('graphqlSchemaDiffReport', () => {
  it('escapeHtml encodes special characters', () => {
    expect(escapeHtml('<script>"&"</script>')).toBe('&lt;script&gt;&quot;&amp;&quot;&lt;/script&gt;');
  });

  it('generateHtmlReport includes all criticality colors and ack notes', () => {
    const html = generateHtmlReport(baseResult, 'Old', 'New');
    expect(html).toContain('BREAKING');
    expect(html).toContain('DANGEROUS');
    expect(html).toContain('DEPRECATED');
    expect(html).toContain('Shipped in v2');
    expect(html).toContain('Query.oldField');
    expect(html).toContain('Schema Diff: Old → New');
  });

  it('generateHtmlReport omits ack note span when note is absent', () => {
    const html = generateHtmlReport(
      {
        ...baseResult,
        changes: [{ ...baseResult.changes[3]!, acknowledgeNote: undefined }],
      },
      'A',
      'B',
    );
    expect(html).toContain('✓ Acknowledged');
    expect(html).not.toContain('Acknowledged:');
  });
});
