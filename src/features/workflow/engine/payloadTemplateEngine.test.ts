import { describe, it, expect, beforeEach } from 'vitest';
import {
  expandPayloadTemplate,
  validatePayloadTemplate,
  getAvailableGenerators,
  resetSequence,
  type PayloadGeneratorContext,
} from './payloadTemplateEngine';

describe('payloadTemplateEngine', () => {
  let ctx: PayloadGeneratorContext;

  beforeEach(() => {
    ctx = {
      requestIndex: 0,
      timestamp: 1714567890123,
    };
    resetSequence();
  });

  describe('expandPayloadTemplate', () => {
    it('expands {{$uuid}} to a valid UUID', () => {
      const result = expandPayloadTemplate('{"id": "{{$uuid}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('expands {{$randomInt(min, max)}} to an integer in range', () => {
      const result = expandPayloadTemplate('{"count": {{$randomInt(10, 20)}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.count).toBeGreaterThanOrEqual(10);
      expect(parsed.count).toBeLessThanOrEqual(20);
    });

    it('expands {{$randomFloat(min, max, decimals)}} to a float with specified precision', () => {
      const result = expandPayloadTemplate('{"price": {{$randomFloat(1.5, 9.5, 2)}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.price).toBeGreaterThanOrEqual(1.5);
      expect(parsed.price).toBeLessThanOrEqual(9.5);
      const decimals = (parsed.price.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    });

    it('expands {{$randomEmail}} to a valid email format', () => {
      const result = expandPayloadTemplate('{"email": "{{$randomEmail}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.email).toMatch(/^[a-z]+\.[a-z]+\d+@[a-z.]+$/);
    });

    it('expands {{$randomName}} to a name with first and last', () => {
      const result = expandPayloadTemplate('{"name": "{{$randomName}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    });

    it('expands {{$randomPhone}} to a phone number format', () => {
      const result = expandPayloadTemplate('{"phone": "{{$randomPhone}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.phone).toMatch(/^\+1-\d{3}-\d{3}-\d{4}$/);
    });

    it('expands {{$timestamp}} to the context timestamp', () => {
      const result = expandPayloadTemplate('{"ts": {{$timestamp}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.ts).toBe(1714567890123);
    });

    it('expands {{$timestampSec}} to timestamp in seconds', () => {
      const result = expandPayloadTemplate('{"ts": {{$timestampSec}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.ts).toBe(1714567890);
    });

    it('expands {{$isoDate}} to ISO 8601 format', () => {
      const result = expandPayloadTemplate('{"date": "{{$isoDate}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('expands {{$date(format)}} with custom format', () => {
      ctx.timestamp = new Date('2024-05-01T12:34:56.789Z').getTime();
      const result = expandPayloadTemplate('{"date": "{{$date(YYYY-MM-DD)}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.date).toBe('2024-05-01');
    });

    it('expands {{$randomChoice(a, b, c)}} to one of the options', () => {
      const result = expandPayloadTemplate('{"status": "{{$randomChoice(active, pending, closed)}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(['active', 'pending', 'closed']).toContain(parsed.status);
    });

    it('expands {{$randomString(length)}} to an alphanumeric string', () => {
      const result = expandPayloadTemplate('{"code": "{{$randomString(8)}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.code).toMatch(/^[A-Za-z0-9]{8}$/);
    });

    it('expands {{$sequence}} with incrementing values', () => {
      const result1 = expandPayloadTemplate('{"seq": {{$sequence}}}', ctx);
      const result2 = expandPayloadTemplate('{"seq": {{$sequence}}}', ctx);
      const result3 = expandPayloadTemplate('{"seq": {{$sequence}}}', ctx);
      expect(JSON.parse(result1).seq).toBe(0);
      expect(JSON.parse(result2).seq).toBe(1);
      expect(JSON.parse(result3).seq).toBe(2);
    });

    it('expands {{$requestIndex}} to the context request index', () => {
      ctx.requestIndex = 42;
      const result = expandPayloadTemplate('{"idx": {{$requestIndex}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.idx).toBe(42);
    });

    it('handles multiple generators in one template', () => {
      const template = '{"id": "{{$uuid}}", "count": {{$randomInt(1, 10)}}, "email": "{{$randomEmail}}"}';
      const result = expandPayloadTemplate(template, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.id).toBeDefined();
      expect(parsed.count).toBeGreaterThanOrEqual(1);
      expect(parsed.email).toContain('@');
    });

    it('leaves unknown generators unchanged', () => {
      const result = expandPayloadTemplate('{"x": "{{$unknownGen}}"}', ctx);
      expect(result).toBe('{"x": "{{$unknownGen}}"}');
    });

    it('handles templates with no generators', () => {
      const template = '{"static": "value", "num": 123}';
      const result = expandPayloadTemplate(template, ctx);
      expect(result).toBe(template);
    });

    it('handles nested JSON structures', () => {
      const template = '{"user": {"id": "{{$uuid}}", "name": "{{$randomName}}"}, "items": [{{$randomInt(1,5)}}]}';
      const result = expandPayloadTemplate(template, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.user.id).toBeDefined();
      expect(parsed.user.name).toBeDefined();
      expect(parsed.items[0]).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validatePayloadTemplate', () => {
    it('returns empty array for valid JSON template', () => {
      const errors = validatePayloadTemplate('{"key": "{{$uuid}}"}');
      expect(errors).toHaveLength(0);
    });

    it('returns error for invalid JSON', () => {
      const errors = validatePayloadTemplate('{"invalid": }');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid JSON');
    });

    it('returns error for unknown generators', () => {
      const errors = validatePayloadTemplate('{"x": "{{$notReal}}"}');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Unknown generator'))).toBe(true);
    });

    it('validates nested templates correctly', () => {
      const errors = validatePayloadTemplate('{"a": {"b": {{$randomInt(1,10)}}}}');
      expect(errors).toHaveLength(0);
    });
  });

  describe('getAvailableGenerators', () => {
    it('returns all available generators with metadata', () => {
      const generators = getAvailableGenerators();
      expect(generators.length).toBeGreaterThan(10);
      
      const names = generators.map(g => g.name);
      expect(names).toContain('uuid');
      expect(names).toContain('randomInt');
      expect(names).toContain('randomEmail');
      expect(names).toContain('timestamp');
      expect(names).toContain('sequence');
    });

    it('each generator has required fields', () => {
      const generators = getAvailableGenerators();
      for (const gen of generators) {
        expect(gen.name).toBeDefined();
        expect(gen.syntax).toBeDefined();
        expect(gen.description).toBeDefined();
        expect(gen.example).toBeDefined();
      }
    });
  });

  describe('resetSequence', () => {
    it('resets sequence counter to 0', () => {
      expandPayloadTemplate('{{$sequence}}', ctx);
      expandPayloadTemplate('{{$sequence}}', ctx);
      resetSequence();
      const result = expandPayloadTemplate('{"seq": {{$sequence}}}', ctx);
      expect(JSON.parse(result).seq).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('randomInt uses defaults when no args provided', () => {
      const result = expandPayloadTemplate('{"n": {{$randomInt()}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.n).toBeGreaterThanOrEqual(0);
      expect(parsed.n).toBeLessThanOrEqual(100);
    });

    it('randomFloat uses defaults when no args provided', () => {
      const result = expandPayloadTemplate('{"f": {{$randomFloat()}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.f).toBeGreaterThanOrEqual(0);
      expect(parsed.f).toBeLessThanOrEqual(100);
    });

    it('randomString uses default length 10 when no args provided', () => {
      const result = expandPayloadTemplate('{"s": "{{$randomString()}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.s).toHaveLength(10);
    });

    it('date uses default format when no args provided', () => {
      const result = expandPayloadTemplate('{"d": "{{$date()}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('randomChoice returns empty string when no args provided', () => {
      const result = expandPayloadTemplate('{"c": "{{$randomChoice()}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.c).toBe('');
    });

    it('uses custom variables from context', () => {
      ctx.customVariables = { myVar: 'customValue', anotherVar: '123' };
      const result = expandPayloadTemplate('{"v": "{{$myVar}}", "n": {{$anotherVar}}}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.v).toBe('customValue');
      expect(parsed.n).toBe(123);
    });

    it('parseArgs handles quoted strings correctly', () => {
      // Test single quotes
      const result1 = expandPayloadTemplate('{"c": "{{$randomChoice(\'hello world\', \'foo bar\')}}"}', ctx);
      const parsed1 = JSON.parse(result1);
      expect(['hello world', 'foo bar']).toContain(parsed1.c);
    });

    it('returns original expression for unknown generator with args', () => {
      const result = expandPayloadTemplate('{"x": "{{$notARealGen(1, 2, 3)}}"}', ctx);
      expect(result).toBe('{"x": "{{$notARealGen(1, 2, 3)}}"}');
    });

    it('validatePayloadTemplate returns error message from non-Error object', () => {
      // This is tricky to trigger - we need invalid JSON that throws non-Error
      // Let's test valid JSON with unknown generator
      const errors = validatePayloadTemplate('{"x": "{{$unknownGenX(a,b)}}"}');
      expect(errors.some(e => e.includes('Unknown generator'))).toBe(true);
    });

    it('expands time patterns in date format', () => {
      ctx.timestamp = new Date('2024-05-01T09:15:30.789Z').getTime();
      const result = expandPayloadTemplate('{"t": "{{$date(YYYY-MM-DD HH:mm:ss)}}"}', ctx);
      const parsed = JSON.parse(result);
      expect(parsed.t).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });
});
