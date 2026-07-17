import { describe, expect, it, vi } from 'vitest';
import { getGrpcStatus } from '../../../shared/grpc/grpcApiClient';
import {
  probeGrpcTargetConnection,
  resetTargetConnectionSession,
  resolveGrpcTargetProbeTimeoutMs,
} from './grpcTargetConnection';

vi.mock('../../../shared/grpc/grpcApiClient', () => ({
  getGrpcStatus: vi.fn(),
}));

describe('grpcTargetConnection', () => {
  it('caps probe timeout at default maximum', () => {
    expect(resolveGrpcTargetProbeTimeoutMs(120_000)).toBe(5_000);
    expect(resolveGrpcTargetProbeTimeoutMs(2_000)).toBe(2_000);
    expect(resolveGrpcTargetProbeTimeoutMs(undefined)).toBe(5_000);
    expect(resolveGrpcTargetProbeTimeoutMs(0)).toBe(5_000);
    expect(resolveGrpcTargetProbeTimeoutMs(-1)).toBe(5_000);
    expect(resolveGrpcTargetProbeTimeoutMs(Number.NaN)).toBe(5_000);
  });

  it('returns idle reset session', () => {
    expect(resetTargetConnectionSession()).toEqual({ state: 'idle' });
  });

  it('returns error when target is invalid', async () => {
    const session = await probeGrpcTargetConnection({
      target: '',
      tlsMode: 'disabled',
      targetValidation: { valid: false, reason: 'Target required' },
    } as never);
    expect(session.state).toBe('error');
    expect(session.errorMessage).toContain('Target required');
  });

  it('marks connected when status probe succeeds', async () => {
    vi.mocked(getGrpcStatus).mockResolvedValue({
      ok: true,
      data: { reachable: true, address: 'localhost:50051', tlsMode: 'disabled', latencyMs: 7 },
    } as never);

    const session = await probeGrpcTargetConnection({
      target: 'localhost:50051',
      tlsMode: 'disabled',
      targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' },
    } as never);

    expect(session.state).toBe('connected');
    expect(session.latencyMs).toBe(7);
  });

  it('returns error when probe reports unreachable', async () => {
    vi.mocked(getGrpcStatus).mockResolvedValue({
      ok: true,
      data: { reachable: false, address: 'localhost:50051', tlsMode: 'disabled', errorMessage: 'refused' },
    } as never);

    const session = await probeGrpcTargetConnection({
      target: 'localhost:50051',
      tlsMode: 'disabled',
      targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' },
    } as never);

    expect(session.state).toBe('error');
    expect(session.errorMessage).toBe('refused');
  });

  it('returns default error when probe is unreachable without message', async () => {
    vi.mocked(getGrpcStatus).mockResolvedValue({
      ok: true,
      data: { reachable: false, address: 'localhost:50051', tlsMode: 'disabled' },
    } as never);

    const session = await probeGrpcTargetConnection({
      target: 'localhost:50051',
      tlsMode: 'disabled',
      targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' },
    } as never);

    expect(session.state).toBe('error');
    expect(session.errorMessage).toBe('Target is unreachable.');
  });

  it('preserves an explicit empty-string invalid target reason', async () => {
    const session = await probeGrpcTargetConnection({
      target: '',
      tlsMode: 'disabled',
      targetValidation: { valid: false, reason: '' },
    } as never);
    expect(session.errorMessage).toBe('');
  });

  it('returns error when status probe throws', async () => {
    vi.mocked(getGrpcStatus).mockRejectedValue(new Error('network down'));

    const session = await probeGrpcTargetConnection({
      target: 'localhost:50051',
      tlsMode: 'disabled',
      targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' },
    } as never);

    expect(session.state).toBe('error');
    expect(session.errorMessage).toBe('network down');
  });

  it('returns generic message when status probe throws a non-Error value', async () => {
    vi.mocked(getGrpcStatus).mockRejectedValue('network down');

    const session = await probeGrpcTargetConnection({
      target: 'localhost:50051',
      tlsMode: 'disabled',
      targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' },
    } as never);

    expect(session.state).toBe('error');
    expect(session.errorMessage).toBe('Connection probe failed.');
  });

  it('uses fallback validation message when reason is absent', async () => {
    const session = await probeGrpcTargetConnection({
      target: '',
      tlsMode: 'disabled',
      targetValidation: { valid: false },
    } as never);
    expect(session.errorMessage).toBe('Invalid target address.');
  });
});
