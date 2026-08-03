import type { ReactNode } from 'react';

export function KafkaCard({
  title,
  hint,
  action,
  children,
  testId,
  /** When true, hint wraps on its own line under the title (for long descriptions). */
  hintBelow = false,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
  hintBelow?: boolean;
}) {
  return (
    <section className="wf-kafka-card" data-testid={testId}>
      <header className={`wf-kafka-card-header${hint && hintBelow ? ' wf-kafka-card-header--hint-below' : ''}`}>
        {hintBelow ? (
          <div className="wf-kafka-card-header-main">
            <h4 className="wf-kafka-card-title">
              <span className="wf-kafka-card-title-text">{title}</span>
            </h4>
            {hint ? <p className="wf-kafka-card-hint">{hint}</p> : null}
          </div>
        ) : (
          <h4 className="wf-kafka-card-title">
            <span className="wf-kafka-card-title-text">{title}</span>
            {hint ? <span className="wf-kafka-card-hint">{hint}</span> : null}
          </h4>
        )}
        {action ? <div className="wf-kafka-card-action">{action}</div> : null}
      </header>
      <div className="wf-kafka-card-body">{children}</div>
    </section>
  );
}

export function KafkaAddButton({
  onClick,
  label = '+ Add',
  testId,
}: {
  onClick: () => void;
  label?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className="wf-kafka-add-btn"
      onClick={onClick}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

export function KafkaFormRow({
  label,
  hint,
  tall,
  /** One-line grid: label | control | hint — controls share a vertical axis. */
  compact,
  children,
}: {
  label: string;
  hint?: ReactNode;
  tall?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  const rowClass = [
    'wf-kafka-form-row',
    tall ? 'wf-kafka-form-row--tall' : '',
    compact ? 'wf-kafka-form-row--compact' : '',
  ].filter(Boolean).join(' ');

  if (compact) {
    return (
      <div className={rowClass}>
        <div className="wf-kafka-form-label">{label}</div>
        <div className="wf-kafka-form-control-slot">{children}</div>
        <div className="wf-kafka-form-hint-slot">
          {hint ? <div className="wf-kafka-form-hint">{hint}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={rowClass}>
      <div className="wf-kafka-form-label">{label}</div>
      <div className={`wf-kafka-form-ctrl${hint ? '' : ' wf-kafka-form-ctrl--inline'}`}>
        {children}
        {hint ? <div className="wf-kafka-form-hint-sub">{hint}</div> : null}
      </div>
    </div>
  );
}

export function KafkaEmptyState({
  title,
  text,
  actionLabel,
  onAction,
}: {
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`wf-kafka-empty${title ? '' : ' wf-kafka-empty--compact'}`}>
      {title ? <p className="wf-kafka-empty-title">{title}</p> : null}
      <p className="wf-kafka-empty-text">{text}</p>
      {actionLabel && onAction ? (
        <button type="button" className="wf-section-add-btn" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
