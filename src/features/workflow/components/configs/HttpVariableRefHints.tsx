import { useCallback, useMemo, useState } from 'react';
import { KafkaCard } from './KafkaConfigUi';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

function hintSourceLabel(hint: WorkflowVariableHint): string {
  if (hint.source?.nodeLabel) {
    const cat = hint.source.category ? ` · ${hint.source.category}` : '';
    return `${hint.source.nodeLabel}${cat}`;
  }
  return hint.label;
}

export function HttpVariableRefHints({ hints }: { hints: WorkflowVariableHint[] }) {
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const sorted = useMemo(
    () =>
      [...hints].sort((a, b) => {
        const ap = a.ref.startsWith('node:') ? 0 : 1;
        const bp = b.ref.startsWith('node:') ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.ref.localeCompare(b.ref);
      }),
    [hints],
  );

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

  if (sorted.length === 0) return null;

  return (
    <div className="wf-http-var-hints">
      <KafkaCard
        title="Variables you can paste"
        hint={
          <>
            Workflow + upstream templates for this step. Use <code>{'{{name}}'}</code> for the latest value,
            or <code>{'{{node:<step id>.name}}'}</code> when several steps share a name.
          </>
        }
      >
        <div className="wf-http-var-hints-list" role="table" aria-label="Variables you can paste">
          <div className="wf-http-var-hints-head" role="row">
            <span role="columnheader">Variable</span>
            <span role="columnheader">Source</span>
            <span role="columnheader">Type</span>
            <span aria-hidden />
          </div>
          {sorted.map((h) => {
            const template = `{{${h.ref}}}`;
            const isCopied = copiedRef === h.ref;
            return (
              <div key={h.ref} className="wf-http-var-hints-item" role="row" title={h.description || ''}>
                <div className="wf-http-var-hints-col-var" role="cell">
                  <code className="wf-http-var-hints-code">{template}</code>
                </div>
                <div className="wf-http-var-hints-col-src" role="cell" title={hintSourceLabel(h)}>
                  <span className="wf-http-var-hints-label">{hintSourceLabel(h)}</span>
                </div>
                <div className="wf-http-var-hints-col-type" role="cell">
                  {h.type ? (
                    <span className="wf-http-var-hints-type">{h.type}</span>
                  ) : (
                    <span className="wf-http-var-hints-type wf-http-var-hints-type--empty">—</span>
                  )}
                </div>
                <div className="wf-http-var-hints-col-action" role="cell">
                  <button
                    type="button"
                    className={`wf-http-var-hints-copy${isCopied ? ' is-copied' : ''}`}
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
      </KafkaCard>
    </div>
  );
}
