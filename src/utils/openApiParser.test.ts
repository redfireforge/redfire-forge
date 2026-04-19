import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec, countEndpoints, getSpecFormatLabel } from './openApiParser';

// ─── Minimal valid specs ─────────────────────────────────

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

const OPENAPI_3_JSON = JSON.stringify({
  openapi: '3.1.0',
  info: { title: 'JSON API', version: '2.0.0' },
  paths: {
    '/health': {
      get: {
        operationId: 'healthCheck',
        summary: 'Health check',
        responses: { '200': { description: 'OK' } },
      },
    },
  },
});

describe('parseOpenApiSpec', () => {
  // ─── OpenAPI 3.x ─────────────────────────────────────

  describe('OpenAPI 3.x', () => {
    it('parses a valid OpenAPI 3.0 YAML spec', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);

      expect(result.entry.name).toBe('Pet Store');
      expect(result.entry.description).toBe('A sample API for pets');
      expect(result.entry.versions).toHaveLength(1);
      expect(result.entry.versions[0].version).toBe('1.0.0');
      expect(result.entry.versions[0].specSize).toBeGreaterThan(0);
      expect(result.entry.versions[0].specHash).toBeTruthy();
    });

    it('extracts servers correctly', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(result.entry.servers).toHaveLength(2);
      expect(result.entry.servers[0].url).toBe('https://api.example.com/v1');
      expect(result.entry.servers[0].description).toBe('Production');
    });

    it('extracts security schemes', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(result.entry.securitySchemes.bearerAuth).toBeDefined();
      expect(result.entry.securitySchemes.bearerAuth.type).toBe('http');
      expect(result.entry.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    it('groups endpoints into tag folders', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(result.entry.folders).toHaveLength(2);

      const petsFolder = result.entry.folders.find(f => f.name === 'pets');
      expect(petsFolder).toBeDefined();
      expect(petsFolder!.endpoints).toHaveLength(3);
      expect(petsFolder!.description).toBe('Pet operations');

      const adminFolder = result.entry.folders.find(f => f.name === 'admin');
      expect(adminFolder).toBeDefined();
      expect(adminFolder!.endpoints).toHaveLength(1);
    });

    it('extracts parameters', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const listPets = petsFolder.endpoints.find(e => e.operationId === 'listPets')!;

      expect(listPets.parameters).toHaveLength(1);
      expect(listPets.parameters[0].name).toBe('limit');
      expect(listPets.parameters[0].in).toBe('query');
      expect(listPets.parameters[0].required).toBe(false);
    });

    it('extracts request body', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const createPet = petsFolder.endpoints.find(e => e.operationId === 'createPet')!;

      expect(createPet.requestBody).toBeDefined();
      expect(createPet.requestBody!.required).toBe(true);
      expect(createPet.requestBody!.contentTypes).toHaveLength(1);
      expect(createPet.requestBody!.contentTypes[0].mediaType).toBe('application/json');
      expect(createPet.requestBody!.contentTypes[0].schema.properties).toHaveProperty('name');
    });

    it('extracts responses', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const listPets = petsFolder.endpoints.find(e => e.operationId === 'listPets')!;

      expect(listPets.responses).toHaveLength(1);
      expect(listPets.responses[0].statusCode).toBe('200');
      expect(listPets.responses[0].description).toBe('A list of pets');
    });

    it('picks first non-json media type when application/json is absent', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: Media Test
  version: "1.0.0"
paths:
  /doc:
    get:
      operationId: getDoc
      summary: Doc
      responses:
        "200":
          description: Plain text body
          content:
            text/plain:
              schema:
                type: string
              example: hello
`;
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      const res = ep.responses.find(r => r.statusCode === '200')!;
      expect(res.schema).toEqual({ type: 'string' });
      expect(res.example).toBe('hello');
    });

    it('uses top-level schema on response when content is missing', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: Schema Test
  version: "1.0.0"
paths:
  /legacy:
    get:
      operationId: legacy
      summary: Legacy
      responses:
        "200":
          description: OK
          schema:
            type: object
            properties:
              id:
                type: string
          example:
            id: "x"
`;
      const result = await parseOpenApiSpec(spec);
      const res = result.entry.endpoints[0].responses[0];
      expect(res.schema?.properties).toHaveProperty('id');
      expect(res.example).toEqual({ id: 'x' });
    });

    it('omits schema when json media exists but schema is not an object', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'S', version: '1.0.0' },
        paths: {
          '/x': {
            get: {
              operationId: 'x',
              summary: 'X',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: 'not-an-object',
                      example: 1,
                    },
                  },
                },
              },
            },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const res = result.entry.endpoints[0].responses[0];
      expect(res.schema).toBeUndefined();
      expect(res.example).toBe(1);
    });

    it('parses JSON input', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_JSON);
      expect(result.entry.name).toBe('JSON API');
      expect(result.entry.versions[0].version).toBe('2.0.0');
    });

    it('handles path-level parameters', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: Path Params Test
  version: "1.0.0"
paths:
  /items/{itemId}:
    parameters:
      - name: itemId
        in: path
        required: true
        schema:
          type: string
    get:
      summary: Get item
      responses:
        "200":
          description: OK
    put:
      summary: Update item
      parameters:
        - name: version
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: OK
`;
      const result = await parseOpenApiSpec(spec);
      const getItem = result.entry.endpoints.find(e => e.method === 'GET')!;
      expect(getItem.parameters).toHaveLength(1);
      expect(getItem.parameters[0].name).toBe('itemId');

      const putItem = result.entry.endpoints.find(e => e.method === 'PUT')!;
      expect(putItem.parameters).toHaveLength(2);
      expect(putItem.parameters.map(p => p.name).sort()).toEqual(['itemId', 'version']);
    });

    it('handles missing operationId with warning', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: Test
  version: "1.0.0"
paths:
  /test:
    get:
      summary: Test endpoint
      responses:
        "200":
          description: OK
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.warnings.some(w => w.includes('no operationId'))).toBe(true);
    });

    it('extracts operation-level security scheme names', async () => {
      const spec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Sec API', version: '1.0.0' },
        paths: {
          '/admin': {
            get: {
              operationId: 'adminPing',
              summary: 'Ping',
              security: [{ bearerAuth: [] }, null, { oauth2: ['read'] }],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer' },
            oauth2: { type: 'oauth2', flows: {} },
          },
        },
      });
      const result = await parseOpenApiSpec(spec);
      const ep = result.entry.endpoints[0];
      expect(ep?.security?.sort()).toEqual(['bearerAuth', 'oauth2']);
    });

    it('parses specs that contain unresolvable $ref under extension keys (resolveRefs keeps stub)', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: Ext Ref
  version: "1.0.0"
paths: {}
x-meta:
  item:
    $ref: "#/this/does/not/exist"
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.name).toBe('Ext Ref');
    });

    it('returns undefined security when operation security is empty or non-array', async () => {
      const emptySec = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'E', version: '1.0.0' },
        paths: {
          '/a': {
            get: {
              operationId: 'a',
              summary: 'A',
              security: [],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const r1 = await parseOpenApiSpec(emptySec);
      const ep1 = r1.entry.endpoints[0];
      expect(ep1.security).toBeUndefined();

      const badType = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'E', version: '1.0.0' },
        paths: {
          '/b': {
            get: {
              operationId: 'b',
              summary: 'B',
              security: 'not-an-array',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      });
      const r2 = await parseOpenApiSpec(badType);
      const ep2 = r2.entry.endpoints[0];
      expect(ep2.security).toBeUndefined();
    });

    it('handles missing title with warning', async () => {
      const spec = `
openapi: "3.0.0"
info:
  version: "1.0.0"
paths: {}
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.name).toBe('Untitled API');
      expect(result.warnings.some(w => w.includes('Missing info.title'))).toBe(true);
    });

    it('marks deprecated endpoints', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: Test
  version: "1.0.0"
paths:
  /old:
    get:
      deprecated: true
      summary: Old endpoint
      responses:
        "200":
          description: OK
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.endpoints[0].deprecated).toBe(true);
    });
  });

  // ─── Swagger 2.0 ────────────────────────────────────

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

  // ─── Error Handling ──────────────────────────────────

  describe('Error handling', () => {
    it('rejects invalid YAML/JSON', async () => {
      await expect(parseOpenApiSpec('{{not valid')).rejects.toThrow('Invalid file');
    });

    it('rejects non-object content', async () => {
      await expect(parseOpenApiSpec('"just a string"')).rejects.toThrow('Invalid file');
    });

    it('rejects spec without swagger/openapi field', async () => {
      await expect(parseOpenApiSpec('{ "info": { "title": "test" } }')).rejects.toThrow('Unsupported spec format');
    });

    it('rejects unknown version', async () => {
      await expect(parseOpenApiSpec('{ "openapi": "4.0.0" }')).rejects.toThrow('Unsupported spec format');
    });
  });

  // ─── Utilities ───────────────────────────────────────

  describe('countEndpoints', () => {
    it('counts endpoints in folders and root', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(countEndpoints(result.entry)).toBe(4);
    });
  });

  describe('getSpecFormatLabel', () => {
    it('detects OpenAPI 3.x', () => {
      expect(getSpecFormatLabel(OPENAPI_3_MINIMAL)).toBe('OpenAPI 3.0.3');
    });

    it('detects Swagger 2.0', () => {
      expect(getSpecFormatLabel(SWAGGER_2_MINIMAL)).toBe('Swagger 2.0');
    });

    it('detects OpenAPI 3.1', () => {
      expect(getSpecFormatLabel(OPENAPI_3_JSON)).toBe('OpenAPI 3.1.0');
    });

    it('returns Unknown for invalid input', () => {
      expect(getSpecFormatLabel('garbage')).toBe('Unknown');
    });
  });

  // ─── Hash determinism ────────────────────────────────

  describe('spec hash', () => {
    it('produces same hash for identical content', async () => {
      const r1 = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      const r2 = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(r1.entry.versions[0].specHash).toBe(r2.entry.versions[0].specHash);
    });

    it('produces different hash for different content', async () => {
      const r1 = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      const r2 = await parseOpenApiSpec(SWAGGER_2_MINIMAL);
      expect(r1.entry.versions[0].specHash).not.toBe(r2.entry.versions[0].specHash);
    });

    it('falls back to non-crypto string hash when subtle is unavailable', async () => {
      const prevCrypto = globalThis.crypto;
      Object.defineProperty(globalThis, 'crypto', {
        value: { subtle: undefined as SubtleCrypto | undefined },
        configurable: true,
      });
      try {
        const r = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
        expect(r.entry.versions[0].specHash).toMatch(/^[0-9a-f]{8,}$/);
      } finally {
        Object.defineProperty(globalThis, 'crypto', { value: prevCrypto, configurable: true });
      }
    });
  });

  // ─── Host & auth config defaults ─────────────────────

  describe('default configs', () => {
    it('sets inherited host config when servers exist', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(result.entry.hostConfig.strategy).toBe('inherited');
      expect(result.entry.hostConfig.selectedServerIndex).toBe(0);
    });

    it('sets hardcoded host config when no servers', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: No Servers
  version: "1.0.0"
paths: {}
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.hostConfig.strategy).toBe('hardcoded');
    });

    it('sets inherited auth config when security schemes exist', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(result.entry.authConfig.strategy).toBe('inherited');
      expect(result.entry.authConfig.inheritedSchemeId).toBe('bearerAuth');
    });

    it('sets hardcoded auth config when no security schemes', async () => {
      const spec = `
openapi: "3.0.0"
info:
  title: No Auth
  version: "1.0.0"
paths: {}
`;
      const result = await parseOpenApiSpec(spec);
      expect(result.entry.authConfig.strategy).toBe('hardcoded');
    });
  });

  // ─── Untagged endpoints ──────────────────────────────

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

  // ─── Multiple methods on same path ───────────────────

  describe('multiple methods', () => {
    it('creates separate endpoints for each HTTP method', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      const petsFolder = result.entry.folders.find(f => f.name === 'pets')!;
      const petsEndpoints = petsFolder.endpoints.filter(e => e.path === '/pets');
      expect(petsEndpoints).toHaveLength(2);
      expect(petsEndpoints.map(e => e.method).sort()).toEqual(['GET', 'POST']);
    });
  });

  // ─── $ref resolution ─────────────────────────────────

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
});
