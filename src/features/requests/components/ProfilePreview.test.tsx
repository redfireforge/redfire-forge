/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ProfilePreview } from './ProfilePreview';
import type { LoadProfileConfig } from '../../../shared/types';

vi.mock('../../../engine/executor', () => ({
  getTargetConcurrency: vi.fn().mockReturnValue(5),
}));

function makeProfile(overrides?: Partial<LoadProfileConfig>): LoadProfileConfig {
  return {
    type: 'constant',
    durationSec: 10,
    maxConcurrency: 10,
    ...overrides,
  };
}

describe('ProfilePreview', () => {
  it('renders SVG with spike concurrency defined', () => {
    const { container } = render(
      <ProfilePreview profile={makeProfile({ spikeConcurrency: 20 })} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('polygon')).toBeTruthy();
  });

  it('renders SVG without spike concurrency (undefined branch)', () => {
    const { container } = render(
      <ProfilePreview profile={makeProfile({ spikeConcurrency: undefined })} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('polygon')).toBeTruthy();
  });

  it('shows duration label text', () => {
    const { container } = render(
      <ProfilePreview profile={makeProfile({ durationSec: 30 })} />,
    );
    expect(container.textContent).toContain('30s');
  });
});
