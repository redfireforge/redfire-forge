import { describe, expect, it } from 'vitest';
import { resolveQuickTestHostForRequest } from './workflowRequestHost';
import type { Environment, Microservice, RequestCollection, RequestItem } from '../../../shared/types';

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

  it('returns hostBaseUrl when absolute URL does not match any microservice', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'multi-env',
      microserviceId: 'ms-sales',
      requests: [],
      folders: [],
    };
    const req = {
      ...makeReq('r-custom'),
      url: 'https://custom-api.example.com/resource',
    };
    const r = resolveQuickTestHostForRequest(
      col,
      req,
      'e-t01',
      'https://sales.apps.test/',
      [msSales],
      [envT01],
    );
    expect(r.hostBaseUrl).toBe('https://custom-api.example.com');
  });

  it('returns empty when relative URL and no resolved base (no microserviceId)', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'url',
      requests: [makeReq('r1')],
      folders: [],
    };
    const r = resolveQuickTestHostForRequest(
      col,
      makeReq('r1'),
      'e-t01',
      'https://harness.example.com',
      [],
      [envT01],
    );
    expect(r).toEqual({});
  });

  it('falls back to microserviceId+envId when no resolved base and collection has microservice', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'multi-env',
      microserviceId: 'ms-sales',
      requests: [makeReq('r1')],
      folders: [],
    };
    const r = resolveQuickTestHostForRequest(
      col,
      makeReq('r1'),
      'e-t01',
      'https://unrelated.com',
      [msSales],
      [envT01],
    );
    expect(r.hostMicroserviceId).toBe('ms-sales');
    expect(r.hostEnvironmentId).toBe('e-t01');
  });

  it('uses absolute URL when collection has microserviceId but no resolved base for env', () => {
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
      url: 'https://ons-profile-read.apps.test/path',
    };
    // Use an envId that has no matching base URL in ms-sales
    const r = resolveQuickTestHostForRequest(
      col,
      req,
      'e-unknown',
      'https://no-match.com',
      [msSales, msOnstar],
      [envT01],
    );
    expect(r.hostMicroserviceId).toBe('ms-onstar');
    expect(r.hostEnvironmentId).toBe('e-t01');
  });

  it('matches subcollection by name when no selectedEnvId', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'multi-env',
      microserviceId: 'ms-sales',
      requests: [],
      folders: [
        {
          id: 'sub',
          name: 't01',
          isSubCollection: true,
          baseUrls: { 'e-t01': 'https://custom.apps.test/' },
          requests: [makeReq('r1')],
        },
      ],
    };
    const r = resolveQuickTestHostForRequest(
      col,
      makeReq('r1'),
      'e-t01',
      'https://harness.example.com',
      [msSales],
      [envT01],
    );
    expect(r.hostBaseUrl).toBe('https://custom.apps.test');
  });

  it('returns empty when absolute URL matches harness base', () => {
    const col: RequestCollection = {
      id: 'c1',
      name: 'C',
      mode: 'url',
      requests: [],
      folders: [],
    };
    const req = {
      ...makeReq('r1'),
      url: 'https://harness.example.com/api/resource',
    };
    const r = resolveQuickTestHostForRequest(
      col,
      req,
      'e-t01',
      'https://harness.example.com',
      [],
      [envT01],
    );
    expect(r).toEqual({});
  });
});

