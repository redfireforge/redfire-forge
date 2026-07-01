import {
  DEFAULT_GRPC_COMPRESSION_CONFIG,
  formatGrpcAcceptEncodingHeader,
  normalizeGrpcCompressionConfig,
  resolveGrpcCompressionEncoding,
} from '../../../shared/grpc/grpcCompressionPolicy';
import type { GrpcCompressionAlgorithm, GrpcCompressionConfig } from '../../../shared/grpc/contracts';

const ALGORITHM_LABELS: Record<GrpcCompressionAlgorithm, string> = {
  identity: 'identity (none)',
  gzip: 'gzip',
  deflate: 'deflate',
};

export interface GrpcCompressionPanelProps {
  compression: GrpcCompressionConfig | undefined;
  disabled?: boolean;
  onChange: (compression: GrpcCompressionConfig) => void;
}

export function GrpcCompressionPanel({
  compression,
  disabled = false,
  onChange,
}: GrpcCompressionPanelProps) {
  const config = normalizeGrpcCompressionConfig(compression) ?? DEFAULT_GRPC_COMPRESSION_CONFIG;
  const encoding = resolveGrpcCompressionEncoding(config);
  const acceptEncoding = formatGrpcAcceptEncodingHeader(config);

  const patch = (partial: Partial<GrpcCompressionConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="grpc-compression-panel" data-testid="grpc-compression-panel">
      <div className="grpc-settings-card">
        <div className="grpc-settings-card-header">
          <h3 className="grpc-settings-card-title">Compression</h3>
        </div>
        <div className="grpc-settings-card-body">
          <p className="grpc-compression-hint">
            Per-call gRPC compression is negotiated via
            {' '}
            <code className="grpc-inline-code">grpc-encoding</code>
            {' '}
            request header and
            {' '}
            <code className="grpc-inline-code">grpc-accept-encoding</code>
            {' '}
            response header.
          </p>

          <div className="grpc-tls-form-row">
            <label className="grpc-tls-form-label" htmlFor="grpc-compression-algorithm">
              Request compression algorithm
            </label>
            <div className="grpc-tls-form-ctrl">
              <select
                id="grpc-compression-algorithm"
                className="grpc-compression-select"
                data-testid="grpc-compression-algorithm"
                value={config.algorithm}
                disabled={disabled || !config.enabled}
                onChange={(event) => {
                  patch({ algorithm: event.target.value as GrpcCompressionAlgorithm });
                }}
              >
                {(Object.keys(ALGORITHM_LABELS) as GrpcCompressionAlgorithm[]).map((algorithm) => (
                  <option key={algorithm} value={algorithm}>
                    {ALGORITHM_LABELS[algorithm]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grpc-compression-toggle-row">
            <label className="grpc-compression-toggle-label" htmlFor="grpc-compression-enabled">
              Enable compression
            </label>
            <button
              id="grpc-compression-enabled"
              type="button"
              role="switch"
              aria-checked={config.enabled}
              className={`grpc-compression-toggle${config.enabled ? ' grpc-compression-toggle--on' : ''}`}
              data-testid="grpc-compression-enabled"
              disabled={disabled}
              onClick={() => patch({ enabled: !config.enabled })}
            >
              <span className="grpc-compression-toggle-thumb" aria-hidden="true" />
            </button>
          </div>

          <div className="grpc-call-settings-preview" data-testid="grpc-compression-preview">
            <span className="grpc-call-settings-preview-label">Effective headers</span>
            {encoding ? (
              <code className="grpc-compression-preview-block">
                grpc-encoding: {encoding}
                {'\n'}
                server responds with:
                {'\n'}
                grpc-accept-encoding: {acceptEncoding}
              </code>
            ) : (
              <code className="grpc-call-settings-preview-value">Compression disabled — no grpc-encoding header</code>
            )}
          </div>

          <p className="grpc-compression-warning" data-testid="grpc-compression-warning">
            If the server does not support the requested algorithm it will return status UNIMPLEMENTED.
          </p>
        </div>
      </div>
    </div>
  );
}
