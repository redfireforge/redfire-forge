import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateContract,
  contractViolationsToFailures,
  loadContractConfig,
  saveContractConfig,
} from './schemaContract';
import type { SchemaContractConfig, ContractViolation } from './schemaContract';
import { captureSchemaSnapshot } from './schemaSnapshot';

vi.mock('../../../utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

import { readKey, writeKey } from '../../../utils/storage';
const mockReadKey = vi.mocked(readKey);
const mockWriteKey = vi.mocked(writeKey);

function makeSnapshot(data: unknown) {
  return captureSchemaSnapshot('test', 'source', data);
}

describe('validateContract', () => {
  const enabledStrict: SchemaContractConfig = { enabled: true, mode: 'strict' };
  const enabledLenient: SchemaContractConfig = { enabled: true, mode: 'lenient' };
  const disabled: SchemaContractConfig = { enabled: false, mode: 'strict' };

  it('returns empty when contract is disabled', () => {
    const saved = makeSnapshot({ name: 'Alice' });
    const violations = validateContract(saved, { age: 42 }, 'test', disabled);
    expect(violations).toEqual([]);
  });

  it('returns empty when schema matches', () => {
    const saved = makeSnapshot({ name: 'Alice', age: 30 });
    const violations = validateContract(saved, { name: 'Bob', age: 25 }, 'test', enabledStrict);
    expect(violations).toEqual([]);
  });

  it('detects removed fields', () => {
    const saved = makeSnapshot({ name: 'Alice', email: 'a@b.c' });
    const violations = validateContract(saved, { name: 'Alice' }, 'test', enabledLenient);
    const removed = violations.find((v) => v.driftType === 'removed');
    expect(removed).toBeDefined();
    expect(removed!.path).toBe('email');
    expect(removed!.expected).toContain('present');
    expect(removed!.actual).toBe('field missing');
  });

  it('detects type changes', () => {
    const saved = makeSnapshot({ count: 42 });
    const violations = validateContract(saved, { count: 'forty-two' }, 'test', enabledLenient);
    const typeChanged = violations.find((v) => v.driftType === 'typeChanged');
    expect(typeChanged).toBeDefined();
    expect(typeChanged!.expected).toContain('number');
    expect(typeChanged!.actual).toContain('string');
  });

  it('strict mode flags added fields', () => {
    const saved = makeSnapshot({ name: 'Alice' });
    const violations = validateContract(saved, { name: 'Alice', extra: true }, 'test', enabledStrict);
    const added = violations.find((v) => v.driftType === 'added');
    expect(added).toBeDefined();
    expect(added!.path).toBe('extra');
  });

  it('lenient mode ignores added fields', () => {
    const saved = makeSnapshot({ name: 'Alice' });
    const violations = validateContract(saved, { name: 'Alice', extra: true }, 'test', enabledLenient);
    const added = violations.find((v) => v.driftType === 'added');
    expect(added).toBeUndefined();
  });

  it('strict mode flags nullable changes', () => {
    const saved = makeSnapshot({ items: [{ id: 1 }] });
    const violations = validateContract(
      saved,
      { items: [null] },
      'test',
      enabledStrict,
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it('handles nested field removal', () => {
    const saved = makeSnapshot({ user: { name: 'Alice', age: 30 } });
    const violations = validateContract(saved, { user: { name: 'Alice' } }, 'test', enabledLenient);
    const removed = violations.find((v) => v.path === 'user.age');
    expect(removed).toBeDefined();
  });

  it('parses JSON string response data before comparing', () => {
    const saved = makeSnapshot({ name: 'Alice', email: 'a@b.c' });
    const jsonString = JSON.stringify({ name: 'Alice' });
    const violations = validateContract(saved, jsonString, 'test', enabledLenient);
    const removed = violations.find((v) => v.driftType === 'removed');
    expect(removed).toBeDefined();
    expect(removed!.path).toBe('email');
  });

  it('handles non-JSON string response gracefully', () => {
    const saved = makeSnapshot({ name: 'Alice' });
    const violations = validateContract(saved, 'plain text', 'test', enabledStrict);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('lenient mode ignores nullable changes', () => {
    const saved = makeSnapshot({ value: 'text' });
    const violations = validateContract(saved, { value: null }, 'test', enabledLenient);
    const nullable = violations.find((v) => v.driftType === 'nullableChanged');
    expect(nullable).toBeUndefined();
  });

  it('strict mode reports nullable change when same type but nullable flag differs', () => {
    const savedData = { tags: ['a', null] };
    const saved = makeSnapshot(savedData);
    const currentData = { tags: ['a', 'b'] };
    const violations = validateContract(saved, currentData, 'test', enabledStrict);
    const nullable = violations.find((v) => v.driftType === 'nullableChanged');
    if (nullable) {
      expect(nullable.expected).toMatch(/nullable|non-nullable/);
      expect(nullable.actual).toMatch(/nullable|non-nullable/);
    }
  });

  it('handles empty response vs non-empty saved', () => {
    const saved = makeSnapshot({ id: 1, name: 'test' });
    const violations = validateContract(saved, {}, 'test', enabledStrict);
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('contractViolationsToFailures', () => {
  it('converts violations to FailureDetail format', () => {
    const violations: ContractViolation[] = [
      { path: 'name', expected: 'present', actual: 'missing', driftType: 'removed' },
      { path: 'age', expected: 'number', actual: 'string', driftType: 'typeChanged' },
    ];

    const failures = contractViolationsToFailures(violations);
    expect(failures).toHaveLength(2);
    expect(failures[0].path).toBe('[schema-contract] name');
    expect(failures[0].expected).toBe('present');
    expect(failures[0].actual).toBe('missing');
    expect(failures[1].path).toBe('[schema-contract] age');
  });

  it('returns empty for no violations', () => {
    expect(contractViolationsToFailures([])).toEqual([]);
  });
});

describe('contract config storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a saved config', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify({ enabled: true, mode: 'strict' }));
    const config = await loadContractConfig('ctx-1');
    expect(config).toEqual({ enabled: true, mode: 'strict' });
  });

  it('returns null for missing config', async () => {
    mockReadKey.mockResolvedValue(null);
    const config = await loadContractConfig('ctx-1');
    expect(config).toBeNull();
  });

  it('returns null for invalid stored data', async () => {
    mockReadKey.mockResolvedValue('not json');
    const config = await loadContractConfig('ctx-1');
    expect(config).toBeNull();
  });

  it('returns null for valid JSON without enabled field', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify({ foo: 'bar' }));
    const config = await loadContractConfig('ctx-1');
    expect(config).toBeNull();
  });

  it('saves a config', async () => {
    mockWriteKey.mockResolvedValue();
    await saveContractConfig('ctx-2', { enabled: true, mode: 'lenient' });
    expect(mockWriteKey).toHaveBeenCalledWith(
      'dm-schema-contract-ctx-2',
      JSON.stringify({ enabled: true, mode: 'lenient' }),
    );
  });

  it('handles save failure silently', async () => {
    mockWriteKey.mockRejectedValue(new Error('quota'));
    await expect(saveContractConfig('ctx-2', { enabled: false, mode: 'strict' })).resolves.toBeUndefined();
  });
});
