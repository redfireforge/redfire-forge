/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ValidationResponsePreview from './ValidationResponsePreview';

describe('ValidationResponsePreview', () => {
  it('shows pending title and class when isPending', () => {
    render(<ValidationResponsePreview responsePreviewJson="{}" isPending />);
    expect(screen.getByText('Fetched response (pending apply)')).toBeInTheDocument();
    expect(document.querySelector('.validation-response-preview--pending')).toBeTruthy();
    expect(screen.getByLabelText('Fetched response preview')).toBeInTheDocument();
  });

  it('shows sample title when not pending', () => {
    render(<ValidationResponsePreview responsePreviewJson="{}" isPending={false} />);
    expect(screen.getByText('Current sample response')).toBeInTheDocument();
    expect(screen.getByLabelText('Current sample response')).toBeInTheDocument();
  });

  it('returns no search matches when json or term is empty', () => {
    render(<ValidationResponsePreview responsePreviewJson="" isPending={false} />);
    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: 'x' } });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('shows plural match count when index not focused', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"ab":"ab"}' isPending={false} />);
    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: 'ab' } });
    expect(screen.getByText('2 matches')).toBeInTheDocument();
  });

  it('shows singular match label for one occurrence', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"only":"z"}' isPending={false} />);
    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: 'z' } });
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('advances match index on Enter and shows position label', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"ab":"ab"}' isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('wraps to last match on Shift+Enter when index unset', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"xx":"xx"}' isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.change(input, { target: { value: 'xx' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('moves to previous match on Shift+Enter when index set', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"ab":"ab"}' isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('does not advance focus on Enter when there are no matches', () => {
    render(<ValidationResponsePreview responsePreviewJson="{}" isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.change(input, { target: { value: 'zzz' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('clears search on Escape when term non-empty', () => {
    render(<ValidationResponsePreview responsePreviewJson="{}" isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.change(input, { target: { value: 'z' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('does nothing on Escape when search is empty', () => {
    render(<ValidationResponsePreview responsePreviewJson="{}" isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('wraps to last match when Previous is clicked before any navigation', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"mm":"mm"}' isPending={false} />);
    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: 'mm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('cycles matches via next and previous buttons', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"yy":"yy"}' isPending={false} />);
    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: 'yy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('disables navigation buttons when there are no matches', () => {
    render(<ValidationResponsePreview responsePreviewJson="{}" isPending={false} />);
    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: 'nomatch' } });
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled();
  });

  it('clears via clear button when search has text', () => {
    render(<ValidationResponsePreview responsePreviewJson="{}" isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
  });

  it('toggles the preview from the header click and keyboard handlers', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"ab":"ab"}' isPending={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sample response' }));
    expect(screen.queryByLabelText('Search sample response')).toBeNull();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Expand sample response' }), { key: ' ' });
    expect(screen.getByLabelText('Search sample response')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Collapse sample response' }), { key: 'Enter' });
    expect(screen.queryByLabelText('Search sample response')).toBeNull();
  });

  it('focuses and selects the active match when navigating results', () => {
    render(<ValidationResponsePreview responsePreviewJson='line1\n{"ab":"ab"}' isPending={false} />);
    const textarea = screen.getByLabelText('Current sample response') as HTMLTextAreaElement;
    const focusSpy = vi.spyOn(textarea, 'focus');
    const selectionSpy = vi.spyOn(textarea, 'setSelectionRange');
    Object.defineProperty(textarea, 'clientHeight', { value: 48, configurable: true });

    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));

    expect(focusSpy).toHaveBeenCalled();
    expect(selectionSpy).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });

  it('pretty-prints the sample response by default', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"a":1,"b":{"c":2}}' isPending={false} />);
    const textarea = screen.getByLabelText('Current sample response') as HTMLTextAreaElement;
    expect(textarea.value).toBe('{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}');
    expect(textarea.rows).toBe(16);
    expect(screen.getByRole('button', { name: 'Pretty-print JSON' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back to the raw payload when pretty mode toggles off', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"a":1}' isPending={false} />);
    const prettyBtn = screen.getByRole('button', { name: 'Pretty-print JSON' });

    fireEvent.click(prettyBtn);

    const textarea = screen.getByLabelText('Current sample response') as HTMLTextAreaElement;
    expect(textarea.value).toBe('{"a":1}');
    expect(textarea.rows).toBe(8);
    expect(prettyBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the raw string when the payload is not valid JSON', () => {
    render(<ValidationResponsePreview responsePreviewJson='not-json{' isPending={false} />);
    const textarea = screen.getByLabelText('Current sample response') as HTMLTextAreaElement;
    expect(textarea.value).toBe('not-json{');
  });

  it('reports the raw payload size regardless of formatting', () => {
    const raw = `{"pad":"${'x'.repeat(1024)}"}`;
    render(<ValidationResponsePreview responsePreviewJson={raw} isPending={false} />);
    // Formatting adds whitespace; the meta must reflect what came off the wire.
    expect(screen.getByText(`${(raw.length / 1024).toFixed(1)} KB`)).toBeInTheDocument();
  });

  it('does not collapse the panel when the pretty toggle is clicked', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"a":1}' isPending={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pretty-print JSON' }));

    expect(screen.getByLabelText('Search sample response')).toBeInTheDocument();
  });

  it('searches against the formatted text so match offsets line up', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"a":1}' isPending={false} />);
    // `": 1` only exists once the payload is pretty-printed.
    fireEvent.change(screen.getByLabelText('Search sample response'), { target: { value: '": 1' } });
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });

  it('resets search index when search term changes', () => {
    render(<ValidationResponsePreview responsePreviewJson='{"ab":"ab","xy":"z"}' isPending={false} />);
    const input = screen.getByLabelText('Search sample response');
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // Change search term — should reset index (show count without position)
    fireEvent.change(input, { target: { value: 'xy' } });
    expect(screen.getByText('1 match')).toBeInTheDocument();
  });
});
