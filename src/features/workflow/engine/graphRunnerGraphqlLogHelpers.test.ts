import { describe, expect, it } from 'vitest';
import {
  collectGraphqlBindingEntries,
  formatBindingValueForConsole,
  logGraphqlResponseData,
  logGraphqlSubscriptionMessage,
  logGraphqlVariableBindings,
  logGraphqlVariables,
  previewForConsoleLog,
} from './graphRunnerGraphqlLogHelpers';

describe('graphRunnerGraphqlLogHelpers', () => {
  it('previewForConsoleLog truncates long JSON', () => {
    const long = previewForConsoleLog({ x: 'a'.repeat(400) }, 50);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(51);
  });

  it('logGraphqlVariables skips empty objects', () => {
    const lines: Array<{ prefix: string; text: string }> = [];
    logGraphqlVariables('Create Order', (l) => lines.push(l), {});
    expect(lines).toHaveLength(0);
    logGraphqlVariables('Create Order', (l) => lines.push(l), { orderId: 'ORD-1' });
    expect(lines[0].text).toContain('Variables:');
    expect(lines[0].text).toContain('ORD-1');
  });

  it('logGraphqlResponseData emits status and data lines', () => {
    const lines: Array<{ prefix: string; text: string }> = [];
    logGraphqlResponseData('Create Order', (l) => lines.push(l), {
      httpStatus: 200,
      durationMs: 646,
      data: { createOrder: { id: 'ORD-1' } },
    });
    expect(lines.some((l) => l.text.includes('HTTP 200 — 646ms'))).toBe(true);
    expect(lines.some((l) => l.text.includes('Data:') && l.text.includes('createOrder'))).toBe(true);
  });

  it('logGraphqlSubscriptionMessage numbers messages from 1', () => {
    const lines: Array<{ prefix: string; text: string }> = [];
    logGraphqlSubscriptionMessage('Watch Order Status', (l) => lines.push(l), 0, { status: 'PENDING' });
    expect(lines[0].text).toContain('Message 1');
    expect(lines[0].text).toContain('PENDING');
  });

  it('collectGraphqlBindingEntries merges extraction and ctx bindings', () => {
    const ctx = { get: (n: string) => (n === 'finalStatus' ? '{"status":"COMPLETE"}' : undefined) };
    const merged = collectGraphqlBindingEntries(
      { orderId: '"ORD-1"' },
      ctx,
      ['orderId', 'finalStatus'],
    );
    expect(merged.orderId).toBe('"ORD-1"');
    expect(merged.finalStatus).toContain('COMPLETE');
  });

  it('formatBindingValueForConsole unwraps JSON-serialized scalars', () => {
    expect(formatBindingValueForConsole('"ord-321"')).toBe('ord-321');
    expect(formatBindingValueForConsole('42')).toBe('42');
    expect(formatBindingValueForConsole('{"id":"x"}')).toBe('{"id":"x"}');
  });

  it('logGraphqlVariableBindings uses # prefix and unwraps scalars', () => {
    const lines: Array<{ prefix: string; text: string }> = [];
    logGraphqlVariableBindings('Create Order', (l) => lines.push(l), { orderId: '"ORD-1"' });
    expect(lines[0].prefix).toBe('#');
    expect(lines[0].text).toContain('orderId = ORD-1');
  });
});
