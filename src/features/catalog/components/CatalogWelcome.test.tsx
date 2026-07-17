/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogWelcome from './CatalogWelcome';

describe('CatalogWelcome', () => {
  it('renders hero, cards and supported formats', () => {
    render(<CatalogWelcome onImport={vi.fn()} />);
    expect(screen.getByText('API CATALOG')).toBeInTheDocument();
    expect(screen.getByText('Browse Endpoints')).toBeInTheDocument();
    expect(screen.getByText('Export to Harness')).toBeInTheDocument();
    expect(screen.getByText('OpenAPI 3.1')).toBeInTheDocument();
  });

  it('fires onImport when the Import Spec button is clicked', async () => {
    const onImport = vi.fn();
    render(<CatalogWelcome onImport={onImport} />);
    await userEvent.click(screen.getByRole('button', { name: /Import Spec/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
