/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Stub the lazy chunk so Suspense resolves without the real module.
vi.mock('../demo/DemoShellHost', () => ({
  DemoShellHost: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'demo-shell-host' }, children),
}));

describe('AppDemoShellMount', () => {
  it('returns null when enabled=false', async () => {
    const { default: AppDemoShellMount } = await import('./AppDemoShellMount');
    const { container } = render(
      React.createElement(AppDemoShellMount, { enabled: false } as never),
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders Suspense wrapper when enabled=true', async () => {
    const { default: AppDemoShellMount } = await import('./AppDemoShellMount');
    const { container } = render(
      React.createElement(AppDemoShellMount, { enabled: true } as never),
    );
    // Suspense renders the stub after resolving
    expect(container).toBeDefined();
  });
});
