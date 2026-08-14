/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockConflictGuide } from './ApiMockConflictGuide';
import type { ApiMockRouteV1, ApiMockServerSettingsV1 } from '../../../shared/api-mock/contracts';

describe('ApiMockConflictGuide', () => {
  it('renders analysis CTAs and policy summary', () => {
    const onAnalyze = vi.fn();
    const onOpenStudio = vi.fn();
    const routes: ApiMockRouteV1[] = [
      { id: 'r1', enabled: true } as unknown as ApiMockRouteV1,
      { id: 'r2', enabled: false } as unknown as ApiMockRouteV1,
    ];
    const settings: ApiMockServerSettingsV1 = {
      selection: {
        multipleMatchPolicy: 'reject_multiple',
        equalPriorityPolicy: 'specificity_then_id',
        ambiguityResponse: {
          status: 409,
          headers: [],
          body: '',
          contentType: 'application/json',
        },
      },
      fallback: {
        unmatchedResponse: {
          status: 404,
          headers: [],
          body: '',
          contentType: 'application/json',
        },
        mode: 'default_response',
      },
      cors: {
        enabled: true,
        allowOrigins: ['*'],
        allowMethods: ['GET'],
        allowHeaders: [],
        allowCredentials: false,
        maxAge: 0,
        exposeHeaders: [],
      },
      limits: {
        maxInboundBodyBytes: 1024,
        maxResponseBodyBytes: 1024,
        maxConcurrentConnections: 10,
        maxDelayMs: 1000,
        longRunningEnabled: false,
        longRunningMaxMs: 1000,
        gracefulDrainMs: 1000,
      },
      journal: {
        enabled: true,
        maxEntries: 100,
        maxCapturedBodyBytes: 1024,
        persistToDisk: false,
      },
      redaction: {
        headerNames: [],
        jsonPaths: [],
        preserveScheme: true,
      },
    };
    render(
      <ApiMockConflictGuide
        routes={routes}
        stats={{ analyzedRules: 1, durationMs: 7 }}
        settings={settings}
        onAnalyze={onAnalyze}
        onOpenStudio={onOpenStudio}
      />,
    );
    expect(screen.getByTestId('api-mock-conflict-guide').textContent).toMatch(/No route conflicts detected/i);
    expect(screen.getByTestId('api-mock-conflict-guide').textContent).toContain('Reject all multiple matches');
    fireEvent.click(screen.getByTestId('api-mock-conflict-guide-analyze'));
    fireEvent.click(screen.getByTestId('api-mock-conflict-guide-studio'));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
    expect(onOpenStudio).toHaveBeenCalledTimes(1);
  });
});
