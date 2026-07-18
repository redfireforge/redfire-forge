import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import {
  convertSwaggerToOpenApiYaml,
  upgradeOpenApi3Yaml,
  isSwagger2RawSpec,
  detectSpecFormat,
  availableTargets,
  validateOpenApi3,
  normalizeConvertedOpenApi3,
  ENGINE_TARGETS,
} from './swaggerToOpenApi';

// ─── Fixtures ────────────────────────────────────────────

/** Minimal valid Swagger 2.0 with a shared `in: body` parameter ref — the exact
 *  pattern that trips @scalar/openapi-upgrader (leftover schemes + requestBody
 *  $ref stuck in parameters[]). See plan §4.5. */
const SWAGGER2_YAML = `swagger: '2.0'
info:
  title: Sample API
  version: 1.0.4
basePath: /v1
schemes:
  - https
consumes:
  - application/json
produces:
  - application/json
securityDefinitions:
  Bearer:
    type: apiKey
    name: Authorization
    in: header
security:
  - Bearer: []
paths:
  /things/{id}:
    get:
      operationId: getThing
      parameters:
        - $ref: '#/parameters/IdParam'
      responses:
        '200':
          description: ok
          schema:
            $ref: '#/definitions/Thing'
  /save:
    post:
      operationId: saveThing
      parameters:
        - $ref: '#/parameters/ThingBody'
      responses:
        '201':
          description: created
parameters:
  IdParam:
    name: id
    in: path
    required: true
    type: string
  ThingBody:
    name: thing
    in: body
    required: true
    schema:
      $ref: '#/definitions/Thing'
definitions:
  Thing:
    type: object
    required:
      - name
    properties:
      id:
        type: string
      name:
        type: string
`;

const SWAGGER2_JSON = JSON.stringify({
  swagger: '2.0',
  info: { title: 'Sample', version: '1.0.0' },
  paths: {},
});

const OPENAPI3_YAML = `openapi: 3.0.4
info:
  title: Already OA3
  version: 1.0.0
paths: {}
`;

// ─── isSwagger2RawSpec ───────────────────────────────────

describe('isSwagger2RawSpec', () => {
  it('returns true for Swagger 2.0 YAML', () => {
    expect(isSwagger2RawSpec(SWAGGER2_YAML)).toBe(true);
  });

  it('returns true for Swagger 2.0 JSON', () => {
    expect(isSwagger2RawSpec(SWAGGER2_JSON)).toBe(true);
  });

  it('returns false for OpenAPI 3 YAML', () => {
    expect(isSwagger2RawSpec(OPENAPI3_YAML)).toBe(false);
  });

  it('returns false for garbage / non-object', () => {
    expect(isSwagger2RawSpec('%%% not valid %%%: : :')).toBe(false);
    expect(isSwagger2RawSpec('"just a string"')).toBe(false);
    expect(isSwagger2RawSpec('')).toBe(false);
  });
});

// ─── ENGINE_TARGETS ──────────────────────────────────────

describe('ENGINE_TARGETS', () => {
  it('swagger2openapi supports only 3.0', () => {
    expect(ENGINE_TARGETS.swagger2openapi).toEqual(['3.0']);
  });
  it('scalar supports 3.0 and 3.1', () => {
    expect(ENGINE_TARGETS.scalar).toEqual(['3.0', '3.1']);
  });
});

// ─── detectSpecFormat (P4-A) ─────────────────────────────

describe('detectSpecFormat', () => {
  it('detects Swagger 2.0 (YAML + JSON)', () => {
    expect(detectSpecFormat(SWAGGER2_YAML)).toBe('swagger2');
    expect(detectSpecFormat(SWAGGER2_JSON)).toBe('swagger2');
  });
  it('detects OpenAPI 3.0 / 3.1 / 3.2 by minor', () => {
    expect(detectSpecFormat('openapi: 3.0.4\ninfo: {title: t, version: 1}\npaths: {}')).toBe('oas30');
    expect(detectSpecFormat('openapi: 3.1.0\ninfo: {title: t, version: 1}\npaths: {}')).toBe('oas31');
    expect(detectSpecFormat('openapi: 3.2.0\ninfo: {title: t, version: 1}\npaths: {}')).toBe('oas32');
  });
  it('treats an unknown 3.x minor as 3.0-ish', () => {
    expect(detectSpecFormat('openapi: 3.9.0\ninfo: {title: t, version: 1}\npaths: {}')).toBe('oas30');
  });
  it('returns unknown for garbage / non-spec / arrays', () => {
    expect(detectSpecFormat('%%% not valid %%%: : :')).toBe('unknown');
    expect(detectSpecFormat('"just a string"')).toBe('unknown');
    expect(detectSpecFormat('- a\n- b')).toBe('unknown');
    expect(detectSpecFormat('{}')).toBe('unknown');
  });
});

// ─── availableTargets (P4-A) ─────────────────────────────

describe('availableTargets', () => {
  it('offers only forward upgrades per source format', () => {
    expect(availableTargets('swagger2')).toEqual(['3.0', '3.1']);
    expect(availableTargets('oas30')).toEqual(['3.1', '3.2']);
    expect(availableTargets('oas31')).toEqual(['3.2']);
  });
  it('offers nothing for the latest (3.2) or unknown', () => {
    expect(availableTargets('oas32')).toEqual([]);
    expect(availableTargets('unknown')).toEqual([]);
  });
});

// ─── validateOpenApi3 ────────────────────────────────────

describe('validateOpenApi3', () => {
  const validDoc = {
    openapi: '3.0.4',
    info: { title: 't', version: '1' },
    paths: {
      '/x': {
        get: { responses: { '200': { description: 'ok' } } },
      },
    },
    components: {},
  };

  it('returns [] for a valid document', () => {
    expect(validateOpenApi3(validDoc)).toEqual([]);
  });

  it('flags non-object output', () => {
    expect(validateOpenApi3(null)).toHaveLength(1);
    expect(validateOpenApi3([])).toHaveLength(1);
  });

  it('flags missing/invalid openapi version', () => {
    expect(validateOpenApi3({ ...validDoc, openapi: undefined })).toContain(
      "Missing or invalid 'openapi' version field (expected a 3.x string)",
    );
    expect(validateOpenApi3({ ...validDoc, openapi: '2.0' })).toContain(
      "Missing or invalid 'openapi' version field (expected a 3.x string)",
    );
  });

  it('flags leftover Swagger 2.0 root keys', () => {
    const errs = validateOpenApi3({ ...validDoc, schemes: ['https'], definitions: {}, host: 'x' });
    expect(errs.some(e => e.includes("'schemes'"))).toBe(true);
    expect(errs.some(e => e.includes("'definitions'"))).toBe(true);
    expect(errs.some(e => e.includes("'host'"))).toBe(true);
  });

  it('flags in:body / in:formData parameters', () => {
    const doc = {
      ...validDoc,
      paths: { '/x': { post: { parameters: [{ name: 'b', in: 'body' }], responses: { '201': { description: 'c' } } } } },
    };
    expect(validateOpenApi3(doc).some(e => e.includes("'body' parameter must be converted to requestBody"))).toBe(true);
  });

  it('flags a requestBody $ref stuck inside parameters[] (the Scalar bug)', () => {
    const doc = {
      ...validDoc,
      paths: { '/x': { post: { parameters: [{ $ref: '#/components/requestBodies/ThingBody' }], responses: { '201': { description: 'c' } } } } },
      components: { requestBodies: { ThingBody: { content: {} } } },
    };
    expect(validateOpenApi3(doc).some(e => e.includes('requestBody $ref found inside parameters[]'))).toBe(true);
  });

  it('flags dangling Swagger 2.0 $refs', () => {
    const doc = {
      ...validDoc,
      paths: { '/x': { get: { responses: { '200': { description: 'ok', schema: { $ref: '#/definitions/Thing' } } } } } },
    };
    expect(validateOpenApi3(doc).some(e => e.includes('#/definitions/Thing'))).toBe(true);
  });

  it('flags broken component $refs', () => {
    const doc = {
      ...validDoc,
      paths: { '/x': { get: { responses: { '200': { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Missing' } } } } } } } },
      components: { schemas: {} },
    };
    expect(validateOpenApi3(doc).some(e => e.includes('#/components/schemas/Missing'))).toBe(true);
  });

  it('flags an operation missing responses', () => {
    const doc = { ...validDoc, paths: { '/x': { get: {} } } };
    expect(validateOpenApi3(doc).some(e => e.includes("has no 'responses'"))).toBe(true);
  });

  it('does NOT require responses for OpenAPI 3.1+ (responses became optional)', () => {
    const doc31 = { ...validDoc, openapi: '3.1.0', paths: { '/x': { get: {} } } };
    expect(validateOpenApi3(doc31).some(e => e.includes("has no 'responses'"))).toBe(false);
    const doc32 = { ...validDoc, openapi: '3.2.0', paths: { '/x': { get: {} } } };
    expect(validateOpenApi3(doc32).some(e => e.includes("has no 'responses'"))).toBe(false);
  });

  it("flags missing 'info' object", () => {
    const { info: _drop, ...rest } = validDoc;
    void _drop;
    expect(validateOpenApi3(rest)).toContain("Missing 'info' object");
  });

  it("flags missing 'info.title'", () => {
    expect(validateOpenApi3({ ...validDoc, info: { version: '1' } })).toContain("Missing 'info.title'");
  });

  it("flags 'paths' that is not an object", () => {
    expect(validateOpenApi3({ ...validDoc, paths: [] })).toContain("'paths' must be an object");
  });

  it("flags a 'parameters' value that is not an array", () => {
    const doc = { ...validDoc, paths: { '/x': { get: { parameters: {}, responses: { '200': { description: 'ok' } } } } } };
    expect(validateOpenApi3(doc).some(e => e.includes("'parameters' must be an array"))).toBe(true);
  });

  it('flags a leftover body parameter at the path-item level', () => {
    const doc = {
      ...validDoc,
      paths: { '/x': { parameters: [{ name: 'b', in: 'body' }], get: { responses: { '200': { description: 'ok' } } } } },
    };
    expect(validateOpenApi3(doc).some(e => e.includes('(path item)'))).toBe(true);
  });
});

// ─── normalizeConvertedOpenApi3 ──────────────────────────

describe('normalizeConvertedOpenApi3', () => {
  it('drops a leftover Swagger 2.0 "schemes" root key', () => {
    const { doc, notes } = normalizeConvertedOpenApi3({ openapi: '3.0.4', schemes: ['https'], paths: {} });
    expect(doc.schemes).toBeUndefined();
    expect(notes.some(n => n.includes('schemes'))).toBe(true);
  });

  it('collapses schema examples arrays back to example for compatibility', () => {
    const input = {
      openapi: '3.1.1',
      paths: {},
      components: {
        schemas: {
          Widget: {
            type: 'object',
            examples: [{ id: 1, name: 'demo' }],
          },
        },
      },
    };
    const { doc, notes } = normalizeConvertedOpenApi3(input);
    const widget = (doc.components as Record<string, unknown>).schemas as Record<string, unknown>;
    expect((widget.Widget as Record<string, unknown>).example).toEqual({ id: 1, name: 'demo' });
    expect((widget.Widget as Record<string, unknown>).examples).toBeUndefined();
    expect(notes.some(n => n.includes('Collapsed schema examples[] to example'))).toBe(true);
  });

  it('leaves a document with no schemes key untouched (no note added)', () => {
    const { notes } = normalizeConvertedOpenApi3({ openapi: '3.0.4', paths: {} });
    expect(notes).toEqual([]);
  });

  it('relocates an operation-level requestBody $ref out of parameters[]', () => {
    const input = {
      openapi: '3.0.4',
      paths: {
        '/save': {
          post: {
            parameters: [{ $ref: '#/components/requestBodies/ThingBody' }],
            responses: { '201': { description: 'created' } },
          },
        },
      },
      components: { requestBodies: { ThingBody: { content: {} } } },
    };
    const { doc, notes } = normalizeConvertedOpenApi3(input);
    const post = (doc.paths as Record<string, Record<string, Record<string, unknown>>>)['/save'].post;
    expect(post.requestBody).toEqual({ $ref: '#/components/requestBodies/ThingBody' });
    expect(post.parameters).toBeUndefined();
    expect(notes.some(n => n.includes('Relocated requestBody $ref'))).toBe(true);
  });

  it('keeps other legitimate parameters and only drops the misplaced requestBody ref', () => {
    const input = {
      openapi: '3.0.4',
      paths: {
        '/save/{id}': {
          post: {
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
              { $ref: '#/components/requestBodies/ThingBody' },
            ],
            responses: { '201': { description: 'created' } },
          },
        },
      },
      components: { requestBodies: { ThingBody: { content: {} } } },
    };
    const { doc } = normalizeConvertedOpenApi3(input);
    const post = (doc.paths as Record<string, Record<string, Record<string, unknown>>>)['/save/{id}'].post;
    expect(post.requestBody).toEqual({ $ref: '#/components/requestBodies/ThingBody' });
    expect(post.parameters).toEqual([{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }]);
  });

  it('propagates a path-item-level shared requestBody ref into operations missing one', () => {
    const input = {
      openapi: '3.0.4',
      paths: {
        '/save': {
          parameters: [{ $ref: '#/components/requestBodies/ThingBody' }],
          post: { responses: { '201': { description: 'created' } } },
          put: { responses: { '200': { description: 'ok' } } },
        },
      },
      components: { requestBodies: { ThingBody: { content: {} } } },
    };
    const { doc } = normalizeConvertedOpenApi3(input);
    const pathItem = (doc.paths as Record<string, Record<string, Record<string, unknown>>>)['/save'];
    expect(pathItem.post.requestBody).toEqual({ $ref: '#/components/requestBodies/ThingBody' });
    expect(pathItem.put.requestBody).toEqual({ $ref: '#/components/requestBodies/ThingBody' });
    expect(pathItem.parameters).toBeUndefined();
  });

  it('does not overwrite a requestBody the operation already has', () => {
    const input = {
      openapi: '3.0.4',
      paths: {
        '/save': {
          post: {
            parameters: [{ $ref: '#/components/requestBodies/ThingBody' }],
            requestBody: { $ref: '#/components/requestBodies/OtherBody' },
            responses: { '201': { description: 'created' } },
          },
        },
      },
    };
    const { doc } = normalizeConvertedOpenApi3(input);
    const post = (doc.paths as Record<string, Record<string, Record<string, unknown>>>)['/save'].post;
    expect(post.requestBody).toEqual({ $ref: '#/components/requestBodies/OtherBody' });
  });

  it('is a no-op when paths is missing or not an object', () => {
    expect(normalizeConvertedOpenApi3({ openapi: '3.0.4' }).doc.paths).toBeUndefined();
    expect(normalizeConvertedOpenApi3({ openapi: '3.0.4', paths: [] }).doc.paths).toEqual([]);
  });
});

// ─── convertSwaggerToOpenApiYaml — default engine ────────

describe('convertSwaggerToOpenApiYaml (swagger2openapi default)', () => {
  it('produces valid OpenAPI 3.0 with body → requestBody and no leftover schemes', async () => {
    const result = await convertSwaggerToOpenApiYaml(SWAGGER2_YAML);

    expect(result.engineUsed).toBe('swagger2openapi');
    expect(result.fellBack).toBe(false);
    expect(result.valid).toBe(true);
    expect(result.validationErrors).toEqual([]);
    expect(result.openapiVersion.startsWith('3.0')).toBe(true);

    const doc = YAML.parse(result.yaml);
    expect(doc.openapi.startsWith('3.0')).toBe(true);
    expect(doc.schemes).toBeUndefined();
    expect(doc.definitions).toBeUndefined();
    expect(doc.paths['/save'].post.requestBody).toBeTruthy();
    // no body param left behind
    const postParams = doc.paths['/save'].post.parameters ?? [];
    expect(postParams.some((p: { in?: string }) => p.in === 'body')).toBe(false);
    // securityDefinitions → components.securitySchemes
    expect(doc.components.securitySchemes.Bearer).toBeTruthy();
  });

  it('round-trips to a parseable YAML object', async () => {
    const result = await convertSwaggerToOpenApiYaml(SWAGGER2_YAML);
    const doc = YAML.parse(result.yaml);
    expect(typeof doc).toBe('object');
    expect(doc.openapi).toBeTruthy();
  });
});

// ─── Scalar engine + validate-driven fallback ────────────

describe('convertSwaggerToOpenApiYaml (scalar engine)', () => {
  it('normalizes Scalar\'s leftover schemes + misplaced requestBody ref so no fallback is needed', async () => {
    const result = await convertSwaggerToOpenApiYaml(SWAGGER2_YAML, { engine: 'scalar', target: '3.0' });

    expect(result.fellBack).toBe(false);
    expect(result.engineUsed).toBe('scalar');
    expect(result.valid).toBe(true);
    expect(result.validationErrors).toEqual([]);

    const doc = YAML.parse(result.yaml);
    expect(doc.schemes).toBeUndefined();
    expect(doc.paths['/save'].post.requestBody).toBeTruthy();
    const postParams = doc.paths['/save'].post.parameters ?? [];
    expect(postParams.some((p: { $ref?: string }) => p.$ref?.includes('/requestBodies/'))).toBe(false);
  });

  it('normalization applies even with fallbackOnInvalid:false, so Scalar output is valid on its own', async () => {
    const result = await convertSwaggerToOpenApiYaml(SWAGGER2_YAML, {
      engine: 'scalar',
      target: '3.0',
      fallbackOnInvalid: false,
    });

    expect(result.fellBack).toBe(false);
    expect(result.engineUsed).toBe('scalar');
    expect(result.valid).toBe(true);
    expect(result.validationErrors).toEqual([]);
  });

  it('can target OpenAPI 3.1 (only Scalar path)', async () => {
    const result = await convertSwaggerToOpenApiYaml(
      // simple spec without the body-ref bug so 3.1 output is valid
      `swagger: '2.0'\ninfo:\n  title: T\n  version: '1'\npaths:\n  /x:\n    get:\n      responses:\n        '200':\n          description: ok\n`,
      { engine: 'scalar', target: '3.1' },
    );
    expect(result.engineUsed).toBe('scalar');
    expect(result.openapiVersion.startsWith('3.1')).toBe(true);
    expect(result.valid).toBe(true);
  });
});

// ─── Guards / errors ─────────────────────────────────────

describe('convertSwaggerToOpenApiYaml (guards)', () => {
  it('rejects swagger2openapi + 3.1 target before running', async () => {
    await expect(
      convertSwaggerToOpenApiYaml(SWAGGER2_YAML, { engine: 'swagger2openapi', target: '3.1' }),
    ).rejects.toThrow(/cannot target OpenAPI 3\.1/);
  });

  it('rejects OpenAPI 3 input', async () => {
    await expect(convertSwaggerToOpenApiYaml(OPENAPI3_YAML)).rejects.toThrow(/Not a Swagger 2\.0 spec/);
  });

  it('rejects unparseable input', async () => {
    await expect(convertSwaggerToOpenApiYaml('%%% : : :')).rejects.toThrow(/parse/i);
  });

  it('rejects a non-object document', async () => {
    await expect(convertSwaggerToOpenApiYaml('"just a string"')).rejects.toThrow();
  });
});

// ─── upgradeOpenApi3Yaml (P4-A) ──────────────────────────

const OAS30_NULLABLE = `openapi: 3.0.3
info:
  title: Upgradeable
  version: '1'
paths:
  /x:
    get:
      responses:
        '200':
          description: ok
components:
  schemas:
    Foo:
      type: object
      nullable: true
      properties:
        n:
          type: integer
`;

const OAS31_YAML = `openapi: 3.1.0
info:
  title: ThreeOne
  version: '1'
paths:
  /x:
    get:
      responses:
        '200':
          description: ok
`;

describe('upgradeOpenApi3Yaml', () => {
  it('upgrades 3.0 → 3.1 (Scalar), rewriting nullable to a type array', async () => {
    const result = await upgradeOpenApi3Yaml(OAS30_NULLABLE, { target: '3.1' });

    expect(result.engineUsed).toBe('scalar');
    expect(result.fellBack).toBe(false);
    expect(result.valid).toBe(true);
    expect(result.openapiVersion.startsWith('3.1')).toBe(true);

    const doc = YAML.parse(result.yaml);
    expect(doc.openapi.startsWith('3.1')).toBe(true);
    expect(doc.components.schemas.Foo.type).toEqual(['object', 'null']);
    expect(doc.components.schemas.Foo.nullable).toBeUndefined();
  });

  it('upgrades 3.0 → 3.2', async () => {
    const result = await upgradeOpenApi3Yaml(OAS30_NULLABLE, { target: '3.2' });
    expect(result.openapiVersion.startsWith('3.2')).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('upgrades 3.1 → 3.2', async () => {
    const result = await upgradeOpenApi3Yaml(OAS31_YAML, { target: '3.2' });
    expect(result.openapiVersion.startsWith('3.2')).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('rejects a non-forward target (3.1 → 3.1 not offered)', async () => {
    await expect(upgradeOpenApi3Yaml(OAS31_YAML, { target: '3.1' })).rejects.toThrow(/Cannot upgrade oas31/);
  });

  it('rejects a Swagger 2.0 input (use convertSwaggerToOpenApiYaml)', async () => {
    await expect(upgradeOpenApi3Yaml(SWAGGER2_YAML, { target: '3.1' })).rejects.toThrow(/Not an OpenAPI 3\.x spec/);
  });

  it('rejects unparseable input', async () => {
    await expect(upgradeOpenApi3Yaml('%%% : : :', { target: '3.1' })).rejects.toThrow(/parse/i);
  });
});
