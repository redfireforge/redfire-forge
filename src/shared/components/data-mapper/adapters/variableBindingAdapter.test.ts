import { describe, it, expect } from 'vitest';
import {
  createVariableBindingAdapter,
  extractTemplateRefs,
  collectTemplateSlots,
  type VariableBinding,
  type VariableHintInput,
  type TemplateSlot,
} from './variableBindingAdapter';
import type { Mapping } from '../types';

// ─── Fixtures ──────────────────────────────────────────────

const hints: VariableHintInput[] = [
  { ref: 'orderId', label: 'Order ID', type: 'string', source: { nodeId: 'n1', nodeLabel: 'Create Order', nodeType: 'http', category: 'HTTP Steps' } },
  { ref: 'status', label: 'HTTP Status', type: 'number', source: { nodeId: 'n1', nodeLabel: 'Create Order', nodeType: 'http', category: 'HTTP Steps' } },
  { ref: 'userId', label: 'User ID', type: 'string', source: { nodeId: 'n2', nodeLabel: 'Login', nodeType: 'http', category: 'HTTP Steps' } },
  { ref: 'baseUrl', label: 'Base URL', type: 'string', source: { nodeLabel: 'Workflow', nodeType: 'workflow', category: 'Workflow' } },
];

const slots: TemplateSlot[] = [
  { ref: 'orderId', location: 'path' },
  { ref: 'userId', location: 'header', headerKey: 'X-User-Id' },
  { ref: 'baseUrl', location: 'path' },
];

function makeMappings(): Mapping[] {
  return [
    { id: 'vb-0', sourceId: 'n1', sourcePath: 'orderId', targetPath: 'orderId' },
    { id: 'vb-1', sourceId: 'n2', sourcePath: 'userId', targetPath: 'userId' },
  ];
}

// ─── extractTemplateRefs ───────────────────────────────────

describe('extractTemplateRefs', () => {
  it('extracts simple refs', () => {
    expect(extractTemplateRefs('Hello {{name}}')).toEqual(['name']);
  });

  it('extracts multiple refs', () => {
    expect(extractTemplateRefs('{{a}} and {{b}}')).toEqual(['a', 'b']);
  });

  it('skips generator refs starting with $', () => {
    expect(extractTemplateRefs('{{$uuid}} and {{name}}')).toEqual(['name']);
  });

  it('trims whitespace inside braces', () => {
    expect(extractTemplateRefs('{{  spaced  }}')).toEqual(['spaced']);
  });

  it('returns empty array for no refs', () => {
    expect(extractTemplateRefs('no refs here')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractTemplateRefs('')).toEqual([]);
  });

  it('handles node-scoped refs', () => {
    expect(extractTemplateRefs('{{node:"Step".val}}')).toEqual(['node:"Step".val']);
  });
});

// ─── collectTemplateSlots ──────────────────────────────────

describe('collectTemplateSlots', () => {
  it('collects from URL', () => {
    const result = collectTemplateSlots({ url: 'https://api.com/{{orderId}}/items' });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ ref: 'orderId', location: 'path' });
  });

  it('collects from headers', () => {
    const result = collectTemplateSlots({
      headers: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ ref: 'token', location: 'header', headerKey: 'Authorization' });
  });

  it('collects from header keys', () => {
    const result = collectTemplateSlots({
      headers: [{ key: '{{headerName}}', value: 'val' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].ref).toBe('headerName');
    expect(result[0].location).toBe('header');
  });

  it('collects from body', () => {
    const result = collectTemplateSlots({ body: '{"id": "{{itemId}}"}' });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ ref: 'itemId', location: 'body' });
  });

  it('collects from bodyForm', () => {
    const result = collectTemplateSlots({
      bodyForm: [{ key: 'name', value: '{{fullName}}' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ ref: 'fullName', location: 'bodyForm' });
  });

  it('deduplicates same ref in same location', () => {
    const result = collectTemplateSlots({
      url: '{{id}}/{{id}}',
    });
    expect(result).toHaveLength(1);
  });

  it('keeps same ref in different locations', () => {
    const result = collectTemplateSlots({
      url: '{{token}}',
      headers: [{ key: 'Auth', value: '{{token}}' }],
    });
    expect(result).toHaveLength(2);
    expect(result[0].location).toBe('path');
    expect(result[1].location).toBe('header');
  });

  it('collects from bodyForm keys', () => {
    const result = collectTemplateSlots({
      bodyForm: [{ key: '{{fieldName}}', value: 'val' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].ref).toBe('fieldName');
    expect(result[0].location).toBe('bodyForm');
  });

  it('collects template refs from both header keys and values in one header', () => {
    const result = collectTemplateSlots({
      headers: [{ key: '{{k}}', value: '{{v}}' }],
    });
    expect(result).toHaveLength(2);
    expect(result.some((s) => s.ref === 'k' && s.location === 'header' && s.headerKey === undefined)).toBe(true);
    expect(result.some((s) => s.ref === 'v' && s.location === 'header' && s.headerKey === '{{k}}')).toBe(true);
  });

  it('collects from header values with concrete header key passed through', () => {
    const result = collectTemplateSlots({
      headers: [{ key: 'X-Request-Id', value: '{{reqId}}' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ ref: 'reqId', location: 'header', headerKey: 'X-Request-Id' });
  });

  it('handles empty scenario', () => {
    expect(collectTemplateSlots({})).toEqual([]);
  });

  it('skips generator refs', () => {
    const result = collectTemplateSlots({ url: '{{$uuid}}/{{orderId}}' });
    expect(result).toHaveLength(1);
    expect(result[0].ref).toBe('orderId');
  });

  it('splits URL path refs as path and query refs as query', () => {
    const result = collectTemplateSlots({
      url: 'https://api.com/{{userId}}/orders?page={{page}}&sort={{sort}}',
    });
    expect(result).toHaveLength(3);
    expect(result.find(s => s.ref === 'userId')?.location).toBe('path');
    expect(result.find(s => s.ref === 'page')?.location).toBe('query');
    expect(result.find(s => s.ref === 'sort')?.location).toBe('query');
  });

  it('assigns path location when URL has no query string', () => {
    const result = collectTemplateSlots({
      url: 'https://api.com/{{resourceId}}/details',
    });
    expect(result).toHaveLength(1);
    expect(result[0].location).toBe('path');
  });
});

// ─── variableBindingAdapter ────────────────────────────────

describe('variableBindingAdapter', () => {
  describe('creation', () => {
    it('has correct contextId', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.contextId).toBe('variable-binding');
    });

    it('has correct category', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.category).toBe('workflow');
    });

    it('has correct title', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.title).toBe('Upstream Variables → Template Slots');
    });

    it('groups sources by producing node', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.sources.length).toBeGreaterThanOrEqual(3);
      const labels = adapter.sources.map((s) => s.label);
      expect(labels).toContain('Create Order');
      expect(labels).toContain('Login');
      expect(labels).toContain('Workflow');
    });

    it('creates fallback source when no hints', () => {
      const adapter = createVariableBindingAdapter({ variableHints: [], templateSlots: slots });
      expect(adapter.sources).toHaveLength(1);
      expect(adapter.sources[0].id).toBe('__empty__');
      expect(adapter.sources[0].label).toBe('No upstream variables');
    });

    it('uses node id as source label when nodeLabel is empty string', () => {
      const adapter = createVariableBindingAdapter({
        variableHints: [
          { ref: 'x', label: 'X', source: { nodeId: 'nid', nodeLabel: '', nodeType: 'http', category: 'HTTP Steps' } },
        ],
        templateSlots: [{ ref: 'x', location: 'path' }],
      });
      const src = adapter.sources.find((s) => s.id === 'nid');
      expect(src?.label).toBe('nid');
    });

    it('builds target fields from template slots', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.target.fields).toHaveLength(3);
      expect(adapter.target.fields![0].path).toBe('orderId');
      expect(adapter.target.fields![1].path).toBe('userId');
    });

    it('target fields include location tags from slots', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.target.fields![0].location).toBe('path');
      expect(adapter.target.fields![1].location).toBe('header');
      expect(adapter.target.fields![2].location).toBe('path');
    });

    it('target does not allow custom fields', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.target.allowCustomFields).toBe(false);
    });

    it('has target label', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.target.label).toBe('Template Slots');
    });

    it('source sampleData contains hint refs with type values', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const createOrderSrc = adapter.sources.find((s) => s.label === 'Create Order');
      expect(createOrderSrc?.sampleData).toEqual({
        orderId: 'string',
        status: 'number',
      });
    });
  });

  describe('serialize', () => {
    it('converts mappings to VariableBinding[]', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const result = adapter.serialize(makeMappings());
      expect(result).toEqual([
        { templateRef: 'orderId', boundTo: 'orderId' },
        { templateRef: 'userId', boundTo: 'userId' },
      ]);
    });

    it('uses expression over sourcePath when set', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings: Mapping[] = [
        { id: 'vb-0', sourceId: 'n1', sourcePath: 'orderId', targetPath: 'orderId', expression: 'node:"Create Order".orderId' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].boundTo).toBe('node:"Create Order".orderId');
    });

    it('returns empty array for empty mappings', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.serialize([])).toEqual([]);
    });
  });

  describe('deserialize', () => {
    it('converts VariableBinding[] to mappings', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const bindings: VariableBinding[] = [
        { templateRef: 'orderId', boundTo: 'orderId' },
        { templateRef: 'userId', boundTo: 'userId' },
      ];
      const result = adapter.deserialize(bindings);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'vb-0',
        sourceId: 'n1',
        sourcePath: 'orderId',
        targetPath: 'orderId',
      });
      expect(result[1]).toMatchObject({
        id: 'vb-1',
        sourceId: 'n2',
        sourcePath: 'userId',
        targetPath: 'userId',
      });
    });

    it('returns empty array for null input', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.deserialize(null as unknown as VariableBinding[])).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.deserialize(undefined as unknown as VariableBinding[])).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.deserialize([])).toEqual([]);
    });

    it('picks exact disambiguated path when templateRef matches full path', () => {
      const dupSlots: TemplateSlot[] = [
        { ref: 'token', location: 'path' },
        { ref: 'token', location: 'header', headerKey: 'Authorization' },
        { ref: 'orderId', location: 'path' },
      ];
      const adapter = createVariableBindingAdapter({
        variableHints: hints,
        templateSlots: dupSlots,
      });
      const bindings: VariableBinding[] = [
        { templateRef: 'token::path', boundTo: 'orderId' },
      ];
      const result = adapter.deserialize(bindings);
      expect(result[0].targetPath).toBe('token::path');
    });

    it('assigns first source id for unrecognized boundTo ref', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const bindings: VariableBinding[] = [
        { templateRef: 'orderId', boundTo: 'nonExistentVar' },
      ];
      const result = adapter.deserialize(bindings);
      // Falls back to first group key, not __unknown__
      expect(result[0].sourceId).not.toBe('__unknown__');
      expect(result[0].sourcePath).toBe('nonExistentVar');
    });

    it('generates stable sequential ids', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const bindings: VariableBinding[] = [
        { templateRef: 'a', boundTo: 'x' },
        { templateRef: 'b', boundTo: 'y' },
        { templateRef: 'c', boundTo: 'z' },
      ];
      const result = adapter.deserialize(bindings);
      expect(result.map((m) => m.id)).toEqual(['vb-0', 'vb-1', 'vb-2']);
    });
  });

  describe('round-trip', () => {
    it('serialize → deserialize preserves structure', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings = makeMappings();
      const serialized = adapter.serialize(mappings);
      const restored = adapter.deserialize(serialized);

      expect(restored).toHaveLength(mappings.length);
      for (let i = 0; i < mappings.length; i++) {
        expect(restored[i].sourcePath).toBe(mappings[i].sourcePath);
        expect(restored[i].targetPath).toBe(mappings[i].targetPath);
      }
    });

    it('deserialize → serialize preserves VariableBinding shape', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const input: VariableBinding[] = [
        { templateRef: 'orderId', boundTo: 'orderId' },
        { templateRef: 'baseUrl', boundTo: 'baseUrl' },
      ];
      const restored = adapter.deserialize(input);
      const serialized = adapter.serialize(restored);
      expect(serialized).toEqual(input);
    });
  });

  describe('disambiguation for duplicate refs', () => {
    const dupSlots: TemplateSlot[] = [
      { ref: 'token', location: 'path' },
      { ref: 'token', location: 'header', headerKey: 'Authorization' },
      { ref: 'orderId', location: 'path' },
    ];

    it('creates disambiguated target paths for same ref in different locations', () => {
      const adapter = createVariableBindingAdapter({
        variableHints: hints,
        templateSlots: dupSlots,
      });
      const paths = adapter.target.fields!.map((f) => f.path);
      expect(paths).toContain('token::path');
      expect(paths).toContain('token::header::Authorization');
      expect(paths).toContain('orderId');
    });

    it('serialize strips disambiguation suffix back to bare templateRef', () => {
      const adapter = createVariableBindingAdapter({
        variableHints: hints,
        templateSlots: dupSlots,
      });
      const mappings: Mapping[] = [
        { id: 'vb-0', sourceId: 'n1', sourcePath: 'orderId', targetPath: 'token::path' },
        { id: 'vb-1', sourceId: 'n2', sourcePath: 'userId', targetPath: 'token::header::Authorization' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].templateRef).toBe('token');
      expect(result[1].templateRef).toBe('token');
      expect(result[0].boundTo).toBe('orderId');
      expect(result[1].boundTo).toBe('userId');
    });

    it('deserialize assigns disambiguated target paths for duplicate refs', () => {
      const adapter = createVariableBindingAdapter({
        variableHints: hints,
        templateSlots: dupSlots,
      });
      const bindings: VariableBinding[] = [
        { templateRef: 'token', boundTo: 'orderId' },
        { templateRef: 'token', boundTo: 'userId' },
      ];
      const result = adapter.deserialize(bindings);
      expect(result).toHaveLength(2);
      const paths = result.map((m) => m.targetPath);
      expect(paths).toContain('token::path');
      expect(paths).toContain('token::header::Authorization');
    });

    it('round-trip preserves duplicate-ref bindings', () => {
      const adapter = createVariableBindingAdapter({
        variableHints: hints,
        templateSlots: dupSlots,
      });
      const input: VariableBinding[] = [
        { templateRef: 'token', boundTo: 'orderId' },
        { templateRef: 'token', boundTo: 'userId' },
        { templateRef: 'orderId', boundTo: 'status' },
      ];
      const mappings = adapter.deserialize(input);
      const output = adapter.serialize(mappings);
      expect(output).toHaveLength(3);
      expect(output[0]).toEqual({ templateRef: 'token', boundTo: 'orderId' });
      expect(output[1]).toEqual({ templateRef: 'token', boundTo: 'userId' });
      expect(output[2]).toEqual({ templateRef: 'orderId', boundTo: 'status' });
    });
  });

  describe('validate', () => {
    it('returns no issues for valid mappings', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const issues = adapter.validate!(makeMappings());
      expect(issues).toHaveLength(0);
    });

    it('reports error for empty template slot', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'n1', sourcePath: 'orderId', targetPath: '' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toContain('Template slot is required');
    });

    it('reports error for empty variable binding', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'n1', sourcePath: '', targetPath: 'orderId' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toContain('No variable bound');
    });

    it('warns about duplicate slot bindings', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'n1', sourcePath: 'orderId', targetPath: 'orderId' },
        { id: 'm2', sourceId: 'n2', sourcePath: 'userId', targetPath: 'orderId' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'warning' && i.message.includes('bound more than once'))).toBe(true);
    });

    it('reports error for whitespace-only template slot', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'n1', sourcePath: 'orderId', targetPath: '   ' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'error' && i.message.includes('Template slot is required'))).toBe(true);
    });

    it('reports error for whitespace-only binding ref', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'n1', sourcePath: '', targetPath: 'orderId', expression: '   ' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'error' && i.message.includes('No variable bound'))).toBe(true);
    });

    it('treats empty expression string as missing binding', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'n1', sourcePath: 'orderId', targetPath: 'orderId', expression: '' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'error' && i.message.includes('No variable bound'))).toBe(true);
    });

    it('returns no issues for empty mappings', () => {
      const adapter = createVariableBindingAdapter({ variableHints: hints, templateSlots: slots });
      expect(adapter.validate!([])).toHaveLength(0);
    });
  });
});
