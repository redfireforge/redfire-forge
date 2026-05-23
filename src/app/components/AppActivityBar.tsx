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

function ActivityBarIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="ab-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export default function AppActivityBar({ activeTab, setActiveTab }: AppActivityBarProps) {
  return (
    <nav className="activity-bar">
      <button
        className={`ab-btn ${domainOf(activeTab) === 'api' ? 'active' : ''}`}
        onClick={() => { if (!isApiTab(activeTab)) setActiveTab('requests'); }}
        title="API"
      >
        <span className="ab-icon">
          <ActivityBarIcon>
            <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
          </ActivityBarIcon>
        </span>
        <span className="ab-label">API</span>
      </button>
      <button
        className={`ab-btn ${domainOf(activeTab) === 'workflow' ? 'active' : ''}`}
        onClick={() => { if (!isWorkflowTab(activeTab)) setActiveTab('workflow'); }}
        title="Workflow"
      >
        <span className="ab-icon">
          <ActivityBarIcon>
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M6 21V9a9 9 0 009 9" />
          </ActivityBarIcon>
        </span>
        <span className="ab-label">Workflow</span>
      </button>
      <button
        className={`ab-btn ${domainOf(activeTab) === 'testing' ? 'active' : ''}`}
        onClick={() => { if (!isHarnessTab(activeTab)) setActiveTab('scenarios'); }}
        title="Harness"
      >
        <span className="ab-icon">
          <ActivityBarIcon>
            <path d="M6 9l6 6 6-6" />
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 14h6" />
          </ActivityBarIcon>
        </span>
        <span className="ab-label">Harness</span>
      </button>
      <button
        className={`ab-btn ${domainOf(activeTab) === 'gallery' ? 'active' : ''}`}
        onClick={() => { if (!isGalleryTab(activeTab)) setActiveTab('gallery'); }}
        title="Gallery"
      >
        <span className="ab-icon">
          <ActivityBarIcon>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </ActivityBarIcon>
        </span>
        <span className="ab-label">Gallery</span>
      </button>
      <div className="ab-spacer" />
      <button
        className={`ab-btn ${domainOf(activeTab) === 'settings' ? 'active' : ''}`}
        onClick={() => { if (!isSettingsTab(activeTab)) setActiveTab('environments'); }}
        title="Settings"
      >
        <span className="ab-icon">
          <ActivityBarIcon>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </ActivityBarIcon>
        </span>
        <span className="ab-label">Settings</span>
      </button>
    </nav>
  );
}
