/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScriptTestResult from './ScriptTestResult';
import type { ScriptResult } from '../../engine/scriptSandbox';

function makeResult(overrides: Partial<ScriptResult> = {}): ScriptResult {
  return {
    success: true,
    outputs: {},
    consoleLogs: [],
    durationMs: 12.5,
    ...overrides,
  };
}

describe('ScriptTestResult', () => {
  it('renders passed state', () => {
    render(<ScriptTestResult result={makeResult()} />);
    expect(screen.getByText(/Passed/)).toBeTruthy();
    expect(screen.getByText(/12\.5ms/)).toBeTruthy();
  });

  it('renders failed state', () => {
    render(<ScriptTestResult result={makeResult({ success: false })} />);
    expect(screen.getByText(/Failed/)).toBeTruthy();
  });

  it('renders error message when present', () => {
    render(<ScriptTestResult result={makeResult({ success: false, error: 'timeout exceeded' })} />);
    expect(screen.getByText('timeout exceeded')).toBeTruthy();
  });

  it('does not render error when not present', () => {
    const { container } = render(<ScriptTestResult result={makeResult()} />);
    expect(container.querySelector('.wf-script-test-error')).toBeNull();
  });

  it('renders outputs', () => {
    render(<ScriptTestResult result={makeResult({ outputs: { foo: 'bar', baz: '42' } })} />);
    expect(screen.getByText('foo')).toBeTruthy();
    expect(screen.getByText('bar')).toBeTruthy();
    expect(screen.getByText('baz')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('truncates long output values at default length', () => {
    const longVal = 'x'.repeat(250);
    render(<ScriptTestResult result={makeResult({ outputs: { key: longVal } })} />);
    // Should truncate at 200 chars (197 + …)
    expect(screen.getByText(/x{197}…/)).toBeTruthy();
  });

  it('truncates at custom maxOutputLength', () => {
    const longVal = 'y'.repeat(150);
    render(<ScriptTestResult result={makeResult({ outputs: { key: longVal } })} maxOutputLength={50} />);
    expect(screen.getByText(/y{47}…/)).toBeTruthy();
  });

  it('does not truncate short values', () => {
    render(<ScriptTestResult result={makeResult({ outputs: { key: 'short' } })} />);
    expect(screen.getByText('short')).toBeTruthy();
  });

  it('renders console logs', () => {
    render(<ScriptTestResult result={makeResult({ consoleLogs: ['hello', 'world'] })} />);
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByText('world')).toBeTruthy();
  });

  it('hides console section when empty', () => {
    const { container } = render(<ScriptTestResult result={makeResult()} />);
    expect(container.querySelector('.wf-script-test-console')).toBeNull();
  });

  it('hides outputs section when empty', () => {
    const { container } = render(<ScriptTestResult result={makeResult()} />);
    expect(container.querySelector('.wf-script-test-outputs')).toBeNull();
  });

  it('applies pass CSS class', () => {
    const { container } = render(<ScriptTestResult result={makeResult()} />);
    expect(container.querySelector('.wf-script-test-pass')).toBeTruthy();
    expect(container.querySelector('.wf-script-test-fail')).toBeNull();
  });

  it('applies fail CSS class', () => {
    const { container } = render(<ScriptTestResult result={makeResult({ success: false })} />);
    expect(container.querySelector('.wf-script-test-fail')).toBeTruthy();
    expect(container.querySelector('.wf-script-test-pass')).toBeNull();
  });

  it('renders all sections together', () => {
    const result = makeResult({
      success: false,
      error: 'oops',
      outputs: { a: '1' },
      consoleLogs: ['log'],
      durationMs: 99.9,
    });
    const { container } = render(<ScriptTestResult result={result} />);
    expect(screen.getByText(/99\.9ms/)).toBeTruthy();
    expect(screen.getByText('oops')).toBeTruthy();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('log')).toBeTruthy();
    expect(container.querySelector('.wf-script-test-fail')).toBeTruthy();
  });
});
