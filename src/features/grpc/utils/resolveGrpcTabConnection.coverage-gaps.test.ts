import { describe, expect, it } from 'vitest';
import {
  canConnectFromResolution,
  resolutionToGrpcTarget,
  resolveGrpcTabConnection,
  resolveGrpcTabTarget,
} from './resolveGrpcTabConnection';

describe('resolveGrpcTabConnection coverage gaps', () => {
  const profiles = [
    { id: 'p1', name: 'Local Go', target: '  localhost:50051  ', tlsMode: 'disabled' as const },
    { id: 'p2', name: 'Spring', target: '', tlsMode: 'tls' as const },
  ];
  const pageDefaults = { target: 'localhost:50051', tlsMode: 'disabled' as const };

  it('resolveGrpcTabTarget ignores blank profile targets and uses page default', () => {
    expect(resolveGrpcTabTarget({ connectionId: 'p2' }, profiles, 'localhost:50051')).toBe(
      'localhost:50051',
    );
  });

  it('resolveGrpcTabConnection trims tab target override', () => {
    const result = resolveGrpcTabConnection(
      { target: '  custom:8080  ' },
      profiles,
      pageDefaults,
    );
    expect(result.target).toBe('custom:8080');
  });

  it('resolveGrpcTabConnection trims profile target when linked', () => {
    const result = resolveGrpcTabConnection({ connectionId: 'p1' }, profiles, pageDefaults);
    expect(result.target).toBe('localhost:50051');
    expect(result.profileName).toBe('Local Go');
  });

  it('resolutionToGrpcTarget uses raw target when validation fails', () => {
    const resolution = resolveGrpcTabConnection(
      { target: '{{grpcHost}}' },
      profiles,
      pageDefaults,
    );
    expect(canConnectFromResolution(resolution)).toBe(false);
    expect(resolutionToGrpcTarget(resolution).address).toBe('{{grpcHost}}');
  });

  it('resolveGrpcTabConnection leaves page defaults when connectionId is unknown', () => {
    const result = resolveGrpcTabConnection({ connectionId: 'missing' }, profiles, pageDefaults);
    expect(result.target).toBe('localhost:50051');
    expect(result.connectionProfileId).toBeUndefined();
  });
});
