import { useEffect, useRef } from 'react';

export type ImportChoice = 'test-definition' | 'data-rows';
export type ExportChoice = 'test-definition' | 'excel-template' | 'data-csv' | 'data-json';

interface ImportModalProps {
  mode: 'import';
  hasDataSource: boolean;
  onSelect: (choice: ImportChoice) => void;
  onClose: () => void;
}

interface ExportModalProps {
  mode: 'export';
  hasDataSource: boolean;
  onSelect: (choice: ExportChoice) => void;
  onClose: () => void;
}

type Props = ImportModalProps | ExportModalProps;

export default function ImportExportChoiceModal(props: Props) {
  const { mode, hasDataSource, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const importChoices: { key: ImportChoice; label: string; description: string; disabled?: boolean }[] = [
    { key: 'test-definition', label: 'Test Definition', description: 'Load a saved test configuration (.json)' },
    { key: 'data-rows', label: 'Data Rows', description: 'Import CSV or JSON data into the Data Source', disabled: !hasDataSource },
  ];

  const exportChoices: { key: ExportChoice; label: string; description: string; disabled?: boolean }[] = [
    { key: 'test-definition', label: 'Test Definition', description: 'Save test configuration as .json' },
    { key: 'excel-template', label: 'Excel Template', description: 'Structured .xlsx with metadata and data rows' },
    { key: 'data-csv', label: 'Data as CSV', description: 'Export Data Source rows as .csv', disabled: !hasDataSource },
    { key: 'data-json', label: 'Data as JSON', description: 'Export Data Source rows as .json', disabled: !hasDataSource },
  ];

  const choices = mode === 'import' ? importChoices : exportChoices;

  return (
    <div className="import-export-choice-overlay">
      <div className="import-export-choice-modal" ref={ref}>
        <div className="import-export-choice-header">
          {mode === 'import' ? 'Import' : 'Export'}
        </div>
        <div className="import-export-choice-list">
          {choices.map((c) => (
            <button
              key={c.key}
              type="button"
              className="import-export-choice-item"
              disabled={c.disabled}
              onClick={() => {
                if (mode === 'import') {
                  (props as ImportModalProps).onSelect(c.key as ImportChoice);
                } else {
                  (props as ExportModalProps).onSelect(c.key as ExportChoice);
                }
              }}
            >
              <span className="import-export-choice-label">{c.label}</span>
              <span className="import-export-choice-desc">{c.description}</span>
            </button>
          ))}
        </div>
        <div className="import-export-choice-footer">
          <button type="button" className="btn btn-xs" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
