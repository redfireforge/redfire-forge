/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { selectOption } from '@test-utils/customSelectHelper';
import CatalogSendToRequestsModal from './CatalogSendToRequestsModal';
import { makeEntry, makeFolder, makeEndpoint, makeServer } from './catalogTestFactories';
import type { Environment, Microservice } from '@shared/types';
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
  preSelectedEndpointId?: string;
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
      preSelectedEndpointId={over.preSelectedEndpointId}
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
    fireEvent.click(document.querySelector('.cat-send-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows the new-group input when "+ New Group..." is selected', async () => {
    renderModal({ inline: true });
    const groupSelect = document.querySelector('.cep-field-input.cs-wrapper') ?? document.querySelector('.cs-wrapper')!;
    selectOption(groupSelect, '+ New Group...');
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
    const groupSelect = document.querySelector('.cep-field-input.cs-wrapper') ?? document.querySelector('.cs-wrapper')!;
    selectOption(groupSelect, '+ New Group...');
    await userEvent.type(screen.getByPlaceholderText('New group name'), 'NG');
    await userEvent.click(screen.getByText(/Export 1 request/));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ newGroupName: 'NG' }));
  });

  it('sends with an existing target group', async () => {
    const { onSend } = renderModal({ inline: true });
    const groupSelect = document.querySelector('.cep-field-input.cs-wrapper') ?? document.querySelector('.cs-wrapper')!;
    selectOption(groupSelect, 'Grp');
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

  it('detects sample data from headers and body', () => {
    renderModal({
      inline: true,
      savedEpValues: {
        ep1: { params: {}, headers: { Authorization: 'Bearer x' }, body: '' },
      },
    });
    expect(document.querySelector('.cat-send-sample-box.checked')).toBeTruthy();
  });

  it('detects sample data from body only', () => {
    renderModal({
      inline: true,
      savedEpValues: {
        ep1: { params: {}, headers: {}, body: '{"id":1}' },
      },
    });
    expect(document.querySelector('.cat-send-sample-box.checked')).toBeTruthy();
  });

  it('hasSample returns false when saved values throw', () => {
    renderModal({
      inline: true,
      savedEpValues: {
        ep1: {
          get params() { throw new Error('bad'); },
          headers: {},
          body: '',
        } as unknown as SavedEndpointValues,
      },
    });
    expect(document.querySelector('.cat-send-sample-box.disabled')).toBeTruthy();
  });

  it('pre-selects a single endpoint when preSelectedEndpointId is set', () => {
    renderModal({ inline: true, preSelectedEndpointId: 'ep1' });
    expect(screen.getByText(/Export 1 request/)).toBeInTheDocument();
  });

  it('ignores sample toggle for endpoints without saved samples', () => {
    renderModal({ inline: true });
    const disabled = document.querySelector('.cat-send-sample-box.disabled') as HTMLElement;
    fireEvent.click(disabled.closest('.cat-send-sample-cell')!);
    expect(disabled.classList.contains('checked')).toBe(false);
  });

  it('selects all samples when Sample header clicked after deselecting', async () => {
    renderModal({ inline: true, savedEpValues: sampleValues });
    fireEvent.click(screen.getByText('Sample')); // deselect all
    fireEvent.click(screen.getByText('Sample')); // select all
    expect(document.querySelector('.cat-send-sample-box.checked')).toBeTruthy();
  });

  it('walks nested folders and root endpoints', () => {
    const nested = makeEntry({
      folders: [
        makeFolder({
          id: 'f1',
          name: 'Users',
          endpoints: [makeEndpoint({ id: 'ep1', path: '/users' })],
          folders: [makeFolder({ id: 'f2', name: 'Nested', endpoints: [makeEndpoint({ id: 'ep2', path: '/nested' })] })],
        }),
      ],
      endpoints: [makeEndpoint({ id: 'ep3', path: '/other', summary: 'Other ep' })],
    });
    renderModal({ inline: true, entry: nested });
    expect(screen.getAllByText('Other ep').length).toBeGreaterThan(0);
    expect(screen.getByText('Nested')).toBeInTheDocument();
  });

  it('uses app environments merged with linked microservice custom envs', () => {
    const svc: Microservice = {
      id: 'svc1',
      name: 'Svc',
      baseUrls: { e1: 'https://svc.example.com', e2: 'https://alt.example.com' },
      customEnvs: [{ id: 'e2', name: 'Alt Env' }],
    };
    const envs: Environment[] = [{ id: 'e1', name: 'Primary', baseUrl: 'https://primary.example.com' }];
    const entry = makeEntry({
      microserviceId: 'svc1',
      folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users' })] })],
      endpoints: [],
    });
    renderModal({ inline: true, entry, appMicroservices: [svc], appEnvironments: envs });
    expect(screen.getAllByText('Primary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alt Env').length).toBeGreaterThan(0);
  });

  it('falls back to server index name when description is missing', () => {
    const entry = makeEntry({
      servers: [{ url: 'https://api.example.com', description: '', resolvedUrl: 'https://resolved.example.com' }],
      folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users' })] })],
      endpoints: [],
    });
    renderModal({ inline: true, entry });
    expect(screen.getAllByText('Server 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('https://resolved.example.com').length).toBeGreaterThan(0);
  });

  it('shows plural new-endpoint label when multiple endpoints are new', () => {
    versionMapRef.map = new Map([
      ['ep1', { status: 'new' }],
      ['ep2', { status: 'new' }],
    ]);
    const entry = makeEntry({
      folders: [makeFolder({
        id: 'f1',
        name: 'Users',
        endpoints: [
          makeEndpoint({ id: 'ep1', path: '/a', summary: 'A' }),
          makeEndpoint({ id: 'ep2', path: '/b', summary: 'B' }),
        ],
      })],
      endpoints: [],
    });
    renderModal({ inline: true, entry });
    expect(screen.getByText('2 new endpoints')).toBeInTheDocument();
  });

  it('shows exported badge without version when exportedVersion is missing', () => {
    versionMapRef.map = new Map([['ep1', { status: 'exported' }]]);
    renderModal({ inline: true });
    expect(screen.getByText('from ?')).toBeInTheDocument();
  });

  it('uses path as display name when summary and custom name are empty', () => {
    const entry = makeEntry({
      folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/raw-path', summary: '' })] })],
      endpoints: [],
    });
    renderModal({ inline: true, entry });
    expect(screen.getAllByText('/raw-path').length).toBeGreaterThan(0);
  });

  it('sends with existing target group id (non-new branch)', async () => {
    const { onSend } = renderModal({ inline: true });
    const groupSelect = document.querySelector('.cep-field-input.cs-wrapper') ?? document.querySelector('.cs-wrapper')!;
    selectOption(groupSelect, 'Grp');
    await userEvent.click(screen.getByText(/Export 1 request/));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ targetGroupId: 'g1' }));
  });

  it('does not send when canSend is false', async () => {
    const { onSend } = renderModal({ inline: true });
    const colInput = document.querySelector('input.cep-field-input') as HTMLInputElement;
    await userEvent.clear(colInput);
    await userEvent.click(screen.getByText(/Export 1 request/));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('stops overlay click propagation on modal body', () => {
    const { onClose } = renderModal();
    fireEvent.click(document.querySelector('.cat-send-modal')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('toggles env row via checkbox without double-firing row handler', () => {
    renderModal({ inline: true });
    const checkbox = document.querySelector('.cat-send-env-table input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('toggles endpoint row via checkbox', () => {
    renderModal({ inline: true });
    const checkbox = document.querySelector('.cat-send-ep-table input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('renders unknown HTTP method color fallback in preview tree', async () => {
    const entry = makeEntry({
      folders: [makeFolder({ id: 'f1', name: 'Users', endpoints: [makeEndpoint({ id: 'ep1', path: '/users', method: 'TRACE' as 'GET' })] })],
      endpoints: [],
    });
    renderModal({ inline: true, entry });
    expect(document.querySelector('.cat-send-tree-ep .cat-send-method')).toBeTruthy();
  });
});
