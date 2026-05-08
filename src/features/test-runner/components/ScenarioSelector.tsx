import { useState, useMemo } from 'react';
import type { FeatureGroup, GlobalAuthProfile, AuthConfig } from '../../../shared/types';
import type { RunnerConfig } from '../hooks/useRunnerConfig';
import { buildSelectedTests } from '../utils/buildSelectedTests';

interface Props {
  featureGroups: FeatureGroup[];
  selectedScenarios: Set<string>;
  onSelectedScenariosChange: (ids: Set<string>) => void;
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
  skipValidation: boolean;
  onSkipValidationChange: (skip: boolean) => void;
  validationOverride: RunnerConfig['validationOverride'];
  onValidationOverrideChange: (override: RunnerConfig['validationOverride']) => void;
  forceUnordered: boolean;
  onForceUnorderedChange: (force: boolean) => void;
  autoReport: boolean;
  onAutoReportChange: (auto: boolean) => void;
  autoReportFormat: 'html' | 'json' | 'markdown';
  onAutoReportFormatChange: (format: 'html' | 'json' | 'markdown') => void;
  hostMode: 'hardcoded' | 'settings' | 'custom';
  customBaseUrl: string;
  resolvedBaseUrl?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
  envFallbackAuth?: AuthConfig;
  disabled?: boolean;
}

export default function ScenarioSelector({
  featureGroups,
  selectedScenarios,
  onSelectedScenariosChange,
  weights: _weights,
  onWeightsChange: _onWeightsChange,
  skipValidation,
  onSkipValidationChange,
  validationOverride,
  onValidationOverrideChange,
  forceUnordered,
  onForceUnorderedChange,
  autoReport,
  onAutoReportChange,
  autoReportFormat,
  onAutoReportFormatChange,
  hostMode,
  customBaseUrl,
  resolvedBaseUrl,
  globalAuthProfiles = [],
  envFallbackAuth,
  disabled = false,
}: Props) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(
    () => new Set(featureGroups.map(fg => fg.id))
  );

  const userGroups = featureGroups.filter(fg => fg.source !== 'gallery');
  const galleryGroups = featureGroups.filter(fg => fg.source === 'gallery');

  const scenarioSourceOf = (scenarioId: string): 'gallery' | 'user' => {
    for (const fg of galleryGroups) {
      if (fg.scenarios.some(sc => sc.id === scenarioId)) return 'gallery';
    }
    return 'user';
  };

  const idsForSource = (source: 'gallery' | 'user') => {
    const groups = source === 'gallery' ? galleryGroups : userGroups;
    return new Set(groups.flatMap(fg => fg.scenarios.map(sc => sc.id)));
  };

  const withExclusion = (next: Set<string>, addingSource: 'gallery' | 'user') => {
    const oppositeIds = idsForSource(addingSource === 'gallery' ? 'user' : 'gallery');
    oppositeIds.forEach(id => next.delete(id));
    return next;
  };

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  };

  const toggleScenario = (scenarioId: string) => {
    const next = new Set(selectedScenarios);
    if (next.has(scenarioId)) {
      next.delete(scenarioId);
    } else {
      next.add(scenarioId);
      withExclusion(next, scenarioSourceOf(scenarioId));
    }
    onSelectedScenariosChange(next);
  };

  const toggleAllInFeature = (fg: FeatureGroup) => {
    const allSelected = fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
    const source = fg.source === 'gallery' ? 'gallery' as const : 'user' as const;
    const next = new Set(selectedScenarios);
    fg.scenarios.forEach((sc) => {
      if (allSelected) next.delete(sc.id);
      else next.add(sc.id);
    });
    if (!allSelected) withExclusion(next, source);
    onSelectedScenariosChange(next);
  };

  const selectAllUser = () => {
    onSelectedScenariosChange(new Set(userGroups.flatMap(fg => fg.scenarios.map(sc => sc.id))));
  };

  const selectAllGallery = () => {
    onSelectedScenariosChange(new Set(galleryGroups.flatMap(fg => fg.scenarios.map(sc => sc.id))));
  };

  const deselectAll = () => {
    onSelectedScenariosChange(new Set());
  };

  const selectedTests = useMemo(() => buildSelectedTests(
    featureGroups,
    selectedScenarios,
    hostMode,
    customBaseUrl,
    resolvedBaseUrl,
    skipValidation,
    validationOverride,
    forceUnordered,
    globalAuthProfiles,
    envFallbackAuth,
  ), [featureGroups, selectedScenarios, hostMode, customBaseUrl, resolvedBaseUrl, skipValidation, validationOverride, forceUnordered, globalAuthProfiles, envFallbackAuth]);

  const renderFeatureGroup = (fg: FeatureGroup) => {
    if (fg.scenarios.length === 0) return null;
    const allSelected = fg.scenarios.length > 0 && fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
    const someSelected = fg.scenarios.some((sc) => selectedScenarios.has(sc.id));
    return (
      <div key={fg.id} className="selection-feature">
        <div className="selection-feature-header">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={() => toggleAllInFeature(fg)}
              disabled={disabled}
            />
            <strong>{fg.name}</strong>
          </label>
          <span className="expand-toggle" onClick={() => toggleFeature(fg.id)}>
            {expandedFeatures.has(fg.id) ? '−' : '+'}
          </span>
        </div>
        {expandedFeatures.has(fg.id) && (
          <div className="selection-scenarios">
            {fg.scenarios.map((sc) => {
              if (sc.tests.length === 0) return null;
              return (
                <div key={sc.id} className="selection-scenario">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedScenarios.has(sc.id)}
                      onChange={() => toggleScenario(sc.id)}
                      disabled={disabled}
                    />
                    <span>{sc.name}</span>
                    <span className="count-badge">{sc.tests.length} test{sc.tests.length !== 1 ? 's' : ''}</span>
                    {(() => {
                      const totalRows = sc.tests.reduce((sum, t) => sum + (t.dataSource?.rows.filter(r => r.enabled).length ?? 0), 0);
                      return totalRows > 0 ? <span className="count-badge count-badge-data">📊 {totalRows} rows</span> : null;
                    })()}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="config-form">
      <div className="selection-header">
        <h3>Select Scenarios to Test</h3>
        <div className="selection-actions">
          <button className="btn btn-sm" onClick={deselectAll} disabled={disabled}>Deselect All</button>
          <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }}>
            <input
              type="checkbox"
              checked={skipValidation}
              onChange={(e) => onSkipValidationChange(e.target.checked)}
              disabled={disabled}
            />
            Skip validation
          </label>
          <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }} title="Runtime validation override — Default uses each test's configured mode">
            <select
              value={validationOverride}
              onChange={(e) => onValidationOverrideChange(e.target.value as RunnerConfig['validationOverride'])}
              disabled={disabled}
              style={{ fontSize: '0.78rem', marginLeft: 4 }}
            >
              <option value="default">Validation: Default</option>
              <option value="none">Validate: No Rows</option>
              <option value="selective">Validate: Sample Rows Only</option>
              <option value="full">Validate: All Rows</option>
            </select>
          </label>
          <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }} title="Match array items by content regardless of order — useful when APIs return arrays in non-deterministic order">
            <input
              type="checkbox"
              checked={forceUnordered}
              onChange={(e) => onForceUnorderedChange(e.target.checked)}
              disabled={disabled || validationOverride === 'none' || skipValidation}
            />
            Unordered arrays
          </label>
          <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem', whiteSpace: 'nowrap' }} title="Automatically download a report when the test finishes">
            <input
              type="checkbox"
              checked={autoReport}
              onChange={(e) => onAutoReportChange(e.target.checked)}
              disabled={disabled}
            />
            Auto-report
            {autoReport && (
              <select
                value={autoReportFormat}
                onChange={(e) => onAutoReportFormatChange(e.target.value as 'html' | 'json' | 'markdown')}
                disabled={disabled}
                style={{ fontSize: '0.78rem', marginLeft: 4 }}
              >
                <option value="html">HTML</option>
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
              </select>
            )}
          </label>
          <span className="filter-count">
            {selectedScenarios.size} scenario{selectedScenarios.size !== 1 ? 's' : ''} selected
            ({selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      {userGroups.length > 0 && (
        <>
          <div className="selection-section-header">
            <span className="selection-section-label">Your Tests</span>
            <button className="btn btn-sm" onClick={selectAllUser} disabled={disabled}>Select All</button>
          </div>
          <div className="selection-tree">
            {userGroups.map((fg) => renderFeatureGroup(fg))}
          </div>
        </>
      )}

      {galleryGroups.length > 0 && (
        <>
          <div className="selection-section-header selection-section-gallery">
            <span className="selection-section-label">🏪 Gallery Samples</span>
            <button className="btn btn-sm" onClick={selectAllGallery} disabled={disabled}>Select All</button>
            {userGroups.length > 0 && (
              <span className="selection-section-hint">Selecting gallery tests will deselect your tests and vice versa</span>
            )}
          </div>
          <div className="selection-tree">
            {galleryGroups.map((fg) => renderFeatureGroup(fg))}
          </div>
        </>
      )}
    </div>
  );
}
