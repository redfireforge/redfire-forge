/**
 * schemaExplorerUtils.test.ts
 */

import { describe, it, expect } from 'vitest';
import { KIND_LABEL, KIND_CSS, KIND_ABBR, fieldCountText, extractTypeName } from './schemaExplorerUtils';
import type { GraphqlTypeNode } from '../../../shared/types/graphql';

function makeType(kind: GraphqlTypeNode['kind'], overrides: Partial<GraphqlTypeNode> = {}): GraphqlTypeNode {
  return { name: 'TestType', kind, ...overrides };
}

describe('extractTypeName', () => {
  it('returns bare name for simple types', () => {
    expect(extractTypeName('String')).toBe('String');
    expect(extractTypeName('User')).toBe('User');
  });

  it('strips ! non-null markers', () => {
    expect(extractTypeName('String!')).toBe('String');
    expect(extractTypeName('ID!')).toBe('ID');
  });

  it('strips list brackets and non-null', () => {
    expect(extractTypeName('[User!]!')).toBe('User');
    expect(extractTypeName('[OrderItem]')).toBe('OrderItem');
    expect(extractTypeName('[String!]')).toBe('String');
  });

  it('handles nested lists', () => {
    expect(extractTypeName('[[Int!]!]!')).toBe('Int');
  });
});

describe('fieldCountText', () => {
  it('returns empty string when no fields/values/possibleTypes', () => {
    expect(fieldCountText(makeType('OBJECT'))).toBe('');
    expect(fieldCountText(makeType('ENUM'))).toBe('');
  });

  it('returns field count for OBJECT', () => {
    const type = makeType('OBJECT', {
      fields: [
        { name: 'id', type: 'ID!' },
        { name: 'name', type: 'String' },
      ],
    });
    expect(fieldCountText(type)).toBe('2 fields');
  });

  it('uses singular for 1 field', () => {
    const type = makeType('OBJECT', { fields: [{ name: 'id', type: 'ID!' }] });
    expect(fieldCountText(type)).toBe('1 field');
  });

  it('returns value count for ENUM', () => {
    const type = makeType('ENUM', { enumValues: ['ACTIVE', 'INACTIVE', 'PENDING'] });
    expect(fieldCountText(type)).toBe('3 values');
  });

  it('uses singular for 1 enum value', () => {
    const type = makeType('ENUM', { enumValues: ['ACTIVE'] });
    expect(fieldCountText(type)).toBe('1 value');
  });

  it('returns type count for UNION', () => {
    const type = makeType('UNION', { possibleTypes: ['Dog', 'Cat'] });
    expect(fieldCountText(type)).toBe('2 types');
  });

  it('uses singular for 1 union type', () => {
    const type = makeType('UNION', { possibleTypes: ['Dog'] });
    expect(fieldCountText(type)).toBe('1 type');
  });
});

describe('KIND_LABEL', () => {
  it('has labels for all type kinds', () => {
    const kinds: GraphqlTypeNode['kind'][] = ['OBJECT', 'INTERFACE', 'UNION', 'INPUT_OBJECT', 'ENUM', 'SCALAR'];
    for (const kind of kinds) {
      expect(KIND_LABEL[kind]).toBeTruthy();
    }
  });
});

describe('KIND_CSS', () => {
  it('has CSS classes for all type kinds', () => {
    const kinds: GraphqlTypeNode['kind'][] = ['OBJECT', 'INTERFACE', 'UNION', 'INPUT_OBJECT', 'ENUM', 'SCALAR'];
    for (const kind of kinds) {
      expect(KIND_CSS[kind]).toMatch(/^gql-se-kind--/);
    }
  });
});

describe('KIND_ABBR', () => {
  it('has abbreviations for all type kinds', () => {
    const kinds: GraphqlTypeNode['kind'][] = ['OBJECT', 'INTERFACE', 'UNION', 'INPUT_OBJECT', 'ENUM', 'SCALAR'];
    for (const kind of kinds) {
      expect(KIND_ABBR[kind]).toBeTruthy();
    }
  });
});
