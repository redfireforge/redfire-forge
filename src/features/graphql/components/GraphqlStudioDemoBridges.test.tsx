/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../config/features', () => ({
  DEMO_HUB_ENABLED: true,
}));

vi.mock('../DemoGqlStudioBridges', () => ({
  default: () => <div data-testid="demo-bridges-stub">bridges</div>,
}));

import { GraphqlStudioDemoBridges } from './GraphqlStudioDemoBridges';

const bridgeProps = {
  upsertEnvironment: vi.fn(),
  deleteEnvironmentByName: vi.fn(),
  applyTlsSettings: vi.fn(),
  setGqlQuery: vi.fn(),
  setRightView: vi.fn(),
  handleAdvSettingsChange: vi.fn(),
  setBatchUnsupportedToast: vi.fn(),
  clearActiveTabAuth: vi.fn(),
};

describe('GraphqlStudioDemoBridges', () => {
  it('renders lazy demo bridges when demo hub is enabled', async () => {
    render(<GraphqlStudioDemoBridges {...bridgeProps} />);
    expect(await screen.findByTestId('demo-bridges-stub')).toBeInTheDocument();
  });
});

describe('GraphqlStudioDemoBridges — demo disabled', () => {
  it('returns null when DEMO_HUB_ENABLED is false', async () => {
    vi.resetModules();
    vi.doMock('../../../config/features', () => ({ DEMO_HUB_ENABLED: false }));
    const mod = await import('./GraphqlStudioDemoBridges');
    const { container } = render(<mod.GraphqlStudioDemoBridges {...bridgeProps} />);
    expect(container.firstChild).toBeNull();
    vi.doUnmock('../../../config/features');
    vi.resetModules();
  });
});
