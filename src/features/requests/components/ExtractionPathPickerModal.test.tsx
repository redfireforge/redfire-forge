/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExtractionPathPickerModal from './ExtractionPathPickerModal';

vi.mock('../../../shared/hooks/useDebounce', () => ({
  useDebounce: (v: string) => v,
}));

const sampleJson = JSON.stringify({ data: { id: 42, name: 'test' }, items: [{ code: 'A' }] });

function renderModal(overrides: Partial<React.ComponentProps<typeof ExtractionPathPickerModal>> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <ExtractionPathPickerModal
      initialExpression="$.data.id"
      initialSampleJson={sampleJson}
      onApply={onApply}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...result, onApply, onClose };
}

describe('ExtractionPathPickerModal', () => {
  it('uses the dedicated extraction picker overlay styling', () => {
    const { container } = renderModal();
    expect(container.querySelector('.epp-overlay')).toBeTruthy();
  });

  it('shows expression input with initial value', () => {
    renderModal();
    const input = screen.getByPlaceholderText(/data.id.*items/) as HTMLInputElement;
    expect(input.value).toBe('$.data.id');
  });

  it('shows preview for a valid path', () => {
    renderModal();
    expect(screen.getByText('Preview at path:')).toBeTruthy();
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  });

  it('shows missing message for invalid path', () => {
    renderModal({ initialExpression: '$.nonexistent' });
    expect(screen.getByText('No value at this path in the sample JSON.')).toBeTruthy();
  });

  it('fires onApply with expression', () => {
    const { onApply } = renderModal();
    fireEvent.click(screen.getByText('Use this path'));
    expect(onApply).toHaveBeenCalledWith('$.data.id');
  });

  it('disables apply button when expression is empty', () => {
    renderModal({ initialExpression: '' });
    const btn = screen.getByText('Use this path') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('fires onClose from cancel', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows field count', () => {
    renderModal();
    expect(screen.getByText(/field/)).toBeTruthy();
  });

  it('prettify button formats JSON', () => {
    renderModal();
    fireEvent.click(screen.getByText('Prettify'));
    const textarea = screen.getByPlaceholderText(/Paste JSON here/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('\n');
  });

  it('clear button empties sample JSON', () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Clear sample JSON'));
    const textarea = screen.getByPlaceholderText(/Paste JSON here/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('shows parse error for invalid JSON', () => {
    renderModal({ initialSampleJson: '{bad' });
    expect(screen.getByText(/Parse error:/)).toBeTruthy();
  });

  it('clear path button empties expression', () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Clear selected path'));
    const input = screen.getByPlaceholderText(/data.id.*items/) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('shows normalized expression hint', () => {
    renderModal();
    expect(screen.getByText(/Normalized:/)).toBeTruthy();
  });

  it('typing in expression updates value', () => {
    renderModal({ initialExpression: '' });
    const input = screen.getByPlaceholderText(/data.id.*items/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '$.items[0].code' } });
    expect(input.value).toBe('$.items[0].code');
  });

  it('search input shows match actions when results found', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Search keys or paths…'), { target: { value: 'id' } });
    expect(screen.getByText(/Use first match/)).toBeTruthy();
  });

  it('use first match sets expression from search', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Search keys or paths…'), { target: { value: 'id' } });
    fireEvent.click(screen.getByText(/Use first match/));
    const input = screen.getByPlaceholderText(/data.id.*items/) as HTMLInputElement;
    expect(input.value).toMatch(/^\$\./);
  });

  it('wildcard button replaces numeric indices', () => {
    renderModal({ initialExpression: '$.items[0].code' });
    fireEvent.click(screen.getByText('Replace numeric indices with [*]'));
    const input = screen.getByPlaceholderText(/data.id.*items/) as HTMLInputElement;
    expect(input.value).toBe('$.items[*].code');
  });

  it('no wildcard button when path has no numeric indices', () => {
    renderModal({ initialExpression: '$.data.id' });
    expect(screen.queryByText('Replace numeric indices with [*]')).toBeNull();
  });

  it('renders fetch button when fetchSample provided', () => {
    renderModal({
      fetchSample: { onFetch: vi.fn(), fetching: false, error: null },
    });
    expect(screen.getByText('Fetch Response')).toBeTruthy();
  });

  it('shows fetching state', () => {
    renderModal({
      fetchSample: { onFetch: vi.fn(), fetching: true, error: null },
    });
    expect(screen.getByText('Fetching…')).toBeTruthy();
  });

  it('shows fetch error', () => {
    renderModal({
      fetchSample: { onFetch: vi.fn(), fetching: false, error: 'Network error' },
    });
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('renders host override controls', () => {
    renderModal({
      fetchSample: {
        onFetch: vi.fn(), fetching: false, error: null,
        host: { enabled: false, setEnabled: vi.fn(), override: '', setOverride: vi.fn(), resolvedBaseUrl: 'https://api.example.com' },
      },
    });
    expect(screen.getByText('Host Override')).toBeTruthy();
  });

  it('fires host setEnabled on checkbox toggle', () => {
    const setEnabled = vi.fn();
    renderModal({
      fetchSample: {
        onFetch: vi.fn(), fetching: false, error: null,
        host: { enabled: false, setEnabled, override: '', setOverride: vi.fn(), resolvedBaseUrl: '' },
      },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it('shows Use Settings button and fills override', () => {
    const setOverride = vi.fn();
    renderModal({
      fetchSample: {
        onFetch: vi.fn(), fetching: false, error: null,
        host: { enabled: true, setEnabled: vi.fn(), override: '', setOverride, resolvedBaseUrl: 'https://api.example.com' },
      },
    });
    fireEvent.click(screen.getByText('Use Settings'));
    expect(setOverride).toHaveBeenCalledWith('https://api.example.com');
  });

  it('does not render tree when no sample JSON', () => {
    renderModal({ initialSampleJson: '' });
    expect(screen.queryByText(/fields? in tree/)).toBeNull();
  });

  it('textarea onChange updates sample JSON', () => {
    renderModal({ initialSampleJson: '' });
    const textarea = screen.getByPlaceholderText(/Paste JSON here/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"a":1}' } });
    expect(textarea.value).toBe('{"a":1}');
  });

  it('match chips are clickable', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Search keys or paths…'), { target: { value: 'id' } });
    const chips = screen.getAllByRole('listitem');
    expect(chips.length).toBeGreaterThan(0);
    fireEvent.click(chips[0]);
    const input = screen.getByPlaceholderText(/data.id.*items/) as HTMLInputElement;
    expect(input.value).toMatch(/^\$\./);
  });

  it('clear if matched clears expression when it matches', () => {
    renderModal({ initialExpression: '$.data.id' });
    fireEvent.change(screen.getByPlaceholderText('Search keys or paths…'), { target: { value: 'id' } });
    fireEvent.click(screen.getByTitle('Clear path if it is one of the matches'));
    const input = screen.getByPlaceholderText(/data.id.*items/) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('preview shows string value for string path', () => {
    renderModal({ initialExpression: '$.data.name' });
    expect(screen.getByText('test')).toBeTruthy();
  });

  it('clears fixed drag positioning when returning to fullscreen', () => {
    const { container } = renderModal();
    const modal = container.querySelector('[role="dialog"]') as HTMLElement;
    const header = container.querySelector('.ram-header') as HTMLElement;

    expect(modal.classList.contains('modal-fullscreen')).toBe(true);

    fireEvent.click(screen.getAllByLabelText('Shrink modal')[0]);
    expect(modal.classList.contains('modal-fullscreen')).toBe(false);

    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 80,
      width: 900,
      height: 700,
      right: 1000,
      bottom: 780,
      x: 100,
      y: 80,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.mouseDown(header, { clientX: 150, clientY: 110 });
    fireEvent.mouseMove(window, { clientX: 190, clientY: 150 });

    expect(modal.style.position).toBe('fixed');
    expect(modal.style.left).toBe('140px');
    expect(modal.style.top).toBe('120px');

    fireEvent.mouseUp(window);
    fireEvent.click(screen.getAllByLabelText('Expand modal')[0]);

    expect(modal.classList.contains('modal-fullscreen')).toBe(true);
    expect(modal.style.position).toBe('');
    expect(modal.style.left).toBe('');
    expect(modal.style.top).toBe('');
  });
});