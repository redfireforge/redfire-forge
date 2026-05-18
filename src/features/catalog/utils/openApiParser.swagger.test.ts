import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec } from './openApiParser';

const SWAGGER_2_MINIMAL = `
swagger: "2.0"
info:
  title: Legacy Pet API
  version: "1.0.0"
  description: Swagger 2.0 pet API
host: api.old.example.com
basePath: /v1
schemes:
  - https
  - http
paths:
  /pets:
    get:
      operationId: listPets
      summary: List pets
      tags: [pets]
      produces:
        - application/json
      parameters:
        - name: limit
          in: query
          type: integer
          required: false
      responses:
        "200":
          description: A list of pets
          schema:
            type: array
            items:
              type: object
    post:
      operationId: createPet
      summary: Create a pet
      tags: [pets]
      consumes:
        - application/json
      parameters:
        - name: body
          in: body
          required: true
          schema:
            type: object
            properties:
              name:
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
          type: string
          required: true
      responses:
        "200":
          description: A pet
securityDefinitions:
  apiKey:
    type: apiKey
    name: X-API-Key
    in: header
tags:
  - name: pets
    description: Pet operations
`;

describe('parseOpenApiSpec', () => {
  describe('Swagger 2.0', () => {
    it('parses a valid Swagger 2.0 spec', async () => {
      const result = await parseOpenApiSpec(SWAGGER_2_MINIMAL);

      expect(result.entry.name).toBe('Legacy Pet API');
      expect(result.entry.description).toBe('Swagger 2.0 pet API');
      expect(result.entry.versions[0].version).toBe('1.0.0');
    });

    it('converts host/basePath/schemes to servers', async () => {
      const result = await parseOpenApiSpec(SWAGGER_2_MINIMAL);
      expect(result.entry.servers).toHaveLength(2);
      expect(result.entry.servers[0].url).toBe('https://api.old.example.com/v1');
      expect(result.entry.servers[1].url).toBe('http://api.old.example.com/v1');
    });

    it('converts securityDefinitions to securitySchemes', async () => {
      const result = await parseOpenApiSpec(SWAGGER_2_MINIMAL);
      expect(result.entry.securitySchemes.apiKey).toBeDefined();
      expect(result.entry.securitySchemes.apiKey.type).toBe('apiKey');
      expect(result.entry.securitySchemes.apiKey.name).toBe('X-API-Key');
      expect(result.entry.securitySchemes.apiKey.in).toBe('header');
    });

    it('extracts Swagger 2.0 body parameters as requestBody', async () => {
      const result = await parseOpenApiSpec(SWAGGER_2_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const createPet = petsFolder.endpoints.find(e => e.operationId === 'createPet')!;

      expect(createPet.requestBody).toBeDefined();
      expect(createPet.requestBody!.required).toBe(true);
      expect(createPet.requestBody!.contentTypes[0].mediaType).toBe('application/json');
    });

    it('converts inline query params (no schema field)', async () => {
      const result = await parseOpenApiSpec(SWAGGER_2_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const listPets = petsFolder.endpoints.find(e => e.operationId === 'listPets')!;

      expect(listPets.parameters).toHaveLength(1);
      expect(listPets.parameters[0].name).toBe('limit');
      expect(listPets.parameters[0].schema.type).toBe('integer');
    });

    it('extracts Swagger 2.0 response schema', async () => {
      const result = await parseOpenApiSpec(SWAGGER_2_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const listPets = petsFolder.endpoints.find(e => e.operationId === 'listPets')!;

      expect(listPets.responses[0].schema).toBeDefined();
      expect(listPets.responses[0].schema!.type).toBe('array');
    });

    it('handles formData parameters', async () => {
      const spec = `
swagger: "2.0"
info:
  title: Form Test
  version: "1.0.0"
paths:
  /upload:
    post:
      summary: Upload file
      consumes:
        - multipart/form-data
      parameters:
        - name: file
          in: formData
          type: file
          required: true
        - name: description
          in: formData
          type: string
      responses:
        "200":
          description: OK
`;
      const result = await parseOpenApiSpec(spec);
      const upload = result.entry.endpoints[0];
      expect(upload.requestBody).toBeDefined();
      expect(upload.requestBody!.contentTypes[0].mediaType).toBe('multipart/form-data');
      expect(upload.requestBody!.contentTypes[0].schema.properties).toHaveProperty('file');
      expect(upload.requestBody!.contentTypes[0].schema.properties).toHaveProperty('description');
    });

    it('handles Swagger 2.0 basic auth', async () => {
      const spec = `
swagger: "2.0"
info:
  title: Auth Test
  version: "1.0.0"
paths: {}
securityDefinitions:
  basicAuth:
    type: basic
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.securitySchemes.basicAuth).toBeDefined();
      expect(result.entry.securitySchemes.basicAuth.type).toBe('http');
      expect(result.entry.securitySchemes.basicAuth.scheme).toBe('basic');
    });
  });
  describe('Swagger 2 edge cases', () => {
    const SWAGGER2_SPEC = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Swagger2 API', version: '1.0.0' },
      host: 'api.example.com',
      basePath: '/v1',
      schemes: ['https'],
      securityDefinitions: {
        apiKey: { type: 'apiKey', name: 'X-API-Key', in: 'header' },
        oauth: { type: 'oauth2', flow: 'implicit', authorizationUrl: 'https://auth.example.com' },
        basic: { type: 'basic' },
        openId: { type: 'openIdConnect' },
      },
      paths: {
        '/items': {
          get: {
            operationId: 'getItems',
            tags: ['items'],
            parameters: [
              { name: 'limit', in: 'query', type: 'integer', description: 'Max items' },
            ],
            responses: {
              '200': {
                description: 'OK',
                schema: { type: 'array' },
                examples: { 'application/json': [{ id: 1 }] },
              },
            },
          },
          post: {
            operationId: 'createItem',
            tags: ['items'],
            consumes: ['application/json'],
            parameters: [
              { name: 'body', in: 'body', required: true, schema: { type: 'object' }, description: 'Item body' },
            ],
            responses: {
              '201': { description: 'Created' },
            },
          },
          put: {
            operationId: 'updateItem',
            tags: ['items'],
            parameters: [
              { name: 'file', in: 'formData', type: 'file', required: true },
              { name: 'name', in: 'formData', type: 'string' },
            ],
            responses: {
              '200': { description: 'OK' },
            },
          },
          delete: {
            tags: ['items'],
            responses: {
              '204': { description: 'Deleted' },
            },
          },
        },
      },
    });

    it('parses Swagger 2.0 spec with securityDefinitions', async () => {
      const result = await parseOpenApiSpec(SWAGGER2_SPEC);
      expect(result.entry.securitySchemes.apiKey.type).toBe('apiKey');
      expect(result.entry.securitySchemes.apiKey.in).toBe('header');
      expect(result.entry.securitySchemes.oauth.type).toBe('oauth2');
      expect(result.entry.securitySchemes.basic.type).toBe('http');
      expect(result.entry.securitySchemes.basic.scheme).toBe('basic');
      expect(result.entry.securitySchemes.openId.type).toBe('openIdConnect');
    });

    it('parses body parameter in Swagger 2', async () => {
      const result = await parseOpenApiSpec(SWAGGER2_SPEC);
      const folder = result.entry.folders.find(f => f.name === 'items')!;
      const post = folder.endpoints.find(e => e.method === 'POST')!;
      expect(post.requestBody).toBeDefined();
      expect(post.requestBody!.required).toBe(true);
      expect(post.requestBody!.description).toBe('Item body');
    });

    it('parses formData parameters with file type', async () => {
      const result = await parseOpenApiSpec(SWAGGER2_SPEC);
      const folder = result.entry.folders.find(f => f.name === 'items')!;
      const put = folder.endpoints.find(e => e.method === 'PUT')!;
      expect(put.requestBody).toBeDefined();
      expect(put.requestBody!.contentTypes[0].mediaType).toBe('multipart/form-data');
    });

    it('generates operationId warning for endpoints without one', async () => {
      const result = await parseOpenApiSpec(SWAGGER2_SPEC);
      expect(result.warnings.some(w => w.includes('has no operationId'))).toBe(true);
    });

    it('extracts Swagger 2 response with schema and examples', async () => {
      const result = await parseOpenApiSpec(SWAGGER2_SPEC);
      const folder = result.entry.folders.find(f => f.name === 'items')!;
      const get = folder.endpoints.find(e => e.method === 'GET')!;
      const res200 = get.responses.find(r => r.statusCode === '200')!;
      expect(res200.schema).toBeDefined();
      expect(res200.example).toBeDefined();
    });

    it('uses server from host/basePath/schemes', async () => {
      const result = await parseOpenApiSpec(SWAGGER2_SPEC);
      expect(result.entry.servers[0].url).toBe('https://api.example.com/v1');
    });
  });
});
