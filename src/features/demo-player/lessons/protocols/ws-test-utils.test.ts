/**
 * @vitest-environment jsdom
 * Unit tests for ws-test-utils shared helpers.
 */
import { describe, it, expect } from 'vitest';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('makeCtx', () => {
  it('returns all required context mock functions', () => {
    const ctx = makeCtx();
    expect(typeof ctx.navigateToTab).toBe('function');
    expect(typeof ctx.click).toBe('function');
    expect(typeof ctx.fill).toBe('function');
    expect(typeof ctx.selectOption).toBe('function');
    expect(typeof ctx.waitFor).toBe('function');
    expect(typeof ctx.delay).toBe('function');
  });

  it('click returns a resolved promise', async () => {
    const ctx = makeCtx();
    await expect(ctx.click('[data-testid="foo"]')).resolves.toBeUndefined();
  });

  it('fill returns a resolved promise', async () => {
    const ctx = makeCtx();
    await expect(ctx.fill('[data-testid="foo"]', 'value')).resolves.toBeUndefined();
  });

  it('selectOption returns a resolved promise', async () => {
    const ctx = makeCtx();
    await expect(ctx.selectOption('[data-testid="sel"]', 'opt')).resolves.toBeUndefined();
  });

  it('waitFor returns a resolved promise', async () => {
    const ctx = makeCtx();
    await expect(ctx.waitFor('[data-testid="bar"]')).resolves.toBeUndefined();
  });

  it('delay returns a resolved promise', async () => {
    const ctx = makeCtx();
    await expect(ctx.delay(0)).resolves.toBeUndefined();
  });
});

describe('makeVisible', () => {
  it('overrides getBoundingClientRect to return non-zero dimensions', () => {
    const el = document.createElement('div');
    makeVisible(el);
    const rect = el.getBoundingClientRect();
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(20);
    expect(rect.top).toBe(0);
    expect(rect.left).toBe(0);
    expect(rect.right).toBe(100);
    expect(rect.bottom).toBe(20);
  });

  it('toJSON on the returned rect returns a string', () => {
    const el = document.createElement('div');
    makeVisible(el);
    const rect = el.getBoundingClientRect();
    expect(typeof rect.toJSON()).toBe('string');
  });
});
