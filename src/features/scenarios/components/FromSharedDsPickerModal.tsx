import { useState } from 'react';
import type { SharedDataSource } from '../../../shared/types';
import PopupModal from '../../../shared/components/PopupModal';

interface Props {
  sharedDataSources: SharedDataSource[];
  onConfirm: (sharedDs: SharedDataSource, testName: string) => void;
  onClose: () => void;
}

export default function FromSharedDsPickerModal({ sharedDataSources, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [testName, setTestName] = useState('');

  const selectedDs = sharedDataSources.find(ds => ds.id === selected);

  const handleClose = () => {
    setSelected(null);
    setTestName('');
    onClose();
  };

  return (
    <PopupModal
      title="Create Test from Shared Data Source"
      onClose={handleClose}
      dialogClassName="from-shared-ds-picker"
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={handleClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!selected || !testName.trim()}
            onClick={() => {
              if (selectedDs) {
                onConfirm(selectedDs, testName.trim());
              }
              handleClose();
            }}
          >
            Create Test
          </button>
        </>
      )}
    >
      <div className="popup-modal-field">
        <label>Test Name</label>
        <input
          type="text"
          value={testName}
          onChange={e => setTestName(e.target.value)}
          placeholder="Enter test name"
          autoFocus
        />
      </div>
      <div className="popup-modal-field">
        <label>Select Data Source</label>
        <div className="shared-ds-picker-list">
          {sharedDataSources.map(ds => (
            <label
              key={ds.id}
              className={`shared-ds-picker-item ${selected === ds.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="sharedDsSelection"
                checked={selected === ds.id}
                onChange={() => {
                  setSelected(ds.id);
                  if (!testName.trim()) {
                    setTestName(`Test from ${ds.name}`);
                  }
                }}
              />
              <span className="shared-ds-picker-info">
                <strong>{ds.name}</strong>
                <small>{ds.dataSource.rows.length} rows · {ds.dataSource.columns.length} columns</small>
              </span>
            </label>
          ))}
        </div>
      </div>
    </PopupModal>
  );
}
