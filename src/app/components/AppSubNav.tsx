import { type Domain, type Tab, domainOf } from '../utils/appTabUtils';
import MigrationBanner from '../../features/test-runner/components/MigrationBanner';
import ServerStatusIndicator from '../../features/workflow/components/panels/ServerStatusIndicator';

interface AppSubNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

interface SubNavItem {
  tab: Tab;
  label: string;
}

const DOMAIN_ITEMS: Record<Domain, SubNavItem[]> = {
  api: [
    { tab: 'requests', label: 'Requests' },
    { tab: 'catalog', label: 'Catalog' },
  ],
  workflow: [
    { tab: 'workflow', label: 'Designer' },
    { tab: 'workflow-executions', label: 'Executions' },
    { tab: 'webhook-deliveries', label: 'Webhooks' },
  ],
  testing: [
    { tab: 'scenarios', label: 'Feature Groups' },
    { tab: 'runner', label: 'Test Runner' },
    { tab: 'param-runner', label: 'Parameterized Runner' },
    { tab: 'workflow-runner', label: 'Workflow Runner' },
    { tab: 'results', label: 'Results' },
  ],
  gallery: [
    { tab: 'gallery', label: 'Samples' },
    { tab: 'training', label: 'Training Tracks' },
  ],
  settings: [
    { tab: 'environments', label: 'Environments' },
    { tab: 'preferences', label: 'Preferences' },
    { tab: 'kafka-settings', label: 'Kafka' },
  ],
  protocols: [
    { tab: 'kafka-message-studio', label: 'Kafka Studio' },
    { tab: 'kafka-topic-explorer', label: 'Topic Explorer' },
    { tab: 'kafka-schema-registry', label: 'Schema Registry' },
  ],
};

function renderTabs(items: SubNavItem[], activeTab: Tab, setActiveTab: (tab: Tab) => void) {
  return items.map(({ tab, label }) => (
    <button
      key={tab}
      className={`sub-nav-tab ${activeTab === tab ? 'active' : ''}`}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </button>
  ));
}

export default function AppSubNav({ activeTab, setActiveTab }: AppSubNavProps) {
  const domain = domainOf(activeTab);

  return (
    <div className="sub-nav">
      {domain === 'api' && (
        <div className="sub-nav-tabs">
          {renderTabs(DOMAIN_ITEMS.api, activeTab, setActiveTab)}
        </div>
      )}
      {domain === 'workflow' && (
        <div className="sub-nav-tabs">
          {renderTabs(DOMAIN_ITEMS.workflow, activeTab, setActiveTab)}
          <div className="sub-nav-spacer" />
          <ServerStatusIndicator />
        </div>
      )}
      {domain === 'testing' && (
        <>
          <div className="sub-nav-tabs">
            {renderTabs(DOMAIN_ITEMS.testing, activeTab, setActiveTab)}
          </div>
          <MigrationBanner onNavigateToParamRunner={() => setActiveTab('param-runner')} />
        </>
      )}
      {domain === 'gallery' && (
        <div className="sub-nav-tabs">
          {renderTabs(DOMAIN_ITEMS.gallery, activeTab, setActiveTab)}
        </div>
      )}
      {domain === 'settings' && (
        <div className="sub-nav-tabs">
          {renderTabs(DOMAIN_ITEMS.settings, activeTab, setActiveTab)}
        </div>
      )}
      {domain === 'protocols' && (
        <div className="sub-nav-tabs">
          {renderTabs(DOMAIN_ITEMS.protocols, activeTab, setActiveTab)}
        </div>
      )}
    </div>
  );
}
