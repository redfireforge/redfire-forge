/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeaderProtocolIndicator from './HeaderProtocolIndicator';
import type { HeaderProtocolIndicatorState } from '../utils/headerProtocolUtils';

const explicitState: HeaderProtocolIndicatorState = {
  protocol: 'websocket',
  protocolLabel: 'WebSocket',
  cssKey: 'ws',
  resolvedUrl: 'wss://ws.example.com',
  status: 'explicit',
  statusSymbol: '✓',
  tooltipTitle: 'WebSocket endpoint · local × orders',
  tooltipDetail: 'Explicitly configured',
};

describe('HeaderProtocolIndicator', () => {
  it('renders badge with truncated URL and status symbol (AC-EM-14)', () => {
    render(<HeaderProtocolIndicator state={explicitState} />);
    const badge = screen.getByTestId('header-protocol-indicator');
    expect(badge.textContent).toContain('wss://ws.example.com');
    expect(badge.textContent).toContain('✓');
    expect(badge.getAttribute('title')).toContain('Explicitly configured');
  });

  it('shows Not resolved when URL is empty', () => {
    render(
      <HeaderProtocolIndicator
        state={{ ...explicitState, resolvedUrl: '', status: 'unresolved', statusSymbol: '✗' }}
      />,
    );
    expect(screen.getByTestId('header-protocol-indicator').textContent).toContain('Not resolved');
  });

  it('applies fallback status class', () => {
    render(
      <HeaderProtocolIndicator
        state={{ ...explicitState, status: 'fallback', statusSymbol: '⚠' }}
      />,
    );
    expect(screen.getByTestId('header-protocol-indicator').className).toContain('fallback');
  });
});
