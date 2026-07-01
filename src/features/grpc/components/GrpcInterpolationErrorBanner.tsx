import type { GrpcInterpolationDiagnosticPayload } from '../../../shared/grpc/grpcInterpolationDiagnostics';
import { GRPC_INTERPOLATION_ERROR_CODES } from '../../../shared/grpc/grpcInterpolationConstants';

export interface GrpcInterpolationErrorBannerProps {
  diagnostic: GrpcInterpolationDiagnosticPayload;
}

function bannerTitleForCode(code: string): string {
  switch (code) {
    case GRPC_INTERPOLATION_ERROR_CODES.CYCLE:
      return 'Environment variable cycle detected';
    case GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN:
      return 'Unresolved environment variable';
    case GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX:
      return 'Invalid interpolation syntax';
    default:
      return 'Interpolation error';
  }
}

export function GrpcInterpolationErrorBanner({
  diagnostic,
}: GrpcInterpolationErrorBannerProps) {
  return (
    <div
      className="grpc-interpolation-error-banner"
      data-testid="grpc-interpolation-error-banner"
      data-code={diagnostic.code}
      role="alert"
    >
      <p className="grpc-interpolation-error-banner__title">
        {bannerTitleForCode(diagnostic.code)}
      </p>
      <p
        className="grpc-interpolation-error-banner__message"
        data-testid="grpc-interpolation-error-message"
      >
        {diagnostic.message}
      </p>
      {diagnostic.tokenPath && diagnostic.tokenPath.length > 0 && (
        <div
          className="grpc-interpolation-error-banner__path"
          data-testid="grpc-interpolation-error-token-path"
          aria-label="Variable cycle path"
        >
          {diagnostic.tokenPath.map((token, index) => (
            <span key={`${token}-${index}`} className="grpc-interpolation-error-banner__token">
              {token}
              {index < diagnostic.tokenPath!.length - 1 && (
                <span className="grpc-interpolation-error-banner__arrow" aria-hidden="true">
                  →
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
