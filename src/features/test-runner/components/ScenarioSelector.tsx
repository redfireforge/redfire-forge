import { useState, useMemo } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { FeatureGroup, GlobalAuthProfile, AuthConfig, ScenarioKind } from '../../../shared/types';
import type { RunnerConfig, UnorderedOverride } from '../hooks/runnerConfigDefaults';
import { buildSelectedTests } from '../utils/buildSelectedTests';

interface Props {
  featureGroups: FeatureGroup[];
  /** If set, only show scenarios matching this kind */
  kind?: ScenarioKind;
  selectedScenarios: Set<string>;
  onSelectedScenariosChange: (ids: Set<string>) => void;
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
  skipValidation: boolean;
  onSkipValidationChange: (skip: boolean) => void;
  skipAssertions: boolean;
  onSkipAssertionsChange: (skip: boolean) => void;
  validationOverride: RunnerConfig['validationOverride'];
  onValidationOverrideChange: (override: RunnerConfig['validationOverride']) => void;
  forceUnordered: UnorderedOverride;
  onForceUnorderedChange: (force: UnorderedOverride) => void;
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
  /** Scenario-level tag filter (show only scenarios with these tags) */
  scenarioTagFilter?: string[];
  onScenarioTagFilterChange?: (tags: string[]) => void;
  /** All unique scenario tags across all feature groups */
  allScenarioTags?: string[];
  /** Tag → scenario count for badge display */
  scenarioTagCounts?: Record<string, number>;
}

export default function ScenarioSelector({
  featureGroups: rawFeatureGroups,
  kind,
  selectedScenarios,
  onSelectedScenariosChange,
  weights: _weights,
  onWeightsChange: _onWeightsChange,
  skipValidation,
  onSkipValidationChange,
  skipAssertions,
  onSkipAssertionsChange,
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
  scenarioTagFilter,
  onScenarioTagFilterChange,
  allScenarioTags = [],
  scenarioTagCounts = {},
}: Props) {
  // First filter by kind
  const kindFilteredGroups = useMemo(() => {
    if (!kind) return rawFeatureGroups;
    return rawFeatureGroups
      .map(fg => ({ ...fg, scenarios: fg.scenarios.filter(sc => sc.kind === kind) }))
      .filter(fg => fg.scenarios.length > 0);
  }, [rawFeatureGroups, kind]);

  // Then filter by scenario tags
  const featureGroups = useMemo(() => {
    if (!scenarioTagFilter || scenarioTagFilter.length === 0) return kindFilteredGroups;
    return kindFilteredGroups
      .map(fg => ({
        ...fg,
        scenarios: fg.scenarios.filter(sc => {
          const scTags = sc.tags ?? [];
          return scTags.length > 0 && scenarioTagFilter.some(t => scTags.includes(t));
        }),
      }))
      .filter(fg => fg.scenarios.length > 0);
  }, [kindFilteredGroups, scenarioTagFilter]);

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

  const selectAll = () => {
    onSelectedScenariosChange(new Set(featureGroups.flatMap(fg => fg.scenarios.map(sc => sc.id))));
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
    skipAssertions,
    validationOverride,
    forceUnordered,
    globalAuthProfiles,
    envFallbackAuth,
  ), [featureGroups, selectedScenarios, hostMode, customBaseUrl, resolvedBaseUrl, skipValidation, skipAssertions, validationOverride, forceUnordered, globalAuthProfiles, envFallbackAuth]);

  /** Count selected scenarios that still exist under the current kind filter.
   *  Tag-hidden selections still count (user may re-enable the tag).
   *  Stale IDs from deleted FGs / other envs do not. */
  const selectedScenarioCount = useMemo(() => {
    let count = 0;
    for (const fg of kindFilteredGroups) {
      for (const sc of fg.scenarios) {
        if (sc.tests.length > 0 && selectedScenarios.has(sc.id)) count++;
      }
    }
    return count;
  }, [kindFilteredGroups, selectedScenarios]);

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
                      const versioned = sc.tests.filter(t => t.sourceSpecVersionLabel);
                      if (versioned.length === 0) return null;
                      const labels = [...new Set(versioned.map(t => t.sourceSpecVersionLabel!))];
                      return <span className="count-badge count-badge-version" title={`Spec version${labels.length > 1 ? 's' : ''}: ${labels.join(', ')}`}>v{labels[0]}{labels.length > 1 ? ` +${labels.length - 1}` : ''}</span>;
                    })()}
                    {(() => {
                      const fromReqs = sc.tests.filter(t => t.sourceRequestId).length;
                      return fromReqs > 0 ? <span className="count-badge count-badge-origin" title={`${fromReqs} test${fromReqs !== 1 ? 's' : ''} from Requests`}>&#128279; {fromReqs}</span> : null;
                    })()}
                    {(() => {
                      const totalRows = sc.tests.reduce((sum, t) => sum + (t.dataSource?.rows.filter(r => r.enabled).length ?? 0), 0);
                      return totalRows > 0 ? <span className="count-badge count-badge-data">📊 {totalRows} rows</span> : null;
                    })()}
                    {sc.tags && sc.tags.length > 0 && (
                      <span className="scenario-selector-tags">
                        {sc.tags.map(tag => (
                          <span key={tag} className="scenario-selector-tag" title={`Tag: ${tag}`}>{tag}</span>
                        ))}
                      </span>
                    )}
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
    <div className="config-form" data-testid="har-scenario-selector">
      <div className="selection-header">
        <h3>Select Scenarios to Test</h3>
        <div className="selection-actions">
          <button className="btn btn-sm" onClick={selectAll} disabled={disabled}>Select All</button>
          <button className="btn btn-sm" onClick={deselectAll} disabled={disabled}>Deselect All</button>
          <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem', whiteSpace: 'nowrap' }} title="Controls JSON response body matching (expected fields, schema). Use Default to respect each test's own setting.">
            Body Validation
            <span style={{ marginLeft: 4, display: 'inline-block' }}>
              <CustomSelect
                value={skipValidation ? 'none' : validationOverride}
                onChange={(val) => {
                  const next = val as RunnerConfig['validationOverride'];
                  onValidationOverrideChange(next);
                  onSkipValidationChange(next === 'none');
                }}
                disabled={disabled}
                size="sm"
                options={[
                  { value: 'default', label: 'Default' },
                  { value: 'none', label: 'None' },
                  { value: 'selective', label: 'Selective' },
                  { value: 'full', label: 'Full' },
                ]}
              />
            </span>
          </label>
          <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem' }} title="Run status, header, and custom assertions. Uncheck to skip all assertions.">
            <input
              type="checkbox"
              checked={!skipAssertions}
              onChange={(e) => onSkipAssertionsChange(!e.target.checked)}
              disabled={disabled}
            />
            Assertions
          </label>
          <label className="checkbox-label" style={{ marginLeft: 8, fontSize: '0.82rem', whiteSpace: 'nowrap' }} title="Array matching: Default respects each test's setting, On forces unordered, Off forces ordered">
            Unordered arrays
            <span style={{ marginLeft: 4, display: 'inline-block' }}>
              <CustomSelect
                value={forceUnordered}
                onChange={(v) => onForceUnorderedChange(v as UnorderedOverride)}
                disabled={disabled || validationOverride === 'none' || skipValidation}
                size="sm"
                options={[
                  { value: 'default', label: 'Default' },
                  { value: 'force-on', label: 'On' },
                  { value: 'force-off', label: 'Off' },
                ]}
              />
            </span>
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
              <span style={{ marginLeft: 4, display: 'inline-block' }}>
                <CustomSelect
                  value={autoReportFormat}
                  onChange={(v) => onAutoReportFormatChange(v as 'html' | 'json' | 'markdown')}
                  disabled={disabled}
                  size="sm"
                  options={[
                    { value: 'html', label: 'HTML' },
                    { value: 'json', label: 'JSON' },
                    { value: 'markdown', label: 'Markdown' },
                  ]}
                />
              </span>
            )}
          </label>
          <span className="filter-count">
            {selectedScenarioCount} scenario{selectedScenarioCount !== 1 ? 's' : ''} selected
            ({selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      {allScenarioTags.length > 0 && (
        <div className="scenario-tag-filter-bar">
          <span className="scenario-tag-filter-label">Tags:</span>
          <button
            className={`scenario-tag-filter-btn ${!scenarioTagFilter || scenarioTagFilter.length === 0 ? 'active' : ''}`}
            onClick={() => onScenarioTagFilterChange?.([])}
            disabled={disabled}
          >
            All
          </button>
          {allScenarioTags.map(tag => (
            <button
              key={tag}
              className={`scenario-tag-filter-btn ${scenarioTagFilter?.includes(tag) ? 'active' : ''}`}
              onClick={() => {
                const current = scenarioTagFilter ?? [];
                const next = current.includes(tag)
                  ? current.filter(t => t !== tag)
                  : [...current, tag];
                onScenarioTagFilterChange?.(next);
              }}
              disabled={disabled}
            >
              {tag} ({scenarioTagCounts[tag] ?? 0})
            </button>
          ))}
        </div>
      )}

      {userGroups.length > 0 && (
        <>
          <div className="selection-section-header">
            <span className="selection-section-label">YOUR TESTS</span>
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
