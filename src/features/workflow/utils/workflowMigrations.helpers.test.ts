import { describe, it, expect } from 'vitest';
import {
  applyServiceIdsFromOrphanMap,
  commonLabelPrefix,
  deriveServiceNameFromLabel,
  extractUrlOrigin,
} from './workflowMigrations';
import type { HttpNodeData, WorkflowNode } from '../types/workflow';

function minimalHttpData(label: string): HttpNodeData {
  return {
    label,
    scenario: {
      id: 's',
      name: 's',
      url: '/',
      method: 'GET',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { mode: 'none' },
    },
  };
}

function httpWorkflowNode(id: string, data: HttpNodeData): WorkflowNode {
  return { id, type: 'http', position: { x: 0, y: 0 }, data };
}

describe('applyServiceIdsFromOrphanMap', () => {
  it('leaves http node unchanged when map has no service for that id', () => {
    const node = httpWorkflowNode('n1', minimalHttpData('L'));
    const out = applyServiceIdsFromOrphanMap([node], new Map());
    expect(out[0]).toBe(node);
  });

  it('assigns serviceId when map has an entry', () => {
    const node = httpWorkflowNode('n1', minimalHttpData('L'));
    const m = new Map<string, string>([['n1', 'svc-99']]);
    const out = applyServiceIdsFromOrphanMap([node], m);
    expect((out[0].data as HttpNodeData).serviceId).toBe('svc-99');
  });

  it('passes through non-http nodes', () => {
    const cond: WorkflowNode = {
      id: 'c1',
      type: 'condition',
      position: { x: 0, y: 0 },
      data: { label: 'If', left: '1', operator: '==', right: '2' },
    };
    expect(applyServiceIdsFromOrphanMap([cond], new Map())[0]).toBe(cond);
  });

  it('returns same node when serviceId already set', () => {
    const data = { ...minimalHttpData('X'), serviceId: 'existing' };
    const node = httpWorkflowNode('n1', data);
    const out = applyServiceIdsFromOrphanMap([node], new Map([['n1', 'other']]));
    expect(out[0]).toBe(node);
  });
});

describe('extractUrlOrigin', () => {
  it('returns null for empty input', () => {
    expect(extractUrlOrigin('')).toBeNull();
  });

  it('returns null for template-prefixed url', () => {
    expect(extractUrlOrigin('{{base}}/x')).toBeNull();
  });

  it('returns null for non-http(s) scheme', () => {
    expect(extractUrlOrigin('ftp://host/x')).toBeNull();
  });

  it('returns null for whitespace-only url', () => {
    expect(extractUrlOrigin('   ')).toBeNull();
  });

  it('parses normal https URL', () => {
    expect(extractUrlOrigin('https://api.example.com/v1')).toBe('https://api.example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(extractUrlOrigin('  https://x.test  ')).toBe('https://x.test');
  });

  it('returns null when URL constructor throws and regex does not match host', () => {
    expect(extractUrlOrigin('https://')).toBeNull();
  });

  it('uses regex fallback when URL throws but origin prefix matches', () => {
    expect(extractUrlOrigin('http://example.com:bad/path')).toBe('http://example.com:bad');
  });
});

describe('deriveServiceNameFromLabel', () => {
  it('strips trailing method suffix', () => {
    expect(deriveServiceNameFromLabel('Users - GET')).toBe('Users');
  });

  it('returns original when suffix uses lowercase method token', () => {
    expect(deriveServiceNameFromLabel('Users - get')).toBe('Users - get');
  });
});

describe('commonLabelPrefix', () => {
  it('returns empty string for no labels', () => {
    expect(commonLabelPrefix([])).toBe('');
  });

  it('uses deriveServiceNameFromLabel for a single label', () => {
    expect(commonLabelPrefix(['Svc - POST'])).toBe('Svc');
  });

  it('returns shared prefix after trimming trailing punctuation', () => {
    expect(commonLabelPrefix(['Acme – A', 'Acme – B'])).toBe('Acme');
  });

  it('falls back to first label derivation when prefix empties', () => {
    expect(commonLabelPrefix(['Zeta', 'Alpha'])).toBe('Zeta');
  });

  it('handles hyphen-heavy shared prefixes', () => {
    expect(commonLabelPrefix(['--A', '--B'])).toBe('-');
  });
});
