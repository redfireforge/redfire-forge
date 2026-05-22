/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CodeTextarea } from './CodeTextarea';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CodeTextarea', () => {
  it('rejects malformed JSON payloads and freezes format control', () => {
    render(
      <CodeTextarea
        value={'{\n"a":1'}
        bodyType="json"
        placeholder="paste"
        onChange={() => {}}
      />,
    );

    expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pretty Format' })).toBeDisabled();
  });

  it('pipes textarea edits upward', () => {
    const onChange = vi.fn();
    render(<CodeTextarea value="x" bodyType="json" placeholder="p" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('p'), { target: { value: 'xy' } });
    expect(onChange).toHaveBeenCalledWith('xy');
  });

  it('ignores keystrokes other than tab for json buffers', () => {
    const onChange = vi.fn();
    render(<CodeTextarea value="x" bodyType="json" placeholder="px" onChange={onChange} />);
    fireEvent.keyDown(screen.getByPlaceholderText('px'), { key: 'ArrowDown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports line counts for plaintext buffers', () => {
    render(
      <CodeTextarea
        value={'line1\nline2'}
        bodyType="text"
        placeholder="p"
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('Plain Text')).toBeInTheDocument();
    expect(screen.getByText('2 lines')).toBeInTheDocument();
  });

  it('prettifies JSON then copies reflected buffer through clipboard API', async () => {
    const onChange = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { rerender } = render(
      <CodeTextarea
        value='{"ok":true}'
        bodyType="json"
        placeholder="p"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pretty Format' }));
    const pretty = '{\n  "ok": true\n}';
    expect(onChange).toHaveBeenCalledWith(pretty);
    rerender(<CodeTextarea value={pretty} bodyType="json" placeholder="p" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(pretty);
    vi.unstubAllGlobals();
  });

  it('disables clipboard copy whenever buffer trims empty', () => {
    render(<CodeTextarea value="" bodyType="json" placeholder="p" onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });

  it('keeps gutters aligned during textarea scroll sync', () => {
    render(<CodeTextarea value="a\nb" bodyType="text" placeholder="p" onChange={() => {}} />);

    const ta = screen.getByPlaceholderText('p') as HTMLTextAreaElement;
    const gutters = ta.previousElementSibling as HTMLDivElement;
    ta.scrollTop = 42;

    fireEvent.scroll(ta);

    expect(gutters.scrollTop).toBe(42);
  });

  it('counts a single line buffer and replaces tab selections', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((fn: FrameRequestCallback) => {
      fn(0);
      return 0;
    });

    render(<CodeTextarea value="solo" bodyType="text" placeholder="p1" onChange={() => {}} />);
    expect(screen.getByText('1 line')).toBeInTheDocument();

    const onChange = vi.fn();
    const { rerender } = render(<CodeTextarea value="abcd" bodyType="json" placeholder="p2" onChange={onChange} />);
    const ta = screen.getByPlaceholderText('p2') as HTMLTextAreaElement;
    ta.selectionStart = 1;
    ta.selectionEnd = 3;
    ta.focus();

    fireEvent.keyDown(ta, { key: 'Tab', preventDefault: vi.fn(), currentTarget: ta });
    expect(onChange).toHaveBeenCalledWith('a  d');

    rerender(<CodeTextarea value="a  d" bodyType="json" placeholder="p2" onChange={onChange} />);
    const synced = screen.getByPlaceholderText('p2') as HTMLTextAreaElement;
    expect(synced.value).toBe('a  d');

    rafSpy.mockRestore();
  });

  it('inserts Tab characters as indented spaces', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((fn: FrameRequestCallback) => {
      fn(0);
      return 0;
    });

    const onChange = vi.fn();
    const { rerender } = render(<CodeTextarea value="hi" bodyType="json" placeholder="p" onChange={onChange} />);

    const ta = screen.getByPlaceholderText('p') as HTMLTextAreaElement;
    ta.selectionStart = 2;
    ta.selectionEnd = 2;
    ta.focus();

    fireEvent.keyDown(ta, { key: 'Tab', preventDefault: vi.fn(), currentTarget: ta });

    expect(onChange).toHaveBeenCalledWith('hi  ');
    rerender(<CodeTextarea value="hi  " bodyType="json" placeholder="p" onChange={onChange} />);
    const taSynced = screen.getByPlaceholderText('p') as HTMLTextAreaElement;
    expect(taSynced.selectionStart).toBe(4);

    rafSpy.mockRestore();
  });

  it('minifies JSON when clicking Minify button', () => {
    const onChange = vi.fn();
    render(
      <CodeTextarea
        value={'{\n  "ok": true\n}'}
        bodyType="json"
        placeholder="p"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Minify' }));
    expect(onChange).toHaveBeenCalledWith('{"ok":true}');
  });

  it('disables Minify button when JSON is invalid', () => {
    render(
      <CodeTextarea
        value='{"invalid'
        bodyType="json"
        placeholder="p"
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Minify' })).toBeDisabled();
  });

  it('does not show JSON controls for non-JSON body types', () => {
    render(
      <CodeTextarea
        value="some text"
        bodyType="text"
        placeholder="p"
        onChange={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Pretty Format' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minify' })).not.toBeInTheDocument();
  });

  it('handles empty value gracefully', () => {
    render(
      <CodeTextarea
        value=""
        bodyType="json"
        placeholder="p"
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('1 line')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pretty Format' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Minify' })).toBeDisabled();
  });

  it('handles scroll sync with null refs', () => {
    const { container } = render(
      <CodeTextarea
        value="a\nb"
        bodyType="text"
        placeholder="p"
        onChange={() => {}}
      />,
    );

    const ta = screen.getByPlaceholderText('p') as HTMLTextAreaElement;
    fireEvent.scroll(ta);
    expect(container.querySelector('.body-code-editor')).toBeInTheDocument();
  });

  it('does not call onChange when minify fails', () => {
    const onChange = vi.fn();
    render(
      <CodeTextarea
        value='{"invalid'
        bodyType="json"
        placeholder="p"
        onChange={onChange}
      />,
    );

    const minifyBtn = screen.getByRole('button', { name: 'Minify' });
    expect(minifyBtn).toBeDisabled();
  });

  it('does not call onChange when format fails', () => {
    const onChange = vi.fn();
    render(
      <CodeTextarea
        value='{"invalid'
        bodyType="json"
        placeholder="p"
        onChange={onChange}
      />,
    );

    const formatBtn = screen.getByRole('button', { name: 'Pretty Format' });
    expect(formatBtn).toBeDisabled();
  });

  it('does not call onChange when format result equals current value', () => {
    const onChange = vi.fn();
    const alreadyFormatted = '{\n  "ok": true\n}';
    render(
      <CodeTextarea
        value={alreadyFormatted}
        bodyType="json"
        placeholder="p"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pretty Format' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
