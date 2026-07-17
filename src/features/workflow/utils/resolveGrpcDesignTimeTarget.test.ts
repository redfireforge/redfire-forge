/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { resolveGrpcDesignTimeTarget } from './resolveGrpcDesignTimeTarget';

describe('resolveGrpcDesignTimeTarget', () => {
  it('returns the raw target when there are no templates', () => {
    expect(resolveGrpcDesignTimeTarget('localhost:50051', { grpcTarget: 'x' })).toEqual({
      resolved: 'localhost:50051',
      usedWorkflowDefaults: false,
      unresolvedTokens: [],
    });
  });

  it('substitutes known workflow variable defaults', () => {
    expect(
      resolveGrpcDesignTimeTarget('{{grpcTarget}}', { grpcTarget: 'localhost:50051' }),
    ).toEqual({
      resolved: 'localhost:50051',
      usedWorkflowDefaults: true,
      unresolvedTokens: [],
    });
  });

  it('leaves unknown tokens unresolved', () => {
    expect(resolveGrpcDesignTimeTarget('{{missing}}:{{grpcTarget}}', { grpcTarget: '50051' })).toEqual({
      resolved: '{{missing}}:50051',
      usedWorkflowDefaults: true,
      unresolvedTokens: ['missing'],
    });
  });

  it('tolerates whitespace inside braces', () => {
    expect(resolveGrpcDesignTimeTarget('{{ grpcTarget }}', { grpcTarget: '127.0.0.1:50051' })).toEqual({
      resolved: '127.0.0.1:50051',
      usedWorkflowDefaults: true,
      unresolvedTokens: [],
    });
  });

  it('treats explicit undefined defaults as empty string replacement', () => {
    expect(
      resolveGrpcDesignTimeTarget('{{grpcTarget}}', { grpcTarget: undefined as unknown as string }),
    ).toEqual({
      resolved: '',
      usedWorkflowDefaults: true,
      unresolvedTokens: [],
    });
  });
});
