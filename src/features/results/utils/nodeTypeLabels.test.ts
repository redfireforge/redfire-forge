import { describe, it, expect } from 'vitest';
import { formatNodeTypeConsole, formatNodeTypeExplorer } from './nodeTypeLabels';

describe('formatNodeTypeConsole', () => {
  it('returns Title Case for known types', () => {
    expect(formatNodeTypeConsole('http')).toBe('HTTP');
    expect(formatNodeTypeConsole('subWorkflow')).toBe('Sub-Workflow');
    expect(formatNodeTypeConsole('setVariable')).toBe('Set Variable');
    expect(formatNodeTypeConsole('correlationWait')).toBe('Correlation Wait');
    expect(formatNodeTypeConsole('errorHandler')).toBe('Error Handler');
  });

  it('returns raw string for unknown types', () => {
    expect(formatNodeTypeConsole('myCustomNode')).toBe('myCustomNode');
  });

  it('covers all standard workflow node types', () => {
    const types = [
      'http', 'condition', 'delay', 'fork', 'join', 'loop',
      'setVariable', 'script', 'aggregate', 'correlationWait',
      'waitForCondition', 'subWorkflow', 'webhook', 'schedule',
      'start', 'end', 'switch', 'logDebug', 'errorHandler',
      'group', 'parallel',
    ];
    for (const t of types) {
      expect(formatNodeTypeConsole(t)).not.toBe(t === 'http' ? 'unused' : undefined);
      expect(formatNodeTypeConsole(t).length).toBeGreaterThan(0);
    }
  });
});

describe('formatNodeTypeExplorer', () => {
  it('returns UPPERCASE for known types', () => {
    expect(formatNodeTypeExplorer('http')).toBe('HTTP');
    expect(formatNodeTypeExplorer('subWorkflow')).toBe('SUB-WORKFLOW');
    expect(formatNodeTypeExplorer('logDebug')).toBe('LOG / DEBUG');
    expect(formatNodeTypeExplorer('errorHandler')).toBe('ERROR HANDLER');
  });

  it('falls back to camelCase split + uppercase for unknown types', () => {
    expect(formatNodeTypeExplorer('myCustomNode')).toBe('MY CUSTOM NODE');
    expect(formatNodeTypeExplorer('fooBar')).toBe('FOO BAR');
  });

  it('handles single-word unknown type', () => {
    expect(formatNodeTypeExplorer('zigzag')).toBe('ZIGZAG');
  });
});
