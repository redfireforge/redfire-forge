/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { DockerStacksSettings } from './DockerStacksSettings';
import { resetDockerStackStore } from '../stores/dockerStackStore';
import { resetDockerPrefetchStore } from '../stores/dockerPrefetchStore';

vi.mock('@shared/utils/platform', () => ({
  isTauri: () => false,
}));

vi.mock('../utils/dockerStackApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/dockerStackApi')>();
  return {
    ...actual,
    getStackStatus: vi.fn(async () => false),
    getStopOnClose: vi.fn(async () => true),
    getDockerImageSizes: vi.fn(async () => []),
    getPrefetchChoice: vi.fn(async () => null),
    isPrefetchRunning: vi.fn(async () => false),
    listenDockerPull: vi.fn(async () => () => {}),
  };
});

describe('DockerStacksSettings on web', () => {
  beforeEach(() => {
    resetDockerStackStore();
    resetDockerPrefetchStore();
  });

  afterEach(() => {
    cleanup();
  });

  it('disables Download images on web', async () => {
    render(<DockerStacksSettings confirm={vi.fn()} />);
    const btn = await screen.findByTestId('docker-settings-prefetch');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toContain('Download images');
    await waitFor(() => expect(screen.getByTestId('docker-settings-web-note')).toBeTruthy());
    expect(screen.getByTestId('docker-settings-stop-on-close')).toBeDisabled();
    expect(screen.getByTestId('docker-settings-uninstall')).toBeDisabled();
    await waitFor(() => expect(screen.getByTestId('docker-settings-remove-all-images')).toBeDisabled());
  });
});
