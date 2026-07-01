/**
 * Phase 9A — interpolation contract tests.
 */
import { describe, expect, it } from 'vitest';
import {
  GRPC_CANONICAL_ENV_TOKENS,
  GRPC_INTERPOLATION_ALLOWED_CONTEXTS,
  GRPC_INTERPOLATION_ERROR_CODES,
  GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY,
  GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS,
  GRPC_INTERPOLATION_VAR_NAME_PATTERN,
  isGrpcStructuralInterpolationForbiddenField,
  isGrpcInterpolationAllowedContext,
  validateGrpcStructuralFieldNotTokenized,
  validateGrpcStructuralFieldIfForbidden,
} from './grpcInterpolationContracts';

describe('grpcInterpolationContracts (Phase 9A)', () => {
  it('defines stable error catalog codes', () => {
    expect(GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN).toBe('grpc.interpolation.missing_token');
    expect(GRPC_INTERPOLATION_ERROR_CODES.CYCLE).toBe('grpc.interpolation.cycle');
    expect(GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET).toBe('grpc.interpolation.invalid_target');
    expect(GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION).toBe('grpc.interpolation.serialization');
    expect(GRPC_INTERPOLATION_ERROR_CODES.VALIDATION).toBe('grpc.interpolation.validation');
    expect(GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX).toBe('grpc.interpolation.invalid_syntax');
    expect(GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED)
      .toBe('grpc.interpolation.structural_key_tokenized');
  });

  it('maps interpolation codes to harness error categories where applicable', () => {
    expect(GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN])
      .toBe('serialization');
    expect(GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET])
      .toBe('validation');
    expect(
      GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED],
    ).toBe('validation');
  });

  it('lists canonical gRPC env tokens', () => {
    expect(GRPC_CANONICAL_ENV_TOKENS).toEqual(['grpcHost', 'grpcPort']);
  });

  it('lists allowed interpolation contexts', () => {
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('target');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('auth_value');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('metadata_value');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('body_value');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('assertion_expected_value');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).toContain('collect_until_expression');
    expect(GRPC_INTERPOLATION_ALLOWED_CONTEXTS).not.toContain('service');
    expect(isGrpcInterpolationAllowedContext('target')).toBe(true);
    expect(isGrpcInterpolationAllowedContext('service')).toBe(false);
  });

  it('canonical env tokens satisfy the frozen var-name pattern', () => {
    for (const token of GRPC_CANONICAL_ENV_TOKENS) {
      expect(GRPC_INTERPOLATION_VAR_NAME_PATTERN.test(token)).toBe(true);
    }
  });

  it('rejects interpolation tokens in structural config fields', () => {
    for (const field of GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS) {
      expect(isGrpcStructuralInterpolationForbiddenField(field)).toBe(true);
      const issue = validateGrpcStructuralFieldNotTokenized(field, '{{tokenized}}');
      expect(issue?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED);
      expect(issue?.field).toBe(field);
    }
  });

  it('allows literal values in structural config fields', () => {
    expect(validateGrpcStructuralFieldNotTokenized('service', 'echo.EchoService')).toBeUndefined();
    expect(validateGrpcStructuralFieldNotTokenized('grpcField', '$.message')).toBeUndefined();
    expect(validateGrpcStructuralFieldNotTokenized(
      'descriptorKey',
      String.raw`\{{not-a-token}}`,
    )).toBeUndefined();
  });

  it('rejects tokenized jsonPath assertion fields', () => {
    const issue = validateGrpcStructuralFieldNotTokenized('grpcField', '$.{{dynamic}}');
    expect(issue?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED);
  });

  it('returns invalid_syntax for malformed templates instead of throwing', () => {
    const issue = validateGrpcStructuralFieldNotTokenized('service', '{{unclosed');
    expect(issue?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX);
    expect(issue?.message).toMatch(/Unclosed interpolation token/);
  });

  it('returns invalid_syntax for empty token names in structural fields', () => {
    const issue = validateGrpcStructuralFieldNotTokenized('method', '{{}}');
    expect(issue?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX);
  });

  it('returns invalid_syntax for invalid token names in structural fields', () => {
    const issue = validateGrpcStructuralFieldNotTokenized('service', '{{9bad}}');
    expect(issue?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX);
  });

  it('classifies non-structural field names via isGrpcStructuralInterpolationForbiddenField', () => {
    expect(isGrpcStructuralInterpolationForbiddenField('target')).toBe(false);
    expect(isGrpcStructuralInterpolationForbiddenField('connectionId')).toBe(false);
    expect(isGrpcStructuralInterpolationForbiddenField('unknown')).toBe(false);
  });

  it('validateGrpcStructuralFieldIfForbidden skips allowed fields and validates forbidden ones', () => {
    expect(validateGrpcStructuralFieldIfForbidden('target', '{{grpcHost}}')).toBeUndefined();
    expect(validateGrpcStructuralFieldIfForbidden('connectionId', '{{profileId}}')).toBeUndefined();
    expect(validateGrpcStructuralFieldIfForbidden('tlsMode', '{{envTlsMode}}')).toBeUndefined();
    expect(validateGrpcStructuralFieldIfForbidden('method', '{{dynamic}}')?.code)
      .toBe(GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED);
  });

  it('forbidden and allowed field sets do not overlap', () => {
    for (const field of GRPC_STRUCTURAL_INTERPOLATION_FORBIDDEN_FIELDS) {
      expect(isGrpcInterpolationAllowedContext(field)).toBe(false);
    }
  });

  it('maps every actionable interpolation code to a harness error category', () => {
    const mappedCodes = [
      GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN,
      GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION,
      GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX,
      GRPC_INTERPOLATION_ERROR_CODES.CYCLE,
      GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
      GRPC_INTERPOLATION_ERROR_CODES.VALIDATION,
      GRPC_INTERPOLATION_ERROR_CODES.STRUCTURAL_KEY_TOKENIZED,
    ] as const;
    for (const code of mappedCodes) {
      expect(GRPC_INTERPOLATION_HARNESS_ERROR_CATEGORY[code]).toMatch(/^(serialization|validation)$/);
    }
  });
});
