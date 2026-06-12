import { describe, it, expect } from 'vitest';
import { createWsExtractionAdapter } from './wsExtractionAdapter';
import type { Extraction } from '../../../types';
import type { Mapping } from '../types';

// ─── Fixtures ──────────────────────────────────────────────

const sampleMessage = {
  type: 'chat',
  data: {
    messageId: 'msg-42',
    text: 'hello world',
    sender: { id: 'user-1', name: 'Alice' },
  },
};

function makeMappings(overrides?: Partial<Mapping>[]): Mapping[] {
  const defaults: Mapping[] = [
    { id: 'ws-0', sourceId: 'ws-message', sourcePath: '$.data.messageId', targetPath: 'msgId' },
    { id: 'ws-1', sourceId: 'ws-message', sourcePath: '$.data.text', targetPath: 'text' },
  ];
  if (!overrides) return defaults;
  return overrides.map((o, i) => ({ ...defaults[i % defaults.length], ...o, id: o.id ?? `m${i}` }));
}

// ─── Tests ─────────────────────────────────────────────────

describe('wsExtractionAdapter', () => {
  describe('creation', () => {
    it('has correct contextId', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.contextId).toBe('ws-extraction');
    });

    it('has correct category', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.category).toBe('messaging');
    });

    it('has default title and source label', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.title).toBe('WS Message → Variables');
      expect(adapter.sources[0].label).toBe('WS Message');
    });

    it('allows custom title and source label', () => {
      const adapter = createWsExtractionAdapter({
        sourceLabel: 'WS Response',
        title: 'WS Response → Variables',
      });
      expect(adapter.title).toBe('WS Response → Variables');
      expect(adapter.sources[0].label).toBe('WS Response');
    });

    it('uses custom sourceLabel in default title when no explicit title', () => {
      const adapter = createWsExtractionAdapter({ sourceLabel: 'Event Payload' });
      expect(adapter.title).toBe('Event Payload → Variables');
    });

    it('has single source with id ws-message', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      expect(adapter.sources).toHaveLength(1);
      expect(adapter.sources[0].id).toBe('ws-message');
      expect(adapter.sources[0].format).toBe('json');
    });

    it('parses object sampleMessage as source sampleData', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      expect(adapter.sources[0].sampleData).toEqual(sampleMessage);
    });

    it('parses string sampleMessage as source sampleData', () => {
      const adapter = createWsExtractionAdapter({
        sampleMessage: JSON.stringify(sampleMessage),
      });
      expect(adapter.sources[0].sampleData).toEqual(sampleMessage);
    });

    it('handles invalid JSON string gracefully', () => {
      const adapter = createWsExtractionAdapter({
        sampleMessage: 'not-json' as unknown as string,
      });
      expect(adapter.sources[0].sampleData).toBeUndefined();
    });

    it('handles undefined sampleMessage', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.sources[0].sampleData).toBeUndefined();
    });

    it('has target with allowCustomFields', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.target.allowCustomFields).toBe(true);
      expect(adapter.target.label).toBe('Extracted Variables');
    });

    it('does not support live fetch', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.fetchSampleData).toBeUndefined();
    });

    it('has expressions capability enabled', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.capabilities?.expressions).toBe(true);
    });
  });

  describe('serialize', () => {
    it('converts mappings to Extraction[] with source body', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const result = adapter.serialize(makeMappings());
      expect(result).toEqual([
        { name: 'msgId', source: 'body', expression: '$.data.messageId' },
        { name: 'text', source: 'body', expression: '$.data.text' },
      ]);
    });

    it('adds $. prefix to paths without it', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: 'data.sender.name', targetPath: 'sender' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].expression).toBe('$.data.sender.name');
    });

    it('preserves $[...] bracket paths', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: '$[0].field', targetPath: 'first' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].expression).toBe('$[0].field');
    });

    it('normalizes empty path to $', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: '', targetPath: 'root' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].expression).toBe('$');
    });

    it('uses expression over sourcePath when available', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: 'data.text', targetPath: 'msg', expression: '$.data.text' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].expression).toBe('$.data.text');
    });

    it('returns empty array for empty mappings', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      expect(adapter.serialize([])).toEqual([]);
    });

    it('all extractions have source body', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const result = adapter.serialize(makeMappings());
      expect(result.every((e) => e.source === 'body')).toBe(true);
    });
  });

  describe('deserialize', () => {
    it('converts Extraction[] to mappings', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const input: Extraction[] = [
        { name: 'msgId', source: 'body', expression: '$.data.messageId' },
        { name: 'text', source: 'body', expression: '$.data.text' },
      ];
      const result = adapter.deserialize(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'ws-0',
        sourceId: 'ws-message',
        sourcePath: '$.data.messageId',
        targetPath: 'msgId',
      });
      expect(result[1]).toMatchObject({
        id: 'ws-1',
        sourceId: 'ws-message',
        sourcePath: '$.data.text',
        targetPath: 'text',
      });
    });

    it('filters out non-body extractions', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const input: Extraction[] = [
        { name: 'msgId', source: 'body', expression: '$.data.messageId' },
        { name: 'statusCode', source: 'status', expression: '' },
        { name: 'text', source: 'body', expression: '$.data.text' },
      ];
      const result = adapter.deserialize(input);
      expect(result).toHaveLength(2);
      expect(result[0].targetPath).toBe('msgId');
      expect(result[1].targetPath).toBe('text');
    });

    it('returns empty array for null input', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.deserialize(null as unknown as Extraction[])).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.deserialize(undefined as unknown as Extraction[])).toEqual([]);
    });

    it('returns empty array for empty array input', () => {
      const adapter = createWsExtractionAdapter();
      expect(adapter.deserialize([])).toEqual([]);
    });

    it('normalizes bare field paths', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const input: Extraction[] = [
        { name: 'msgId', source: 'body', expression: 'data.messageId' },
      ];
      const result = adapter.deserialize(input);
      expect(result[0].sourcePath).toBe('$.data.messageId');
    });

    it('generates stable sequential ids', () => {
      const adapter = createWsExtractionAdapter();
      const input: Extraction[] = [
        { name: 'a', source: 'body', expression: '$.x' },
        { name: 'b', source: 'body', expression: '$.y' },
        { name: 'c', source: 'body', expression: '$.z' },
      ];
      const result = adapter.deserialize(input);
      expect(result.map((m) => m.id)).toEqual(['ws-0', 'ws-1', 'ws-2']);
    });
  });

  describe('round-trip', () => {
    it('serialize → deserialize preserves mapping structure', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings = makeMappings();
      const serialized = adapter.serialize(mappings);
      const restored = adapter.deserialize(serialized);

      expect(restored).toHaveLength(mappings.length);
      for (let i = 0; i < mappings.length; i++) {
        expect(restored[i].sourcePath).toBe(mappings[i].sourcePath);
        expect(restored[i].targetPath).toBe(mappings[i].targetPath);
        expect(restored[i].sourceId).toBe('ws-message');
      }
    });

    it('deserialize → serialize preserves Extraction[] shape', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const input: Extraction[] = [
        { name: 'type', source: 'body', expression: '$.type' },
        { name: 'senderName', source: 'body', expression: '$.data.sender.name' },
      ];
      const restored = adapter.deserialize(input);
      const serialized = adapter.serialize(restored);

      expect(serialized).toEqual(input);
    });

    it('normalizes paths on round-trip', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: 'data.messageId', targetPath: 'msgId' },
      ];
      const serialized = adapter.serialize(mappings);
      expect(serialized[0].expression).toBe('$.data.messageId');
      const restored = adapter.deserialize(serialized);
      expect(restored[0].sourcePath).toBe('$.data.messageId');
    });
  });

  describe('fallback preservation', () => {
    it('preserves fallback on deserialize → serialize round-trip', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const input: Extraction[] = [
        { name: 'msgId', source: 'body', expression: '$.data.messageId', fallback: 'N/A' },
        { name: 'text', source: 'body', expression: '$.data.text' },
      ];
      const mappings = adapter.deserialize(input);
      const serialized = adapter.serialize(mappings);
      expect(serialized[0].fallback).toBe('N/A');
      expect(serialized[1].fallback).toBeUndefined();
    });

    it('clears fallback map between deserialize calls', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const withFallback: Extraction[] = [
        { name: 'a', source: 'body', expression: '$.x', fallback: 'default' },
      ];
      adapter.deserialize(withFallback);
      const withoutFallback: Extraction[] = [
        { name: 'b', source: 'body', expression: '$.y' },
      ];
      const mappings = adapter.deserialize(withoutFallback);
      const serialized = adapter.serialize(mappings);
      expect(serialized[0].fallback).toBeUndefined();
    });

    it('uses mapping.fallback when set directly', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'ws-0', sourceId: 'ws-message', sourcePath: '$.data.messageId', targetPath: 'msgId', fallback: 'direct' },
      ];
      const serialized = adapter.serialize(mappings);
      expect(serialized[0].fallback).toBe('direct');
    });
  });

  describe('function expression paths', () => {
    it('does not corrupt $parseInt function expressions', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: '$.data.text', targetPath: 'val', expression: '$parseInt($.data.messageId)' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].expression).toBe('$parseInt($.data.messageId)');
    });

    it('does not corrupt $toString function expressions', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: '$.data.text', targetPath: 'val', expression: '$toString($.type)' },
      ];
      const result = adapter.serialize(mappings);
      expect(result[0].expression).toBe('$toString($.type)');
    });

    it('round-trips function expressions via deserialize → serialize', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const input: Extraction[] = [
        { name: 'val', source: 'body', expression: '$parseInt($.data.messageId)' },
      ];
      const mappings = adapter.deserialize(input);
      expect(mappings[0].sourcePath).toBe('$parseInt($.data.messageId)');
      const serialized = adapter.serialize(mappings);
      expect(serialized[0].expression).toBe('$parseInt($.data.messageId)');
    });
  });

  describe('normalizePath edge cases', () => {
    it('strips leading dots before prefixing', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const result = adapter.serialize([
        { id: 'm1', sourceId: 'ws-message', sourcePath: '.foo', targetPath: 'myVar' },
      ]);
      expect(result[0].expression).toBe('$.foo');
    });

    it('handles bracket-only paths like [0].name', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const result = adapter.serialize([
        { id: 'm1', sourceId: 'ws-message', sourcePath: '[0].name', targetPath: 'myVar' },
      ]);
      expect(result[0].expression).toBe('$[0].name');
    });

    it('preserves already-normalized $. paths', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const result = adapter.serialize([
        { id: 'm1', sourceId: 'ws-message', sourcePath: '$.data.messageId', targetPath: 'myVar' },
      ]);
      expect(result[0].expression).toBe('$.data.messageId');
    });

    it('preserves bare $ path', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const result = adapter.serialize([
        { id: 'm1', sourceId: 'ws-message', sourcePath: '$', targetPath: 'whole' },
      ]);
      expect(result[0].expression).toBe('$');
    });
  });

  describe('validate', () => {
    it('returns no issues for valid mappings', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const issues = adapter.validate!(makeMappings());
      expect(issues).toHaveLength(0);
    });

    it('reports error for empty variable name', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings = makeMappings([{ id: 'm1', targetPath: '', sourcePath: '$.data.messageId' }]);
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toContain('Variable name is required');
    });

    it('reports error for empty JSON path', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings = makeMappings([{ id: 'm1', targetPath: 'msgId', sourcePath: '' }]);
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].message).toContain('JSON path is empty');
    });

    it('reports error for duplicate variable names', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: '$.data.messageId', targetPath: 'dup' },
        { id: 'm2', sourceId: 'ws-message', sourcePath: '$.data.text', targetPath: 'dup' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'error' && i.message.includes('Duplicate'))).toBe(true);
    });

    it('warns about braces in variable names', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings = makeMappings([{ id: 'm1', targetPath: '{{msgId}}', sourcePath: '$.data.messageId' }]);
      const issues = adapter.validate!(mappings);
      expect(issues.some((i) => i.severity === 'warning' && i.message.includes('braces'))).toBe(true);
    });

    it('returns no issues for empty mappings', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      expect(adapter.validate!([])).toHaveLength(0);
    });

    it('checks expression when set instead of sourcePath', () => {
      const adapter = createWsExtractionAdapter({ sampleMessage });
      const mappings: Mapping[] = [
        { id: 'm1', sourceId: 'ws-message', sourcePath: '', targetPath: 'msgId', expression: '$.data.messageId' },
      ];
      const issues = adapter.validate!(mappings);
      expect(issues).toHaveLength(0);
    });
  });
});
