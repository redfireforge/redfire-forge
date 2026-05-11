import { describe, it, expect } from 'vitest';
import { createDemoAdapter } from './demoAdapter';

describe('demoAdapter', () => {
  const adapter = createDemoAdapter();

  it('has correct contextId and title', () => {
    expect(adapter.contextId).toBe('demo');
    expect(adapter.title).toContain('Demo Adapter');
  });

  it('provides at least one source with sample data', () => {
    expect(adapter.sources.length).toBeGreaterThan(0);
    expect(adapter.sources[0].sampleData).toBeTruthy();
  });

  it('provides target with sample data and fields', () => {
    expect(adapter.target.sampleData).toBeTruthy();
    expect(adapter.target.fields).toBeTruthy();
    expect(adapter.target.fields!.length).toBeGreaterThan(0);
  });

  it('provides field constraints', () => {
    expect(adapter.target.fieldConstraints).toBeTruthy();
    expect(adapter.target.fieldConstraints!['fullName']?.required).toBe(true);
    expect(adapter.target.fieldConstraints!['email']?.required).toBe(true);
  });

  it('serializes mappings to DemoOutput format', () => {
    const mappings = [
      { id: 'm1', sourcePath: 'user.firstName', sourceId: 'api-response', targetPath: 'fullName' },
      { id: 'm2', sourcePath: 'user.email', sourceId: 'api-response', targetPath: 'email', expression: '$upper($.user.email)' },
    ];
    const output = adapter.serialize(mappings);
    expect(output.mappings).toHaveLength(2);
    expect(output.mappings[0]).toEqual({ from: 'api-response.user.firstName', to: 'fullName' });
    expect(output.mappings[1]).toEqual({
      from: 'api-response.user.email',
      to: 'email',
      expression: '$upper($.user.email)',
    });
  });

  it('deserializes DemoOutput back to mappings', () => {
    const output = {
      mappings: [
        { from: 'api-response.user.firstName', to: 'fullName' },
        { from: 'api-response.user.email', to: 'email', expression: '$upper($.user.email)' },
      ],
    };
    const mappings = adapter.deserialize(output);
    expect(mappings).toHaveLength(2);
    expect(mappings[0].sourceId).toBe('api-response');
    expect(mappings[0].sourcePath).toBe('user.firstName');
    expect(mappings[0].targetPath).toBe('fullName');
    expect(mappings[1].expression).toBe('$upper($.user.email)');
  });

  it('returns empty array for null/undefined deserialization', () => {
    expect(adapter.deserialize(null as unknown as { mappings: never[] })).toEqual([]);
    expect(adapter.deserialize(undefined as unknown as { mappings: never[] })).toEqual([]);
  });

  it('validate returns warning when non-email field mapped to email target', () => {
    const mappings = [
      { id: 'm1', sourcePath: 'user.firstName', sourceId: 'api-response', targetPath: 'email' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('email');
  });

  it('validate returns no issues when email field mapped to email target', () => {
    const mappings = [
      { id: 'm1', sourcePath: 'user.email', sourceId: 'api-response', targetPath: 'email' },
    ];
    const issues = adapter.validate!(mappings);
    expect(issues).toHaveLength(0);
  });

  it('round-trips serialize → deserialize preserving paths and expressions', () => {
    const original = [
      { id: 'm1', sourcePath: 'user.firstName', sourceId: 'api-response', targetPath: 'fullName' },
      { id: 'm2', sourcePath: 'user.email', sourceId: 'api-response', targetPath: 'email', expression: '$upper($.user.email)' },
    ];
    const output = adapter.serialize(original);
    const restored = adapter.deserialize(output);
    expect(restored).toHaveLength(2);
    expect(restored[0].sourcePath).toBe('user.firstName');
    expect(restored[0].targetPath).toBe('fullName');
    expect(restored[0].sourceId).toBe('api-response');
    expect(restored[1].sourcePath).toBe('user.email');
    expect(restored[1].expression).toBe('$upper($.user.email)');
  });
});
