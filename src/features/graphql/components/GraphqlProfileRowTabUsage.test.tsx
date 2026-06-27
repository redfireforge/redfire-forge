/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GraphqlProfileRowTabUsage } from './GraphqlProfileRowTabUsage';

describe('GraphqlProfileRowTabUsage', () => {
  it('renders unused hint when no tabs link', () => {
    render(<GraphqlProfileRowTabUsage profileId="p1" links={[]} />);
    expect(screen.getByText('Used by')).toBeInTheDocument();
    expect(screen.getByText('Not linked to any tab')).toBeInTheDocument();
  });

  it('renders tab pills with active indicator', () => {
    render(
      <GraphqlProfileRowTabUsage
        profileId="p1"
        links={[
          { tabId: 'tab-1', label: 'Staging', isActive: false },
          { tabId: 'tab-2', label: 'Production', isActive: true },
        ]}
      />,
    );
    expect(screen.getByTestId('gql-profile-tab-pill-p1-tab-2')).toHaveClass(
      'gql-profile-row__tab-pill--active',
    );
    expect(screen.getByLabelText(/Tabs using this profile/i)).toBeInTheDocument();
  });

  it('shows overflow pill when many tabs link', () => {
    const links = Array.from({ length: 5 }, (_, i) => ({
      tabId: `tab-${i}`,
      label: `Tab ${i + 1}`,
      isActive: i === 0,
    }));
    render(<GraphqlProfileRowTabUsage profileId="p1" links={links} />);
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });
});
