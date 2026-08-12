/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerSettingsModal } from './ApiMockServerSettingsModal';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Mock Server 1',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: {
      ...DEFAULT_SETTINGS,
      fallback: {
        ...DEFAULT_SETTINGS.fallback,
        unmatchedResponse: {
          ...DEFAULT_SETTINGS.fallback.unmatchedResponse,
          contentType: undefined,
        },
      },
    },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('ApiMockServerSettingsModal coverage gaps', () => {
  it('updates policy selects, applies Running status styling, and saves selected policies', () => {
    const onSave = vi.fn();
    render(<ApiMockServerSettingsModal server={makeServer()} onSave={onSave} onClose={vi.fn()} statusLabel="Running" />);

    const mm = screen.getByTestId('api-mock-settings-multiple-match');
    fireEvent.click(mm.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="reject_multiple"]') as HTMLElement);

    const ep = screen.getByTestId('api-mock-settings-equal-priority');
    fireEvent.click(ep.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="specificity_then_id"]') as HTMLElement);

    expect(screen.getByText('application/json')).toBeTruthy();
    expect(screen.getByText('Running').className).toContain('success');

    fireEvent.click(screen.getByTestId('api-mock-settings-save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        selection: expect.objectContaining({
          multipleMatchPolicy: 'reject_multiple',
          equalPriorityPolicy: 'specificity_then_id',
        }),
      }),
    }));
  });
});
