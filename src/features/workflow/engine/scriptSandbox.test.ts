import { describe, it, expect } from 'vitest';
import { executeScript, scriptModeLabel } from './scriptSandbox';
import type { ScriptNodeData, ScriptMode } from '../types/workflow';
import { MAX_OUTPUT_SIZE_BYTES } from './scriptAnalysis';

function makeData(overrides: Partial<ScriptNodeData> = {}): ScriptNodeData {
  return {
    label: 'Script',
    code: 'output.result = input.value;',
    mode: 'transform',
    inputVariables: ['value'],
    outputVariables: ['result'],
    timeoutMs: 5000,
    captureConsole: true,
    ...overrides,
  };
}

describe('executeScript', () => {
  // ── Basic execution ──

  it('executes a transform script and returns outputs', () => {
    const result = executeScript(makeData(), { value: 'hello' });
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({ result: 'hello' });
    expect(result.error).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns empty string for missing input variables', () => {
    const result = executeScript(makeData(), {});
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({ result: '' });
  });

  it('stringifies non-string output values', () => {
    const data = makeData({
      code: 'output.result = 42;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({ result: '42' });
  });

  it('stringifies object output values as JSON', () => {
    const data = makeData({
      code: 'output.result = { a: 1, b: "two" };',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
    expect(result.outputs.result).toBe('{"a":1,"b":"two"}');
  });

  it('stringifies boolean output values', () => {
    const data = makeData({
      code: 'output.result = true;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
    expect(result.outputs.result).toBe('true');
  });

  it('ignores output variables not listed in outputVariables', () => {
    const data = makeData({
      code: 'output.result = "ok"; output.extra = "ignored";',
      outputVariables: ['result'],
    });
    const result = executeScript(data, { value: '' });
    expect(result.outputs).toEqual({ result: 'ok' });
    expect(result.outputs).not.toHaveProperty('extra');
  });

  it('does not include undefined output variables', () => {
    const data = makeData({
      code: '// does not set output.result',
      outputVariables: ['result'],
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({});
  });

  // ── Multiple input/output variables ──

  it('handles multiple input and output variables', () => {
    const data = makeData({
      code: 'output.sum = String(Number(input.a) + Number(input.b)); output.product = String(Number(input.a) * Number(input.b));',
      inputVariables: ['a', 'b'],
      outputVariables: ['sum', 'product'],
    });
    const result = executeScript(data, { a: '3', b: '4' });
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({ sum: '7', product: '12' });
  });

  it('handles empty inputVariables and outputVariables arrays', () => {
    const data = makeData({
      code: '// no-op',
      inputVariables: [],
      outputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({});
  });

  // ── Console capture ──

  it('captures console.log output', () => {
    const data = makeData({
      code: 'console.log("hello", "world"); output.result = "ok";',
    });
    const result = executeScript(data, { value: '' });
    expect(result.consoleLogs).toEqual(['hello world']);
  });

  it('captures console.warn with [warn] prefix', () => {
    const data = makeData({
      code: 'console.warn("caution"); output.result = "ok";',
    });
    const result = executeScript(data, { value: '' });
    expect(result.consoleLogs).toEqual(['[warn] caution']);
  });

  it('captures console.error with [error] prefix', () => {
    const data = makeData({
      code: 'console.error("bad"); output.result = "ok";',
    });
    const result = executeScript(data, { value: '' });
    expect(result.consoleLogs).toEqual(['[error] bad']);
  });

  it('captures console.info output', () => {
    const data = makeData({
      code: 'console.info("info msg"); output.result = "ok";',
    });
    const result = executeScript(data, { value: '' });
    expect(result.consoleLogs).toEqual(['info msg']);
  });

  it('captures multiple console calls in order', () => {
    const data = makeData({
      code: 'console.log("first"); console.warn("second"); console.error("third");',
      outputVariables: [],
    });
    const result = executeScript(data, { value: '' });
    expect(result.consoleLogs).toEqual(['first', '[warn] second', '[error] third']);
  });

  it('captures console even when captureConsole is false', () => {
    // Console proxy is always active but logs may not be shown by the runner
    const data = makeData({
      code: 'console.log("test"); output.result = "ok";',
      captureConsole: false,
    });
    const result = executeScript(data, { value: '' });
    // consoleLogs are still collected — the captureConsole flag controls runner display, not capture
    expect(result.consoleLogs).toEqual(['test']);
  });

  // ── Error handling ──

  it('returns error for syntax errors in code', () => {
    const data = makeData({
      code: 'function( { broken',
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.outputs).toEqual({});
  });

  it('returns error for runtime errors in code', () => {
    const data = makeData({
      code: 'throw new Error("boom");',
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
  });

  it('returns error for runtime TypeError', () => {
    const data = makeData({
      code: 'null.foo;',
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for thrown non-Error values', () => {
    const data = makeData({
      code: 'throw "string error";',
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('string error');
  });

  it('preserves consoleLogs even when script errors', () => {
    const data = makeData({
      code: 'console.log("before error"); throw new Error("fail");',
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(false);
    expect(result.consoleLogs).toEqual(['before error']);
  });

  // ── Validate mode ──

  it('passes in validate mode when output.result is true', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = true;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('passes in validate mode when output.result is "true"', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = "true";',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
  });

  it('passes in validate mode when output.result is "1"', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = "1";',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
  });

  it('passes in validate mode when output.result is non-zero number', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = 42;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
  });

  it('passes in validate mode when output.result is truthy object', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = {};',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
  });

  it('fails in validate mode when output.result is false', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = false;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('fails in validate mode when output.result is "false"', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = "false";',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(false);
  });

  it('fails in validate mode when output.result is 0', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = 0;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(false);
  });

  it('fails in validate mode when output.result is undefined', () => {
    const data = makeData({
      mode: 'validate',
      code: '// does not set output.result',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });

  it('fails in validate mode when output.result is null', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = null;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(false);
  });

  it('still collects output variables in validate mode on success', () => {
    const data = makeData({
      mode: 'validate',
      code: 'output.result = true;',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
    expect(result.outputs.result).toBe('true');
  });

  // ── Generate mode ──

  it('runs in generate mode like transform', () => {
    const data = makeData({
      mode: 'generate',
      code: 'output.result = "generated-" + Date.now();',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
    expect(result.outputs.result).toMatch(/^generated-\d+$/);
  });

  // ── Timeout ──

  it('clamps timeout to MAX_TIMEOUT_MS (30000)', () => {
    const data = makeData({
      timeoutMs: 999999,
      code: 'output.result = "ok";',
    });
    const result = executeScript(data, { value: '' });
    // Should succeed — timeout is clamped but sync execution completes
    expect(result.success).toBe(true);
  });

  it('handles zero timeout by using default', () => {
    const data = makeData({
      timeoutMs: 0,
      code: 'output.result = "ok";',
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(true);
  });

  // ── Async detection ──

  it('rejects async code returning a Promise', () => {
    const data = makeData({
      code: 'return Promise.resolve("async");',
    });
    const result = executeScript(data, { value: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Async code');
  });

  // ── Max output size enforcement (Phase C) ──

  it('fails when output exceeds max size', () => {
    const bigString = 'x'.repeat(MAX_OUTPUT_SIZE_BYTES + 100);
    const data = makeData({
      code: `output.result = "${bigString}";`,
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });

  it('succeeds when output is within max size', () => {
    const data = makeData({
      code: 'output.result = "ok";',
      inputVariables: [],
    });
    const result = executeScript(data, {});
    expect(result.success).toBe(true);
  });

  // ── durationMs ──

  it('reports durationMs', () => {
    const result = executeScript(makeData(), { value: '' });
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('reports durationMs even on error', () => {
    const data = makeData({ code: 'throw new Error("fail");' });
    const result = executeScript(data, { value: '' });
    expect(typeof result.durationMs).toBe('number');
  });
});

describe('scriptModeLabel', () => {
  it('returns "Transform" for transform', () => {
    expect(scriptModeLabel('transform')).toBe('Transform');
  });

  it('returns "Validate" for validate', () => {
    expect(scriptModeLabel('validate')).toBe('Validate');
  });

  it('returns "Generate" for generate', () => {
    expect(scriptModeLabel('generate')).toBe('Generate');
  });

  it('covers all ScriptMode values', () => {
    const modes: ScriptMode[] = ['transform', 'validate', 'generate'];
    for (const mode of modes) {
      expect(scriptModeLabel(mode)).toBeTruthy();
    }
  });
});
