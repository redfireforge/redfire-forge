/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SCRIPT_MODE_OPTIONS, initMockInputs, useScriptTest } from './useScriptTest';
import type { ScriptNodeData } from '../../types/workflow';

vi.mock('../../engine/scriptSandbox', () => ({
  executeScript: vi.fn(() => ({
    success: true,
    outputs: { result: 'ok' },
    consoleLogs: ['log1'],
    durationMs: 5,
  })),
}));

vi.mock('../../engine/scriptAnalysis', () => ({
  detectOutputVariables: vi.fn((code: string) =>
    code.includes('output.') ? ['result'] : [],
  ),
  analyzeScriptComplexity: vi.fn((code: string) =>
    code.length > 200 ? ['complex'] : [],
  ),
  inferMockInputs: vi.fn(() => ({ x: '42' })),
  validateOutputSize: vi.fn(),
}));

vi.mock('../../engine/scriptLibraries', () => ({
  loadScriptLibraries: vi.fn(() => []),
  buildLibraryPreamble: vi.fn(() => ''),
}));

import { executeScript } from '../../engine/scriptSandbox';
import { detectOutputVariables } from '../../engine/scriptAnalysis';
import { buildLibraryPreamble } from '../../engine/scriptLibraries';

const mockExecuteScript = vi.mocked(executeScript);
const mockDetectOutputVariables = vi.mocked(detectOutputVariables);
const mockBuildLibraryPreamble = vi.mocked(buildLibraryPreamble);

function makeData(overrides: Partial<ScriptNodeData> = {}): ScriptNodeData {
  return {
    label: 'test',
    mode: 'transform',
    code: 'output.result = input.x;',
    inputVariables: ['x'],
    outputVariables: ['result'],
    timeoutMs: 5000,
    captureConsole: false,
    ...overrides,
  };
}

// ─── SCRIPT_MODE_OPTIONS ──────────────────────────────

describe('SCRIPT_MODE_OPTIONS', () => {
  it('contains all three modes', () => {
    expect(SCRIPT_MODE_OPTIONS).toHaveLength(3);
    expect(SCRIPT_MODE_OPTIONS.map(o => o.value)).toEqual(['transform', 'validate', 'generate']);
  });

  it('each option has label and description', () => {
    for (const opt of SCRIPT_MODE_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(opt.description).toBeTruthy();
    }
  });
});

// ─── initMockInputs ──────────────────────────────────

describe('initMockInputs', () => {
  it('populates from workflow variables', () => {
    const result = initMockInputs(['x', 'y'], { x: 'hello', y: 'world' });
    expect(result).toEqual({ x: 'hello', y: 'world' });
  });

  it('skips empty variable names', () => {
    const result = initMockInputs(['', 'x'], { x: '1' });
    expect(result).toEqual({ x: '1' });
  });

  it('skips variables not in workflow', () => {
    const result = initMockInputs(['x', 'y'], { x: '1' });
    expect(result).toEqual({ x: '1' });
  });

  it('returns empty for empty inputs', () => {
    expect(initMockInputs([], {})).toEqual({});
  });
});

// ─── useScriptTest hook ──────────────────────────────

describe('useScriptTest', () => {
  it('initializes with null testResult', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    expect(result.current.testResult).toBeNull();
  });

  it('populates mockInputs from workflow variables', () => {
    const { result } = renderHook(() =>
      useScriptTest(makeData(), { x: 'from-wf' }),
    );
    expect(result.current.mockInputs).toEqual({ x: 'from-wf' });
  });

  it('handleTestScript executes and sets result', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    act(() => result.current.handleTestScript());
    expect(mockExecuteScript).toHaveBeenCalled();
    expect(result.current.testResult).toBeTruthy();
    expect(result.current.testResult!.success).toBe(true);
  });

  it('handleAutoDetect returns detected variables', () => {
    const { result } = renderHook(() =>
      useScriptTest(makeData({ code: 'output.foo = 1;' }), {}),
    );
    const detected = result.current.handleAutoDetect();
    expect(mockDetectOutputVariables).toHaveBeenCalledWith('output.foo = 1;');
    expect(detected).toEqual(['result']);
  });

  it('handleAutoDetect returns empty when no outputs', () => {
    mockDetectOutputVariables.mockReturnValueOnce([]);
    const { result } = renderHook(() =>
      useScriptTest(makeData({ code: 'const x = 1;' }), {}),
    );
    const detected = result.current.handleAutoDetect();
    expect(detected).toEqual([]);
  });

  it('handleMockInputChange updates mockInputs', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    act(() => result.current.handleMockInputChange('x', 'new-value'));
    expect(result.current.mockInputs.x).toBe('new-value');
  });

  it('provides inferredDefaults', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    expect(result.current.inferredDefaults).toEqual({ x: '42' });
  });

  it('provides complexityWarnings for short code', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    expect(result.current.complexityWarnings).toEqual([]);
  });

  it('provides libraries as empty array', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    expect(result.current.libraries).toEqual([]);
  });

  it('setTestResult can clear result', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    act(() => result.current.handleTestScript());
    expect(result.current.testResult).toBeTruthy();
    act(() => result.current.setTestResult(null));
    expect(result.current.testResult).toBeNull();
  });

  it('setMockInputs replaces all inputs', () => {
    const { result } = renderHook(() => useScriptTest(makeData(), {}));
    act(() => result.current.setMockInputs({ x: 'a', y: 'b' }));
    expect(result.current.mockInputs).toEqual({ x: 'a', y: 'b' });
  });

  it('handleTestScript uses workflowVariables fallback when mockInputs empty', () => {
    const { result } = renderHook(() =>
      useScriptTest(makeData(), { x: 'wf-val' }),
    );
    // Clear mockInputs so the fallback chain hits workflowVariables
    act(() => result.current.setMockInputs({}));
    act(() => result.current.handleTestScript());
    expect(mockExecuteScript).toHaveBeenCalled();
    const callArgs = mockExecuteScript.mock.calls[mockExecuteScript.mock.calls.length - 1];
    expect(callArgs[1]).toEqual({ x: 'wf-val' });
  });

  it('handleTestScript uses inferredDefaults fallback', () => {
    // inferredDefaults returns { x: '42' } from mock
    const { result } = renderHook(() =>
      useScriptTest(makeData(), {}),
    );
    act(() => result.current.setMockInputs({}));
    act(() => result.current.handleTestScript());
    const callArgs = mockExecuteScript.mock.calls[mockExecuteScript.mock.calls.length - 1];
    expect(callArgs[1]).toEqual({ x: '42' });
  });

  it('handleTestScript falls back to "test" when all sources empty', () => {
    const { result } = renderHook(() =>
      useScriptTest(makeData({ inputVariables: ['unknown'] }), {}),
    );
    act(() => result.current.handleTestScript());
    const callArgs = mockExecuteScript.mock.calls[mockExecuteScript.mock.calls.length - 1];
    expect(callArgs[1]).toEqual({ unknown: 'test' });
  });

  it('handleTestScript passes library preamble when libraryIds present', () => {
    mockBuildLibraryPreamble.mockReturnValueOnce('// preamble');
    const { result } = renderHook(() =>
      useScriptTest(makeData({ libraryIds: ['lib1'] }), {}),
    );
    act(() => result.current.handleTestScript());
    expect(mockBuildLibraryPreamble).toHaveBeenCalled();
    const callArgs = mockExecuteScript.mock.calls[mockExecuteScript.mock.calls.length - 1];
    expect(callArgs[2]).toBe('// preamble');
  });

  it('handleTestScript passes undefined preamble when no libraryIds', () => {
    const { result } = renderHook(() =>
      useScriptTest(makeData(), {}),
    );
    act(() => result.current.handleTestScript());
    const callArgs = mockExecuteScript.mock.calls[mockExecuteScript.mock.calls.length - 1];
    expect(callArgs[2]).toBeUndefined();
  });

  it('handleTestScript skips empty variable names', () => {
    const { result } = renderHook(() =>
      useScriptTest(makeData({ inputVariables: ['', 'x'] }), {}),
    );
    act(() => result.current.handleTestScript());
    const callArgs = mockExecuteScript.mock.calls[mockExecuteScript.mock.calls.length - 1];
    // Empty string variable should be skipped
    expect(Object.keys(callArgs[1])).not.toContain('');
    expect(callArgs[1]).toHaveProperty('x');
  });
});
