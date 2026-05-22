import { describe, it, expect } from 'vitest';
import { HttpNodeData } from '../types/workflow';
import { mergeWorkflowNodeData, stripEphemeralNodeDataFields, cloneWorkflowNodeDataForStorage } from './workflowNodeMerge';

describe('mergeWorkflowNodeData', () => {
  it('does not wipe initialVariables when patch spreads initialVariables: undefined', () => {
    const base: HttpNodeData = {
      label: 'S',
      scenario: {
        id: '1',
        name: 'n',
        url: 'https://x/?vin={{vin}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      initialVariables: { vin: 'ABC' },
    };
    const dataProp = { ...base, initialVariables: undefined as Record<string, string> | undefined };
    const patch = { ...dataProp, scenario: { ...base.scenario, url: 'https://y/' } };
    const out = mergeWorkflowNodeData(base, patch) as HttpNodeData;
    expect(out.initialVariables).toEqual({ vin: 'ABC' });
  });

  it('preserves initialVariables when patch only updates scenario (HttpConfig partial patch)', () => {
    const base: HttpNodeData = {
      label: 'L',
      scenario: {
        id: '1',
        name: 'n',
        url: 'https://x/?vin={{vin}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      initialVariables: { vin: 'REALVIN' },
    };
    const patch: Partial<HttpNodeData> = {
      scenario: { ...base.scenario, url: 'https://y/other?vin={{vin}}' },
    };
    const out = mergeWorkflowNodeData(base, patch) as HttpNodeData;
    expect(out.initialVariables).toEqual({ vin: 'REALVIN' });
    expect(out.scenario.url).toContain('https://y/other');
  });

  it('allows clearing with initialVariables: {}', () => {
    const base: HttpNodeData = {
      label: 'S',
      scenario: {
        id: '1',
        name: 'n',
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      initialVariables: { vin: 'x' },
    };
    const out = mergeWorkflowNodeData(base, { initialVariables: {} }) as HttpNodeData;
    expect(out.initialVariables).toEqual({});
  });

  it('does not wipe label when patch spreads label: undefined', () => {
    const base: HttpNodeData = {
      label: 'Keep',
      scenario: {
        id: '1',
        name: 'n',
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
    };
    const patch = { ...base, label: undefined as unknown as string };
    const out = mergeWorkflowNodeData(base, patch) as HttpNodeData;
    expect(out.label).toBe('Keep');
  });

  it('still clears host fields when patch sets host keys to undefined', () => {
    const base: HttpNodeData = {
      label: 'S',
      scenario: {
        id: '1',
        name: 'n',
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      hostEnvironmentId: 'env1',
      hostMicroserviceId: 'svc1',
    };
    const out = mergeWorkflowNodeData(base, {
      hostEnvironmentId: undefined,
      hostMicroserviceId: undefined,
      hostBaseUrl: undefined,
    }) as HttpNodeData;
    expect(out.hostEnvironmentId).toBeUndefined();
    expect(out.hostMicroserviceId).toBeUndefined();
    expect(out.hostBaseUrl).toBeUndefined();
  });

  it('stripEphemeralNodeDataFields removes runStatus from HTTP node data', () => {
    const data = {
      label: 'S',
      scenario: {
        id: '1',
        name: 'n',
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      initialVariables: { vin: 'X' },
      runStatus: { state: 'fail' as const, error: 'bad' },
    } as HttpNodeData & { runStatus: { state: 'fail'; error: string } };
    const out = stripEphemeralNodeDataFields(data) as HttpNodeData;
    expect('runStatus' in out).toBe(false);
    expect(out.initialVariables).toEqual({ vin: 'X' });
  });

  it('cloneWorkflowNodeDataForStorage preserves initialVariables for JSON persistence', () => {
    const data: HttpNodeData = {
      label: 'H',
      scenario: {
        id: '1',
        name: 'n',
        url: 'https://x/?vin={{vin}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      initialVariables: { vin: '1GN1RK114R1079748' },
    };
    const cloned = cloneWorkflowNodeDataForStorage(data) as HttpNodeData;
    const roundTrip = JSON.parse(JSON.stringify(cloned)) as HttpNodeData;
    expect(roundTrip.initialVariables).toEqual({ vin: '1GN1RK114R1079748' });
  });

  it('cloneWorkflowNodeDataForStorage returns cleaned data when JSON round-trip throws', () => {
    const data: HttpNodeData = {
      label: 'H',
      scenario: {
        id: '1',
        name: 'n',
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      },
      initialVariables: { vin: 'X' },
      runStatus: { state: 'pass' as const },
    } as HttpNodeData & { runStatus: { state: 'pass' } };
    const stringify = JSON.stringify;
    JSON.stringify = () => {
      throw new Error('circular');
    };
    try {
      const cloned = cloneWorkflowNodeDataForStorage(data) as HttpNodeData;
      expect('runStatus' in cloned).toBe(false);
      expect(cloned.initialVariables).toEqual({ vin: 'X' });
    } finally {
      JSON.stringify = stringify;
    }
  });
});
