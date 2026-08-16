import { describe, expect, it, vi } from 'vitest';
import { applyPatternToolbox } from './apiMockPatternToolboxApply';

function base(overrides: Partial<Parameters<typeof applyPatternToolbox>[0]> = {}) {
  return {
    tab: 'jsonpath' as const,
    jsonPath: '$.id',
    jsonExpected: '',
    xpath: '/root',
    xpathValue: '',
    schemaKind: 'json' as const,
    schemaText: '{"type":"object"}',
    constraints: [],
    regexApplied: { kind: 'regex' as const, value: '^id$' },
    caseInsensitive: false,
    kind: 'exact' as const,
    value: '/users',
    onApply: vi.fn(),
    onClose: vi.fn(),
    nextId: () => 'pred-1',
    ...overrides,
  };
}

describe('applyPatternToolbox', () => {
  it('applies JSONPath exists vs equals through onApplyPredicate', () => {
    const onApplyPredicate = vi.fn();
    applyPatternToolbox(base({ onApplyPredicate }));
    expect(onApplyPredicate).toHaveBeenCalledWith({
      source: 'body', selector: '', operator: 'jsonPath_exists', expected: '$.id',
    });

    onApplyPredicate.mockClear();
    applyPatternToolbox(base({ onApplyPredicate, jsonExpected: '42' }));
    expect(onApplyPredicate).toHaveBeenCalledWith({
      source: 'body', selector: '', operator: 'jsonPath_equals', expected: ['$.id', '42'],
    });
  });

  it('falls back to onApplyConditions for XPath and schema', () => {
    const onApplyConditions = vi.fn();
    applyPatternToolbox(base({ tab: 'xpath', onApplyConditions, xpathValue: 'n' }));
    expect(onApplyConditions).toHaveBeenCalledWith([expect.objectContaining({
      operator: 'xpath_equals', expected: ['/root', 'n'],
    })]);

    onApplyConditions.mockClear();
    applyPatternToolbox(base({ tab: 'xpath', onApplyConditions, xpathValue: '  ' }));
    expect(onApplyConditions).toHaveBeenCalledWith([expect.objectContaining({
      operator: 'xpath_exists', expected: '/root',
    })]);

    onApplyConditions.mockClear();
    applyPatternToolbox(base({ tab: 'schema', schemaKind: 'xml', schemaText: 'Order, Id', onApplyConditions }));
    expect(onApplyConditions).toHaveBeenCalledWith([expect.objectContaining({
      operator: 'xmlSchema', expected: 'Order, Id',
    })]);

    onApplyConditions.mockClear();
    applyPatternToolbox(base({ tab: 'schema', schemaKind: 'json', schemaText: '{', onApplyConditions }));
    expect(onApplyConditions).not.toHaveBeenCalled();

    onApplyConditions.mockClear();
    applyPatternToolbox(base({ tab: 'schema', schemaKind: 'json', onApplyConditions }));
    expect(onApplyConditions).toHaveBeenCalledWith([expect.objectContaining({
      operator: 'jsonSchema', expected: '{"type":"object"}',
    })]);
  });

  it('maps constraint rows and skips blank selectors', () => {
    const onApplyConditions = vi.fn();
    applyPatternToolbox(base({
      tab: 'constraints',
      onApplyConditions,
      constraints: [
        { id: 'c0', source: 'header', selector: '  ', operator: 'exact', expected: 'x' },
        { id: 'c1', source: 'query', selector: 'q', operator: 'present', expected: 'ignored' },
        { id: 'c2', source: 'cookie', selector: 'sid', operator: 'absent', expected: '1' },
        { id: 'c3', source: 'header', selector: 'x-debug', operator: 'exact', expected: '1' },
      ],
    }));
    expect(onApplyConditions).toHaveBeenCalledWith([
      { id: 'pred-1', source: 'query', selector: 'q', operator: 'present', expected: undefined },
      { id: 'pred-1', source: 'cookie', selector: 'sid', operator: 'absent', expected: undefined },
      { id: 'pred-1', source: 'header', selector: 'x-debug', operator: 'exact', expected: '1' },
    ]);
  });

  it('applies regex/glob rows and path matchers', () => {
    const onApply = vi.fn();
    applyPatternToolbox(base({ tab: 'regex', onApply, caseInsensitive: true, predicateOperator: 'regex' }));
    expect(onApply).toHaveBeenCalledWith({
      kind: 'regex', value: '^id$', flags: { caseInsensitive: true },
    });

    onApply.mockClear();
    applyPatternToolbox(base({ tab: 'regex', onApply, predicateOperator: 'glob' }));
    expect(onApply).toHaveBeenCalledWith({
      kind: 'regex', value: '^id$', flags: undefined,
    });

    onApply.mockClear();
    applyPatternToolbox(base({ tab: 'regex', onApply }));
    expect(onApply).toHaveBeenCalled();

    onApply.mockClear();
    applyPatternToolbox(base({ tab: 'regex', onApply, predicateOperator: 'exact' }));
    expect(onApply).not.toHaveBeenCalled();

    onApply.mockClear();
    const onClose = vi.fn();
    applyPatternToolbox(base({ tab: 'path', onApply, onClose, onApplyPredicate: vi.fn() }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    onApply.mockClear();
    applyPatternToolbox(base({ tab: 'path', onApply, caseInsensitive: true }));
    expect(onApply).toHaveBeenCalledWith({
      kind: 'exact', value: '/users', flags: { caseInsensitive: true },
    });
    onApply.mockClear();
    applyPatternToolbox(base({ tab: 'path', onApply, caseInsensitive: false }));
    expect(onApply).toHaveBeenCalledWith({ kind: 'exact', value: '/users', flags: undefined });
  });

  it('allocates predicate ids when nextId is omitted', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'abcd1234-xxxx' });
    const onApplyConditions = vi.fn();
    applyPatternToolbox(base({ tab: 'xpath', onApplyConditions, nextId: undefined }));
    expect(onApplyConditions.mock.calls[0][0][0].id).toBe('pred-abcd1234');
    vi.unstubAllGlobals();
  });
});
