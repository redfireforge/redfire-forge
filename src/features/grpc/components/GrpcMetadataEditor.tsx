import { useEffect, useMemo, useState } from 'react';
import type { WsKeyValueEntry } from '../../../shared/websocket/types';
import { KeyValueEditor } from '../../websocket/KeyValueEditor';
import {
  metadataEntriesFromRecord,
  metadataRecordFromEntries,
  validateGrpcMetadataEntries,
} from '../utils/grpcMetadataEditor';

export interface GrpcMetadataEditorProps {
  metadata: Record<string, string>;
  onChange: (metadata: Record<string, string>) => void;
  onValidationChange?: (valid: boolean) => void;
  disabled?: boolean;
}

function metadataRecordsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function GrpcMetadataEditor({
  metadata,
  onChange,
  onValidationChange,
  disabled = false,
}: GrpcMetadataEditorProps) {
  const [entries, setEntries] = useState<WsKeyValueEntry[]>(
    () => metadataEntriesFromRecord(metadata),
  );

  useEffect(() => {
    setEntries((current) => {
      const fromLocal = metadataRecordFromEntries(current);
      if (metadataRecordsEqual(fromLocal, metadata)) {
        return current;
      }
      return metadataEntriesFromRecord(metadata);
    });
  }, [metadata]);

  const validation = useMemo(() => validateGrpcMetadataEntries(entries), [entries]);

  useEffect(() => {
    onValidationChange?.(validation.valid);
  }, [onValidationChange, validation.valid]);

  const handleChange = (nextEntries: WsKeyValueEntry[]) => {
    setEntries(nextEntries);
    onChange(metadataRecordFromEntries(nextEntries));
  };

  return (
    <div className="grpc-metadata-editor" data-testid="grpc-metadata-editor">
      <p className="grpc-metadata-hint">
        Keys are normalized to lowercase when saved. Suffix keys with <code>-bin</code> for binary values (base64).
      </p>
      {!validation.valid && validation.message && (
        <p className="grpc-metadata-error" data-testid="grpc-metadata-validation-error" role="alert">
          {validation.message}
        </p>
      )}
      <KeyValueEditor
        label="Metadata"
        entries={entries}
        onChange={handleChange}
        disabled={disabled}
        testIdPrefix="grpc-metadata"
        toggleVerb="send"
        sectionClassName="grpc-metadata-kv-section"
        headerClassName="grpc-metadata-kv-header"
        labelClassName="grpc-metadata-kv-label"
      />
      {Object.entries(validation.rowErrors).map(([index, message]) => (
        <p
          key={index}
          className="grpc-metadata-row-error"
          data-testid={`grpc-metadata-row-error-${index}`}
        >
          Row {Number(index) + 1}: {message}
        </p>
      ))}
    </div>
  );
}
