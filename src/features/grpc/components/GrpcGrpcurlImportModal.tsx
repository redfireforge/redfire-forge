import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseGrpcurlCommand } from '../utils/grpcGrpcurl';
import type { GrpcGrpcurlImportSuccess } from '../utils/grpcGrpcurlTypes';
import { serializeGrpcPreviewJson } from '@shared/grpc/grpcSafePreview';
import { useModalDrag } from '@shared/hooks/useModalDrag';

export interface GrpcGrpcurlImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (result: GrpcGrpcurlImportSuccess) => void;
}

export function GrpcGrpcurlImportModal({ open, onClose, onImport }: GrpcGrpcurlImportModalProps) {
  const [command, setCommand] = useState('');
  const [parseError, setParseError] = useState<string | undefined>();
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { onDragStart, modalStyle } = useModalDrag(open, { modalRef, constrainToViewport: true });

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (!open) return;
    setCommand('');
    setParseError(undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    syncTextareaHeight();
  }, [command, open, syncTextareaHeight]);

  const parsed = useMemo(() => {
    if (!command.trim()) return undefined;
    const result = parseGrpcurlCommand(command);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return { ok: true as const, value: result };
  }, [command]);

  useEffect(() => {
    if (parsed && !parsed.ok) {
      setParseError(parsed.error);
    } else {
      setParseError(undefined);
    }
  }, [parsed]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const preview = parsed?.ok
    ? serializeGrpcPreviewJson({
        target: parsed.value.targetAddress,
        service: parsed.value.serviceFullName,
        method: parsed.value.methodName,
        tlsMode: parsed.value.tlsMode,
        metadata: parsed.value.metadata,
        body: parsed.value.body,
      })
    : '';

  const warnings = parsed?.ok ? parsed.value.warnings : [];

  return (
    <div className="grpc-import-grpcurl-modal" data-testid="grpc-import-grpcurl-modal" role="dialog" aria-label="Import grpcurl command" ref={modalRef} style={modalStyle}>
      <header className="grpc-import-grpcurl-modal__header" onMouseDown={onDragStart}>
        <h2 className="grpc-import-grpcurl-modal__title">Import grpcurl command</h2>
      </header>
      <div className="grpc-import-grpcurl-modal__body">
        <label className="grpc-form-row grpc-form-row--stacked">
          <span className="grpc-form-row__label">Command</span>
          <textarea
            ref={textareaRef}
            className="grpc-import-grpcurl-modal__textarea"
            data-testid="grpc-import-grpcurl-textarea"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            rows={5}
            spellCheck={false}
            placeholder="grpcurl -plaintext localhost:50051 echo.EchoService/Echo"
          />
        </label>
        {parseError && (
          <p className="grpc-import-grpcurl-modal__error" role="alert">{parseError}</p>
        )}
        {parsed?.ok && (
          <>
            <div className="grpc-form-row grpc-form-row--stacked grpc-import-grpcurl-modal__preview-section">
              <span className="grpc-form-row__label">Parsed preview</span>
              <pre className="grpc-import-grpcurl-modal__preview" data-testid="grpc-import-grpcurl-preview">{preview}</pre>
            </div>
            {warnings.length > 0 && (
              <ul className="grpc-import-grpcurl-modal__warnings" data-testid="grpc-import-grpcurl-warnings">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <footer className="grpc-import-grpcurl-modal__footer">
        <button type="button" className="grpc-btn grpc-btn--ghost" data-testid="grpc-import-grpcurl-cancel" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="grpc-btn grpc-btn--primary"
          data-testid="grpc-import-grpcurl-submit"
          disabled={!parsed?.ok}
          onClick={() => {
            if (parsed?.ok) {
              onImport(parsed.value);
              onClose();
            }
          }}
        >
          Import to Studio
        </button>
      </footer>
    </div>
  );
}
