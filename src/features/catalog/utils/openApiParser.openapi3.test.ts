import { describe, it, expect } from 'vitest';
import { parseOpenApiSpec } from './openApiParser';

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
});
