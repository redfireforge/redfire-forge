import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec } from './openApiParser';

const OPENAPI_3_MINIMAL = `
openapi: "3.0.3"
info:
  title: Pet Store
  version: "1.0.0"
  description: A sample API for pets
paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      tags: [pets]
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: A list of pets
    post:
      operationId: createPet
      summary: Create a pet
      tags: [pets]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                tag:
                  type: string
      responses:
        "201":
          description: Created
  /pets/{petId}:
    get:
      operationId: getPetById
      summary: Get pet by ID
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: A single pet
    delete:
      summary: Delete a pet
      tags: [admin]
      responses:
        "204":
          description: Deleted
servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging.example.com/v1
    description: Staging
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
tags:
  - name: pets
    description: Pet operations
  - name: admin
    description: Admin operations
`;

describe('parseOpenApiSpec', () => {
  describe('$ref resolution', () => {
    const REF_SPEC = `
swagger: "2.0"
info:
  title: Ref Test API
  version: "1.0.0"
host: api.example.com
basePath: /v1
schemes: [https]
paths:
  /items/{itemId}:
    get:
      summary: Get item
      tags: [items]
      parameters:
        - $ref: '#/parameters/ItemId'
        - $ref: '#/parameters/Lang'
      responses:
        "200":
          $ref: '#/responses/OkItem'
        "400":
          $ref: '#/responses/BadReq'
        "404":
          description: Not found
parameters:
  ItemId:
    name: itemId
    in: path
    type: string
    required: true
    description: The item identifier
  Lang:
    name: Accept-Language
    in: header
    type: string
    required: false
    description: Preferred language
definitions:
  Item:
    type: object
    properties:
      id:
        type: string
        example: abc-123
      name:
        type: string
        example: Widget
  Error:
    type: object
    required: [code]
    properties:
      code:
        type: string
      message:
        type: string
responses:
  OkItem:
    description: Successful item response
    schema:
      $ref: '#/definitions/Item'
  BadReq:
    description: Bad request
    schema:
      $ref: '#/definitions/Error'
`;

    it('resolves $ref parameters', async () => {
      const result = await parseOpenApiSpec(REF_SPEC);
      const folder = result.entry.folders.find(f => f.name === 'items')!;
      const ep = folder.endpoints[0];

      expect(ep.parameters).toHaveLength(2);
      expect(ep.parameters[0].name).toBe('itemId');
      expect(ep.parameters[0].in).toBe('path');
      expect(ep.parameters[0].required).toBe(true);
      expect(ep.parameters[0].description).toBe('The item identifier');

      expect(ep.parameters[1].name).toBe('Accept-Language');
      expect(ep.parameters[1].in).toBe('header');
    });

    it('resolves $ref responses with descriptions', async () => {
      const result = await parseOpenApiSpec(REF_SPEC);
      const folder = result.entry.folders.find(f => f.name === 'items')!;
      const ep = folder.endpoints[0];

      expect(ep.responses).toHaveLength(3);

      const ok = ep.responses.find(r => r.statusCode === '200')!;
      expect(ok.description).toBe('Successful item response');
      expect(ok.schema).toBeDefined();
      expect(ok.schema!.properties).toHaveProperty('id');
      expect(ok.schema!.properties).toHaveProperty('name');

      const bad = ep.responses.find(r => r.statusCode === '400')!;
      expect(bad.description).toBe('Bad request');
      expect(bad.schema).toBeDefined();
      expect(bad.schema!.properties).toHaveProperty('code');

      const notFound = ep.responses.find(r => r.statusCode === '404')!;
      expect(notFound.description).toBe('Not found');
    });

    it('resolves nested $ref chains (response -> schema -> definition)', async () => {
      const result = await parseOpenApiSpec(REF_SPEC);
      const folder = result.entry.folders.find(f => f.name === 'items')!;
      const ep = folder.endpoints[0];

      const ok = ep.responses.find(r => r.statusCode === '200')!;
      expect(ok.schema!.properties!.id.example).toBe('abc-123');
      expect(ok.schema!.properties!.name.example).toBe('Widget');
    });
  });
  describe('untagged endpoints', () => {
    it('places untagged endpoints at root level', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: Mixed Tags
  version: "1.0.0"
paths:
  /tagged:
    get:
      tags: [alpha]
      summary: Tagged
      responses:
        "200":
          description: OK
  /untagged:
    get:
      summary: Untagged
      responses:
        "200":
          description: OK
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.folders).toHaveLength(1);
      expect(result.entry.folders[0].name).toBe('alpha');
      expect(result.entry.endpoints).toHaveLength(1);
      expect(result.entry.endpoints[0].path).toBe('/untagged');
    });
  });
  describe('multiple methods', () => {
    it('creates separate endpoints for each HTTP method', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const petsEndpoints = petsFolder.endpoints.filter(e => e.path === '/pets');
      expect(petsEndpoints).toHaveLength(2);
      expect(petsEndpoints.map(e => e.method).sort()).toEqual(['GET', 'POST']);
    });
  });
  describe('edge case specs', () => {
    it('handles spec with no info.title', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { version: '1.0.0' },
        paths: {},
      });
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.name).toBe('Untitled API');
      expect(result.warnings).toContain('Missing info.title — using "Untitled API"');
    });

    it('handles spec with no paths', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Empty', version: '1.0.0' },
      });
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.folders).toHaveLength(0);
      expect(result.entry.endpoints).toHaveLength(0);
    });

    it('handles null/non-object path items', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/a': null, '/b': 'invalid' },
      });
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.endpoints).toHaveLength(0);
    });

    it('handles untagged endpoints', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'testGet',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.endpoints.length).toBeGreaterThan(0);
    });

    it('handles oauth2 and openIdConnect security schemes', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          securitySchemes: {
            oauth: { type: 'oauth2', description: 'OAuth2 flow' },
            oidc: { type: 'openIdConnect', description: 'OpenID Connect' },
            apikey: { type: 'apiKey', name: 'X-API-Key', in: 'cookie' },
            unknown: { type: 'unknownType' },
            nullDef: null,
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.securitySchemes.oauth.type).toBe('oauth2');
      expect(result.entry.securitySchemes.oidc.type).toBe('openIdConnect');
      expect(result.entry.securitySchemes.apikey.type).toBe('apiKey');
      expect(result.entry.securitySchemes.apikey.in).toBe('cookie');
      expect(result.entry.securitySchemes.unknown.type).toBe('http');
    });

    it('handles parameter with cookie in, no schema, and type fallback', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              parameters: [
                { name: 'sid', in: 'cookie', type: 'integer' },
                { name: 'other', in: 'unknown_location' },
                { name: 'noschema', in: 'query' },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      const sid = ep.parameters.find(p => p.name === 'sid')!;
      expect(sid.in).toBe('cookie');
      expect(sid.schema).toEqual({ type: 'integer' });
      const other = ep.parameters.find(p => p.name === 'other')!;
      expect(other.in).toBe('query'); // fallback
      const noschema = ep.parameters.find(p => p.name === 'noschema')!;
      expect(noschema.schema).toEqual({ type: 'string' }); // default type fallback
    });

    it('handles swagger2 formData without file type', async () => {
      const spec = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        host: 'example.com',
        paths: {
          '/upload': {
            post: {
              operationId: 'uploadNoFile',
              parameters: [
                { name: 'field1', in: 'formData', type: 'string', required: true },
                { name: 'field2', in: 'formData' },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      expect(ep.requestBody).toBeDefined();
      expect(ep.requestBody!.contentTypes[0].mediaType).toBe('application/x-www-form-urlencoded');
      expect(ep.requestBody!.required).toBe(true);
    });

    it('handles response with non-json content type and schema fallbacks', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              responses: {
                '200': {
                  description: 'XML response',
                  content: {
                    'application/xml': { schema: { type: 'string' }, example: '<xml/>' },
                  },
                },
                '204': { description: 'No content' },
                '500': null,
              },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      const r200 = ep.responses.find(r => r.statusCode === '200')!;
      expect(r200.schema).toEqual({ type: 'string' });
      expect(r200.example).toBe('<xml/>');
    });

    it('handles swagger2 response with examples key', async () => {
      const spec = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        host: 'example.com',
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              responses: {
                '200': {
                  description: 'OK',
                  schema: { type: 'object' },
                  examples: { 'application/json': { id: 1 } },
                },
              },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      const r200 = ep.responses.find(r => r.statusCode === '200')!;
      expect(r200.example).toEqual({ id: 1 });
    });

    it('handles $ref that does not start with #/', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              parameters: [{ $ref: 'external.json#/Param' }],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.endpoints.length).toBe(1);
    });

    it('handles requestBody content with null entry', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            post: {
              operationId: 'postTest',
              requestBody: {
                required: true,
                description: 'body desc',
                content: {
                  'application/json': null,
                  'text/plain': { schema: { type: 'string' } },
                },
              },
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      expect(ep.requestBody).toBeDefined();
      expect(ep.requestBody!.contentTypes.length).toBe(1);
      expect(ep.requestBody!.contentTypes[0].mediaType).toBe('text/plain');
    });

    it('handles swagger2 body param without schema object', async () => {
      const spec = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        host: 'example.com',
        paths: {
          '/test': {
            post: {
              operationId: 'postTest',
              parameters: [{ name: 'body', in: 'body', required: true }],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      expect(ep.requestBody).toBeDefined();
      expect(ep.requestBody!.contentTypes[0].schema).toEqual({});
    });

    it('handles operation-level security', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              security: [{ bearerAuth: [] }, { apiKey: [] }],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      expect(ep.security).toEqual(['bearerAuth', 'apiKey']);
    });

    it('handles response content with no schema', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'getTest',
              responses: {
                '200': {
                  description: 'OK',
                  content: { 'application/json': { example: { a: 1 } } },
                },
              },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const r200 = result.entry.endpoints[0].responses[0];
      expect(r200.schema).toBeUndefined();
      expect(r200.example).toEqual({ a: 1 });
    });

    it('handles tag descriptions in spec.tags', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        tags: [
          { name: 'users', description: 'User operations' },
          { name: 'noDesc' },
        ],
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              tags: ['users'],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const folder = result.entry.folders.find(f => f.name === 'users')!;
      expect(folder.description).toBe('User operations');
    });

    it('handles requestBody with empty content object', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/test': {
            post: {
              operationId: 'postTest',
              requestBody: { content: {} },
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.endpoints[0].requestBody).toBeUndefined();
    });
  });
});
