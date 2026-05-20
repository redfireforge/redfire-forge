import { type Tab, domainOf } from '../utils/appTabUtils';
import MigrationBanner from '../../features/test-runner/components/MigrationBanner';
import ServerStatusIndicator from '../../features/workflow/components/panels/ServerStatusIndicator';

interface AppSubNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export default function AppSubNav({ activeTab, setActiveTab }: AppSubNavProps) {
  return (
    <div className="sub-nav">
      {domainOf(activeTab) === 'api' && (
        <div className="sub-nav-tabs">
          <button className={`sub-nav-tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>Requests</button>
          <button className={`sub-nav-tab ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>Catalog</button>
        </div>
      )}
      {domainOf(activeTab) === 'workflow' && (
        <div className="sub-nav-tabs">
          <button className={`sub-nav-tab ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')}>Designer</button>
          <button className={`sub-nav-tab ${activeTab === 'workflow-executions' ? 'active' : ''}`} onClick={() => setActiveTab('workflow-executions')}>Executions</button>
          <button className={`sub-nav-tab ${activeTab === 'webhook-deliveries' ? 'active' : ''}`} onClick={() => setActiveTab('webhook-deliveries')}>Webhooks</button>
          <div className="sub-nav-spacer" />
          <ServerStatusIndicator />
        </div>
      )}
      {domainOf(activeTab) === 'testing' && (
        <>
          <div className="sub-nav-tabs">
            <button className={`sub-nav-tab ${activeTab === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveTab('scenarios')}>Feature Groups</button>
            <button className={`sub-nav-tab ${activeTab === 'runner' ? 'active' : ''}`} onClick={() => setActiveTab('runner')}>Test Runner</button>
            <button className={`sub-nav-tab ${activeTab === 'param-runner' ? 'active' : ''}`} onClick={() => setActiveTab('param-runner')}>Parameterized Runner</button>
            <button className={`sub-nav-tab ${activeTab === 'workflow-runner' ? 'active' : ''}`} onClick={() => setActiveTab('workflow-runner')}>Workflow Runner</button>
            <button className={`sub-nav-tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Results</button>
          </div>
          <MigrationBanner onNavigateToParamRunner={() => setActiveTab('param-runner')} />
        </>
      )}
      {domainOf(activeTab) === 'gallery' && (
        <div className="sub-nav-tabs">
          <button className={`sub-nav-tab ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}>Samples</button>
          <button className={`sub-nav-tab ${activeTab === 'training' ? 'active' : ''}`} onClick={() => setActiveTab('training')}>Training Tracks</button>
        </div>
      )}
      {domainOf(activeTab) === 'settings' && (
        <div className="sub-nav-tabs">
          <button className={`sub-nav-tab ${activeTab === 'environments' ? 'active' : ''}`} onClick={() => setActiveTab('environments')}>Environments</button>
          <button className={`sub-nav-tab ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>Preferences</button>
        </div>
      )}
    </div>
  );
}
