import { useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { matchPath } from '../../../shared/api-mock/pathMatcher';
import type { ApiMockPathMatcherV1, ApiMockPathMatcherKind } from '../../../shared/api-mock/contracts';

interface Props {
  initial: ApiMockPathMatcherV1;
  onApply: (matcher: ApiMockPathMatcherV1) => void;
  onClose: () => void;
}

const KIND_OPTIONS: Array<{ value: ApiMockPathMatcherKind; label: string }> = [
  { value: 'exact', label: 'Exact' },
  { value: 'parameterized', label: 'Parameterized (:id / {id})' },
  { value: 'glob', label: 'Glob (* ** ?)' },
  { value: 'regex', label: 'Regex' },
];

const PRESETS: Array<{ kind: ApiMockPathMatcherKind; value: string; sample: string; label: string }> = [
  { kind: 'parameterized', value: '/users/:id', sample: '/users/42', label: '/users/:id' },
  { kind: 'parameterized', value: '/orders/{orderId}/items/{itemId}', sample: '/orders/7/items/3', label: 'nested params' },
  { kind: 'glob', value: '/api/**', sample: '/api/v1/users', label: '/api/** (any depth)' },
  { kind: 'glob', value: '/assets/*.png', sample: '/assets/logo.png', label: '/assets/*.png' },
  { kind: 'regex', value: '^/v[0-9]+/.*$', sample: '/v2/users', label: '^/v[0-9]+/.*$' },
];

export function ApiMockPatternToolboxModal({ initial, onApply, onClose }: Props) {
  const [kind, setKind] = useState<ApiMockPathMatcherKind>(initial.kind);
  const [value, setValue] = useState(initial.value);
  const [caseInsensitive, setCaseInsensitive] = useState(initial.flags?.caseInsensitive ?? false);
  const [sample, setSample] = useState(initial.value.replace(/[:{][^/}]+\}?/g, '123'));

  const matcher: ApiMockPathMatcherV1 = { kind, value, flags: caseInsensitive ? { caseInsensitive: true } : undefined };
  let result: { matched: boolean; params: Record<string, string> } = { matched: false, params: {} };
  try { result = matchPath(matcher, sample || '/'); } catch { /* invalid pattern */ }
  const paramEntries = Object.entries(result.params);

  return (
    <AppModalFrame
      title="Pattern toolbox"
      onClose={onClose}
      footer={
        <div className="api-mock-root am-in-modal" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="am-btn" onClick={onClose} data-testid="api-mock-toolbox-cancel">Cancel</button>
          <button className="am-btn primary" onClick={() => { onApply(matcher); onClose(); }} data-testid="api-mock-toolbox-apply">Apply pattern</button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal" style={{ minWidth: 520 }}>
        <div className="am-form-grid">
          <div className="am-form-row">
            <div className="am-form-label">Kind</div>
            <div className="am-form-control">
              <CustomSelect value={kind} onChange={v => setKind(v as ApiMockPathMatcherKind)} options={KIND_OPTIONS} className="am-cs" aria-label="Pattern kind" data-testid="api-mock-toolbox-kind" />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Pattern</div>
            <div className="am-form-control">
              <input className="am-input wide mono" value={value} onChange={e => setValue(e.target.value)} data-testid="api-mock-toolbox-pattern" />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Case-insensitive</div>
            <div className="am-form-control">
              <button
                className={`am-toggle${caseInsensitive ? ' on' : ''}`}
                role="switch"
                aria-checked={caseInsensitive}
                aria-label="Case-insensitive matching"
                onClick={() => setCaseInsensitive(v => !v)}
                data-testid="api-mock-toolbox-ci"
              />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Test path</div>
            <div className="am-form-control">
              <input className="am-input wide mono" value={sample} onChange={e => setSample(e.target.value)} placeholder="/users/42" data-testid="api-mock-toolbox-sample" />
            </div>
          </div>
        </div>

        <div className="am-section-heading">Live result</div>
        <div className={`am-notice ${result.matched ? '' : 'danger'}`} data-testid="api-mock-toolbox-result">
          <span>
            {result.matched ? '✓ Matches' : '✕ Does not match'}
            {paramEntries.length > 0 && <> · {paramEntries.map(([k, v]) => `${k}=${v}`).join(', ')}</>}
          </span>
        </div>

        <div className="am-section-heading">Presets</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              className="am-chip"
              onClick={() => { setKind(p.kind); setValue(p.value); setSample(p.sample); }}
              data-testid={`api-mock-toolbox-preset-${p.label}`}
            >{p.label}</button>
          ))}
        </div>
      </div>
    </AppModalFrame>
  );
}
