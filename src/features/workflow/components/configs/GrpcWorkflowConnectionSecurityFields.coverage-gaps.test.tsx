/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import GrpcWorkflowConnectionSecurityFields from './GrpcWorkflowConnectionSecurityFields';

vi.mock('../../../grpc/hooks/useGrpcTls', () => ({
  useGrpcTls: () => ({ issues: [], valid: true, normalizedTlsConfig: undefined }),
}));

vi.mock('../../../grpc/components/GrpcTlsConfigBody', () => ({
  GrpcTlsConfigBody: ({
    onTlsConfigChange,
    onTlsModeChange,
  }: {
    onTlsConfigChange: (patch: Record<string, string>) => void;
    onTlsModeChange: (mode: string) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="mock-tls-patch"
        onClick={() => onTlsConfigChange({ caCert: 'pem-data' })}
      >
        Patch TLS
      </button>
      <button
        type="button"
        data-testid="mock-tls-mode-mtls"
        onClick={() => onTlsModeChange('mtls')}
      >
        mTLS
      </button>
    </div>
  ),
}));

vi.mock('../../../grpc/components/GrpcAuthPanel', () => ({
  GrpcAuthPanel: () => <div data-testid="mock-auth-panel" />,
}));

const baseData = {
  label: 'Echo',
  target: 'localhost:50051',
  descriptorKey: 'k',
  service: 'echo.EchoService',
  method: 'Echo',
  body: {},
  callType: 'unary' as const,
};

describe('GrpcWorkflowConnectionSecurityFields coverage gaps', () => {
  it('expands TLS panel, patches tlsConfig, and toggles certificate editor visibility', () => {
    const onChange = vi.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <GrpcWorkflowConnectionSecurityFields
        data={baseData}
        onChange={onChange}
        testIdPrefix="grpc-unary-config"
      />,
    );

    fireEvent.change(getByTestId('grpc-unary-config-tls-mode'), { target: { value: 'tls' } });
    rerender(
      <GrpcWorkflowConnectionSecurityFields
        data={{ ...baseData, tlsMode: 'tls' }}
        onChange={onChange}
        testIdPrefix="grpc-unary-config"
      />,
    );
    expect(getByTestId('grpc-unary-config-tls-panel')).toBeInTheDocument();

    fireEvent.click(getByTestId('grpc-unary-config-tls-configure'));
    expect(queryByTestId('grpc-unary-config-tls-panel')).not.toBeInTheDocument();

    fireEvent.click(getByTestId('grpc-unary-config-tls-configure'));
    expect(getByTestId('grpc-unary-config-tls-panel')).toBeInTheDocument();

    fireEvent.click(getByTestId('mock-tls-patch'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      tlsConfig: { caCert: 'pem-data' },
    }));

    fireEvent.click(getByTestId('mock-tls-mode-mtls'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tlsMode: 'mtls' }));
  });

  it('uses localhost preview when target is blank and hides TLS controls when disabled', () => {
    const onChange = vi.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <GrpcWorkflowConnectionSecurityFields
        data={{ ...baseData, target: '', tlsMode: 'tls', tlsConfig: { caCert: 'x' } }}
        onChange={onChange}
        testIdPrefix="grpc-stream-config"
      />,
    );

    expect(getByTestId('grpc-stream-config-tls-panel')).toBeInTheDocument();

    fireEvent.change(getByTestId('grpc-stream-config-tls-mode'), { target: { value: 'disabled' } });
    rerender(
      <GrpcWorkflowConnectionSecurityFields
        data={{ ...baseData, target: '', tlsMode: 'disabled', tlsConfig: { caCert: 'x' } }}
        onChange={onChange}
        testIdPrefix="grpc-stream-config"
      />,
    );
    expect(queryByTestId('grpc-stream-config-tls-configure')).not.toBeInTheDocument();
    expect(queryByTestId('grpc-stream-config-tls-panel')).not.toBeInTheDocument();
  });
});
