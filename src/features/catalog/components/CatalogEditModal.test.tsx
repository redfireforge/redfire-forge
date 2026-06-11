/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import CatalogEditModal from './CatalogEditModal';
import { makeEntry, makeHostConfig } from './catalogTestFactories';
import type { Microservice, Environment } from '../../../shared/types';

vi.mock('../../../shared/components/FullPanelModal', () => ({
  default: ({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) => (
    <div data-testid="full-panel-modal">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-body">{children}</div>
      <div data-testid="modal-footer">{footer}</div>
    </div>
  ),
}));

const environments: Environment[] = [
  { id: 'dev', name: 'Dev' },
  { id: 'prod', name: 'Prod' },
];

function makeSvc(over: Partial<Microservice> = {}): Microservice {
  return {
    id: 'svc1',
    name: 'Orders Service',
    baseUrls: { dev: 'https://dev.orders', prod: 'https://prod.orders' },
    ...over,
  };
}

describe('CatalogEditModal', () => {
  it('renders the title and a None state when no microservice is linked', () => {
    render(
      <CatalogEditModal
        entry={makeEntry({ name: 'Orders API' })}
        microservices={[makeSvc()]}
        environments={environments}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit — Orders API');
    expect(screen.getByText(/No microservice linked/)).toBeInTheDocument();
  });

  it('shows the environment preview table when a linked microservice has base URLs', async () => {
    render(
      <CatalogEditModal
        entry={makeEntry()}
        microservices={[makeSvc()]}
        environments={environments}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'svc1');
    expect(screen.getByText('Dev')).toBeInTheDocument();
    expect(screen.getByText('https://dev.orders')).toBeInTheDocument();
  });

  it('shows an empty hint when the linked microservice has no base URLs', async () => {
    render(
      <CatalogEditModal
        entry={makeEntry()}
        microservices={[makeSvc({ baseUrls: {} })]}
        environments={environments}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'svc1');
    expect(screen.getByText(/no base URLs configured/)).toBeInTheDocument();
  });

  it('saves and resets host strategy to inherited when unlinking with environment strategy', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <CatalogEditModal
        entry={makeEntry({ hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'dev' }) })}
        microservices={[makeSvc()]}
        environments={environments}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        microserviceId: undefined,
        hostConfig: expect.objectContaining({ strategy: 'inherited', environmentId: undefined }),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('reassigns environmentId to the first available base URL when linking a service missing the current env', async () => {
    const onSave = vi.fn();
    render(
      <CatalogEditModal
        entry={makeEntry({ hostConfig: makeHostConfig({ strategy: 'environment', environmentId: 'staging' }) })}
        microservices={[makeSvc({ baseUrls: { prod: 'https://prod.orders' } })]}
        environments={environments}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'svc1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        microserviceId: 'svc1',
        hostConfig: expect.objectContaining({ environmentId: 'prod' }),
      }),
    );
  });

  it('calls onClose from the Cancel button', async () => {
    const onClose = vi.fn();
    render(
      <CatalogEditModal
        entry={makeEntry()}
        microservices={[makeSvc()]}
        environments={environments}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
