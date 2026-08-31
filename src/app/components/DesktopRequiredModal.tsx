import PopupModal from '@shared/components/PopupModal';
import { featureRequiresDesktopReason } from '../utils/desktopFeatureGate';
import { useDesktopDownloadInfo } from '../hooks/useDesktopDownloadInfo';

interface DesktopRequiredModalProps {
  featureName: string;
  onClose: () => void;
}

export function DesktopRequiredModal({ featureName, onClose }: DesktopRequiredModalProps) {
  const { label, href } = useDesktopDownloadInfo();
  const reason = featureRequiresDesktopReason(featureName);

  return (
    <PopupModal
      title="Desktop App Required"
      onClose={onClose}
      dialogClassName="desktop-required-modal"
      dialogTestId="desktop-required-modal"
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose} data-testid="desktop-required-later">
            Maybe later
          </button>
          <a
            className="btn btn-primary desktop-required-modal__download"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="desktop-required-download"
          >
            ↓ {label}
          </a>
        </>
      )}
    >
      <p className="desktop-required-modal__reason">{reason}</p>
      <p className="desktop-required-modal__also">The desktop app also supports:</p>
      <ul className="desktop-required-modal__list">
        <li>API Mock Server</li>
        <li>gRPC / Kafka testing</li>
        <li>Corporate &amp; VPN endpoints</li>
        <li>All web features, plus more</li>
      </ul>
    </PopupModal>
  );
}
