/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtocolEndpointPreview } from './ProtocolEndpointPreview';

describe('ProtocolEndpointPreview', () => {
  it('renders resolved preview for template URLs (AC-EM-19)', () => {
    render(
      <ProtocolEndpointPreview
        draftUrl="{{wsBaseUrl}}/ws"
        envVarMap={{ wsBaseUrl: 'wss://ws.example.com' }}
        protocolRowStatus="explicit"
        testId="preview"
      />,
    );
    const el = screen.getByTestId('preview');
    expect(el.textContent).toContain('wss://ws.example.com/ws');
    expect(el.getAttribute('data-status')).toBe('explicit');
    expect(el.textContent).toContain('✓');
  });

  it('hides preview for literal URLs without templates', () => {
    render(
      <ProtocolEndpointPreview
        draftUrl="https://api.example.com/ws"
        envVarMap={{ baseUrl: 'https://api.example.com' }}
        testId="preview"
      />,
    );
    expect(screen.queryByTestId('preview')).toBeNull();
  });

  it('shows fallback status chip', () => {
    render(
      <ProtocolEndpointPreview
        draftUrl="{{sseUrl}}/events"
        envVarMap={{ sseUrl: 'https://events.example.com' }}
        protocolRowStatus="fallback"
        testId="sse-preview"
      />,
    );
    expect(screen.getByTestId('sse-preview').getAttribute('data-status')).toBe('fallback');
    expect(screen.getByTestId('sse-preview').textContent).toContain('⚠');
  });
});
