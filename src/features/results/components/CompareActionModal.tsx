import PopupModal from '../../../shared/components/PopupModal';

interface Props {
  open: boolean;
  compareActionRunLabel: string;
  selectedRunLabel: string;
  onClose: () => void;
  onUseAsCompared: () => void;
  onSwapDirection: () => void;
}

export function CompareActionModal({
  open,
  compareActionRunLabel,
  selectedRunLabel,
  onClose,
  onUseAsCompared,
  onSwapDirection,
}: Props) {
  if (!open) return null;

  return (
    <PopupModal
      title="Choose Comparison Action"
      onClose={onClose}
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={onUseAsCompared}>Use As Compared Run</button>
          <button className="btn btn-primary" onClick={onSwapDirection}>Swap Direction</button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0 }}>
          You selected: <strong>{compareActionRunLabel}</strong>
        </p>
        <p style={{ margin: 0 }}>
          Current baseline run: <strong>{selectedRunLabel || 'None'}</strong>
        </p>
        <p style={{ margin: 0 }}>Choose one action:</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Use As Compared Run: keep current baseline, compare selected target against it.</li>
          <li>Swap Direction: make selected target the baseline and compare the current baseline against it.</li>
        </ul>
      </div>
    </PopupModal>
  );
}
