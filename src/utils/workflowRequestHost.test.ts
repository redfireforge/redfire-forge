import { describe, expect, it } from 'vitest';
import { resolveQuickTestHostForRequest } from './workflowRequestHost';
import type { Environment, Microservice, RequestCollection, RequestItem } from '../types';

const envT01: Environment = { id: 'e-t01', name: 't01' };
const envP01: Environment = { id: 'e-p01', name: 'p01' };

const msSales: Microservice = {
  id: 'ms-sales',
  name: 'sales-product-autoassign',
  baseUrls: { 'e-t01': 'https://sales.apps.test/', 'e-p01': 'https://sales.prod/' },
};

const msOnstar: Microservice = {
  id: 'ms-onstar',
  name: 'onstar-profile-read',
  baseUrls: { 'e-t01': 'https://ons-profile-read.apps.test/', 'e-p01': 'https://ons.prod/' },
};

function makeReq(id: string): RequestItem {
  return {
    id,
    name: 'R',
    method: 'GET',
    url: '/path',
    headers: [],
    body: '',
    auth: { type: 'none' },
  };
}

describe('resolveQuickTestHostForRequest', () => {
  it('maps subcollection base to env + microservice when URLs match the catalog', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'multi-env',
      microserviceId: 'ms-sales',
      requests: [],
      folders: [
        {
          id: 'sub',
          name: 'onstar',
          isSubCollection: true,
          selectedEnvId: 'e-t01',
          baseUrls: { 'e-t01': 'https://ons-profile-read.apps.test/' },
          requests: [makeReq('r1')],
        },
      ],
    };
    const harnessBase = 'https://sales.apps.test';
    const r = resolveQuickTestHostForRequest(
      col,
      makeReq('r1'),
      'e-t01',
      harnessBase,
      [msSales, msOnstar],
      [envT01, envP01],
    );
    expect(r.hostMicroserviceId).toBe('ms-onstar');
    expect(r.hostEnvironmentId).toBe('e-t01');
    expect(r.hostBaseUrl).toBeUndefined();
  });

  it('stores hostBaseUrl when the resolved base does not match any microservice', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'multi-env',
      microserviceId: 'ms-sales',
      requests: [],
      folders: [
        {
          id: 'sub',
          name: 'legacy',
          isSubCollection: true,
          selectedEnvId: 'e-t01',
          baseUrls: { 'e-t01': 'https://custom-legacy.example.com/' },
          requests: [makeReq('r2')],
        },
      ],
    };
    const r = resolveQuickTestHostForRequest(
      col,
      makeReq('r2'),
      'e-t01',
      'https://sales.apps.test',
      [msSales],
      [envT01],
    );
    expect(r.hostBaseUrl).toBe('https://custom-legacy.example.com');
    expect(r.hostMicroserviceId).toBeUndefined();
  });

  it('returns empty patch when resolved base matches the harness', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'multi-env',
      microserviceId: 'ms-sales',
      requests: [makeReq('top')],
      folders: [],
    };
    const r = resolveQuickTestHostForRequest(
      col,
      makeReq('top'),
      'e-t01',
      'https://sales.apps.test/',
      [msSales],
      [envT01],
    );
    expect(r).toEqual({});
  });

  it('infers onstar from absolute request URL when collection base matches harness', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'multi-env',
      microserviceId: 'ms-sales',
      requests: [],
      folders: [],
    };
    const req = {
      ...makeReq('r-abs'),
      url: 'https://ons-profile-read.apps.test/orgs/1/vin/1GNS5U189T107587C',
    };
    const r = resolveQuickTestHostForRequest(
      col,
      req,
      'e-t01',
      'https://sales.apps.test/',
      [msSales, msOnstar],
      [envT01],
    );
    expect(r.hostMicroserviceId).toBe('ms-onstar');
    expect(r.hostEnvironmentId).toBe('e-t01');
  });
});
