import { describe, it, expect } from 'vitest';
import {
  inferSemanticType,
  semanticTypesMatch,
  inferFieldSemanticTypes,
} from './smartAutoMap';

describe('inferSemanticType', () => {
  it('detects email', () => {
    expect(inferSemanticType('alice@example.com')).toBe('email');
  });

  it('detects phone numbers', () => {
    expect(inferSemanticType('+1-555-123-4567')).toBe('phone');
    expect(inferSemanticType('(555) 123-4567')).toBe('phone');
  });

  it('detects URLs', () => {
    expect(inferSemanticType('https://example.com/path')).toBe('url');
    expect(inferSemanticType('http://localhost:3000')).toBe('url');
  });

  it('detects ISO dates', () => {
    expect(inferSemanticType('2024-01-15')).toBe('date');
    expect(inferSemanticType('2024-01-15T10:30:00')).toBe('date');
  });

  it('detects US date format', () => {
    expect(inferSemanticType('01/15/2024')).toBe('date');
  });

  it('detects UUIDs', () => {
    expect(inferSemanticType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
  });

  it('detects currency with leading symbol', () => {
    expect(inferSemanticType('$1,299.99')).toBe('currency');
    expect(inferSemanticType('€50.00')).toBe('currency');
  });

  it('detects currency with trailing symbol', () => {
    expect(inferSemanticType('1,299.99$')).toBe('currency');
  });

  it('detects percentage', () => {
    expect(inferSemanticType('85.5%')).toBe('percentage');
    expect(inferSemanticType('-10%')).toBe('percentage');
  });

  it('detects IP addresses', () => {
    expect(inferSemanticType('192.168.1.1')).toBe('ipAddress');
  });

  it('detects zip codes', () => {
    expect(inferSemanticType('90210')).toBe('zipCode');
    expect(inferSemanticType('90210-1234')).toBe('zipCode');
  });

  it('detects hex colors', () => {
    expect(inferSemanticType('#ff0000')).toBe('hex');
    expect(inferSemanticType('#FFF')).toBe('hex');
  });

  it('detects hex with 0x prefix', () => {
    expect(inferSemanticType('0xFF00')).toBe('hex');
  });

  it('detects country codes', () => {
    expect(inferSemanticType('US')).toBe('countryCode');
    expect(inferSemanticType('GBR')).toBe('countryCode');
  });

  it('detects boolean values', () => {
    expect(inferSemanticType(true)).toBe('boolean');
    expect(inferSemanticType(false)).toBe('boolean');
    expect(inferSemanticType('true')).toBe('boolean');
    expect(inferSemanticType('false')).toBe('boolean');
  });

  it('detects integers', () => {
    expect(inferSemanticType(42)).toBe('integer');
    expect(inferSemanticType(0)).toBe('integer');
  });

  it('detects decimals', () => {
    expect(inferSemanticType(3.14)).toBe('decimal');
  });

  it('detects numeric strings', () => {
    expect(inferSemanticType('42')).toBe('integer');
    expect(inferSemanticType('3.14')).toBe('decimal');
  });

  it('returns unknown for null/undefined', () => {
    expect(inferSemanticType(null)).toBe('unknown');
    expect(inferSemanticType(undefined)).toBe('unknown');
  });

  it('returns unknown for array values', () => {
    expect(inferSemanticType([1])).toBe('unknown');
    expect(inferSemanticType([42])).toBe('unknown');
    expect(inferSemanticType([90210])).toBe('unknown');
    expect(inferSemanticType(['a@b.com'])).toBe('unknown');
    expect(inferSemanticType([])).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(inferSemanticType('')).toBe('unknown');
  });

  it('returns unknown for plain text', () => {
    expect(inferSemanticType('hello world')).toBe('unknown');
  });

  it('prefers UUID over other patterns', () => {
    expect(inferSemanticType('550e8400-e29b-41d4-a716-446655440000')).toBe('uuid');
  });

  it('prefers email over phone-like patterns', () => {
    expect(inferSemanticType('user@domain.co')).toBe('email');
  });
});

describe('semanticTypesMatch', () => {
  it('returns matching type for two emails', () => {
    expect(semanticTypesMatch('a@b.com', 'c@d.org')).toBe('email');
  });

  it('returns matching type for two UUIDs', () => {
    expect(semanticTypesMatch(
      '550e8400-e29b-41d4-a716-446655440000',
      '12345678-1234-1234-1234-123456789abc',
    )).toBe('uuid');
  });

  it('returns null for mismatched types', () => {
    expect(semanticTypesMatch('a@b.com', '2024-01-01')).toBeNull();
  });

  it('returns null when either is unknown', () => {
    expect(semanticTypesMatch('hello', 'world')).toBeNull();
  });

  it('returns null when both unknown', () => {
    expect(semanticTypesMatch('foo', 'bar')).toBeNull();
  });

  it('matches two integers', () => {
    expect(semanticTypesMatch(42, 100)).toBe('integer');
  });

  it('matches two booleans', () => {
    expect(semanticTypesMatch(true, false)).toBe('boolean');
  });
});

describe('inferFieldSemanticTypes', () => {
  it('infers types for flat object', () => {
    const data = {
      email: 'user@example.com',
      phone: '+1-555-000-1234',
      name: 'Alice',
      age: 30,
    };
    const types = inferFieldSemanticTypes(data);
    expect(types.get('email')).toBe('email');
    expect(types.get('phone')).toBe('phone');
    expect(types.get('age')).toBe('integer');
    expect(types.has('name')).toBe(false); // plain text → unknown, skipped
  });

  it('infers types for nested object', () => {
    const data = {
      user: { email: 'a@b.com', profile: { url: 'https://example.com' } },
    };
    const types = inferFieldSemanticTypes(data);
    expect(types.get('user.email')).toBe('email');
    expect(types.get('user.profile.url')).toBe('url');
  });

  it('returns empty map for null', () => {
    expect(inferFieldSemanticTypes(null).size).toBe(0);
  });

  it('returns empty map for primitive', () => {
    expect(inferFieldSemanticTypes(42).size).toBe(0);
  });

  it('skips array values', () => {
    const data = { tags: ['a', 'b'], count: 5 };
    const types = inferFieldSemanticTypes(data);
    expect(types.has('tags')).toBe(false);
    expect(types.get('count')).toBe('integer');
  });

  it('skips single-element numeric arrays (not misclassified as integer)', () => {
    const data = { nums: [1], codes: [90210], emails: ['a@b.com'] };
    const types = inferFieldSemanticTypes(data);
    expect(types.has('nums')).toBe(false);
    expect(types.has('codes')).toBe(false);
    expect(types.has('emails')).toBe(false);
  });
});
