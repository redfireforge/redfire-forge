import { useCallback, useState } from 'react';

export interface GrpcJsonCodeToolbarProps {
  label?: string;
  copyText: string;
  onPrettyFormat?: () => void;
  prettyDisabled?: boolean;
  copyDisabled?: boolean;
  testIdPrefix?: string;
}

export function GrpcJsonCodeToolbar({
  label = 'JSON',
  copyText,
  onPrettyFormat,
  prettyDisabled = false,
  copyDisabled = false,
  testIdPrefix = 'grpc-json',
}: GrpcJsonCodeToolbarProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = useCallback(async () => {
    if (copyDisabled || !copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      setCopyStatus('failed');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    }
  }, [copyDisabled, copyText]);

  const copyLabel = copyStatus === 'copied'
    ? 'Copied'
    : copyStatus === 'failed'
      ? 'Copy failed'
      : 'Copy';

  return (
    <div className="grpc-json-code-toolbar" data-testid={`${testIdPrefix}-toolbar`}>
      <span className="grpc-json-code-toolbar__label">{label}</span>
      <span className="grpc-json-code-toolbar__spacer" />
      {onPrettyFormat && (
        <button
          type="button"
          className="grpc-json-code-toolbar__btn"
          data-testid={`${testIdPrefix}-pretty-btn`}
          disabled={prettyDisabled}
          onClick={onPrettyFormat}
          title="Pretty format JSON"
        >
          Pretty Format
        </button>
      )}
      <button
        type="button"
        className="grpc-json-code-toolbar__btn"
        data-testid={`${testIdPrefix}-copy-btn`}
        disabled={copyDisabled || !copyText}
        onClick={() => { void handleCopy(); }}
        title="Copy to clipboard"
      >
        {copyLabel}
      </button>
    </div>
  );
}
