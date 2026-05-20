import {
  type Tab,
  domainOf,
  isApiTab,
  isWorkflowTab,
  isHarnessTab,
  isGalleryTab,
  isSettingsTab,
} from '../utils/appTabUtils';

interface AppActivityBarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export default function AppActivityBar({ activeTab, setActiveTab }: AppActivityBarProps) {
  return (
    <nav className="activity-bar">
      <button
        className={`ab-btn ${domainOf(activeTab) === 'api' ? 'active' : ''}`}
        onClick={() => { if (!isApiTab(activeTab)) setActiveTab('requests'); }}
        title="API"
      >
        <span className="ab-icon">🔌</span>
        <span className="ab-label">API</span>
      </button>
      <button
        className={`ab-btn ${domainOf(activeTab) === 'workflow' ? 'active' : ''}`}
        onClick={() => { if (!isWorkflowTab(activeTab)) setActiveTab('workflow'); }}
        title="Workflow"
      >
        <span className="ab-icon">🔧</span>
        <span className="ab-label">Workflow</span>
      </button>
      <button
        className={`ab-btn ${domainOf(activeTab) === 'testing' ? 'active' : ''}`}
        onClick={() => { if (!isHarnessTab(activeTab)) setActiveTab('scenarios'); }}
        title="Harness"
      >
        <span className="ab-icon">🏋</span>
        <span className="ab-label">Harness</span>
      </button>
      <button
        className={`ab-btn ${domainOf(activeTab) === 'gallery' ? 'active' : ''}`}
        onClick={() => { if (!isGalleryTab(activeTab)) setActiveTab('gallery'); }}
        title="Gallery"
      >
        <span className="ab-icon">🏪</span>
        <span className="ab-label">Gallery</span>
      </button>
      <div className="ab-spacer" />
      <button
        className={`ab-btn ${domainOf(activeTab) === 'settings' ? 'active' : ''}`}
        onClick={() => { if (!isSettingsTab(activeTab)) setActiveTab('environments'); }}
        title="Settings"
      >
        <span className="ab-icon">⚙️</span>
        <span className="ab-label">Settings</span>
      </button>
    </nav>
  );
}
