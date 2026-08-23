import { useCallback, useState, useEffect } from 'react';
import { prettyJson, isValidJson } from '@shared/utils/helpers';
import WorkflowResponseBody from '../panels/WorkflowResponseBody';
import WorkflowQuickTestFailurePanel from '../panels/WorkflowQuickTestFailurePanel';
import WorkflowEditorModalFrame from './WorkflowEditorModalFrame';
import type { QuickTestFailureReport } from '../../utils/workflowRunErrors';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Step result: read-only body */
  body?: string;
  /** Structured Quick Test failure (replaces plain-text body + search UI). */
  failureReport?: QuickTestFailureReport;
  /** Variable: editable */
  variableMode?: boolean;
  variableValue?: string;
  onVariableChange?: (v: string) => void;
  onApplyVariable?: () => void;
  onClose: () => void;
}

export default function WorkflowDetailModal({
  open,
  title,
  subtitle,
  body,
  failureReport,
  variableMode,
  variableValue,
  onVariableChange,
  onApplyVariable,
  onClose,
}: Props) {
  const isFailureReport = !!failureReport;
  const isCompactChrome = isFailureReport || !!variableMode;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(body ?? '');
    } catch {
      /* ignore */
    }
  }, [body]);

  const [pretty, setPretty] = useState(false);

  useEffect(() => { setPretty(false); }, [open]);

  const prettyValue = (() => {
    if (!pretty || !variableMode) return null;
    const raw = (variableValue ?? '').trim();
    if (!raw) return null;
    return isValidJson(raw) ? prettyJson(raw) : null;
  })();

  const isJson = (() => {
    const raw = (variableValue ?? '').trim();
    return raw.length > 0 && isValidJson(raw);
  })();

  const footer = isFailureReport ? (
    <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
      Close
    </button>
  ) : variableMode ? (
    <>
      <button type="button" className="btn btn-sm btn-accent" onClick={onApplyVariable}>
        Apply
      </button>
      <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
        Close
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn btn-sm" onClick={copy}>
        Copy
      </button>
      <div style={{ flex: 1 }} />
      <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
        Close
      </button>
    </>
  );

  return (
    <WorkflowEditorModalFrame
      open={open}
      title={<span id="wf-detail-title">{title}</span>}
      titleId="wf-detail-title"
      onClose={onClose}
      overlayClassName="wf-detail-modal-overlay"
      dialogClassName={
        isCompactChrome
          ? 'wf-detail-modal wf-detail-modal--compact modal-no-chrome'
          : 'wf-detail-modal wf-detail-modal--wide'
      }
      bodyClassName="ram-body wf-detail-modal-body"
      bodyScrollable={false}
      expandMode={isCompactChrome ? undefined : 'fullscreen'}
      hideExpandButton={isCompactChrome}
      hideCloseButton
      footerClassName={`ram-footer wf-detail-modal-footer${isCompactChrome ? ' wf-detail-modal-footer--end' : ''}`}
      footer={footer}
    >
      {variableMode ? (
        <>
          {subtitle && <p className="wf-detail-modal-sub">{subtitle}</p>}
          {isJson && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                type="button"
                className={`btn btn-sm${pretty ? ' btn-accent' : ''}`}
                onClick={() => setPretty(p => !p)}
                title={pretty ? 'Show raw value' : 'Format JSON with indentation'}
              >
                {pretty ? 'Raw' : 'Pretty Format'}
              </button>
            </div>
          )}
          {pretty && prettyValue != null ? (
            <pre className="wf-detail-modal-pretty">{prettyValue}</pre>
          ) : (
            <textarea
              className="wf-detail-modal-textarea"
              value={variableValue ?? ''}
              onChange={(e) => onVariableChange?.(e.target.value)}
              spellCheck={false}
              rows={8}
            />
          )}
        </>
      ) : failureReport ? (
        <WorkflowQuickTestFailurePanel report={failureReport} />
      ) : (
        <WorkflowResponseBody body={body ?? ''} subtitle={subtitle} />
      )}
    </WorkflowEditorModalFrame>
  );
}
