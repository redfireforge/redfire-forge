/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Environment, Microservice, RequestFolder } from '@shared/types';
import BatchSendToHarnessModal, { type BatchSendToHarnessPayload } from './BatchSendToHarnessModal';

afterEach(() => {
  cleanup();
});

const environments: Environment[] = [
  { id: 'e1', name: 'Dev' },
];

const microservices: Microservice[] = [
  { id: 'm1', name: 'Payments', baseUrls: { e1: 'https://pay' }, customEnvs: [] },
];

function nestedFolder(): RequestFolder {
  return {
    id: 'f1',
    name: 'F1',
    requests: [{
      id: 'r-folder',
      name: 'In folder',
      url: '/nested',
      method: 'DELETE',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
      parameters: {},
      bodyType: 'none',
    }],
    folders: [],
  };
}

function selectCascadeOption(fieldTestId: string, optionText: string) {
  const field = document.querySelector(`[data-testid="${fieldTestId}"]`)!;
  const trigger = field.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger')!;
  fireEvent.click(trigger);
  const items = field.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item');
  const target = Array.from(items).find(item => item.textContent?.includes(optionText));
  if (target) fireEvent.click(target);
}

function selectEnvAndSvc() {
  selectCascadeOption('send-harness-cascade-environment', 'Dev');
  selectCascadeOption('send-harness-cascade-microservice', 'Payments');
}

describe('BatchSendToHarnessModal', () => {
  it('gates Next until env and microservice then surfaces request checklist and totals', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'col',
          name: 'My API',
          mode: 'direct',
          requests: [
            {
              id: 'r1',
              name: 'Ping',
              url: '/health',
              method: 'POST',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
          folders: [nestedFolder()],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Send Collection to Harness/)).toBeInTheDocument();
    expect(screen.getByText(/My API/)).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();

    selectEnvAndSvc();

    fireEvent.click(next);

    const pingCheckbox = screen.getByText('Ping').closest('label')!.querySelector('input[type="checkbox"]')!;
    fireEvent.click(pingCheckbox);
    expect(document.querySelector('.batch-harness-count')).toHaveTextContent('1/2');
    fireEvent.click(pingCheckbox);
    expect(document.querySelector('.batch-harness-count')).toHaveTextContent('2/2');

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBe(2);
    expect(screen.getByText('Dev')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(document.querySelector('.batch-harness-count')).toHaveTextContent('2/2');
    expect(screen.getByText(/2 Test Scenarios/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Deselect All/ }));
    expect(document.querySelector('.batch-harness-count')).toHaveTextContent('0/2');
    fireEvent.click(screen.getByRole('button', { name: /Select All/ }));
    expect(document.querySelector('.batch-harness-count')).toHaveTextContent('2/2');
  });

  it('fires onConfirm with option selections and escapes via overlay listener', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'c99',
          name: 'Tiny',
          mode: 'direct',
          requests: [
            {
              id: 'solo',
              name: '',
              url: '/solo',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
          folders: [],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    selectEnvAndSvc();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByText('Snapshot'));
    fireEvent.click(screen.getByText('Status 200'));

    fireEvent.click(screen.getByRole('button', { name: /^Send .* to Harness/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0]?.[0] as BatchSendToHarnessPayload;

    expect(payload.collectionId).toBe('c99');
    expect(payload.validationPreset).toBe('status-200');
    expect(payload.authMode).toBe('concrete');
    expect(payload.environmentId).toBe('e1');
    expect(payload.microserviceId).toBe('m1');
    expect(payload.selectedRequestIds instanceof Set ? payload.selectedRequestIds.has('solo') : false).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    fireEvent.click(document.querySelector('.send-harness-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows settings hint blocks when environments or microservices are empty', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'c',
          name: 'C',
          mode: 'direct',
          requests: [],
          folders: [],
        }}
        environments={[]}
        microservices={[]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/Need a new environment/i).length).toBeGreaterThanOrEqual(1);
  });

  it('disables Send when no requests selected after deselect-all', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'c',
          name: 'C',
          mode: 'direct',
          requests: [
            {
              id: 'rq',
              name: 'RQ',
              url: '/',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
          folders: [],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    selectEnvAndSvc();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: /Deselect All/ }));

    const send = screen.getByRole('button', { name: /^Send .* to Harness/ });
    expect(send).toBeDisabled();
  });

  it('returns to target step from Back then re-advances', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'c',
          name: 'N',
          mode: 'direct',
          requests: [
            {
              id: 'r1',
              name: 'A',
              url: '/',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
          folders: [],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    selectEnvAndSvc();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: /Send .* to Harness/ })).toBeEnabled();
  });

  it('includes custom-only env IDs in cascade options', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'cid',
          name: 'Nm',
          mode: 'direct',
          requests: [
            {
              id: 'r',
              url: '',
              method: 'PUT',
              name: 'Untitled label',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
          folders: [],
        }}
        environments={environments}
        microservices={[
          {
            id: 'srv',
            name: 'Srv',
            baseUrls: {},
            customEnvs: [{ id: 'cust1', name: 'Edge' }],
          },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const envField = document.querySelector('[data-testid="send-harness-cascade-environment"]')!;
    const trigger = envField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger')!;
    fireEvent.click(trigger);
    const items = envField.querySelectorAll('.cascade-dropdown-item');
    const itemTexts = Array.from(items).map(i => i.textContent);
    expect(itemTexts.some(t => t?.includes('Edge'))).toBe(true);
    const edgeItem = Array.from(items).find(i => i.textContent?.includes('Edge'));
    if (edgeItem) fireEvent.click(edgeItem);
  });

  it('filters microservices to those wired for the chosen custom-only environment', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'c-cust',
          name: 'Cust',
          mode: 'direct',
          requests: [
            {
              id: 'rq',
              name: '',
              url: '/',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
        }}
        environments={[{ id: 'e1', name: 'Dev' }, { id: 'edge', name: 'Edge' }]}
        microservices={[
          { id: 'only-edge', name: 'EdgeSvc', baseUrls: {}, customEnvs: [{ id: 'edge', name: 'Edge CE' }] },
          { id: 'classic', name: 'ClassicSvc', baseUrls: { e1: 'http://classic' }, customEnvs: [] },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    selectCascadeOption('send-harness-cascade-environment', 'Edge');

    {
      const svcField = document.querySelector('[data-testid="send-harness-cascade-microservice"]')!;
      const svcTrigger = svcField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger')!;
      fireEvent.click(svcTrigger);
      const svcItems = svcField.querySelectorAll('.cascade-dropdown-item');
      const svcNames = Array.from(svcItems).map(i => i.querySelector('.cascade-dropdown-item-name')?.textContent);
      expect(svcNames).toEqual(['EdgeSvc']);
      fireEvent.click(svcTrigger); // close
    }

    selectCascadeOption('send-harness-cascade-environment', 'Dev');

    {
      const svcField = document.querySelector('[data-testid="send-harness-cascade-microservice"]')!;
      const svcTrigger = svcField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger')!;
      fireEvent.click(svcTrigger);
      const svcItems = svcField.querySelectorAll('.cascade-dropdown-item');
      const svcNames = Array.from(svcItems).map(i => i.querySelector('.cascade-dropdown-item-name')?.textContent);
      expect(svcNames).toContain('ClassicSvc');
      expect(svcNames).not.toContain('EdgeSvc');
    }
  });

  it('dedupes cascade environment ids shared between tenants and embedded custom envs', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'dup',
          name: 'D',
          mode: 'direct',
          requests: [
            {
              id: 'solo',
              name: '',
              url: '',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
        }}
        environments={[{ id: 'shared', name: 'Shared Tenant' }]}
        microservices={[
          {
            id: 'm',
            name: 'Srv',
            baseUrls: { shared: 'https://x' },
            customEnvs: [{ id: 'shared', name: 'Overlap' }],
          },
        ]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const envField = document.querySelector('[data-testid="send-harness-cascade-environment"]')!;
    const trigger = envField.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger')!;
    fireEvent.click(trigger);
    const items = envField.querySelectorAll('.cascade-dropdown-item');
    const envIds = Array.from(items).map(i => i.querySelector('.cascade-dropdown-item-name')?.textContent);
    const sharedCount = envIds.filter(n => n === 'Shared Tenant').length;
    expect(sharedCount).toBe(1);
  });

  it('falls back styling for unrecognized HTTP verbs and renders singular summaries', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'c',
          name: 'RootOnly',
          mode: 'direct',
          requests: [
            {
              id: 'opt',
              name: 'OPTIONS',
              url: '/rpc',
              method: 'OPTIONS',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    selectEnvAndSvc();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(document.querySelector('.batch-harness-method')!.getAttribute('style')).toMatch(/94a3b8|rgb\(148, 163, 184\)/);

    const preview = document.querySelector('.batch-harness-preview-text');
    expect(preview?.textContent).toContain('Will create');
    expect(preview?.textContent).toContain('1 Feature Group');
    expect(preview?.textContent).toContain('1 Test Scenario');

    fireEvent.click(screen.getByRole('button', { name: /^Send 1 to Harness/ }));
  });

  it('shows inline hints when cascades retain options alongside guidance', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'hints',
          name: 'Hints',
          mode: 'direct',
          requests: [
            {
              id: 'a',
              name: 'Only',
              url: '/',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
          folders: [],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(document.querySelector('.send-harness-settings-hint-inline')).toBeTruthy();
  });

  it('selects harness inherit auth and disables validation via option cards', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'cards',
          name: 'Radio',
          mode: 'direct',
          requests: [{
            id: 'solo',
            name: 'S',
            url: '/',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
            parameters: {},
            bodyType: 'none',
          }],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    selectEnvAndSvc();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]!);
    fireEvent.click(radios[0]!);
    fireEvent.click(radios[3]!);
    fireEvent.click(radios[2]!);

    expect(radios[0]).toBeChecked();
    expect(radios[2]).toBeChecked();
  });

  it('labels blank requests as untitled and reflects manual deselection', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'blank',
          name: 'Blank',
          mode: 'direct',
          requests: [
            {
              id: 'anon',
              name: '',
              url: '',
              method: 'GET',
              headers: [],
              body: '',
              auth: { type: 'none' },
              validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
              parameters: {},
              bodyType: 'none',
            },
          ],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    selectEnvAndSvc();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByTitle('Untitled')).toHaveTextContent('Untitled');

    const hidden = document.querySelector('.batch-harness-hidden-input') as HTMLInputElement;
    fireEvent.click(hidden);
    expect(hidden.checked).toBe(false);
    expect(document.querySelector('.batch-harness-checkbox.checked')).toBeNull();
  });

  it('uses plural preview copy when folders shape multiple scenarios', () => {
    render(
      <BatchSendToHarnessModal
        collection={{
          id: 'pf',
          name: 'Plural',
          mode: 'direct',
          requests: [],
          folders: [
            nestedFolder(),
            {
              id: 'f2',
              name: 'Second',
              requests: [{
                id: 'r2',
                name: 'Other',
                url: '/two',
                method: 'PATCH',
                headers: [],
                body: '',
                auth: { type: 'none' },
                validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
                parameters: {},
                bodyType: 'none',
              }],
              folders: [],
            },
          ],
        }}
        environments={environments}
        microservices={microservices}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    selectEnvAndSvc();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText(/3 Test Scenarios/)).toBeInTheDocument();
    expect(screen.getByText(/2 tests\b/)).toBeInTheDocument();
  });
});
