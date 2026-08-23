/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DerivedVarsPanel } from './DerivedVarsPanel';
import type { Microservice } from '@shared/types';

const svc: Microservice = {
  id: 'svc-1',
  name: 'orders',
  baseUrls: { e1: 'https://api.example.com' },
  protocolEndpoints: {
    websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
  },
};

describe('DerivedVarsPanel', () => {
  it('renders derived variable rows for websocket protocol', () => {
    render(
      <DerivedVarsPanel svc={svc} protocol="websocket" envId="e1" envName="local" />,
    );
    const panel = screen.getByTestId('derived-vars-websocket');
    expect(panel.textContent).toContain('{{wsBaseUrl}}');
    expect(panel.textContent).toContain('wss://ws.example.com');
    expect(panel.textContent).toContain('explicitly set');
  });

  it('returns null when protocol has no derived vars', () => {
    const { container } = render(
      <DerivedVarsPanel svc={svc} protocol={'unknown' as never} envId="e1" envName="local" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when grpcHost is not configured', () => {
    const { container } = render(
      <DerivedVarsPanel svc={svc} protocol="grpc" envId="e1" envName="local" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when all derived values are empty strings', () => {
    const emptySvc: Microservice = { id: 'x', name: '', baseUrls: {} };
    const { container } = render(
      <DerivedVarsPanel svc={emptySvc} protocol="http" envId="e1" envName="" />,
    );
    expect(container.firstChild).toBeNull();
  });
  it('shows envName and svcName even when HTTP base URL is missing', () => {
    const emptySvc: Microservice = { id: 'x', name: 'empty', baseUrls: {} };
    render(
      <DerivedVarsPanel svc={emptySvc} protocol="http" envId="e1" envName="local" />,
    );
    const panel = screen.getByTestId('derived-vars-http');
    expect(panel.textContent).toContain('{{envName}}');
    expect(panel.textContent).toContain('local');
    expect(panel.textContent).toContain('{{svcName}}');
    expect(panel.textContent).not.toContain('{{baseUrl}}');
  });

  it('shows HTTP fallback label for derived websocket URL', () => {
    render(
      <DerivedVarsPanel svc={svc} protocol="sse" envId="e1" envName="local" />,
    );
    const panel = screen.getByTestId('derived-vars-sse');
    expect(panel.textContent).toContain('HTTP fallback');
  });
});
