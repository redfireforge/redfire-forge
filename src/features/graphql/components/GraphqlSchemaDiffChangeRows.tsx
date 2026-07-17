import { useState } from 'react';
import type { GraphqlSchemaDiffChange } from '../../../shared/types/graphql';
import { SEVERITY_CSS, SEVERITY_LABEL, ackSectionChangeRowNoop } from '../utils/graphqlSchemaDiffConstants';

interface ChangeRowProps {
  change: GraphqlSchemaDiffChange;
  canAcknowledge: boolean;
  isAckExpanded: boolean;
  ackNote: string;
  onToggleAck: () => void;
  onAckNoteChange: (note: string) => void;
  onAckSubmit: () => void;
  onUnacknowledge?: () => void;
}

export function ChangeRow({
  change, canAcknowledge, isAckExpanded, ackNote,
  onToggleAck, onAckNoteChange, onAckSubmit, onUnacknowledge,
}: ChangeRowProps) {
  return (
    <div
      className={`gql-diff-row${change.acknowledged ? ' gql-diff-row--acked' : ''}`}
      data-testid="gql-diff-row"
    >
      <div className="gql-diff-row-main">
        <span className={`gql-diff-badge ${SEVERITY_CSS[change.criticality]}`}>
          {SEVERITY_LABEL[change.criticality]}
        </span>
        <span className="gql-diff-row-path" title={change.path}>{change.path}</span>
        <span className="gql-diff-row-desc">{change.description}</span>
        {canAcknowledge && !change.acknowledged && (
          <button
            type="button"
            className="gql-diff-ack-btn"
            onClick={onToggleAck}
            title="Mark as intentional (acknowledge this breaking change)"
            data-testid="gql-diff-ack-btn"
          >
            {isAckExpanded ? 'Cancel' : 'Acknowledge'}
          </button>
        )}
        {change.acknowledged && onUnacknowledge && (
          <button
            type="button"
            className="gql-diff-unack-btn"
            onClick={onUnacknowledge}
            title="Remove acknowledgement"
            data-testid="gql-diff-unack-btn"
          >
            ✓ Undo
          </button>
        )}
      </div>
      {isAckExpanded && (
        <div className="gql-diff-ack-form">
          <input
            type="text"
            className="gql-diff-ack-note"
            placeholder="Optional note: why is this change intentional?"
            value={ackNote}
            onChange={(e) => onAckNoteChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onAckSubmit(); }}
            autoFocus
            data-testid="gql-diff-ack-note"
          />
          <button
            type="button"
            className="gql-diff-ack-confirm"
            onClick={onAckSubmit}
            data-testid="gql-diff-ack-confirm"
          >
            Confirm
          </button>
        </div>
      )}
      {change.acknowledged && change.acknowledgeNote && (
        <div className="gql-diff-ack-note-display">
          Note: {change.acknowledgeNote}
        </div>
      )}
    </div>
  );
}

export function AcknowledgedSection({
  changes,
  onUnacknowledge,
}: {
  changes: GraphqlSchemaDiffChange[];
  onUnacknowledge?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="gql-diff-acked-section" data-testid="gql-diff-acked-section">
      <button
        type="button"
        className="gql-diff-acked-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? '▼' : '▶'} Acknowledged ({changes.length})
      </button>
      {expanded && changes.map((change) => (
        <ChangeRow
          key={change.criticality + ':' + change.path}
          change={change}
          canAcknowledge={false}
          isAckExpanded={false}
          ackNote=""
          onToggleAck={ackSectionChangeRowNoop}
          onAckNoteChange={ackSectionChangeRowNoop}
          onAckSubmit={ackSectionChangeRowNoop}
          onUnacknowledge={onUnacknowledge ? () => onUnacknowledge(change.path) : undefined}
        />
      ))}
    </div>
  );
}
