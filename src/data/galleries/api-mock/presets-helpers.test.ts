import { describe, expect, it } from 'vitest';
import {
  TS,
  emptyGroup,
  jsonBody,
  jsonHeader,
  storeRoute,
  xmlBody,
  xmlHeader,
} from './presets-helpers';

describe('api-mock gallery preset helpers', () => {
  it('builds JSON and XML bodies and headers', () => {
    expect(jsonBody('{"ok":true}')).toEqual({
      kind: 'json',
      content: '{"ok":true}',
      contentType: 'application/json',
    });
    expect(xmlBody('<ok/>')).toEqual({
      kind: 'xml',
      content: '<ok/>',
      contentType: 'application/xml',
    });
    expect(jsonHeader('h1')).toEqual({
      id: 'h1', key: 'Content-Type', value: 'application/json', enabled: true,
    });
    expect(xmlHeader('h2')).toEqual({
      id: 'h2', key: 'Content-Type', value: 'application/xml', enabled: true,
    });
  });

  it('clones an empty predicate group with a new id', () => {
    const group = emptyGroup('pg-x');
    expect(group.id).toBe('pg-x');
    expect(group.combinator).toBe('all');
  });

  it('storeRoute defaults folder, enabled, predicates, JSON body, and status 200', () => {
    const route = storeRoute({
      id: 'route-plain',
      name: 'Plain',
      method: 'GET',
      path: { kind: 'exact', value: '/plain' },
      priority: 10,
      tags: ['t'],
      body: '{"ok":true}',
    });
    expect(route.folderId).toBeUndefined();
    expect(route.enabled).toBe(true);
    expect(route.operationId).toBeUndefined();
    expect(route.predicates.id).toBe('pg-route-plain');
    expect(route.responses[0]?.status).toBe(200);
    expect(route.responses[0]?.headers[0]?.value).toBe('application/json');
    expect(route.responses[0]?.body.kind).toBe('json');
    expect(route.createdAt).toBe(TS);
  });

  it('storeRoute keeps folder, draft, custom predicates, XML body, status, and operationId', () => {
    const predicates = emptyGroup('pg-custom');
    const route = storeRoute({
      id: 'route-soap',
      folderId: 'folder-orders',
      name: 'SOAP',
      method: 'POST',
      path: { kind: 'exact', value: '/soap' },
      priority: 20,
      tags: ['xml'],
      body: '<Ack/>',
      bodyKind: 'xml',
      status: 201,
      enabled: false,
      operationId: 'submitSoap',
      predicates,
    });
    expect(route.folderId).toBe('folder-orders');
    expect(route.enabled).toBe(false);
    expect(route.operationId).toBe('submitSoap');
    expect(route.predicates).toBe(predicates);
    expect(route.responses[0]?.status).toBe(201);
    expect(route.responses[0]?.headers[0]?.value).toBe('application/xml');
    expect(route.responses[0]?.body.kind).toBe('xml');
  });
});
