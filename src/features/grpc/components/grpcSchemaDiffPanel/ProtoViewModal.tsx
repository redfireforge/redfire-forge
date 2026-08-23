import { useMemo, useEffect } from 'react';
import type { GrpcSchemaDiffChange } from '@shared/grpc/grpcSchemaDiffContracts';
import type { GrpcDescriptor } from '@shared/grpc/contracts';
import { schemaDiffSeverityBadgeClass } from '../../utils/grpcStudioAdvancedModel';
import { grpcSchemaDiffChangeId } from '../../utils/grpcSchemaDiffAck';
import StandardProfessionalModal from '@shared/components/StandardProfessionalModal';
import {
  SEVERITY_ORDER,
  buildChangeDrivenProtoText,
  buildProtoForEntity,
  formatChangeAction,
  isRelatedSchemaDiffPath,
} from './grpcSchemaDiffPanelUtils';

export interface ProtoViewModalProps {
  entityPath: string;
  beforeDescriptor: GrpcDescriptor | null | undefined;
  afterDescriptor: GrpcDescriptor | null | undefined;
  relatedChanges: GrpcSchemaDiffChange[];
  onClose: () => void;
}

export function ProtoViewModal({
  entityPath,
  beforeDescriptor,
  afterDescriptor,
  relatedChanges,
  onClose,
}: ProtoViewModalProps) {
  const resolvedBeforeText = buildProtoForEntity(beforeDescriptor, entityPath);
  const resolvedAfterText = buildProtoForEntity(afterDescriptor, entityPath);
  const entityChanges = useMemo(() => (
    relatedChanges
      .filter((change) => isRelatedSchemaDiffPath(entityPath, change.entityPath))
      .sort((left, right) => (
        SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
        || left.entityPath.localeCompare(right.entityPath)
      ))
  ), [relatedChanges, entityPath]);

  const summary = useMemo(() => {
    const counts = { breaking: 0, non_breaking: 0, informational: 0 };
    for (const change of entityChanges) {
      counts[change.severity] += 1;
    }
    return counts;
  }, [entityChanges]);

  const hasStructuralChange = useMemo(
    () => entityChanges.some((change) => change.changeType !== 'doc_comment_changed'),
    [entityChanges],
  );
  const shouldDeriveFromChanges = hasStructuralChange && resolvedBeforeText === resolvedAfterText;
  const derivedBeforeText = shouldDeriveFromChanges
    ? buildChangeDrivenProtoText(entityPath, entityChanges, 'before')
    : null;
  const derivedAfterText = shouldDeriveFromChanges
    ? buildChangeDrivenProtoText(entityPath, entityChanges, 'after')
    : null;
  const beforeText = derivedBeforeText ?? resolvedBeforeText;
  const afterText = derivedAfterText ?? resolvedAfterText;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <StandardProfessionalModal
      open
      title="Proto Schema Diff"
      onClose={onClose}
      dialogClassName="grpc-sdiff-proto-modal-shell"
      closeButtonKind="none"
      dragAnchor={{
        selector: '[data-testid="grpc-schema-diff-panel"]',
        hAlign: 'center',
        vAlign: 'top',
        padding: { top: 22 },
      }}
      minWidth={680}
      minHeight={420}
      bodyStyle={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div className="grpc-sdiff-proto-modal-content" data-testid="grpc-sdiff-proto-modal">
        <div className="grpc-sdiff-proto-modal__header">
          <h3 className="grpc-sdiff-proto-modal__title">
            <span className="grpc-sdiff-proto-modal__icon" aria-hidden="true">{'{ }'}</span>
            <span className="grpc-sdiff-proto-modal__path">{entityPath}</span>
          </h3>
        </div>

        <section className="grpc-sdiff-proto-impact" data-testid="grpc-sdiff-proto-impact">
          <div className="grpc-sdiff-proto-impact__title">Change impact for this entity</div>
          {shouldDeriveFromChanges && (derivedBeforeText || derivedAfterText) && (
            <p className="grpc-sdiff-proto-impact__warning" data-testid="grpc-sdiff-proto-derived-warning">
              Before/After descriptor snapshots resolved to identical text. Showing a change-focused proto view derived from the diff report for clarity.
            </p>
          )}
          <div className="grpc-sdiff-proto-impact__summary" data-testid="grpc-sdiff-proto-impact-summary">
            <span className="grpc-sdiff-proto-impact-chip grpc-sdiff-proto-impact-chip--breaking">
              Breaking: {summary.breaking}
            </span>
            <span className="grpc-sdiff-proto-impact-chip grpc-sdiff-proto-impact-chip--non-breaking">
              Non-breaking: {summary.non_breaking}
            </span>
            <span className="grpc-sdiff-proto-impact-chip grpc-sdiff-proto-impact-chip--informational">
              Informational: {summary.informational}
            </span>
          </div>
          {entityChanges.length > 0 ? (
            <ul className="grpc-sdiff-proto-impact__list" data-testid="grpc-sdiff-proto-impact-list">
              {entityChanges.map((change) => {
                const changeId = grpcSchemaDiffChangeId(change);
                return (
                  <li key={changeId} className="grpc-sdiff-proto-impact__item">
                    <span className={`grpc-advanced-diff-badge ${schemaDiffSeverityBadgeClass(change.severity)}`}>
                      {change.severity.replace(/_/g, ' ')}
                    </span>
                    <div className="grpc-sdiff-proto-impact__item-main">
                      <div className="grpc-sdiff-proto-impact__item-title">{formatChangeAction(change)}</div>
                      <div className="grpc-sdiff-proto-impact__item-detail">{change.description}</div>
                    </div>
                    <span className="grpc-sdiff-proto-impact__item-path">{change.entityPath}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="grpc-sdiff-proto-impact__empty" data-testid="grpc-sdiff-proto-impact-empty">
              No recorded changes for this entity in the current diff report.
            </p>
          )}
        </section>

        <div className="grpc-sdiff-proto-modal__body">
          <div className="grpc-sdiff-proto-pane grpc-sdiff-proto-pane--before">
            <div className="grpc-sdiff-proto-pane__label">Before (baseline)</div>
            <pre className="grpc-sdiff-proto-pane__code" data-testid="grpc-sdiff-proto-before">{beforeText}</pre>
          </div>
          <div className="grpc-sdiff-proto-pane grpc-sdiff-proto-pane--after">
            <div className="grpc-sdiff-proto-pane__label">After (current)</div>
            <pre className="grpc-sdiff-proto-pane__code" data-testid="grpc-sdiff-proto-after">{afterText}</pre>
          </div>
        </div>
        <div className="grpc-sdiff-proto-modal__close-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="grpc-sdiff-proto-modal-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </StandardProfessionalModal>
  );
}
