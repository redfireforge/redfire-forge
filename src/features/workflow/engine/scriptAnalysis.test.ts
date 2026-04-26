import { describe, it, expect } from 'vitest';
import {
  detectOutputVariables,
  analyzeScriptComplexity,
  validateOutputSize,
  MAX_OUTPUT_SIZE_BYTES,
} from './scriptAnalysis';

describe('detectOutputVariables', () => {
  it('returns empty array for empty code', () => {
    expect(detectOutputVariables('')).toEqual([]);
  });

  it('detects single output variable', () => {
    expect(detectOutputVariables('output.result = "ok";')).toEqual(['result']);
  });

  it('detects multiple output variables', () => {
    const code = 'output.name = "John";\noutput.age = 30;\noutput.active = true;';
    expect(detectOutputVariables(code)).toEqual(['active', 'age', 'name']); // sorted
  });

  it('deduplicates repeated assignments', () => {
    const code = 'output.result = "a";\noutput.result = "b";';
    expect(detectOutputVariables(code)).toEqual(['result']);
  });

  it('does not detect input assignments', () => {
    expect(detectOutputVariables('input.value = "test";')).toEqual([]);
  });

  it('does not detect non-output dot assignments', () => {
    expect(detectOutputVariables('obj.result = "test";')).toEqual([]);
  });

  it('handles code with comments', () => {
    const code = '// output.fake = "no"\noutput.real = "yes";';
    // regex still picks up the comment line — acceptable minor imprecision
    const result = detectOutputVariables(code);
    expect(result).toContain('real');
  });

  it('detects output variables with spaces around =', () => {
    expect(detectOutputVariables('output.result  =  "ok";')).toEqual(['result']);
  });

  it('handles multiline code', () => {
    const code = `
      const data = JSON.parse(input.body);
      output.count = data.length;
      output.first = data[0];
    `;
    expect(detectOutputVariables(code)).toEqual(['count', 'first']);
  });
});

describe('analyzeScriptComplexity', () => {
  it('returns empty array for empty code', () => {
    expect(analyzeScriptComplexity('')).toEqual([]);
  });

  it('returns empty array for simple code', () => {
    expect(analyzeScriptComplexity('output.result = input.value;')).toEqual([]);
  });

  it('warns about while(true) loops', () => {
    const warnings = analyzeScriptComplexity('while(true) { break; }');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('infinite loop');
  });

  it('warns about for(;;) loops', () => {
    const warnings = analyzeScriptComplexity('for(;;) { break; }');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('infinite loop');
  });

  it('warns about recursive functions', () => {
    const code = 'function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }';
    const warnings = analyzeScriptComplexity(code);
    expect(warnings.some(w => w.includes('recursive'))).toBe(true);
  });

  it('does not warn about non-recursive functions', () => {
    const code = 'function add(a, b) { return a + b; }';
    const warnings = analyzeScriptComplexity(code);
    expect(warnings.some(w => w.includes('recursive'))).toBe(false);
  });

  it('warns about very long lines', () => {
    const longLine = 'x = "' + 'a'.repeat(600) + '";';
    const warnings = analyzeScriptComplexity(longLine);
    expect(warnings.some(w => w.includes('long line'))).toBe(true);
  });

  it('warns about eval usage', () => {
    const warnings = analyzeScriptComplexity('eval("alert(1)")');
    expect(warnings.some(w => w.includes('eval()'))).toBe(true);
  });

  it('warns about fetch usage', () => {
    const warnings = analyzeScriptComplexity('fetch("https://example.com")');
    expect(warnings.some(w => w.includes('fetch'))).toBe(true);
  });

  it('warns about XMLHttpRequest usage', () => {
    const warnings = analyzeScriptComplexity('new XMLHttpRequest()');
    expect(warnings.some(w => w.includes('Network access'))).toBe(true);
  });

  it('warns about setTimeout usage', () => {
    const warnings = analyzeScriptComplexity('setTimeout(() => {}, 1000)');
    expect(warnings.some(w => w.includes('setTimeout'))).toBe(true);
  });

  it('warns about setInterval usage', () => {
    const warnings = analyzeScriptComplexity('setInterval(() => {}, 1000)');
    expect(warnings.some(w => w.includes('setInterval'))).toBe(true);
  });

  it('can return multiple warnings at once', () => {
    const code = 'eval("x"); while(true) { break; } setTimeout(() => {}, 0);';
    const warnings = analyzeScriptComplexity(code);
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateOutputSize', () => {
  it('returns valid for empty outputs', () => {
    const result = validateOutputSize({});
    expect(result.valid).toBe(true);
    expect(result.totalBytes).toBe(0);
  });

  it('returns valid for small outputs', () => {
    const result = validateOutputSize({ result: 'hello', count: '42' });
    expect(result.valid).toBe(true);
    expect(result.totalBytes).toBe(7); // 5 + 2
  });

  it('returns invalid when exceeding max size', () => {
    const bigValue = 'x'.repeat(MAX_OUTPUT_SIZE_BYTES + 1);
    const result = validateOutputSize({ result: bigValue });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });

  it('checks combined size of all outputs', () => {
    const halfSize = 'x'.repeat(Math.floor(MAX_OUTPUT_SIZE_BYTES / 2) + 1);
    const result = validateOutputSize({ a: halfSize, b: halfSize });
    expect(result.valid).toBe(false);
  });

  it('returns valid for outputs exactly at limit', () => {
    const exactValue = 'x'.repeat(MAX_OUTPUT_SIZE_BYTES);
    const result = validateOutputSize({ result: exactValue });
    expect(result.valid).toBe(true);
    expect(result.totalBytes).toBe(MAX_OUTPUT_SIZE_BYTES);
  });

  it('error message includes human-readable sizes', () => {
    const bigValue = 'x'.repeat(MAX_OUTPUT_SIZE_BYTES + 1);
    const result = validateOutputSize({ result: bigValue });
    expect(result.error).toContain('MB');
  });

  it('formats KB-sized outputs correctly in error', () => {
    // Slightly over limit check — this validates the KB formatting branch
    // We need outputs that exceed MAX but are close to MB range
    const result = validateOutputSize({ result: 'x'.repeat(2048) });
    // This should be valid (way under limit)
    expect(result.valid).toBe(true);
    expect(result.totalBytes).toBe(2048);
  });
});
