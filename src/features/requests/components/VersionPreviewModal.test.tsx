/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VersionPreviewModal from './VersionPreviewModal';

describe('VersionPreviewModal', { timeout: 30_000 }, () => {
  const onClose = vi.fn();
  const clipboardWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    onClose.mockClear();
    clipboardWriteText.mockClear();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      configurable: true,
      writable: true,
    });
    Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
  });

  function renderModal(props: Partial<ComponentProps<typeof VersionPreviewModal>> = {}) {
    return render(
      <VersionPreviewModal
        title="Preview"
        content='{"x":1}'
        language="json"
        onClose={onClose}
        {...props}
      />,
    );
  }

  it('renders title, line count, Copy and Close', () => {
    renderModal({ content: 'a\nb', language: 'dsl' });
    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByText('2 lines')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('shows optional subtitle and tags (with optional color)', () => {
    const { container } = renderModal({
      subtitle: 'v1',
      tags: [{ label: 'draft' }, { label: 'hot', color: '#f00' }],
      language: 'dsl',
      content: 'ok',
    });
    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.getByText('draft')).toBeTruthy();
    const hot = screen.getByText('hot');
    expect((hot as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
    expect(container.querySelector('.vp-tags')).toBeTruthy();
  });

  it('does not render subtitle or tag strip when omitted or tags empty', () => {
    const { rerender, container } = render(
      <VersionPreviewModal title="Preview" content="hi" language="dsl" onClose={onClose} tags={[]} />,
    );
    expect(container.querySelector('.vp-subtitle')).toBeNull();
    expect(container.querySelector('.vp-tags')).toBeNull();
    rerender(<VersionPreviewModal title="Preview" content="hi" language="dsl" onClose={onClose} />);
    expect(container.querySelector('.vp-tags')).toBeNull();
  });

  it('pretty-prints valid JSON and leaves invalid JSON raw', () => {
    const { rerender } = renderModal({ content: '{"b":2,"a":1}', language: 'json' });
    const pre = screen.getByText(/"a"/).closest('pre');
    expect(pre?.textContent).toContain('"a"');
    expect(pre?.textContent).toContain('"b"');
    expect(pre?.innerHTML).toContain('vp-key');
    expect(pre?.innerHTML).toContain('vp-number');
    rerender(
      <VersionPreviewModal title="Preview" content="{ not json" language="json" onClose={onClose} />,
    );
    const pre2 = document.querySelector('.vp-code');
    expect(pre2?.textContent).toContain('{ not json');
  });

  it('uses raw content for dsl and highlights operators, comments, and paths', () => {
    const dsl = '# comment\n$.user.email equals "x"\nnull';
    renderModal({ content: dsl, language: 'dsl' });
    const pre = document.querySelector('.vp-code') as HTMLElement;
    expect(pre.innerHTML).toContain('vp-comment');
    expect(pre.innerHTML).toContain('vp-path');
    expect(pre.innerHTML).toContain('vp-operator');
  });

  it('closes when Close is clicked', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking the backdrop overlay', () => {
    const { container } = renderModal();
    const overlay = container.querySelector('.vp-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal', () => {
    const { container } = renderModal();
    const modal = container.querySelector('.vp-modal') as HTMLElement;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape when search is empty', () => {
    renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears search on Escape when query is non-empty instead of closing (window listener)', async () => {
    renderModal({ content: 'hello', language: 'dsl' });
    const input = screen.getByPlaceholderText(/Search/);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('focuses search on Meta+F and Ctrl+F', () => {
    renderModal();
    const input = screen.getByPlaceholderText(/Search/) as HTMLInputElement;
    const focusSpy = vi.spyOn(input, 'focus');
    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(focusSpy).toHaveBeenCalledTimes(2);
  });

  it('shows match count, marks matching gutter lines, and highlights hits', async () => {
    renderModal({ content: 'alpha\nbeta\nalpha', language: 'dsl' });
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, 'alpha');
    expect(screen.getByText('1/2')).toBeTruthy();
    const lines = document.querySelectorAll('.vp-line-number--match');
    expect(lines.length).toBe(2);
    const pre = document.querySelector('.vp-code') as HTMLElement;
    expect(pre.innerHTML).toContain('vp-search-hit');
    expect(pre.innerHTML).toContain('vp-search-hit--active');
  });

  it('shows No match when query does not match', async () => {
    renderModal({ content: 'zzz', language: 'dsl' });
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, 'nomatch');
    expect(screen.getByText('No match')).toBeTruthy();
    expect(screen.getByTitle('Next match (Enter)')).toBeDisabled();
    expect(screen.getByTitle('Previous match (Shift+Enter)')).toBeDisabled();
  });

  it('escapes regex metacharacters in the search query', async () => {
    renderModal({ content: 'a+b line', language: 'dsl' });
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, 'a+b');
    const pre = document.querySelector('.vp-code') as HTMLElement;
    expect(pre.innerHTML).toContain('vp-search-hit');
  });

  it('navigates matches with Enter and Shift+Enter from the search input', async () => {
    renderModal({ content: 'foo\nbar\nfoo', language: 'dsl' });
    const input = screen.getByPlaceholderText(/Search/);
    await userEvent.type(input, 'foo');
    let pre = document.querySelector('.vp-code') as HTMLElement;
    expect(pre.innerHTML).toContain('vp-search-hit--active');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    pre = document.querySelector('.vp-code') as HTMLElement;
    const activeMatches = pre.innerHTML.match(/vp-search-hit--active/g);
    expect(activeMatches?.length).toBeGreaterThan(0);
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('wraps next/prev match and scrolls the gutter line into view', async () => {
    const user = userEvent.setup();
    renderModal({ content: 'hit\nhit', language: 'dsl' });
    const input = screen.getByPlaceholderText(/Search/);
    await user.type(input, 'hit');
    const nextBtn = screen.getByTitle('Next match (Enter)');
    const prevBtn = screen.getByTitle('Previous match (Shift+Enter)');
    await user.click(nextBtn);
    await user.click(nextBtn);
    await user.click(prevBtn);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('Copy writes displayed content and shows confirmation', async () => {
    vi.useFakeTimers();
    try {
      const content = '{"z":true}';
      renderModal({ content, language: 'json' });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await Promise.resolve();
      });
      expect(clipboardWriteText).toHaveBeenCalledWith(JSON.stringify(JSON.parse(content), null, 2));
      expect(screen.getByRole('button', { name: '✓ Copied' })).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Enter on search still calls next/prev handlers when there are no matches', () => {
    renderModal({ content: 'solo', language: 'dsl' });
    const input = screen.getByPlaceholderText(/Search/);
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('No match')).toBeTruthy();
  });

  it('wraps JSON token highlighting for boolean, null, and comparison-like numbers', () => {
    renderModal({
      content: '{"flag": false, "empty": null, "sci": 1e2}',
      language: 'json',
    });
    const pre = document.querySelector('.vp-code') as HTMLElement;
    expect(pre.innerHTML).toContain('vp-bool');
    expect(pre.innerHTML).toContain('vp-null');
    expect(pre.innerHTML).toContain('vp-number');
  });

  it('highlights JSON keys and string values that contain escaped quotes', () => {
    renderModal({
      content: '{"say":"line with \\"quoted\\" bit"}',
      language: 'json',
    });
    const pre = document.querySelector('.vp-code') as HTMLElement;
    expect(pre.innerHTML).toContain('vp-key');
    expect(pre.innerHTML).toContain('vp-string');
    expect(pre.textContent).toContain('quoted');
  });

  it('highlights dsl comparison operators', () => {
    renderModal({ content: '$.n > 0\n$.n <= 1', language: 'dsl' });
    const pre = document.querySelector('.vp-code') as HTMLElement;
    expect(pre.innerHTML).toMatch(/vp-operator/);
  });
});
