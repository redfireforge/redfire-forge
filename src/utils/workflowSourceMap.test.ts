import { describe, it, expect } from 'vitest';
import { buildVariableSourceMap, resolveVariableSource } from './workflowSourceMap';
import type { WorkflowVariableHint } from './workflowVariableHints';

describe('buildVariableSourceMap', () => {
  it('returns empty map for empty hints', () => {
    const m = buildVariableSourceMap([]);
    expect(m.size).toBe(0);
  });

  it('maps workflow-sourced hints to "Default"', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'baseUrl', label: 'baseUrl (workflow)' },
      { ref: 'apiKey', label: 'apiKey (workflow)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.get('baseUrl')).toBe('Default');
    expect(m.get('apiKey')).toBe('Default');
  });

  it('maps "this step" hints to "This step" when no workflowVars', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'channel', label: 'channel (this step)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.get('channel')).toBe('This step');
  });

  it('maps "this step" hints to "Default" when ref exists in workflowVars', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'channel', label: 'channel (this step)' },
    ];
    const m = buildVariableSourceMap(hints, { channel: 'default-val' });
    expect(m.get('channel')).toBe('Default');
  });

  it('maps "latest" hints to step name from scoped arrow hints', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:abc.status', label: 'status ← "Fetch Status" (scoped)' },
      { ref: 'status', label: 'status (latest)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.get('status')).toBe('Fetch Status');
  });

  it('maps "latest" hints to "Upstream" when no scoped arrow hint exists', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'token', label: 'token (latest)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.get('token')).toBe('Upstream');
  });

  it('skips scoped refs (containing ":")', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:abc.channel', label: 'channel ← "Trial Offer" (scoped)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.has('node:abc.channel')).toBe(false);
  });

  it('does not overwrite already-mapped refs', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'vin', label: 'vin (workflow)' },
      { ref: 'vin', label: 'vin (this step)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.get('vin')).toBe('Default');
  });

  it('adds unmapped workflowVars as "Default"', () => {
    const hints: WorkflowVariableHint[] = [];
    const m = buildVariableSourceMap(hints, { env: 'prod', region: 'us' });
    expect(m.get('env')).toBe('Default');
    expect(m.get('region')).toBe('Default');
  });

  it('does not add empty-key workflowVars', () => {
    const m = buildVariableSourceMap([], { '': 'empty', '  ': 'spaces' });
    expect(m.size).toBe(0);
  });

  it('does not override hint-mapped ref with workflowVars', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'token', label: 'token (latest)' },
    ];
    const m = buildVariableSourceMap(hints, { token: 'abc' });
    // "latest" maps to "Upstream" first, workflowVars should not override
    expect(m.get('token')).toBe('Upstream');
  });

  it('extracts step name from dotted scoped ref', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:xyz.deep.nested.key', label: 'key ← "My Step" (scoped)' },
      { ref: 'key', label: 'key (latest)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.get('key')).toBe('My Step');
  });

  it('ignores hints without parenthesized source', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'something', label: 'something - no source' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.has('something')).toBe(false);
  });

  it('handles mixed hint types correctly', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'node:a1.channel', label: 'channel ← "Kafka Step" (scoped)' },
      { ref: 'baseUrl', label: 'baseUrl (workflow)' },
      { ref: 'channel', label: 'channel (latest)' },
      { ref: 'localVar', label: 'localVar (this step)' },
    ];
    const wv = { baseUrl: 'http://example.com', extra: '123' };
    const m = buildVariableSourceMap(hints, wv);
    expect(m.get('baseUrl')).toBe('Default');
    expect(m.get('channel')).toBe('Kafka Step');
    expect(m.get('localVar')).toBe('This step');
    expect(m.get('extra')).toBe('Default');
    expect(m.has('node:a1.channel')).toBe(false);
  });

  it('handles arrow hint with ref that has no dot (uses full ref as baseName)', () => {
    const hints: WorkflowVariableHint[] = [
      { ref: 'channelName', label: 'channelName ← "Input Step" (scoped)' },
      { ref: 'channelName', label: 'channelName (latest)' },
    ];
    const m = buildVariableSourceMap(hints);
    expect(m.get('channelName')).toBe('Input Step');
  });
});

describe('resolveVariableSource', () => {
  const sourceMap = new Map<string, string>([
    ['baseUrl', 'Default'],
    ['channel', 'Kafka Step'],
    ['token', 'Upstream'],
  ]);

  it('resolves node-scoped ref to step name', () => {
    const result = resolveVariableSource('{{node:"My Step".status}}', sourceMap);
    expect(result.source).toBe('My Step');
    expect(result.displayValue).toBe('{{status}}');
  });

  it('resolves simple ref from sourceMap', () => {
    const result = resolveVariableSource('{{channel}}', sourceMap);
    expect(result.source).toBe('Kafka Step');
    expect(result.displayValue).toBe('{{channel}}');
  });

  it('returns empty source for unmapped simple ref', () => {
    const result = resolveVariableSource('{{unknown}}', sourceMap);
    expect(result.source).toBe('');
    expect(result.displayValue).toBe('{{unknown}}');
  });

  it('returns empty source for plain text values', () => {
    const result = resolveVariableSource('hello world', sourceMap);
    expect(result.source).toBe('');
    expect(result.displayValue).toBe('hello world');
  });

  it('returns empty source for empty string', () => {
    const result = resolveVariableSource('', sourceMap);
    expect(result.source).toBe('');
    expect(result.displayValue).toBe('');
  });

  it('simplifies multiple node-scoped refs in one value', () => {
    const result = resolveVariableSource(
      '{{node:"Step A".x}}/{{node:"Step B".y}}',
      sourceMap,
    );
    expect(result.source).toBe('Step A');
    expect(result.displayValue).toBe('{{x}}/{{y}}');
  });

  it('handles value with mixed plain text and template', () => {
    const result = resolveVariableSource('prefix-{{baseUrl}}-suffix', sourceMap);
    // Not a simple {{ref}} pattern, so no sourceMap lookup
    expect(result.source).toBe('');
    expect(result.displayValue).toBe('prefix-{{baseUrl}}-suffix');
  });

  it('returns empty source for value with no braces', () => {
    const result = resolveVariableSource('just/a/path', new Map());
    expect(result.source).toBe('');
    expect(result.displayValue).toBe('just/a/path');
  });

  it('handles node ref with special characters in step name', () => {
    const result = resolveVariableSource('{{node:"Step (v2)".data}}', sourceMap);
    // The regex expects no closing quote before the dot, parentheses in name are fine
    expect(result.source).toBe('Step (v2)');
    expect(result.displayValue).toBe('{{data}}');
  });
});
