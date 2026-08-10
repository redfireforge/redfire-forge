import { useCallback, useState } from 'react';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import { KafkaCard } from './KafkaConfigUi';

interface Props {
  hints: WorkflowVariableHint[];
}

function sourceLabel(hint: WorkflowVariableHint): string {
  if (hint.source?.nodeLabel) {
    const cat = hint.source.category ? ` · ${hint.source.category}` : '';
    return `${hint.source.nodeLabel}${cat}`;
  }
  return hint.label;
}

/**
 * Input tab for WorkflowNodeConfigModal — shows resolved variables
 * available to the step at execution time.
 */
export default function NodeConfigInputTab({ hints }: Props) {
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const copyRef = useCallback(async (ref: string) => {
    const snippet = `{{${ref}}}`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedRef(ref);
      window.setTimeout(() => setCopiedRef((cur) => (cur === ref ? null : cur)), 1200);
    } catch {
      /* clipboard may be unavailable in some test / restricted contexts */
    }
  }, []);

  return (
    <div className="wf-config-tab-content wf-node-input-tab">
      <KafkaCard
        title="Available variables"
        hint={
          hints.length > 0
            ? `${hints.length} resolved for this step at run time. Click a template to copy.`
            : 'Resolved for this step at run time.'
        }
      >
        {hints.length > 0 ? (
          <div className="wf-node-input-list" role="table" aria-label="Available variables">
            <div className="wf-node-input-list-head" role="row">
              <span className="wf-node-input-col-var" role="columnheader">Variable</span>
              <span className="wf-node-input-col-src" role="columnheader">Source</span>
              <span className="wf-node-input-col-meta" role="columnheader">Type</span>
              <span className="wf-node-input-col-action" aria-hidden />
            </div>
            {hints.map((h) => {
              const template = `{{${h.ref}}}`;
              const isCopied = copiedRef === h.ref;
              return (
                <div key={h.ref} className="wf-node-input-row" role="row">
                  <div className="wf-node-input-col-var" role="cell">
                    <code className="wf-node-input-ref" title={h.description || template}>
                      {template}
                    </code>
                  </div>
                  <div className="wf-node-input-col-src" role="cell" title={sourceLabel(h)}>
                    <span className="wf-node-input-source">{sourceLabel(h)}</span>
                  </div>
                  <div className="wf-node-input-col-meta" role="cell">
                    {h.type ? (
                      <span className="wf-node-input-type">{h.type}</span>
                    ) : (
                      <span className="wf-node-input-type wf-node-input-type--empty">—</span>
                    )}
                  </div>
                  <div className="wf-node-input-col-action" role="cell">
                    <button
                      type="button"
                      className={`wf-node-input-copy${isCopied ? ' is-copied' : ''}`}
                      onClick={() => void copyRef(h.ref)}
                      title={isCopied ? 'Copied' : `Copy ${template}`}
                      aria-label={isCopied ? `Copied ${template}` : `Copy ${template}`}
                    >
                      {isCopied ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="wf-node-input-empty">
            <p className="wf-node-input-empty-title">No variables yet</p>
            <p className="wf-node-input-empty-text">
              Add workflow defaults, trigger inputs, or upstream extracts — they will appear here for this step.
            </p>
          </div>
        )}
      </KafkaCard>
    </div>
  );
}
