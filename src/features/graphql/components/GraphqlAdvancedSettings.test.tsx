/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphqlAdvancedSettings } from './GraphqlAdvancedSettings';
import type { AdvancedSettingsValues } from './GraphqlAdvancedSettings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeValues(overrides: Partial<AdvancedSettingsValues> = {}): AdvancedSettingsValues {
  return {
    apqEnabled: false,
    apqUseGet: false,
    apqUnsupportedDetected: false,
    batchEnabled: false,
    batchTimeoutMs: 30000,
    batchUnsupportedDetected: false,
    dedupEnabled: false,
    complexityBlockEnabled: false,
    complexityBlockThreshold: 1000,
    ...overrides,
  };
}

function renderSettings(
  overrides: Partial<Parameters<typeof GraphqlAdvancedSettings>[0]> = {},
) {
  const anchorRef = { current: document.createElement('button') };
  const props = {
    values: makeValues(),
    onChange: vi.fn(),
    anchorRef,
    open: true,
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<GraphqlAdvancedSettings {...props} />), props };
}

describe('GraphqlAdvancedSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Visibility ───────────────────────────────────────────────────────────────

  it('renders nothing when open=false', () => {
    const anchorRef = { current: document.createElement('button') };
    render(
      <GraphqlAdvancedSettings
        values={makeValues()}
        onChange={vi.fn()}
        anchorRef={anchorRef}
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when open=true', () => {
    renderSettings();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the Advanced Settings title', () => {
    renderSettings();
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
  });

  // ── Close ─────────────────────────────────────────────────────────────────────

  it('calls onClose when the × button is clicked', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByLabelText('Close advanced settings'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const { props } = renderSettings();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the popover (not anchor)', () => {
    const { props } = renderSettings();
    // Click somewhere outside both the popover and anchor
    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the popover', () => {
    const { props } = renderSettings();
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('removes event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderSettings();
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
  });

  it('does not register mousedown listener when closed', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const anchorRef = { current: document.createElement('button') };
    const onClose = vi.fn();
    render(
      <GraphqlAdvancedSettings
        values={makeValues()}
        onChange={vi.fn()}
        anchorRef={anchorRef}
        open={false}
        onClose={onClose}
      />,
    );
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  it('renders all four tabs', () => {
    renderSettings();
    expect(screen.getByRole('tab', { name: /APQ/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Batch/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Dedup/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Performance/i })).toBeInTheDocument();
  });

  it('defaults to the APQ tab', () => {
    renderSettings();
    expect(screen.getByLabelText('Enable Automatic Persisted Queries')).toBeInTheDocument();
  });

  it('switches to Batch tab on click', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByLabelText('Enable query batching')).toBeInTheDocument();
  });

  it('switches to Dedup tab on click', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Dedup/i }));
    expect(screen.getByLabelText('Enable request deduplication')).toBeInTheDocument();
  });

  it('switches to Performance tab on click', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    expect(screen.getByLabelText('Enable complexity gate')).toBeInTheDocument();
  });

  // ── APQ Tab ───────────────────────────────────────────────────────────────────

  it('calls onChange with apqEnabled true when APQ checkbox toggled on', () => {
    const { props } = renderSettings();
    const checkbox = screen.getByLabelText('Enable Automatic Persisted Queries');
    fireEvent.click(checkbox);
    expect(props.onChange).toHaveBeenCalledWith({ apqEnabled: true });
  });

  it('shows "Use GET for queries" sub-option when apqEnabled is true', () => {
    renderSettings({ values: makeValues({ apqEnabled: true }) });
    expect(screen.getByLabelText('Use GET for query requests')).toBeInTheDocument();
  });

  it('does not show "Use GET for queries" when APQ is disabled', () => {
    renderSettings();
    expect(screen.queryByLabelText('Use GET for query requests')).not.toBeInTheDocument();
  });

  it('shows "APQ is inactive during batch execution" note when both APQ and batch are enabled', () => {
    renderSettings({ values: makeValues({ apqEnabled: true, batchEnabled: true }) });
    expect(screen.getByText(/APQ is inactive during batch execution/)).toBeInTheDocument();
  });

  it('shows "Unsupported by server" badge when apqUnsupportedDetected', () => {
    renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    expect(screen.getByText('Unsupported by server')).toBeInTheDocument();
  });

  it('disables APQ checkbox when unsupported detected', () => {
    renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    const checkbox = screen.getByLabelText('Enable Automatic Persisted Queries');
    expect(checkbox).toBeDisabled();
  });

  it('shows "Reset APQ detection" button when unsupported detected', () => {
    renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    expect(screen.getByText('Reset APQ detection')).toBeInTheDocument();
  });

  it('calls onChange with reset APQ values when "Reset APQ detection" is clicked', () => {
    const { props } = renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    fireEvent.click(screen.getByText('Reset APQ detection'));
    expect(props.onChange).toHaveBeenCalledWith({ apqUnsupportedDetected: false, apqEnabled: true });
  });

  it('calls onChange with apqUseGet when "Use GET" checkbox is toggled', () => {
    const { props } = renderSettings({ values: makeValues({ apqEnabled: true }) });
    const checkbox = screen.getByLabelText('Use GET for query requests');
    fireEvent.click(checkbox);
    expect(props.onChange).toHaveBeenCalledWith({ apqUseGet: true });
  });

  // ── Batch Tab ─────────────────────────────────────────────────────────────────

  it('shows batch timeout input when batchEnabled is true', () => {
    renderSettings({ values: makeValues({ batchEnabled: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByLabelText('Batch timeout in milliseconds')).toBeInTheDocument();
  });

  it('does not show batch timeout input when batchEnabled is false', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.queryByLabelText('Batch timeout in milliseconds')).not.toBeInTheDocument();
  });

  it('calls onChange with batchTimeoutMs on input change', () => {
    const { props } = renderSettings({ values: makeValues({ batchEnabled: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    const input = screen.getByLabelText('Batch timeout in milliseconds');
    fireEvent.change(input, { target: { value: '60000' } });
    expect(props.onChange).toHaveBeenCalledWith({ batchTimeoutMs: 60000 });
  });

  it('falls back to 30000 for invalid batch timeout', () => {
    const { props } = renderSettings({ values: makeValues({ batchEnabled: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    const input = screen.getByLabelText('Batch timeout in milliseconds');
    fireEvent.change(input, { target: { value: '100' } }); // below minimum 5000
    expect(props.onChange).toHaveBeenCalledWith({ batchTimeoutMs: 30000 });
  });

  it('shows "batch unsupported" warning when batchUnsupportedDetected', () => {
    renderSettings({ values: makeValues({ batchUnsupportedDetected: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByText(/Server does not support array batching/)).toBeInTheDocument();
  });

  it('calls onChange with reset batch values on "Reset batch detection" click', () => {
    const { props } = renderSettings({ values: makeValues({ batchUnsupportedDetected: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    fireEvent.click(screen.getByText('Reset batch detection'));
    expect(props.onChange).toHaveBeenCalledWith({ batchUnsupportedDetected: false });
  });

  // ── Dedup Tab ─────────────────────────────────────────────────────────────────

  it('calls onChange with dedupEnabled when dedup checkbox toggled', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Dedup/i }));
    const checkbox = screen.getByLabelText('Enable request deduplication');
    fireEvent.click(checkbox);
    expect(props.onChange).toHaveBeenCalledWith({ dedupEnabled: true });
  });

  // ── Performance Tab ───────────────────────────────────────────────────────────

  it('shows complexity threshold input when complexityBlockEnabled is true', () => {
    renderSettings({ values: makeValues({ complexityBlockEnabled: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    expect(screen.getByLabelText('Complexity block threshold')).toBeInTheDocument();
  });

  it('does not show threshold input when complexityBlockEnabled is false', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    expect(screen.queryByLabelText('Complexity block threshold')).not.toBeInTheDocument();
  });

  it('calls onChange with complexityBlockThreshold on input change', () => {
    const { props } = renderSettings({ values: makeValues({ complexityBlockEnabled: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    const input = screen.getByLabelText('Complexity block threshold');
    fireEvent.change(input, { target: { value: '500' } });
    expect(props.onChange).toHaveBeenCalledWith({ complexityBlockThreshold: 500 });
  });

  it('falls back to 1000 for invalid complexity threshold', () => {
    const { props } = renderSettings({ values: makeValues({ complexityBlockEnabled: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    const input = screen.getByLabelText('Complexity block threshold');
    fireEvent.change(input, { target: { value: '50' } }); // below minimum 100
    expect(props.onChange).toHaveBeenCalledWith({ complexityBlockThreshold: 1000 });
  });

  it('calls onChange with complexityBlockEnabled when complexity checkbox toggled', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    const checkbox = screen.getByLabelText('Enable complexity gate');
    fireEvent.click(checkbox);
    expect(props.onChange).toHaveBeenCalledWith({ complexityBlockEnabled: true });
  });
});
