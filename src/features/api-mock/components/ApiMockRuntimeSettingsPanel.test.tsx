/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DEFAULT_SETTINGS, HARD_CEILINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { selectOptionByTestId } from '../../../test-utils/customSelectHelper';
import { ApiMockRuntimeSettingsPanel } from './ApiMockRuntimeSettingsPanel';

function makeServer(overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Mock Server 1',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}

function pickSelect(testId: string, value: string) {
  const trigger = screen.getByTestId(testId).querySelector('.cs-trigger') as HTMLElement;
  fireEvent.click(trigger);
  fireEvent.click(document.querySelector(`[role="option"][data-value="${value}"]`) as HTMLElement);
}

describe('ApiMockRuntimeSettingsPanel', () => {
  it('saves selection, journal, and LAN host changes', () => {
    const onSave = vi.fn();
    render(<ApiMockRuntimeSettingsPanel server={makeServer()} onSave={onSave} />);
    expect(screen.getByTestId('api-mock-runtime-settings-save')).toBeDisabled();

    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-journal'));
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-redact-paths'), {
      target: { value: '$.password' },
    });
    expect(screen.getByTestId('api-mock-runtime-settings-save')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const patch = onSave.mock.calls[0][0];
    expect(patch.settings.journal.enabled).toBe(false);
    expect(patch.settings.redaction.jsonPaths).toEqual(['$.password']);
  });

  it('shows listen preview, dirty badge, and saves all policy fields', () => {
    const onSave = vi.fn();
    render(
      <ApiMockRuntimeSettingsPanel
        server={makeServer({ basePath: '/api', port: 8080 })}
        onSave={onSave}
      />,
    );

    expect(screen.getByTitle('http://127.0.0.1:8080/api')).toBeInTheDocument();
    expect(screen.queryByTestId('api-mock-runtime-settings-dirty')).not.toBeInTheDocument();

    pickSelect('api-mock-runtime-settings-multiple', 'reject_multiple');
    pickSelect('api-mock-runtime-settings-equal', 'specificity_then_id');
    pickSelect('api-mock-runtime-settings-fallback', 'closest_match_debug');

    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-cors'));
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-cors-origins'), {
      target: { value: 'https://a.test, https://b.test' },
    });

    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-inbound'), { target: { value: '2048' } });
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-conn'), { target: { value: '50' } });
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-timeout-hold'), { target: { value: '8000' } });
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-drain'), { target: { value: '3000' } });

    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-journal-max'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-persist'));
    expect(screen.getByText(/OS temp directory/i)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-redact-headers'), {
      target: { value: 'X-Secret, Cookie' },
    });

    expect(screen.getByTestId('api-mock-runtime-settings-dirty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-save'));

    const patch = onSave.mock.calls[0][0];
    expect(patch.settings.selection.multipleMatchPolicy).toBe('reject_multiple');
    expect(patch.settings.selection.equalPriorityPolicy).toBe('specificity_then_id');
    expect(patch.settings.fallback.mode).toBe('closest_match_debug');
    expect(patch.settings.cors.enabled).toBe(true);
    expect(patch.settings.cors.allowOrigins).toEqual(['https://a.test', 'https://b.test']);
    expect(patch.settings.limits.maxInboundBodyBytes).toBe(2048);
    expect(patch.settings.limits.maxConcurrentConnections).toBe(50);
    expect(patch.settings.limits.longRunningMaxMs).toBe(8000);
    expect(patch.settings.limits.gracefulDrainMs).toBe(3000);
    expect(patch.settings.journal.maxEntries).toBe(100);
    expect(patch.settings.journal.persistToDisk).toBe(true);
    expect(patch.settings.redaction.headerNames).toEqual(['x-secret', 'cookie']);
  });

  it('shows LAN warning and badge when host is 0.0.0.0', () => {
    const onSave = vi.fn();
    render(<ApiMockRuntimeSettingsPanel server={makeServer()} onSave={onSave} />);

    selectOptionByTestId('api-mock-runtime-settings-host', '0.0.0.0 (LAN exposed)');

    expect(screen.getAllByText('LAN').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/exposes this mock on your local network/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-save'));
    expect(onSave.mock.calls[0][0].host).toBe('0.0.0.0');
  });

  it('disables CORS origins and journal max when toggles are off', () => {
    render(
      <ApiMockRuntimeSettingsPanel
        server={makeServer({
          settings: {
            ...DEFAULT_SETTINGS,
            cors: { ...DEFAULT_SETTINGS.cors, enabled: true },
            journal: { ...DEFAULT_SETTINGS.journal, enabled: true },
          },
        })}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId('api-mock-runtime-settings-cors-origins')).not.toBeDisabled();
    expect(screen.getByTestId('api-mock-runtime-settings-journal-max')).not.toBeDisabled();
    expect(screen.getByTestId('api-mock-runtime-settings-persist')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-cors'));
    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-journal'));

    expect(screen.getByTestId('api-mock-runtime-settings-cors-origins')).toBeDisabled();
    expect(screen.getByTestId('api-mock-runtime-settings-journal-max')).toBeDisabled();
    expect(screen.getByTestId('api-mock-runtime-settings-persist')).not.toBeDisabled();
    expect(screen.getByText(/Turn Journal on first/i)).toBeInTheDocument();
  });

  it('falls back to server defaults when numeric fields are invalid', () => {
    const onSave = vi.fn();
    render(<ApiMockRuntimeSettingsPanel server={makeServer()} onSave={onSave} />);

    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-inbound'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-conn'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-timeout-hold'), { target: { value: '-1' } });
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-drain'), { target: { value: 'NaN' } });
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-journal-max'), { target: { value: 'x' } });

    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-save'));

    const patch = onSave.mock.calls[0][0];
    expect(patch.settings.limits.maxInboundBodyBytes).toBe(DEFAULT_SETTINGS.limits.maxInboundBodyBytes);
    expect(patch.settings.limits.maxConcurrentConnections).toBe(DEFAULT_SETTINGS.limits.maxConcurrentConnections);
    expect(patch.settings.limits.longRunningMaxMs).toBe(DEFAULT_SETTINGS.limits.longRunningMaxMs);
    expect(patch.settings.limits.gracefulDrainMs).toBe(DEFAULT_SETTINGS.limits.gracefulDrainMs);
    expect(patch.settings.journal.maxEntries).toBe(DEFAULT_SETTINGS.journal.maxEntries);
  });

  it('resets local state when server prop changes', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <ApiMockRuntimeSettingsPanel server={makeServer()} onSave={onSave} />,
    );

    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-redact-paths'), {
      target: { value: '$.temp' },
    });
    expect(screen.getByTestId('api-mock-runtime-settings-dirty')).toBeInTheDocument();

    rerender(
      <ApiMockRuntimeSettingsPanel
        server={makeServer({
          id: 'srv-2',
          settings: {
            ...DEFAULT_SETTINGS,
            redaction: { ...DEFAULT_SETTINGS.redaction, jsonPaths: ['$.saved'] },
          },
        })}
        onSave={onSave}
      />,
    );

    expect(screen.queryByTestId('api-mock-runtime-settings-dirty')).not.toBeInTheDocument();
    expect(screen.getByTestId('api-mock-runtime-settings-redact-paths')).toHaveValue('$.saved');
  });

  it('defaults cors origins to * when allowOrigins is empty', () => {
    render(
      <ApiMockRuntimeSettingsPanel
        server={makeServer({
          settings: {
            ...DEFAULT_SETTINGS,
            cors: { ...DEFAULT_SETTINGS.cors, allowOrigins: [] },
          },
        })}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId('api-mock-runtime-settings-cors-origins')).toHaveValue('*');
  });

  it('gives hinted rows room so descriptions are not clipped', () => {
    render(<ApiMockRuntimeSettingsPanel server={makeServer()} onSave={vi.fn()} />);

    const persistHint = screen.getByText(/survives companion restart/i);
    expect(persistHint.closest('.am-rt-stg-row')).toHaveClass('am-rt-stg-row--hinted');
    expect(persistHint.closest('.am-rt-stg-row')).not.toHaveClass('am-rt-stg-row--inline-hint');

    const maxEntriesHint = screen.getByText(/Oldest entries drop when the cap is reached/i);
    expect(maxEntriesHint.closest('.am-rt-stg-row')).toHaveClass('am-rt-stg-row--hinted');
    expect(maxEntriesHint.closest('.am-rt-stg-row')).toHaveClass('am-rt-stg-row--inline-hint');

    expect(screen.getByText(/Click a name to add or remove it/i).closest('.am-rt-stg-row')).toHaveClass('am-rt-stg-row--hinted');
    expect(screen.getByText(/JSONPath expressions/i).closest('.am-rt-stg-row')).toHaveClass('am-rt-stg-row--hinted');
    expect(screen.getByText('Max concurrent · 500').closest('.am-rt-stg-row')).toHaveClass('am-rt-stg-row--inline-hint');
  });

  it('adds a catalog header from the reference chips', () => {
    const onSave = vi.fn();
    render(<ApiMockRuntimeSettingsPanel server={makeServer()} onSave={onSave} />);

    expect(screen.getByTestId('api-mock-runtime-settings-redact-header-picker')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('api-mock-redact-header-chip-x-csrf-token'));
    expect(screen.getByTestId('api-mock-runtime-settings-redact-headers')).toHaveValue(
      `${DEFAULT_SETTINGS.redaction.headerNames.join(', ')}, x-csrf-token`,
    );
    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-save'));
    expect(onSave.mock.calls[0][0].settings.redaction.headerNames).toContain('x-csrf-token');
  });

  it('saves proxy fallback mode and localhost host', () => {
    const onSave = vi.fn();
    render(<ApiMockRuntimeSettingsPanel server={makeServer()} onSave={onSave} />);

    pickSelect('api-mock-runtime-settings-fallback', 'proxy');
    selectOptionByTestId('api-mock-runtime-settings-host', 'localhost');

    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-save'));

    const patch = onSave.mock.calls[0][0];
    expect(patch.settings.fallback.mode).toBe('proxy');
    expect(patch.host).toBe('localhost');
  });

  it('clamps timeout hold max to the hard ceiling on save', () => {
    const onSave = vi.fn();
    render(<ApiMockRuntimeSettingsPanel server={makeServer()} onSave={onSave} />);
    fireEvent.change(screen.getByTestId('api-mock-runtime-settings-timeout-hold'), {
      target: { value: String(HARD_CEILINGS.maxLongRunningMs + 1) },
    });
    fireEvent.click(screen.getByTestId('api-mock-runtime-settings-save'));
    expect(onSave.mock.calls[0][0].settings.limits.longRunningMaxMs).toBe(HARD_CEILINGS.maxLongRunningMs);
  });
});
