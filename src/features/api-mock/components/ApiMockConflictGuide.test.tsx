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

  it('renders "Ready to analyze" and default labels when no stats or settings provided', () => {
    render(<ApiMockConflictGuide routes={[]} />);
    const guide = screen.getByTestId('api-mock-conflict-guide');
    expect(guide.textContent).toMatch(/Ready to analyze/);
    expect(guide.textContent).toMatch(/Check rules before they collide/);
    expect(guide.textContent).toMatch(/Not run yet/);
    expect(guide.textContent).toMatch(/Highest priority/);
    expect(guide.textContent).toMatch(/Reject as ambiguous/);
    expect(screen.queryByTestId('api-mock-conflict-guide-analyze')).toBeNull();
    expect(screen.queryByTestId('api-mock-conflict-guide-studio')).toBeNull();
  });

  it('shows "highest_priority" multiLabel when policy is highest_priority', () => {
    const settings = {
      selection: {
        multipleMatchPolicy: 'highest_priority',
        equalPriorityPolicy: 'reject',
      },
    } as unknown as ApiMockServerSettingsV1;
    render(<ApiMockConflictGuide routes={[]} settings={settings} />);
    expect(screen.getByTestId('api-mock-conflict-guide').textContent).toMatch(/Choose highest priority/);
    expect(screen.getByTestId('api-mock-conflict-guide').textContent).toMatch(/Reject as ambiguous \(409\)/);
  });

  it('shows "specificity" equalLabel when equalPriorityPolicy is specificity_then_id', () => {
    const settings = {
      selection: {
        multipleMatchPolicy: 'reject_multiple',
        equalPriorityPolicy: 'specificity_then_id',
      },
    } as unknown as ApiMockServerSettingsV1;
    render(<ApiMockConflictGuide routes={[]} settings={settings} />);
    expect(screen.getByTestId('api-mock-conflict-guide').textContent).toMatch(/Specificity, then stable ID/);
  });

  it('counts enabled routes only and shows analyzed stats when hasRun', () => {
    const routes: ApiMockRouteV1[] = [
      { id: 'r1', enabled: true } as unknown as ApiMockRouteV1,
      { id: 'r2', enabled: true } as unknown as ApiMockRouteV1,
      { id: 'r3', enabled: false } as unknown as ApiMockRouteV1,
    ];
    render(<ApiMockConflictGuide routes={routes} stats={{ analyzedRules: 2, durationMs: 15 }} />);
    const guide = screen.getByTestId('api-mock-conflict-guide');
    expect(guide.textContent).toMatch(/No route conflicts detected/);
    expect(guide.textContent).toMatch(/2 rules · 15 ms/);
    expect(guide.textContent).toMatch(/2 \/ 3/);
  });
});
