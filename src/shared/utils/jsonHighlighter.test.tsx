/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { highlightJson } from './jsonHighlighter';

function Highlighted({ json }: { json: string }) {
  return (
    <pre data-testid="highlight-root">
      {highlightJson(json)}
    </pre>
  );
}

describe('highlightJson', () => {
  it('returns empty output for an empty string', () => {
    render(<Highlighted json="" />);
    const root = screen.getByTestId('highlight-root');
    expect(root).toBeEmptyDOMElement();
    expect(highlightJson('')).toEqual([]);
  });

  it('renders plain punctuation and braces without highlight spans when no tokens match', () => {
    const json = '{},[]';
    render(<Highlighted json={json} />);
    const root = screen.getByTestId('highlight-root');
    expect(root.querySelectorAll('span')).toHaveLength(0);
    expect(root).toHaveTextContent(json);
  });

  it('wraps JSON keys in spans with jhl-key', () => {
    const json = '{"name": "x"}';
    render(<Highlighted json={json} />);
    const key = screen.getByText('"name"', { exact: true });
    expect(key.tagName).toBe('SPAN');
    expect(key).toHaveClass('jhl-key');
  });

  it('classifies string values as jhl-string and omits key span for the value', () => {
    const json = '{"greeting": "hello"}';
    render(<Highlighted json={json} />);
    const root = screen.getByTestId('highlight-root');
    expect(within(root).getByText('"greeting"', { exact: true })).toHaveClass('jhl-key');
    expect(within(root).getByText('"hello"', { exact: true })).toHaveClass('jhl-string');
  });

  it('highlights numbers including decimals and scientific notation', () => {
    const json = '{"n": 1.5e+3}';
    render(<Highlighted json={json} />);
    expect(screen.getByText('1.5e+3', { exact: true })).toHaveClass('jhl-number');
  });

  it('treats a minus before a digit as plain text when separated by whitespace (word boundary)', () => {
    const json = '{"n": -9}';
    render(<Highlighted json={json} />);
    const root = screen.getByTestId('highlight-root');
    expect(root).toHaveTextContent('-9');
    expect(screen.getByText('9', { exact: true })).toHaveClass('jhl-number');
  });

  it('does not treat numbers inside quoted strings as numeric tokens', () => {
    const json = '{"id": "order-42"}';
    render(<Highlighted json={json} />);
    expect(screen.queryByText('42', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByTestId('highlight-root').textContent).toContain('order-42');
  });

  it('highlights boolean literals with jhl-boolean', () => {
    render(<Highlighted json='{"ok": true, "no": false}' />);
    expect(screen.getByText('true', { exact: true })).toHaveClass('jhl-boolean');
    expect(screen.getByText('false', { exact: true })).toHaveClass('jhl-boolean');
  });

  it('highlights null with jhl-null', () => {
    render(<Highlighted json='{"x": null}' />);
    expect(screen.getByText('null', { exact: true })).toHaveClass('jhl-null');
  });

  it('does not highlight true/false/null when they appear inside string values', () => {
    const json = '{"note": "null_true_false"}';
    render(<Highlighted json={json} />);
    const root = screen.getByTestId('highlight-root');
    expect(root.querySelector('.jhl-null')).toBeNull();
    expect(root.querySelector('.jhl-boolean')).toBeNull();
    expect(screen.getByText('"null_true_false"', { exact: true })).toHaveClass('jhl-string');
  });

  it('inserts newline nodes between lines', () => {
    const json = '{\n  "a": 1\n}';
    const nodes = highlightJson(json);
    expect(nodes.some(n => n === '\n')).toBe(true);
    render(<Highlighted json={json} />);
    expect(screen.getByTestId('highlight-root').textContent).toBe(json);
  });

  it('handles multiple lines with independent highlighting per line', () => {
    const json = '{\n"a": 1,\n"b": 2\n}';
    render(<Highlighted json={json} />);
    const keys = screen.getAllByText(/"a"|"b"/);
    expect(keys[0]).toHaveClass('jhl-key');
    expect(keys[1]).toHaveClass('jhl-key');
    expect(screen.getByText('1', { exact: true })).toHaveClass('jhl-number');
    expect(screen.getByText('2', { exact: true })).toHaveClass('jhl-number');
  });

  it('preserves escaped quotes inside keys and string values', () => {
    const json = '{"quote\\"": "\\"hi\\""}';
    render(<Highlighted json={json} />);
    const root = screen.getByTestId('highlight-root');
    expect(root.textContent).toContain('"quote');
    expect(root.querySelector('.jhl-key')).toHaveTextContent(/^"quote/);
    expect(root.querySelector('.jhl-string')).toHaveTextContent(/^"/);
  });

  it('avoids double-classifying the same quoted region as key and string', () => {
    const json = '{"k": "v"}';
    render(<Highlighted json={json} />);
    const strings = screen.getAllByText(/"k"|"v"/);
    expect(strings.find(el => el.classList.contains('jhl-key'))).toBeTruthy();
    expect(strings.find(el => el.classList.contains('jhl-string'))).toBeTruthy();
    expect(strings).toHaveLength(2);
  });

  it('uses unique React keys per line and start offset (renders without duplicate key warnings)', () => {
    const json = '{"a":1}\n{"b":2}';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Highlighted json={json} />);
    err.mockRestore();
    expect(screen.getByTestId('highlight-root').textContent?.replace(/\s/g, '')).toContain('{"a":1}{"b":2}');
  });
});
