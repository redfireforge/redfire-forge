/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CatalogSendToRequestsModal from './CatalogSendToRequestsModal';
import { makeEntry, makeFolder, makeEndpoint, makeServer } from './catalogTestFactories';
import type { Environment, Microservice } from '../../../shared/types';
import type { SavedEndpointValues } from '../types/catalog';

const versionMapRef = vi.hoisted(() => ({ map: new Map<string, { status: string; exportedVersion?: string }>() }));
vi.mock('../utils/versionStatus', () => ({
  buildVersionInfoMap: () => versionMapRef.map,
}));
vi.mock('../../requests/utils/requestTree', () => ({
  collectAllGroups: () => [{ group: { id: 'g1', name: 'Grp' }, depth: 0 }],
}));

const baseEntry = makeEntry({
  folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users', summary: 'Get users' })] })],
  endpoints: [],
  servers: [makeServer({ url: 'https://api.example.com', description: 'Prod' })],
});

const sampleValues: Record<string, SavedEndpointValues> = {
  ep1: { params: { id: '123' }, headers: {}, body: '' },
};

function renderModal(over: {
  inline?: boolean;
  entry?: typeof baseEntry;
  savedEpValues?: Record<string, SavedEndpointValues>;
  appEnvironments?: Environment[];
  appMicroservices?: Microservice[];
} = {}) {
  const onSend = vi.fn();
  const onClose = vi.fn();
  render(
    <CatalogSendToRequestsModal
      entry={over.entry ?? baseEntry}
      appEnvironments={over.appEnvironments ?? []}
      appMicroservices={over.appMicroservices ?? []}
      savedEpValues={over.savedEpValues ?? {}}
      collections={[]}
      onSend={onSend}
      onClose={onClose}
      inline={over.inline}
    />,
  );
  return { onSend, onClose };
}

beforeEach(() => {
  versionMapRef.map = new Map([['ep1', { status: 'new' }]]);
});

describe('CatalogSendToRequestsModal', () => {
  it('renders inline with collection name, environments and endpoints', () => {
    renderModal({ inline: true });
    expect(screen.getByText('Collection Name')).toBeInTheDocument();
    expect(screen.getAllByText('Get users').length).toBeGreaterThan(0);
    expect(screen.getByText('1 new endpoint')).toBeInTheDocument();
    expect(screen.getByText(/Export 1 request/)).toBeInTheDocument();
  });

  it('renders the overlay variant and closes via overlay, close button and cancel', async () => {
    const { onClose } = renderModal();
    expect(screen.getByText('Export to Requests')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Cancel'));
    await userEvent.click(screen.getByText('×'));
    fireEvent.click(document.querySelector('.cat-send-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('shows the new-group input when "+ New Group..." is selected', async () => {
    renderModal({ inline: true });
    const select = document.querySelector('select.cep-field-input') as HTMLSelectElement;
    await userEvent.selectOptions(select, '__new__');
    expect(screen.getByPlaceholderText('New group name')).toBeInTheDocument();
  });

  it('toggles select-all and individual environments and endpoints', async () => {
    renderModal({ inline: true });
    const selectAlls = screen.getAllByText('Select All');
    expect(selectAlls.length).toBe(2);
    const envSelectAll = selectAlls[0].querySelector('input') as HTMLInputElement;
    await userEvent.click(envSelectAll);
    await userEvent.click(envSelectAll);
    const epSelectAll = selectAlls[1].querySelector('input') as HTMLInputElement;
    await userEvent.click(epSelectAll);
    await userEvent.click(epSelectAll);
    // individual env row click
    fireEvent.click(screen.getAllByText('Prod')[0]);
    // individual ep row click
    fireEvent.click(screen.getAllByText('Get users')[0]);
  });

  it('edits the custom name for an endpoint', async () => {
    renderModal({ inline: true });
    const nameInput = document.querySelector('.cat-send-name-input') as HTMLInputElement;
    await userEvent.type(nameInput, 'My Name');
    expect(nameInput.value).toBe('My Name');
  });

  it('toggles sample selection when saved values exist', async () => {
    renderModal({ inline: true, savedEpValues: sampleValues });
    const sampleCell = document.querySelector('.cat-send-sample-cell') as HTMLElement;
    fireEvent.click(sampleCell);
    fireEvent.click(sampleCell);
    // toggle all samples via the Sample header
    fireEvent.click(screen.getByText('Sample'));
  });

  it('collapses and expands a preview environment', async () => {
    renderModal({ inline: true });
    const envHdr = document.querySelector('.cat-send-tree-env-hdr') as HTMLElement;
    fireEvent.click(envHdr);
    fireEvent.click(envHdr);
  });

  it('sends with a new target group', async () => {
    const { onSend } = renderModal({ inline: true, savedEpValues: sampleValues });
    const select = document.querySelector('select.cep-field-input') as HTMLSelectElement;
    await userEvent.selectOptions(select, '__new__');
    await userEvent.type(screen.getByPlaceholderText('New group name'), 'NG');
    await userEvent.click(screen.getByText(/Export 1 request/));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ newGroupName: 'NG' }));
  });

  it('sends with an existing target group', async () => {
    const { onSend } = renderModal({ inline: true });
    const select = document.querySelector('select.cep-field-input') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'g1');
    await userEvent.click(screen.getByText(/Export 1 request/));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ targetGroupId: 'g1' }));
  });

  it('disables export and shows empty preview when collection name is cleared', async () => {
    renderModal({ inline: true });
    const colInput = document.querySelector('input.cep-field-input') as HTMLInputElement;
    await userEvent.clear(colInput);
    expect(screen.getAllByText(/Select at least one environment/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Export 1 request/)).toBeDisabled();
  });

  it('resizes a column via mouse drag', () => {
    renderModal({ inline: true });
    const handle = document.querySelector('.cat-send-col-resize') as HTMLElement;
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 160 });
    fireEvent.mouseUp(document);
  });

  it('builds env options from a linked microservice', () => {
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://svc.example.com' },
      customEnvs: [{ id: 'e1', name: 'Env One' }],
    };
    const entry = makeEntry({
      microserviceId: 'svc1',
      folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users' })] })],
      endpoints: [],
    });
    renderModal({ inline: true, entry, appMicroservices: [svc] });
    expect(screen.getAllByText('Env One').length).toBeGreaterThan(0);
  });

  it('builds env options from legacy entry.environments', () => {
    const entry = makeEntry({
      environments: [{ id: 'env1', name: 'Staging', baseUrl: 'https://staging.example.com' }],
      folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users' })] })],
      endpoints: [],
    });
    renderModal({ inline: true, entry });
    expect(screen.getAllByText('Staging').length).toBeGreaterThan(0);
  });

  it('shows the no-environments message when none are available', () => {
    const entry = makeEntry({
      servers: [],
      folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users' })] })],
      endpoints: [],
    });
    renderModal({ inline: true, entry });
    expect(screen.getByText(/No environments available/)).toBeInTheDocument();
  });

  it('renders exported version badge and "all previously exported" label', () => {
    versionMapRef.map = new Map([['ep1', { status: 'exported', exportedVersion: '1.0.0' }]]);
    renderModal({ inline: true });
    expect(screen.getByText('all previously exported')).toBeInTheDocument();
    expect(screen.getByText('from 1.0.0')).toBeInTheDocument();
  });
});
