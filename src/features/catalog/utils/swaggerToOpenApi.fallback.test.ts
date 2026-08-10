import { describe, it, expect, vi } from 'vitest';

// Force the swagger2openapi engine to throw so we can exercise throw-driven
// fallback and the "no fallback" propagation path. The scalar engine stays real.
vi.mock('./engines/swagger2openapiEngine', () => ({
  runSwagger2OpenApi: vi.fn(() => {
    throw new Error('simulated engine failure');
  }),
}));

// Force the scalar engine to throw so the upgrade dispatcher's catch is exercised.
vi.mock('./engines/scalarEngine', async (importActual) => {
  const actual = await importActual<typeof import('./engines/scalarEngine')>();
  return {
    ...actual,
    runScalarUpgrade: vi.fn((spec: Record<string, unknown>) => {
      // Real behavior for the Swagger-2 fallback test; throw only for the upgrade probe.
      if (typeof spec.openapi === 'string' && spec.openapi.startsWith('3')) {
        throw new Error('scalar boom');
      }
      return actual.runScalarUpgrade(spec, '3.0');
    }),
  };
});

import { convertSwaggerToOpenApiYaml, upgradeOpenApi3Yaml } from './swaggerToOpenApi';

const MINIMAL_SWAGGER2 = `swagger: '2.0'
info:
  title: Minimal
  version: '1.0.0'
paths:
  /ping:
    get:
      responses:
        '200':
          description: ok
`;

// The exact shared-body-parameter pattern that trips @scalar/openapi-upgrader
// (leftover "schemes" + a requestBody $ref left in parameters[]) — reproduces the
// real-world case where swagger2openapi crashes on a spec and the auto-fallback to
// Scalar previously landed on Scalar's known-buggy (but now auto-normalized) output.
const SWAGGER2_WITH_SHARED_BODY_PARAM = `swagger: '2.0'
info:
  title: Sample
  version: '1.0.4'
schemes:
  - https
paths:
  /save:
    post:
      operationId: saveThing
      parameters:
        - $ref: '#/parameters/ThingBody'
      responses:
        '201':
          description: created
parameters:
  ThingBody:
    name: thing
    in: body
    required: true
    schema:
      $ref: '#/definitions/Thing'
definitions:
  Thing:
    type: object
    properties:
      id:
        type: string
`;

describe('convertSwaggerToOpenApiYaml — throw-driven fallback', () => {
  it('falls back to scalar when the primary engine throws', async () => {
    const result = await convertSwaggerToOpenApiYaml(MINIMAL_SWAGGER2, { engine: 'swagger2openapi', target: '3.0' });

    expect(result.fellBack).toBe(true);
    expect(result.fallbackReason).toBe('threw');
    expect(result.engineUsed).toBe('scalar');
    expect(result.valid).toBe(true);
  });

  it('normalizes the fallback Scalar output (leftover schemes + misplaced requestBody ref) into a valid result', async () => {
    const result = await convertSwaggerToOpenApiYaml(SWAGGER2_WITH_SHARED_BODY_PARAM, { engine: 'swagger2openapi', target: '3.0' });

    expect(result.fellBack).toBe(true);
    expect(result.fallbackReason).toBe('threw');
    expect(result.engineUsed).toBe('scalar');
    expect(result.valid).toBe(true);
    expect(result.validationErrors).toEqual([]);
  });

  it('propagates the failure when fallbackOnInvalid is false', async () => {
    await expect(
      convertSwaggerToOpenApiYaml(MINIMAL_SWAGGER2, {
        engine: 'swagger2openapi',
        target: '3.0',
        fallbackOnInvalid: false,
      }),
    ).rejects.toThrow(/Conversion failed/);
  });

  it('surfaces the real primary-engine crash reason when the fallback is still invalid for an unrelated reason', async () => {
    // Empty `responses` is untouched by normalization, so this stays invalid even
    // after Scalar's output is adopted — the surfaced error must still mention why
    // the primary (swagger2openapi) engine actually crashed, not just the leftover
    // structural defect in the fallback's output.
    const swagger2WithNoResponses = `swagger: '2.0'
info:
  title: Broken
  version: '1.0.0'
paths:
  /x:
    get:
      responses: {}
`;
    const result = await convertSwaggerToOpenApiYaml(swagger2WithNoResponses, { engine: 'swagger2openapi', target: '3.0' });

    expect(result.fellBack).toBe(true);
    expect(result.fallbackReason).toBe('threw');
    expect(result.engineUsed).toBe('scalar');
    expect(result.valid).toBe(false);
    expect(result.validationErrors[0]).toMatch(/^Primary engine "swagger2openapi" crashed: simulated engine failure/);
  });
});

describe('upgradeOpenApi3Yaml — engine throw', () => {
  it('wraps a Scalar engine throw as "Upgrade failed"', async () => {
    const oas30 = "openapi: '3.0.3'\ninfo:\n  title: T\n  version: '1'\npaths: {}\n";
    await expect(upgradeOpenApi3Yaml(oas30, { target: '3.1' })).rejects.toThrow(/Upgrade failed: scalar boom/);
  });
});
