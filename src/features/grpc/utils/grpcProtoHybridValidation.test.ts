import { describe, expect, it } from 'vitest';
import {
  aggregateGrpcProtoHybridNodeStatus,
  collectValidationLevelsForPathPrefix,
  hasGrpcProtoHybridApplyBlockingState,
  hasGrpcProtoHybridBlockingErrors,
  summarizeGrpcProtoHybridValidation,
} from './grpcProtoHybridValidation';

describe('grpcProtoHybridValidation (Phase 0 foundation)', () => {
  it('summarizes errors/warnings/infos from path map', () => {
    const summary = summarizeGrpcProtoHybridValidation({
      alpha: { level: 'error', code: 'required', message: 'required' },
      beta: { level: 'warning', code: 'recommended', message: 'recommended' },
      gamma: { level: 'info', code: 'hint', message: 'hint' },
      delta: { level: 'none', code: 'ok', message: '' },
    });

    expect(summary).toEqual({ errors: 1, warnings: 1, infos: 1 });
    expect(hasGrpcProtoHybridBlockingErrors(summary)).toBe(true);
  });

  it('collects levels for exact path and descendants', () => {
    const levels = collectValidationLevelsForPathPrefix(
      {
        payment: { level: 'warning', code: 'warn', message: 'warn' },
        'payment.amount': { level: 'error', code: 'required', message: 'required' },
        'payment.currency': { level: 'info', code: 'hint', message: 'hint' },
        customer: { level: 'none', code: 'ok', message: '' },
      },
      'payment',
    );

    expect(levels).toEqual(['warning', 'error', 'info']);
  });

  it('aggregates node status by strongest child level', () => {
    expect(aggregateGrpcProtoHybridNodeStatus([])).toBe('unknown');
    expect(aggregateGrpcProtoHybridNodeStatus(['none', 'info'])).toBe('valid');
    expect(aggregateGrpcProtoHybridNodeStatus(['warning', 'none'])).toBe('warning');
    expect(aggregateGrpcProtoHybridNodeStatus(['warning', 'error', 'info'])).toBe('error');
  });

  it('treats json parse errors as apply-blocking even when validation summary has no errors', () => {
    const noValidationErrors = { errors: 0, warnings: 1, infos: 0 };
    expect(hasGrpcProtoHybridApplyBlockingState(noValidationErrors, null)).toBe(false);
    expect(hasGrpcProtoHybridApplyBlockingState(noValidationErrors, 'Unexpected token }')).toBe(true);
  });

  it('returns an empty summary object when no path issues exist', () => {
    expect(summarizeGrpcProtoHybridValidation({})).toEqual({ errors: 0, warnings: 0, infos: 0 });
  });

  it('supports path-prefix matching when a trailing dot and whitespace are provided', () => {
    const levels = collectValidationLevelsForPathPrefix(
      {
        customer: { level: 'warning', code: 'warn', message: 'warn' },
        'customer.id': { level: 'error', code: 'required', message: 'required' },
      },
      ' customer. ',
    );

    expect(levels).toEqual(['error']);
  });

  it('returns all levels when path prefix is blank', () => {
    const levels = collectValidationLevelsForPathPrefix(
      {
        alpha: { level: 'none', code: 'ok', message: '' },
        beta: { level: 'info', code: 'hint', message: 'hint' },
      },
      '   ',
    );

    expect(levels).toEqual(['none', 'info']);
  });

  it('is apply-blocked when validation has errors even without json errors', () => {
    expect(hasGrpcProtoHybridApplyBlockingState({ errors: 2, warnings: 0, infos: 0 }, null)).toBe(true);
  });
});
