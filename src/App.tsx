import { useState } from 'react';
import type { FeatureGroup } from './types';
import ScenarioBuilder from './pages/ScenarioBuilder';
import TestRunner from './pages/TestRunner';
import ResultsDashboard from './pages/ResultsDashboard';
import './App.css';

type Tab = 'scenarios' | 'runner' | 'results';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('scenarios');
  const [featureGroups, setFeatureGroups] = useState<FeatureGroup[]>([]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚡ Performance Test</h1>
        <nav className="tab-nav">
          <button className={`tab ${activeTab === 'scenarios' ? 'active' : ''}`} onClick={() => setActiveTab('scenarios')}>
            Feature Groups
          </button>
          <button className={`tab ${activeTab === 'runner' ? 'active' : ''}`} onClick={() => setActiveTab('runner')}>
            Test Runner
          </button>
          <button className={`tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>
            Results
          </button>
        </nav>
      </header>
      <main className="app-main">
        {activeTab === 'scenarios' && <ScenarioBuilder featureGroups={featureGroups} setFeatureGroups={setFeatureGroups} />}
        {activeTab === 'runner' && <TestRunner featureGroups={featureGroups} onComplete={() => setActiveTab('results')} />}
        {activeTab === 'results' && <ResultsDashboard />}
      </main>
    </div>
  );
}
