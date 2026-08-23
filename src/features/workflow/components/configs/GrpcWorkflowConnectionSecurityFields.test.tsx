/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { selectOptionByTestId } from '@test-utils/customSelectHelper';
import '@testing-library/jest-dom';
import GrpcWorkflowConnectionSecurityFields from './GrpcWorkflowConnectionSecurityFields';

vi.mock('../../../grpc/hooks/useGrpcTls', () => ({
  useGrpcTls: () => ({ issues: [], valid: true, normalizedTlsConfig: undefined }),
}));

vi.mock('../../../grpc/components/GrpcTlsConfigBody', () => ({
  GrpcTlsConfigBody: () => <div data-testid="mock-tls-body" />,
}));

vi.mock('../../../grpc/components/GrpcAuthPanel', () => ({
  GrpcAuthPanel: ({ onChange }: { onChange: (auth: unknown) => void }) => (
    <button type="button" data-testid="mock-auth-set" onClick={() => onChange({ type: 'bearer', bearerToken: 'tok' })}>
      Set auth
    </button>
  ),
}));

describe('GrpcWorkflowConnectionSecurityFields', () => {
  it('updates tls mode and auth', () => {
    const onChange = vi.fn();
    const data = {
      label: 'Echo',
      target: '',
      descriptorKey: 'k',
      service: 's',
      method: 'm',
      body: {},
      callType: 'unary' as const,
    };

    const { getByTestId } = render(
      <GrpcWorkflowConnectionSecurityFields
        data={data}
        onChange={onChange}
        testIdPrefix="grpc-unary-config"
      />,
    );

    selectOptionByTestId('grpc-unary-config-tls-mode', 'TLS');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tlsMode: 'tls' }));

    fireEvent.click(getByTestId('mock-auth-set'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      auth: { type: 'bearer', bearerToken: 'tok' },
    }));
  });
});
