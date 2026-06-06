import {
  DIAGNOSTIC_LABELS,
  formatDiagnosticHint,
  type KafkaDiagnosticBannerData,
} from './kafkaSettingsUtils';

interface KafkaDiagnosticBannerProps {
  detail: KafkaDiagnosticBannerData;
  testId?: string;
}

export default function KafkaDiagnosticBanner({ detail, testId }: KafkaDiagnosticBannerProps) {
  return (
    <div className={`kafka-diagnostic-banner kind-${detail.kind}`} data-testid={testId}>
      <div className="kafka-diagnostic-title-row">
        <strong>{DIAGNOSTIC_LABELS[detail.kind]}</strong>
        <span className="kafka-diagnostic-code">{detail.code}</span>
      </div>
      <div className="kafka-diagnostic-message">{detail.message}</div>
      <div className="kafka-diagnostic-hint">{formatDiagnosticHint(detail.kind, detail.retryable)}</div>
    </div>
  );
}
