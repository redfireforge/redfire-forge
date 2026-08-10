import { useMemo } from 'react';
import { Viewer } from 'json-diff-kit';
import { sharedDiffer } from '../../utils/jsonDiffKit';
import 'json-diff-kit/dist/viewer.css';
import 'json-diff-kit/dist/viewer-monokai.css';
import type { AuthConfig } from '../../types';
import { parseJsonOrRaw } from '../../utils/helpers';

export interface HeadersDiffData {
  headersAdded: Array<{ key: string; value: string }>;
  headersRemoved: Array<{ key: string; value: string }>;
  headersModified: Array<{ key: string; oldValue: string; newValue: string }>;
}

const tryParse = parseJsonOrRaw;

export function HeadersDiffView({ diff }: { diff: HeadersDiffData }) {
  const hasChanges = diff.headersAdded.length > 0 || diff.headersRemoved.length > 0 || diff.headersModified.length > 0;
  if (!hasChanges) return <div className="test-def-diff-empty">No header changes</div>;

  return (
    <table className="test-def-diff-headers-table">
      <thead>
        <tr>
          <th className="test-def-diff-headers-th-status" />
          <th className="test-def-diff-headers-th">Header</th>
          <th className="test-def-diff-headers-th">Value</th>
        </tr>
      </thead>
      <tbody>
        {diff.headersAdded.map((h) => (
          <tr key={`add-${h.key}`} className="test-def-diff-headers-tr added">
            <td className="test-def-diff-headers-td-status"><span className="test-def-diff-badge added">+</span></td>
            <td className="test-def-diff-headers-td-key"><code>{h.key}</code></td>
            <td className="test-def-diff-headers-td-val"><span className="test-def-diff-new">{h.value}</span></td>
          </tr>
        ))}
        {diff.headersRemoved.map((h) => (
          <tr key={`rem-${h.key}`} className="test-def-diff-headers-tr removed">
            <td className="test-def-diff-headers-td-status"><span className="test-def-diff-badge removed">−</span></td>
            <td className="test-def-diff-headers-td-key"><code>{h.key}</code></td>
            <td className="test-def-diff-headers-td-val"><span className="test-def-diff-old">{h.value}</span></td>
          </tr>
        ))}
        {diff.headersModified.map((h) => (
          <tr key={`mod-${h.key}`} className="test-def-diff-headers-tr modified">
            <td className="test-def-diff-headers-td-status"><span className="test-def-diff-badge modified">~</span></td>
            <td className="test-def-diff-headers-td-key"><code>{h.key}</code></td>
            <td className="test-def-diff-headers-td-val">
              <span className="test-def-diff-old">{h.oldValue}</span>
              <span className="test-def-diff-arrow">→</span>
              <span className="test-def-diff-new">{h.newValue}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BodyDiffView<S extends { body: string }>({
  older,
  newer,
  diff,
}: {
  older: S;
  newer: S;
  diff: { bodyChanged: boolean };
}) {
  if (!diff.bodyChanged) return <div className="test-def-diff-empty">No body changes</div>;

  return (
    <div className="test-def-diff-section">
      <InlineDiff oldObj={tryParse(older.body)} newObj={tryParse(newer.body)} />
    </div>
  );
}

export function AuthDiffView<S extends { auth: AuthConfig }>({
  older,
  newer,
  diff,
}: {
  older: S;
  newer: S;
  diff: { authChanged: boolean };
}) {
  if (!diff.authChanged) return <div className="test-def-diff-empty">No auth changes</div>;

  return (
    <div className="test-def-diff-section">
      <InlineDiff oldObj={older.auth} newObj={newer.auth} />
    </div>
  );
}

export function InlineDiff({ oldObj, newObj }: { oldObj: unknown; newObj: unknown }) {
  const result = useMemo(() => sharedDiffer.diff(oldObj, newObj), [oldObj, newObj]);
  return (
    <div className="test-def-diff-json-viewer" data-theme="monokai">
      <Viewer diff={result} indent={2} lineNumbers highlightInlineDiff />
    </div>
  );
}

/** Reusable row for overview diffs (name/url/method/bodyType/body/formData). */
function DiffRow({ label, oldVal, newVal, block }: { label: string; oldVal: string; newVal?: string; block?: boolean }) {
  return (
    <div className="test-def-diff-row modified">
      <span className="test-def-diff-badge modified">~</span>
      <span className="test-def-diff-field">{label}</span>
      <span className={`test-def-diff-val${block ? ' test-def-diff-val-block' : ''}`}>
        {newVal !== undefined ? (
          <>
            <span className="test-def-diff-old">{oldVal}</span>
            <span className="test-def-diff-arrow">→</span>
            <span className="test-def-diff-new">{newVal}</span>
          </>
        ) : oldVal}
      </span>
    </div>
  );
}

export interface OverviewDiffData {
  nameChanged: boolean;
  urlChanged: boolean;
  methodChanged: boolean;
  bodyChanged: boolean;
  bodyTypeChanged: boolean;
  formDataChanged: boolean;
}

/** Shared overview diff for both Request and Test definition comparisons. */
export function OverviewDiffView<S extends { name: string; url: string; method: string; bodyType?: string; body: string }>({
  older,
  newer,
  diff,
}: {
  older: S;
  newer: S;
  diff: OverviewDiffData;
}) {
  const hasChanges = diff.nameChanged || diff.urlChanged || diff.methodChanged || diff.bodyChanged || diff.bodyTypeChanged || diff.formDataChanged;
  if (!hasChanges) return <div className="test-def-diff-empty">No overview changes</div>;

  return (
    <div className="test-def-diff-section">
      {diff.nameChanged && <DiffRow label="Name" oldVal={older.name} newVal={newer.name} />}
      {diff.urlChanged && <DiffRow label="URL" oldVal={older.url} newVal={newer.url} block />}
      {diff.methodChanged && <DiffRow label="Method" oldVal={older.method} newVal={newer.method} />}
      {diff.bodyTypeChanged && <DiffRow label="Body Type" oldVal={older.bodyType ?? 'none'} newVal={newer.bodyType ?? 'none'} />}
      {diff.bodyChanged && <DiffRow label="Body" oldVal="content modified" />}
      {diff.formDataChanged && <DiffRow label="Form Data" oldVal="form fields modified" />}
    </div>
  );
}
