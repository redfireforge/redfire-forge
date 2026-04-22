import { describe, it, expect } from 'vitest';
import { extractVariables, type ResponseData } from './extractVariables';
import { VariableContext } from './variableContext';
import type { Extraction } from '../../types';

function makeResponse(overrides: Partial<ResponseData> = {}): ResponseData {
  return {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req-123' },
    body: { user: { name: 'Alice', age: 30 }, items: ['a', 'b'] },
    ...overrides,
  };
}

describe('extractVariables', () => {
  it('extracts value from JSON body path', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'userName', source: 'body', expression: '$.user.name' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.userName).toBe('Alice');
    expect(ctx.get('userName')).toBe('Alice');
  });

  it('extracts nested object as JSON string', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'user', source: 'body', expression: '$.user' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.user).toBe(JSON.stringify({ name: 'Alice', age: 30 }));
  });

  it('extracts value from response header (case-insensitive)', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'reqId', source: 'header', expression: 'X-Request-Id' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.reqId).toBe('req-123');
  });

  it('extracts HTTP status', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'code', source: 'status', expression: '' },
    ];
    const result = extractVariables(extractions, makeResponse({ status: 404 }), ctx, 'n1');
    expect(result.code).toBe('404');
  });

  it('uses fallback when body path not found', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'missing', source: 'body', expression: '$.nonexistent', fallback: 'default' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.missing).toBe('default');
    expect(ctx.get('missing')).toBe('default');
  });

  it('uses fallback when header not found', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'missing', source: 'header', expression: 'X-Missing', fallback: 'n/a' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.missing).toBe('n/a');
  });

  it('skips variable when no value and no fallback', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'missing', source: 'body', expression: '$.nonexistent' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.missing).toBeUndefined();
    expect(ctx.get('missing')).toBeUndefined();
  });

  it('sets per-node variables for scoped refs', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'token', source: 'body', expression: '$.user.name' },
    ];
    extractVariables(extractions, makeResponse(), ctx, 'step-1');
    expect(ctx.getFromNode('step-1', 'token')).toBe('Alice');
  });

  it('handles multiple extractions', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'name', source: 'body', expression: '$.user.name' },
      { name: 'status', source: 'status', expression: '' },
      { name: 'contentType', source: 'header', expression: 'content-type' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.name).toBe('Alice');
    expect(result.status).toBe('200');
    expect(result.contentType).toBe('application/json');
  });

  it('handles empty extractions array', () => {
    const ctx = new VariableContext();
    const result = extractVariables([], makeResponse(), ctx, 'n1');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('extracts array element from body', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'first', source: 'body', expression: '$.items[0]' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.first).toBe('a');
  });

  it('extracts numeric value as string', () => {
    const ctx = new VariableContext();
    const extractions: Extraction[] = [
      { name: 'age', source: 'body', expression: '$.user.age' },
    ];
    const result = extractVariables(extractions, makeResponse(), ctx, 'n1');
    expect(result.age).toBe('30');
  });
});
