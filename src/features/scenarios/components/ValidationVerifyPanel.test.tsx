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
    renderPanel({ onVerifyScopeChange });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rules' } });
    expect(onVerifyScopeChange).toHaveBeenCalledWith('rules');
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
});
