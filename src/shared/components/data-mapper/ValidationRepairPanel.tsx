import type { ValidationSeverity } from './types';

export type MapperRepairIssueKind =
  | 'missing-target'
  | 'duplicate-target'
  | 'type-mismatch'
  | 'unresolved-path';

export interface MapperRepairIssue {
  id: string;
  kind: MapperRepairIssueKind;
  severity: ValidationSeverity;
  message: string;
  mappingId: string;
  sourceId: string;
  sourcePath: string;
  targetPath: string;
  suggestedFixExpression?: string;
}

interface ValidationRepairPanelProps {
  issues: MapperRepairIssue[];
  onFix: (issue: MapperRepairIssue) => void;
  onReplace: (issue: MapperRepairIssue) => void;
  onIgnoreOnce: (issue: MapperRepairIssue) => void;
  onOpenNode: (issue: MapperRepairIssue) => void;
}

function issueLabel(kind: MapperRepairIssueKind): string {
  switch (kind) {
    case 'missing-target':
      return 'Missing target';
    case 'duplicate-target':
      return 'Duplicate target';
    case 'type-mismatch':
      return 'Type mismatch';
    case 'unresolved-path':
      return 'Unresolved path';
    default:
      return 'Issue';
  }
}

function issueIcon(severity: ValidationSeverity): string {
  if (severity === 'error') return '✕';
  if (severity === 'warning') return '⚠';
  return 'ℹ';
}

export default function ValidationRepairPanel({
  issues,
  onFix,
  onReplace,
  onIgnoreOnce,
  onOpenNode,
}: ValidationRepairPanelProps) {
  if (issues.length === 0) return null;

  return (
    <div className="dm-validation-repair-panel" role="region" aria-label="Validation and repair panel">
      <div className="dm-validation-repair-head">
        <span className="dm-validation-repair-title">Validation &amp; Repair</span>
        <span className="dm-validation-repair-count">
          {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="dm-validation-repair-rows">
        {issues.slice(0, 12).map((issue) => (
          <div
            key={issue.id}
            className={`dm-validation-repair-row dm-validation-repair-row--${issue.severity}`}
            data-issue-kind={issue.kind}
          >
            <div className="dm-validation-repair-main">
              <span className="dm-validation-repair-icon">{issueIcon(issue.severity)}</span>
              <span className="dm-validation-repair-kind">{issueLabel(issue.kind)}</span>
              <span className="dm-validation-repair-message">{issue.message}</span>
              <span className="dm-validation-repair-path" title={issue.targetPath}>
                {issue.targetPath}
              </span>
            </div>

            <div className="dm-validation-repair-actions">
              <button
                type="button"
                className="dm-validation-repair-btn"
                onClick={() => onFix(issue)}
                disabled={!issue.suggestedFixExpression}
                title={issue.suggestedFixExpression ? 'Apply suggested fix' : 'No automatic fix available'}
              >
                Fix
              </button>
              <button
                type="button"
                className="dm-validation-repair-btn"
                onClick={() => onReplace(issue)}
                title="Replace mapping with selected source/target"
              >
                Replace
              </button>
              <button
                type="button"
                className="dm-validation-repair-btn"
                onClick={() => onIgnoreOnce(issue)}
                title="Hide this issue until mappings change"
              >
                Ignore once
              </button>
              <button
                type="button"
                className="dm-validation-repair-btn dm-validation-repair-btn--primary"
                onClick={() => onOpenNode(issue)}
                title="Focus this mapping in the tree"
              >
                Open node
              </button>
            </div>
          </div>
        ))}
      </div>

      {issues.length > 12 && (
        <div className="dm-validation-repair-more">
          +{issues.length - 12} more issue{issues.length - 12 !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
