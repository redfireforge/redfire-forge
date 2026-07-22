import {
  DEFAULT_GRPC_COMPRESSION_CONFIG,
  formatGrpcAcceptEncodingHeader,
  normalizeGrpcCompressionConfig,
  resolveGrpcCompressionEncoding,
} from '../../../shared/grpc/grpcCompressionPolicy';
import type { GrpcCompressionAlgorithm, GrpcCompressionConfig } from '../../../shared/grpc/contracts';
import { CustomSelect } from '../../../shared/components/CustomSelect';

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
      <div className="grpc-settings-section">
        <p className="grpc-settings-intro grpc-compression-hint">
          Choose whether the client compresses request bodies and advertises supported response
          encodings for this tab.
        </p>
        <div className="grpc-settings-card">
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

            <div className="grpc-settings-form-card">
              <div className="grpc-settings-form-row">
                <div className="grpc-settings-form-row__label-col">
                  <label className="grpc-settings-form-row__label" htmlFor="grpc-compression-enabled">
                    Enable compression
                  </label>
                  <span className="grpc-settings-form-row__label-hint">
                    Sends a request encoding when the server supports it.
                  </span>
                </div>
                <div className="grpc-settings-form-row__ctrl">
                  <div className="grpc-settings-inline-ctrl grpc-compression-toggle-row">
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
                    <span className="grpc-settings-inline-hint">
                      {config.enabled ? 'Compression is active for this tab.' : 'Compression is currently off.'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grpc-settings-form-row">
                <div className="grpc-settings-form-row__label-col">
                  <label className="grpc-settings-form-row__label" htmlFor="grpc-compression-algorithm">
                    Request compression algorithm
                  </label>
                  <span className="grpc-settings-form-row__label-hint">
                    Choose the encoding sent in the grpc-encoding header.
                  </span>
                </div>
                <div className="grpc-settings-form-row__ctrl">
                  <CustomSelect
                    className="grpc-compression-select grpc-settings-select"
                    data-testid="grpc-compression-algorithm"
                    aria-label="Request compression algorithm"
                    value={config.algorithm}
                    disabled={disabled || !config.enabled}
                    onChange={(v) => {
                      patch({ algorithm: v as GrpcCompressionAlgorithm });
                    }}
                    options={(Object.keys(ALGORITHM_LABELS) as GrpcCompressionAlgorithm[]).map((algorithm) => ({
                      value: algorithm,
                      label: ALGORITHM_LABELS[algorithm],
                    }))}
                  />
                </div>
              </div>

              <div className="grpc-settings-form-row grpc-settings-form-row--stacked">
                <div className="grpc-settings-form-row__label-col">
                  <span className="grpc-settings-form-row__label">Effective headers</span>
                  <span className="grpc-settings-form-row__label-hint">
                    Preview of what this tab will send and accept.
                  </span>
                </div>
                <div className="grpc-settings-form-row__ctrl" data-testid="grpc-compression-preview">
                  {encoding ? (
                    <code className="grpc-settings-code-block grpc-compression-preview-block">
                      {`grpc-encoding: ${encoding}\ngrpc-accept-encoding: ${acceptEncoding}`}
                    </code>
                  ) : (
                    <code className="grpc-settings-code-block grpc-call-settings-preview-value">Compression disabled — no grpc-encoding header</code>
                  )}
                </div>
              </div>
            </div>

            <p className="grpc-settings-note grpc-settings-note--warning grpc-compression-warning" data-testid="grpc-compression-warning">
              If the server does not support the requested algorithm it will return status UNIMPLEMENTED.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
