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
  describe('countEndpoints', () => {
    it('counts endpoints in folders and root', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(countEndpoints(result.entry)).toBe(4);
    });
  });
  describe('specFormat on parsed version', () => {
    it('stores "OpenAPI 3.0.3" for an OpenAPI 3 spec', async () => {
      const result = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
      expect(result.entry.versions[0].specFormat).toBe('OpenAPI 3.0.3');
    });

    it('stores "Swagger 2.0" for a Swagger 2 spec', async () => {
      const result = await parseOpenApiSpec(SWAGGER_2_MINIMAL);
      expect(result.entry.versions[0].specFormat).toBe('Swagger 2.0');
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
      const prevSubtle = globalThis.crypto.subtle;
      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      try {
        const r = await parseOpenApiSpec(OPENAPI_3_MINIMAL);
        expect(r.entry.versions[0].specHash).toMatch(/^[0-9a-f]{8,}$/);
      } finally {
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: prevSubtle,
          configurable: true,
          writable: true,
        });
      }
    });
  });
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
});
