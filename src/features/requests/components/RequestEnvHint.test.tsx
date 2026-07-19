/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import RequestEnvHint from './RequestEnvHint';

describe('RequestEnvHint', () => {
  it('shows the base-url hint when no base urls are configured', () => {
    render(<RequestEnvHint hasBaseUrls={false} isOrphanSubCol={false} />);

    expect(screen.getByText(/Base URLs not configured/i)).toBeTruthy();
  });

  it('shows the orphan sub-collection warning when orphaned', () => {
    render(<RequestEnvHint hasBaseUrls={true} isOrphanSubCol={true} />);

    expect(screen.getByTestId('req-subcol-orphan-warning')).toBeTruthy();
    expect(screen.getByText(/isn't linked to a configured environment/i)).toBeTruthy();
  });

  it('renders nothing when base urls exist and the sub-collection is linked', () => {
    const { container } = render(<RequestEnvHint hasBaseUrls={true} isOrphanSubCol={false} />);

    expect(container.firstChild).toBeNull();
  });
});
