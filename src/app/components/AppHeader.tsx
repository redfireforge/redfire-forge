import type { RefObject } from 'react';
import type { Environment, Microservice } from '../../shared/types';
import type { KafkaConnectionSnapshot } from '../../shared/kafka/kafkaConfig';
import { isCustomThemeId, findSavedTheme } from '../themeCustomizerUtils';
import KafkaConnectionIndicator from './KafkaConnectionIndicator';

interface ThemeItem {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  readonly bg: string;
}

interface ThemeGroup {
  readonly group: string;
  readonly items: readonly ThemeItem[];
}

interface AppHeaderProps {
  headerRef: RefObject<HTMLElement | null>;
  environments: Environment[];
  microservices: Microservice[];
  selectedEnvId: string;
  setSelectedEnvId: (id: string) => void;
  selectedSvcId: string;
  setSelectedSvcId: (id: string) => void;
  theme: string;
  setTheme: (id: string) => void;
  themePickerOpen: boolean;
  setThemePickerOpen: (fn: boolean | ((prev: boolean) => boolean)) => void;
  themePickerRef: RefObject<HTMLDivElement | null>;
  THEMES: readonly ThemeGroup[];
  THEME_ICONS: Record<string, string>;
  setShowCustomizer: (show: boolean) => void;
  kafkaConnection: KafkaConnectionSnapshot;
  kafkaClusterName: string | null;
  kafkaHasClusters: boolean;
  onNavigateToKafkaSettings: () => void;
}

export default function AppHeader({
  headerRef,
  environments,
  microservices,
  selectedEnvId,
  setSelectedEnvId,
  selectedSvcId,
  setSelectedSvcId,
  theme,
  setTheme,
  themePickerOpen,
  setThemePickerOpen,
  themePickerRef,
  THEMES,
  THEME_ICONS,
  setShowCustomizer,
  kafkaConnection,
  kafkaClusterName,
  kafkaHasClusters,
  onNavigateToKafkaSettings,
}: AppHeaderProps) {
  return (
    <header ref={headerRef} className="app-header">
      <h1>🔥 RedfireForge
        <span style={{ fontSize: '0.4em', fontWeight: 400, opacity: 0.5, marginLeft: '0.6em', verticalAlign: 'middle', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>v{__APP_VERSION__}</span>
      </h1>
      <div className="header-selectors">
        <div className="header-select-group">
          <select value={selectedEnvId} onChange={(e) => setSelectedEnvId(e.target.value)}>
            <option value="">Environment…</option>
            {environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
            {microservices.some(s => (s.customEnvs ?? []).length > 0) && (
              <optgroup label="Additional">
                {microservices.flatMap(s => (s.customEnvs ?? []).map(ce => (
                  <option key={ce.id} value={ce.id}>{ce.name} ({s.name})</option>
                )))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="header-select-group">
          <select value={selectedSvcId} onChange={(e) => setSelectedSvcId(e.target.value)}>
            <option value="">Service…</option>
            {microservices.map((svc) => <option key={svc.id} value={svc.id}>{svc.name}</option>)}
          </select>
        </div>
        <KafkaConnectionIndicator
          connection={kafkaConnection}
          clusterName={kafkaClusterName}
          hasClusters={kafkaHasClusters}
          onNavigateToSettings={onNavigateToKafkaSettings}
        />

        <div className={`theme-picker${themePickerOpen ? ' open' : ''}`} ref={themePickerRef}>
          <button className="theme-toggle" onClick={() => setThemePickerOpen((o: boolean) => !o)}
            title={`Theme: ${isCustomThemeId(theme) ? (findSavedTheme(theme)?.name ?? 'Custom') : theme}`}>
            {THEME_ICONS[theme] ?? '🎨'}
          </button>
          <div className="theme-dropdown">
            {THEMES.map(g => (
              <div key={g.group}>
                <div className="theme-dropdown-label">{g.group}</div>
                {g.items.map(t => (
                  <button key={t.id} className={`theme-option${theme === t.id ? ' active' : ''}`}
                    onClick={() => { setTheme(t.id); setThemePickerOpen(false); }}>
                    <span className="theme-opt-icon">{t.icon}</span>
                    {t.label}
                    <span className="theme-opt-swatch" style={{ background: t.bg }} />
                  </button>
                ))}
              </div>
            ))}
            <div className="theme-dropdown-divider" />
            {isCustomThemeId(theme) && (
              <div className="theme-active-custom">
                <span className="theme-opt-icon">🎨</span>
                {findSavedTheme(theme)?.name ?? 'Custom'}
                <span className="theme-active-badge">active</span>
              </div>
            )}
            <button className={`theme-customize-btn${isCustomThemeId(theme) ? ' active' : ''}`}
              onClick={() => { setThemePickerOpen(false); setShowCustomizer(true); }}>
              🎨 Customize…
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

declare const __APP_VERSION__: string;
