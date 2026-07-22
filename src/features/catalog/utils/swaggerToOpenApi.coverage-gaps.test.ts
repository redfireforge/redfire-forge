import { describe, expect, it, vi } from 'vitest';

const { runSwagger2OpenApiMock, runScalarUpgradeMock } = vi.hoisted(() => ({
  runSwagger2OpenApiMock: vi.fn((spec: Record<string, unknown>) => {
    const title = String((spec.info as { title?: string } | undefined)?.title ?? '');
    if (title === 'Throw String') throw 'primary string boom';
    if (title === 'Invalid Primary') {
      return {
        openapi: {
          openapi: '3.0.4',
          info: { title: 'invalid', version: '1' },
          paths: {
            '/x': {
              post: {
                parameters: [{ $ref: '#/components/requestBodies/Missing' }],
                responses: { '200': { description: 'ok' } },
              },
            },
          },
          components: {},
        },
        openapiVersion: '3.0.4',
        warnings: ['primary invalid'],
      };
    }
    return {
      openapi: { openapi: '3.0.4', info: { title: 'ok', version: '1' }, paths: {} },
      openapiVersion: '3.0.4',
      warnings: [],
    };
  }),
  runScalarUpgradeMock: vi.fn((spec: Record<string, unknown>, target: string) => {
    const title = String((spec.info as { title?: string } | undefined)?.title ?? '');
    if (title === 'Throw String' || title === 'Throw Upgrade String') throw 'secondary string boom';
    return {
      openapi: {
        openapi: target === '3.1' ? '3.1.0' : '3.0.4',
        info: { title: 'fallback', version: '1' },
        paths: { '/x': { get: { responses: { '200': { description: 'ok' } } } } },
      },
      openapiVersion: target === '3.1' ? '3.1.0' : '3.0.4',
      warnings: [],
    };
  }),
}));

vi.mock('./engines/swagger2openapiEngine', () => ({
  runSwagger2OpenApi: runSwagger2OpenApiMock,
}));

vi.mock('./engines/scalarEngine', () => ({
  runScalarUpgrade: runScalarUpgradeMock,
}));

import { convertSwaggerToOpenApiYaml, upgradeOpenApi3Yaml } from './swaggerToOpenApi';

describe('swaggerToOpenApi coverage gaps', () => {
  it('falls back with an invalid-output reason when the primary engine returns invalid OpenAPI', async () => {
    const result = await convertSwaggerToOpenApiYaml(
      `swagger: '2.0'\ninfo:\n  title: Invalid Primary\n  version: '1'\npaths: {}\n`,
      { engine: 'swagger2openapi', target: '3.0' },
    );

    expect(result.fellBack).toBe(true);
    expect(result.fallbackReason).toBe('invalid-output');
    expect(result.engineUsed).toBe('scalar');
    expect(result.valid).toBe(true);
  });

  it('surfaces a string-based primary failure when both engines throw', async () => {
    await expect(
      convertSwaggerToOpenApiYaml(
        `swagger: '2.0'\ninfo:\n  title: Throw String\n  version: '1'\npaths: {}\n`,
        { engine: 'swagger2openapi', target: '3.0' },
      ),
    ).rejects.toThrow('Conversion failed: primary string boom');
  });

  it('wraps non-Error upgrade failures with the original string detail', async () => {
    await expect(
      upgradeOpenApi3Yaml(
        `openapi: 3.0.3\ninfo:\n  title: Throw Upgrade String\n  version: '1'\npaths: {}\n`,
        { target: '3.1' },
      ),
    ).rejects.toThrow('Upgrade failed: secondary string boom');
  });
});