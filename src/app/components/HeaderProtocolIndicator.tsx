import type { HeaderProtocolIndicatorState } from '../utils/headerProtocolUtils';

export interface HeaderProtocolIndicatorProps {
  state: HeaderProtocolIndicatorState;
}

export default function HeaderProtocolIndicator({ state }: HeaderProtocolIndicatorProps) {
  const displayUrl = state.resolvedUrl || 'Not resolved';
  const tooltip = `${state.tooltipTitle}\n${state.tooltipDetail}`;

  return (
    <div
      className={`header-proto-badge header-proto-badge--${state.status}`}
      data-testid="header-protocol-indicator"
      data-protocol={state.protocol}
      data-status={state.status}
      title={tooltip}
      tabIndex={0}
      role="status"
      aria-label={`${state.protocolLabel} endpoint: ${displayUrl}. ${state.tooltipDetail.replace(/\n/g, ' ')}`}
    >
      <span className={`header-proto-dot header-proto-dot--${state.cssKey}`} aria-hidden="true" />
      <span className="header-proto-url">{displayUrl}</span>
      <span className={`header-proto-status header-proto-status--${state.status}`} aria-hidden="true">
        {state.statusSymbol}
      </span>
    </div>
  );
}
