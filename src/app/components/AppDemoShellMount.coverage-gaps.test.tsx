/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Stub the lazy chunk so Suspense resolves synchronously without the real module.
vi.mock('../demo/DemoShellHost', () => ({
  DemoShellHost: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'demo-shell-host' }, children),
}));

// The module-level ternary (`import.meta.env.VITE_ENABLE_DEMO_HUB === 'true'`)
// is evaluated once at import time, so we must stub the env var and reset
// modules before each group so the ternary is re-evaluated.

describe('AppDemoShellMount — DEMO_HUB disabled (prod-slim)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_DEMO_HUB', 'false');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns null when enabled=false', async () => {
    const { default: AppDemoShellMount } = await import('./AppDemoShellMount');
    const { container } = render(
      React.createElement(AppDemoShellMount, { enabled: false } as never),
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when enabled=true but DemoShellHost is null (flag off)', async () => {
    const { default: AppDemoShellMount } = await import('./AppDemoShellMount');
    const { container } = render(
      React.createElement(AppDemoShellMount, { enabled: true } as never),
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('AppDemoShellMount — DEMO_HUB enabled', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_DEMO_HUB', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns null when enabled=false even if DemoShellHost is available', async () => {
    const { default: AppDemoShellMount } = await import('./AppDemoShellMount');
    const { container } = render(
      React.createElement(AppDemoShellMount, { enabled: false } as never),
    );
    expect(container.firstChild).toBeNull();
  });
});
