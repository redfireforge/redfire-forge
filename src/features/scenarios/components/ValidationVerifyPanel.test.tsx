/**
 * @vitest-environment jsdom
 */
import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ValidationVerifyPanel from './ValidationVerifyPanel';

type PanelProps = ComponentProps<typeof ValidationVerifyPanel>;

function renderPanel(props: Partial<PanelProps> = {}) {
  const defaults: PanelProps = {
    expectedFieldCount: 1,
    assertionCount: 1,
    validating: false,
    verifyScope: 'all',
    onVerifyScopeChange: vi.fn(),
    onValidate: vi.fn(),
    fetchHostEnabled: false,
    onFetchHostEnabledChange: vi.fn(),
    fetchHostOverride: '',
    onFetchHostOverrideChange: vi.fn(),
    resolvedBaseUrl: 'https://api.example',
    onUseSettingsUrl: vi.fn(),
    validationResult: null,
    onDismissResult: vi.fn(),
    unorderedArrays: false,
    onEnableUnorderedAndReVerify: vi.fn(),
    ...props,
  };
  return { ...render(<ValidationVerifyPanel {...defaults} />), defaults };
}

describe('ValidationVerifyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there are no rules and no assertions', () => {
    const { container } = render(
      <ValidationVerifyPanel
        expectedFieldCount={0}
        assertionCount={0}
        validating={false}
        verifyScope="all"
        onVerifyScopeChange={vi.fn()}
        onValidate={vi.fn()}
        fetchHostEnabled={false}
        onFetchHostEnabledChange={vi.fn()}
        fetchHostOverride=""
        onFetchHostOverrideChange={vi.fn()}
        resolvedBaseUrl=""
        onUseSettingsUrl={vi.fn()}
        validationResult={null}
        onDismissResult={vi.fn()}
        unorderedArrays={false}
        onEnableUnorderedAndReVerify={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders verify controls when only assertions are present', () => {
    renderPanel({ expectedFieldCount: 0, assertionCount: 2 });
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });

  it('disables Verify while validating', () => {
    renderPanel({ validating: true });
    expect(screen.getByRole('button', { name: 'Validating...' })).toBeDisabled();
  });

  it('calls onValidate when Verify is clicked', () => {
    const onValidate = vi.fn();
    renderPanel({ onValidate });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(onValidate).toHaveBeenCalledTimes(1);
  });

  it('calls onVerifyScopeChange when scope select changes', () => {
    const onVerifyScopeChange = vi.fn();
    renderPanel({ onVerifyScopeChange, verifyScope: 'rules' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'assertions' } });
    expect(onVerifyScopeChange).toHaveBeenCalledWith('assertions');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
    expect(onVerifyScopeChange).toHaveBeenCalledWith('all');
  });

  it('shows Use Settings when host override is on with empty override', () => {
    renderPanel({
      fetchHostEnabled: true,
      fetchHostOverride: '',
      resolvedBaseUrl: 'https://cfg.example',
    });
    expect(screen.getByTitle('Use Settings base URL')).toBeInTheDocument();
  });

  it('calls onUseSettingsUrl when Use Settings is clicked', () => {
    const onUseSettingsUrl = vi.fn();
    renderPanel({
      fetchHostEnabled: true,
      fetchHostOverride: '',
      resolvedBaseUrl: 'https://cfg.example',
      onUseSettingsUrl,
    });
    fireEvent.click(screen.getByTitle('Use Settings base URL'));
    expect(onUseSettingsUrl).toHaveBeenCalled();
  });

  it('calls onFetchHostEnabledChange when Host Override checkbox is toggled', () => {
    const onFetchHostEnabledChange = vi.fn();
    renderPanel({ fetchHostEnabled: false, onFetchHostEnabledChange });
    fireEvent.click(screen.getByRole('checkbox', { name: /Host Override/i }));
    expect(onFetchHostEnabledChange).toHaveBeenCalledWith(true);
  });

  it('calls onFetchHostOverrideChange when validate host input changes', () => {
    const onFetchHostOverrideChange = vi.fn();
    renderPanel({
      fetchHostEnabled: true,
      fetchHostOverride: '',
      onFetchHostOverrideChange,
    });
    const hostInput = document.querySelector('.validate-host-input') as HTMLInputElement;
    fireEvent.change(hostInput, { target: { value: 'https://override.example' } });
    expect(onFetchHostOverrideChange).toHaveBeenCalledWith('https://override.example');
  });

  it('uses default host placeholder when resolvedBaseUrl is undefined', () => {
    renderPanel({
      resolvedBaseUrl: undefined,
      fetchHostEnabled: true,
      fetchHostOverride: '',
    });
    const hostInput = document.querySelector('.validate-host-input') as HTMLInputElement;
    expect(hostInput.placeholder).toBe('Enter base URL');
  });

  it('disables host URL input when Host Override is off', () => {
    renderPanel({ fetchHostEnabled: false });
    const hostInput = document.querySelector('.validate-host-input') as HTMLInputElement;
    expect(hostInput).toBeDisabled();
  });

  it('does not show Use Settings when override is already filled', () => {
    renderPanel({
      fetchHostEnabled: true,
      fetchHostOverride: 'https://filled.example',
      resolvedBaseUrl: 'https://cfg.example',
    });
    expect(screen.queryByTitle('Use Settings base URL')).not.toBeInTheDocument();
  });

  it('does not show Use Settings when resolvedBaseUrl is empty string', () => {
    renderPanel({
      fetchHostEnabled: true,
      fetchHostOverride: '',
      resolvedBaseUrl: '',
    });
    expect(screen.queryByTitle('Use Settings base URL')).not.toBeInTheDocument();
  });

  it('shows combined passed summary with only field rules when assertions count is zero', () => {
    renderPanel({
      expectedFieldCount: 2,
      assertionCount: 0,
      validationResult: { passed: true, failures: [], verifyScope: 'all' },
    });
    expect(screen.getByText('All 2 rules passed (0 assertions, 2 field rules)')).toBeInTheDocument();
  });

  it('uses singular rule wording when total checks equal one with zero assertions', () => {
    renderPanel({
      expectedFieldCount: 1,
      assertionCount: 0,
      validationResult: { passed: true, failures: [], verifyScope: 'all' },
    });
    expect(screen.getByText('All 1 rule passed (0 assertions, 1 field rule)')).toBeInTheDocument();
  });

  it('shows HTTP status on passed result when provided', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        httpStatus: 201,
        verifyScope: 'all',
      },
    });
    expect(screen.getByText('HTTP 201')).toBeInTheDocument();
    expect(screen.getByText(/1 assertion/)).toBeInTheDocument();
    expect(screen.getByText(/1 field rule/)).toBeInTheDocument();
  });

  it('does not show HTTP label when httpStatus is missing on passed result', () => {
    renderPanel({
      validationResult: { passed: true, failures: [], verifyScope: 'all' },
    });
    expect(screen.queryByText(/^HTTP /)).not.toBeInTheDocument();
  });

  it('defaults verifyScope to all for passed summary when omitted', () => {
    renderPanel({
      expectedFieldCount: 2,
      assertionCount: 3,
      validationResult: { passed: true, failures: [] },
    });
    expect(screen.getByText(/5 rules passed/)).toBeInTheDocument();
  });

  it('uses plural passed summary for all scope', () => {
    renderPanel({
      expectedFieldCount: 2,
      assertionCount: 3,
      validationResult: { passed: true, failures: [], verifyScope: 'all' },
    });
    expect(screen.getByText(/5 rules passed/)).toBeInTheDocument();
  });

  it('uses assertions-only summary when verifyScope is assertions', () => {
    renderPanel({
      assertionCount: 3,
      validationResult: { passed: true, failures: [], verifyScope: 'assertions' },
    });
    expect(screen.getByText('All 3 assertions passed')).toBeInTheDocument();
  });

  it('uses singular assertion label when one assertion passed in assertions scope', () => {
    renderPanel({
      assertionCount: 1,
      validationResult: { passed: true, failures: [], verifyScope: 'assertions' },
    });
    expect(screen.getByText('All 1 assertion passed')).toBeInTheDocument();
  });

  it('uses rules-only summary when verifyScope is rules', () => {
    renderPanel({
      expectedFieldCount: 4,
      validationResult: { passed: true, failures: [], verifyScope: 'rules' },
    });
    expect(screen.getByText('All 4 field rules passed')).toBeInTheDocument();
  });

  it('uses singular field rule label in rules scope', () => {
    renderPanel({
      expectedFieldCount: 1,
      validationResult: { passed: true, failures: [], verifyScope: 'rules' },
    });
    expect(screen.getByText('All 1 field rule passed')).toBeInTheDocument();
  });

  it('calls onDismissResult when dismiss is clicked', () => {
    const onDismissResult = vi.fn();
    renderPanel({
      validationResult: { passed: true, failures: [] },
      onDismissResult,
    });
    fireEvent.click(screen.getByRole('button', { name: '×' }));
    expect(onDismissResult).toHaveBeenCalled();
  });

  it('shows singular discrepancy label for one failure', () => {
    renderPanel({
      validationResult: {
        passed: false,
        failures: [{ path: '$.a', expected: '1', actual: '2' }],
      },
    });
    expect(screen.getByText('1 discrepancy found')).toBeInTheDocument();
  });

  it('shows plural discrepancies for multiple failures', () => {
    renderPanel({
      validationResult: {
        passed: false,
        failures: [
          { path: '$.a', expected: '1', actual: '2' },
          { path: '$.b', expected: 'x', actual: 'y' },
        ],
      },
    });
    expect(screen.getByText('2 discrepancies found')).toBeInTheDocument();
  });

  it('renders failure table rows', () => {
    renderPanel({
      validationResult: {
        passed: false,
        failures: [{ path: '$.id', expected: '"a"', actual: '"b"' }],
      },
    });
    expect(screen.getByText('$.id')).toBeInTheDocument();
    expect(screen.getByText('"a"')).toBeInTheDocument();
    expect(screen.getByText('"b"')).toBeInTheDocument();
  });

  it('does not render failure table when failed with zero failures', () => {
    renderPanel({
      validationResult: { passed: false, failures: [] },
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows array order hint and calls re-verify when all failures look like ordering mismatches', () => {
    const onEnableUnorderedAndReVerify = vi.fn();
    renderPanel({
      unorderedArrays: false,
      onEnableUnorderedAndReVerify,
      validationResult: {
        passed: false,
        failures: [
          {
            path: '$.items[0].id',
            expected: '"1"',
            actual: '2 (matched by code=AAA at [1])',
          },
        ],
      },
    });
    expect(screen.getByText(/array ordering mismatches/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enable unordered matching/i }));
    expect(onEnableUnorderedAndReVerify).toHaveBeenCalled();
  });

  it('does not show order hint when unordered matching is already enabled', () => {
    renderPanel({
      unorderedArrays: true,
      validationResult: {
        passed: false,
        failures: [
          {
            path: '$.items[0].id',
            expected: '"1"',
            actual: '2 (matched by x at [1])',
          },
        ],
      },
    });
    expect(screen.queryByText(/array ordering mismatches/i)).not.toBeInTheDocument();
  });

  it('does not show order hint when a failure path has no bracket index', () => {
    renderPanel({
      unorderedArrays: false,
      validationResult: {
        passed: false,
        failures: [
          {
            path: '$.items.id',
            expected: '"1"',
            actual: '2 (matched by x at [1])',
          },
        ],
      },
    });
    expect(screen.queryByText(/array ordering mismatches/i)).not.toBeInTheDocument();
  });

  it('does not show response toggle when there is no response JSON or headers', () => {
    renderPanel({
      validationResult: { passed: true, failures: [] },
    });
    expect(screen.queryByRole('button', { name: /Toggle response details/i })).not.toBeInTheDocument();
    expect(document.querySelector('.validate-result-header--clickable')).toBeNull();
  });

  it('toggles response details via button and updates aria-expanded', () => {
    renderPanel({
      validationResult: {
        passed: false,
        failures: [{ path: '$.x', expected: '1', actual: '2' }],
        responseHeaders: { 'X-Test': '1' },
      },
    });
    const toggle = screen.getByRole('button', { name: /Toggle response details/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.validate-response-detail')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('X-Test')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(document.querySelector('.validate-response-detail')).toBeNull();
  });

  it('toggles response details when header is double-clicked', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        responseJson: '{"a":1}',
      },
    });
    const header = document.querySelector('.validate-result-header--clickable');
    expect(header).toBeTruthy();
    fireEvent.doubleClick(header as Element);
    expect(document.querySelector('.validate-response-detail')).toBeInTheDocument();
    fireEvent.doubleClick(header as Element);
    expect(document.querySelector('.validate-response-detail')).toBeNull();
  });

  it('renders status-ok badge for 3xx responses in detail panel', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        httpStatus: 399,
        statusText: 'OKish',
        responseJson: '{}',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    const badge = document.querySelector('.validate-response-detail-status-badge.status-ok');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('399');
    expect(screen.getByText('OKish')).toBeInTheDocument();
  });

  it('renders status-4xx badge for client errors', () => {
    renderPanel({
      validationResult: {
        passed: false,
        failures: [{ path: '$.a', expected: '1', actual: '2' }],
        httpStatus: 404,
        statusText: 'Not Found',
        responseJson: '{}',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    expect(document.querySelector('.status-4xx')).toBeInTheDocument();
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('renders status-5xx badge for server errors', () => {
    renderPanel({
      validationResult: {
        passed: false,
        failures: [{ path: '$.a', expected: '1', actual: '2' }],
        httpStatus: 500,
        responseJson: '{}',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    expect(document.querySelector('.status-5xx')).toBeInTheDocument();
  });

  it('renders empty status text when statusText is omitted', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        httpStatus: 200,
        responseJson: '{}',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    const valueSpan = document.querySelector('.validate-response-detail-value');
    expect(valueSpan).toBeTruthy();
    expect(valueSpan?.textContent).toBe('');
  });

  it('omits Response Headers section when headers object is empty', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        responseHeaders: {},
        responseJson: '{"x":1}',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    expect(screen.queryByText(/Response Headers/)).not.toBeInTheDocument();
  });

  it('lists response headers with count when headers are present', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        responseHeaders: { 'Content-Type': 'application/json', Server: 'nginx' },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('Content-Type')).toBeInTheDocument();
    expect(screen.getByText('application/json')).toBeInTheDocument();
    expect(screen.getByText('nginx')).toBeInTheDocument();
  });

  it('formats valid JSON and applies syntax highlight spans in response body', () => {
    const raw = JSON.stringify({
      key: 'val',
      n: 42,
      f: -1.5e2,
      b: true,
      z: null,
    });
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        responseJson: raw,
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    const pre = document.querySelector('.validate-response-detail-body');
    expect(pre).toBeTruthy();
    const html = pre?.innerHTML ?? '';
    expect(html).toContain('json-hl-key');
    expect(html).toContain('json-hl-str');
    expect(html).toContain('json-hl-num');
    expect(html).toContain('json-hl-kw');
    expect(html).not.toContain('<script');
  });

  it('shows non-JSON response body verbatim and escapes HTML', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        responseJson: '<div a="b">&y',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    const pre = document.querySelector('.validate-response-detail-body');
    expect(pre?.innerHTML).toContain('&lt;div');
    expect(pre?.innerHTML).toContain('&amp;');
  });

  it('shows response controls when only empty headers object is present (no JSON)', () => {
    renderPanel({
      validationResult: {
        passed: true,
        failures: [],
        responseHeaders: {},
      },
    });
    expect(screen.getByRole('button', { name: /Toggle response details/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Toggle response details/i }));
    expect(screen.queryByText(/Response Body/)).not.toBeInTheDocument();
  });

  it('shows order hint when every failure matches ordering mismatch pattern', () => {
    renderPanel({
      unorderedArrays: false,
      validationResult: {
        passed: false,
        failures: [
          {
            path: '$.items[0].id',
            expected: '"1"',
            actual: '2 (matched by code=AAA at [1])',
          },
          {
            path: '$.items[1].id',
            expected: '"2"',
            actual: '1 (matched by code=BBB at [0])',
          },
        ],
      },
    });
    expect(screen.getByText(/array ordering mismatches/i)).toBeInTheDocument();
  });

  it('does not show order hint when actual text lacks matched-by wording', () => {
    renderPanel({
      unorderedArrays: false,
      validationResult: {
        passed: false,
        failures: [
          {
            path: '$.items[0].id',
            expected: '"1"',
            actual: '2 (wrong order)',
          },
        ],
      },
    });
    expect(screen.queryByText(/array ordering mismatches/i)).not.toBeInTheDocument();
  });
});
