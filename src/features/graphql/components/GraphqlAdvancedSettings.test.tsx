/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  deriveTabLabel: vi.fn(() => 'Untitled'),
}));

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
    subscriptionTransport: 'auto',
    sseMode: 'distinct',
    wsEndpointOverride: '',
    historyMaxItems: 100,
    subscriptionBufferSize: 5000,
    maxFileSizeMb: 50,
    ...overrides,
  };
}

function makeBatchSettings(tabCount = 2) {
  const tabIds = Array.from({ length: tabCount }, (_, i) => `t${i + 1}`);
  return {
    groups: [{ key: 'k', resolvedEndpoint: 'http://a.com/gql', displayLabel: 'a.com', tabIds }],
    activeGroupKey: 'k',
    onGroupChange: vi.fn(),
    batchedTabIds: new Set<string>(),
    onToggleBatchTab: vi.fn(),
    tabs: [],
  };
}

function renderSettings(
  overrides: Partial<Parameters<typeof GraphqlAdvancedSettings>[0]> = {},
) {
  const anchorRef = { current: document.createElement('button') };
  const props = {
    values: makeValues(),
    onSave: vi.fn(),
    anchorRef,
    open: true,
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<GraphqlAdvancedSettings {...props} />), props };
}

function clickSave() {
  fireEvent.click(screen.getByTestId('gql-adv-settings-save-btn'));
}

describe('GraphqlAdvancedSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open=false', () => {
    const anchorRef = { current: document.createElement('button') };
    render(
      <GraphqlAdvancedSettings
        values={makeValues()}
        onSave={vi.fn()}
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

  it('shows the Advanced settings title', () => {
    renderSettings();
    expect(screen.getByText('Advanced settings')).toBeInTheDocument();
  });

  it('renders with enlarged default popover dimensions', () => {
    renderSettings();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gql-advsettings-popover');
    expect(dialog.className).not.toContain('gql-advsettings-popover--dragged');
    const style = dialog.getAttribute('style');
    expect(style ?? '').not.toMatch(/width:\s*\d+px/);
  });

  it('moves the panel when the header is dragged', () => {
    renderSettings();
    const dialog = screen.getByRole('dialog');
    const header = dialog.querySelector('.gql-advsettings-header')!;
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 200,
      top: 60,
      width: 420,
      height: 500,
      right: 620,
      bottom: 560,
      x: 200,
      y: 60,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.mouseDown(header, { clientX: 210, clientY: 70 });
    fireEvent.mouseMove(window, { clientX: 260, clientY: 120 });
    fireEvent.mouseUp(window);

    expect(dialog).toHaveClass('gql-advsettings-popover--dragged');
    expect(dialog).toHaveStyle({ position: 'fixed', left: '250px', top: '110px' });
  });

  // ── Save / Cancel ─────────────────────────────────────────────────────────────

  it('calls onClose when Cancel is clicked', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByTestId('gql-adv-settings-cancel-btn'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('calls onSave when Save is clicked', () => {
    const { props } = renderSettings();
    clickSave();
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const { props } = renderSettings();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking outside the popover', () => {
    const { props } = renderSettings();
    fireEvent.mouseDown(document.body);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside the popover', () => {
    const { props } = renderSettings();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('removes escape listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderSettings();
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
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
    renderSettings({ batchSettings: makeBatchSettings(2) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByLabelText('Enable query batching')).toBeInTheDocument();
  });

  it('shows batch prerequisite note when fewer than two tabs share an endpoint', () => {
    renderSettings({ batchSettings: makeBatchSettings(1) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByTestId('gql-adv-batch-prerequisite')).toBeInTheDocument();
    expect(screen.queryByLabelText('Enable query batching')).not.toBeInTheDocument();
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

  it('calls onSave with apqEnabled true when APQ checkbox toggled on and saved', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByLabelText('Enable Automatic Persisted Queries'));
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ apqEnabled: true }));
  });

  it('shows "Use GET for queries" sub-option when apqEnabled is true', () => {
    renderSettings({ values: makeValues({ apqEnabled: true }) });
    expect(screen.getByLabelText('Use GET for query requests')).toBeInTheDocument();
  });

  it('does not show "Use GET for queries" when APQ is disabled', () => {
    renderSettings();
    expect(screen.queryByLabelText('Use GET for query requests')).not.toBeInTheDocument();
  });

  it('shows APQ inactive note when both APQ and batch are enabled', () => {
    renderSettings({ values: makeValues({ apqEnabled: true, batchEnabled: true }) });
    expect(screen.getByText(/APQ is inactive while batch execution is running/)).toBeInTheDocument();
  });

  it('shows "Unsupported" badge when apqUnsupportedDetected', () => {
    renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    expect(screen.getByText('Unsupported')).toBeInTheDocument();
  });

  it('disables APQ checkbox when unsupported detected', () => {
    renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    const checkbox = screen.getByLabelText('Enable Automatic Persisted Queries');
    expect(checkbox).toBeDisabled();
  });

  it('shows "Reset detection" button when APQ unsupported detected', () => {
    renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    expect(screen.getByText('Reset detection')).toBeInTheDocument();
  });

  it('calls onChange with reset APQ values when "Reset detection" is clicked', () => {
    const { props } = renderSettings({ values: makeValues({ apqUnsupportedDetected: true }) });
    fireEvent.click(screen.getByText('Reset detection'));
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ apqUnsupportedDetected: false, apqEnabled: true }));
  });

  it('calls onSave with apqUseGet when "Use GET" checkbox is toggled and saved', () => {
    const { props } = renderSettings({ values: makeValues({ apqEnabled: true }) });
    fireEvent.click(screen.getByLabelText('Use GET for query requests'));
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ apqUseGet: true }));
  });

  // ── Batch Tab ─────────────────────────────────────────────────────────────────

  it('shows batch timeout input when batchEnabled is true', () => {
    renderSettings({ values: makeValues({ batchEnabled: true }), batchSettings: makeBatchSettings(2) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByLabelText('Batch timeout in milliseconds')).toBeInTheDocument();
  });

  it('does not show batch timeout input when batchEnabled is false', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.queryByLabelText('Batch timeout in milliseconds')).not.toBeInTheDocument();
  });

  it('calls onChange with batchTimeoutMs on input change', () => {
    const { props } = renderSettings({
      values: makeValues({ batchEnabled: true }),
      batchSettings: makeBatchSettings(2),
    });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    const input = screen.getByLabelText('Batch timeout in milliseconds');
    fireEvent.change(input, { target: { value: '60000' } });
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ batchTimeoutMs: 60000 }));
  });

  it('falls back to 30000 for invalid batch timeout', () => {
    const { props } = renderSettings({
      values: makeValues({ batchEnabled: true }),
      batchSettings: makeBatchSettings(2),
    });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    const input = screen.getByLabelText('Batch timeout in milliseconds');
    fireEvent.change(input, { target: { value: '100' } }); // below minimum 5000
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ batchTimeoutMs: 30000 }));
  });

  it('shows "batch unsupported" warning when batchUnsupportedDetected', () => {
    renderSettings({ values: makeValues({ batchUnsupportedDetected: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByText(/Server does not support array batching/)).toBeInTheDocument();
  });

  it('shows batch settings panel when batchEnabled and batchSettings provided', () => {
    renderSettings({
      values: makeValues({ batchEnabled: true }),
      batchSettings: makeBatchSettings(2),
    });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    expect(screen.getByTestId('gql-adv-batch-panel')).toBeInTheDocument();
  });

  it('calls onChange with reset batch values on "Reset detection" click', () => {
    const { props } = renderSettings({ values: makeValues({ batchUnsupportedDetected: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Batch/i }));
    fireEvent.click(screen.getByText('Reset detection'));
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ batchUnsupportedDetected: false }));
  });

  // ── Dedup Tab ─────────────────────────────────────────────────────────────────

  it('calls onSave with dedupEnabled when dedup checkbox toggled and saved', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Dedup/i }));
    fireEvent.click(screen.getByLabelText('Enable request deduplication'));
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ dedupEnabled: true }));
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
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ complexityBlockThreshold: 500 }));
  });

  it('falls back to 1000 for invalid complexity threshold', () => {
    const { props } = renderSettings({ values: makeValues({ complexityBlockEnabled: true }) });
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    const input = screen.getByLabelText('Complexity block threshold');
    fireEvent.change(input, { target: { value: '50' } }); // below minimum 100
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ complexityBlockThreshold: 1000 }));
  });

  it('calls onSave with complexityBlockEnabled when complexity checkbox toggled and saved', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Performance/i }));
    fireEvent.click(screen.getByLabelText('Enable complexity gate'));
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ complexityBlockEnabled: true }));
  });

  // ── Transport Tab ───────────────────────────────────────────────────────────

  it('renders Transport and Limits tabs', () => {
    renderSettings();
    expect(screen.getByRole('tab', { name: /Transport/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Limits/i })).toBeInTheDocument();
  });

  it('calls onChange with subscriptionTransport when transport select changes', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Transport/i }));
    fireEvent.change(screen.getByLabelText('Subscription transport protocol'), { target: { value: 'graphql-ws' } });
    clickSave();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ subscriptionTransport: 'graphql-ws' }));
  });

  it('shows SSE mode radios when subscription transport is sse', () => {
    renderSettings({ values: makeValues({ subscriptionTransport: 'sse', sseMode: 'distinct' }) });
    fireEvent.click(screen.getByRole('tab', { name: /Transport/i }));
    expect(screen.getByDisplayValue('distinct')).toBeInTheDocument();
    expect(screen.getByDisplayValue('single')).toBeInTheDocument();
  });

  it('updates sseMode and wsEndpointOverride in transport tab', () => {
    const { props } = renderSettings({ values: makeValues({ subscriptionTransport: 'sse', sseMode: 'distinct' }) });
    fireEvent.click(screen.getByRole('tab', { name: /Transport/i }));

    fireEvent.click(screen.getByDisplayValue('single'));
    fireEvent.change(screen.getByLabelText('WebSocket endpoint override'), { target: { value: 'wss://ws.example.com/graphql' } });
    clickSave();

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      sseMode: 'single',
      wsEndpointOverride: 'wss://ws.example.com/graphql',
    }));
  });

  // ── Limits Tab ──────────────────────────────────────────────────────────────

  it('updates limits with valid values', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Limits/i }));

    fireEvent.change(screen.getByLabelText('History buffer size'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Subscription buffer size'), { target: { value: '9000' } });
    fireEvent.change(screen.getByLabelText('Max file upload size in megabytes'), { target: { value: '80' } });
    clickSave();

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      historyMaxItems: 250,
      subscriptionBufferSize: 9000,
      maxFileSizeMb: 80,
    }));
  });

  it('applies fallback defaults for invalid limit values', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Limits/i }));

    fireEvent.change(screen.getByLabelText('History buffer size'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Subscription buffer size'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Max file upload size in megabytes'), { target: { value: '0' } });
    clickSave();

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      historyMaxItems: 100,
      subscriptionBufferSize: 5000,
      maxFileSizeMb: 50,
    }));
  });

  it('clamps limits to their max bounds', () => {
    const { props } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Limits/i }));

    fireEvent.change(screen.getByLabelText('History buffer size'), { target: { value: '999' } });
    fireEvent.change(screen.getByLabelText('Subscription buffer size'), { target: { value: '99999' } });
    fireEvent.change(screen.getByLabelText('Max file upload size in megabytes'), { target: { value: '999' } });
    clickSave();

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({
      historyMaxItems: 500,
      subscriptionBufferSize: 10000,
      maxFileSizeMb: 100,
    }));
  });
});
