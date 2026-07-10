import type { UseGrpcStudioAdvancedFeaturesReturn } from '../../hooks/useGrpcStudioAdvancedFeatures';
import type { GrpcAdvancedOperationStatusPresentation } from '../../utils/grpcStudioAdvancedModel';
import {
  parseNonNegativeInt,
  parseNonNegativeSecondsToMs,
  parsePositiveInt,
  parsePositiveSecondsToMs,
  presentMsAsSeconds,
} from './grpcLoadTestPanelUtils';

export interface GrpcLoadTestConfigSectionProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
  profileName: string;
  setProfileName: (value: string) => void;
  status: GrpcAdvancedOperationStatusPresentation;
  callTypeBadge: string;
  canStart: boolean;
  canStop: boolean;
}

export function GrpcLoadTestConfigSection({
  advanced,
  profileName,
  setProfileName,
  status,
  callTypeBadge,
  canStart,
  canStop,
}: GrpcLoadTestConfigSectionProps) {
  const config = advanced.loadTest.config;

  return (
    <>
      <header className="grpc-advanced-card__header">
        <div>
          <h2 className="grpc-advanced-card__title">Load test configuration</h2>
          <p className="grpc-advanced-card__subtitle">
            Tab: {advanced.activeTabLabel}
            {advanced.activeRpcLabel ? ` · ${advanced.activeRpcLabel}` : ''}
          </p>
          {advanced.activeLoadTestCallType && (
            <p
              className="grpc-advanced-card__subtitle"
              data-testid="grpc-load-test-call-type-badge"
            >
              Call type: <span className="grpc-advanced-badge">{callTypeBadge}</span>
              {advanced.activeLoadTestCallType === 'server_streaming' && (
                <span className="grpc-advanced-hint"> — Express proxy transport; bounded message collection per stream.</span>
              )}
            </p>
          )}
        </div>
        <div className="grpc-advanced-card__actions">
          {canStart && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid="grpc-load-test-start-btn"
              disabled={Boolean(advanced.loadTestValidationError)}
              title={advanced.loadTestValidationError}
              onClick={advanced.startLoadTest}
            >
              Start load test
            </button>
          )}
          {canStop && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              data-testid="grpc-load-test-stop-btn"
              onClick={advanced.cancelLoadTest}
            >
              Stop
            </button>
          )}
        </div>
      </header>

      <div className="grpc-advanced-card grpc-advanced-card__body">
        <div className="grpc-advanced-form-grid">
          <label className="grpc-advanced-field grpc-advanced-field--full-width">
            <span className="grpc-advanced-field__label">Method under test</span>
            <select
              className="grpc-advanced-select"
              data-testid="grpc-load-test-method-select"
              value={advanced.selectedLoadTestMethodKey ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.setLoadTestMethodOverride(event.target.value);
              }}
            >
              <option value="">Use active Studio method ({advanced.activeRpcLabel ?? 'none selected'})</option>
              {(advanced.loadTestMethodOptions ?? []).map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Concurrency</span>
            <input
              type="number"
              min={1}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-concurrency"
              value={config.concurrency}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                const value = parsePositiveInt(event.target.value);
                if (value != null) advanced.patchLoadTestConfig({ concurrency: value });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Total requests</span>
            <input
              type="number"
              min={1}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-total-calls"
              value={config.totalCalls ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  totalCalls: parsePositiveInt(event.target.value),
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Duration (s)</span>
            <input
              type="number"
              min={1}
              step="0.1"
              className="grpc-advanced-input"
              data-testid="grpc-load-test-duration"
              value={presentMsAsSeconds(config.durationMs)}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  durationMs: parsePositiveSecondsToMs(event.target.value),
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Ramp-up (s)</span>
            <input
              type="number"
              min={0}
              step="0.1"
              className="grpc-advanced-input"
              data-testid="grpc-load-test-ramp-up"
              value={presentMsAsSeconds(config.rampUpMs)}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  rampUpMs: parseNonNegativeSecondsToMs(event.target.value),
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Request rate (RPS, 0 = unlimited)</span>
            <input
              type="number"
              min={0}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-request-rate"
              value={config.requestRateRps ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  requestRateRps: parseNonNegativeInt(event.target.value),
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Warm-up calls</span>
            <input
              type="number"
              min={0}
              className="grpc-advanced-input"
              data-testid="grpc-load-test-warmup"
              value={config.warmupCalls ?? ''}
              disabled={advanced.loadTestRunning}
              onChange={(event) => {
                advanced.patchLoadTestConfig({
                  warmupCalls: parseNonNegativeInt(event.target.value),
                });
              }}
            />
          </label>
          {advanced.activeLoadTestCallType === 'server_streaming' && (
            <label className="grpc-advanced-field">
              <span className="grpc-advanced-field__label">Max messages / stream</span>
              <input
                type="number"
                min={1}
                className="grpc-advanced-input"
                data-testid="grpc-load-test-max-messages-per-stream"
                value={config.maxMessagesPerStream ?? ''}
                disabled={advanced.loadTestRunning}
                placeholder="10"
                onChange={(event) => {
                  advanced.patchLoadTestConfig({
                    maxMessagesPerStream: parsePositiveInt(event.target.value),
                  });
                }}
              />
            </label>
          )}
          {advanced.activeLoadTestCallType === 'unary' && (
            <label className="grpc-advanced-field grpc-advanced-field--full-width">
              <span className="grpc-advanced-field__label">Request body template (JSON object)</span>
              <textarea
                className="grpc-advanced-input grpc-advanced-textarea"
                data-testid="grpc-load-test-request-template"
                value={config.requestTemplateJson ?? ''}
                disabled={advanced.loadTestRunning}
                placeholder={'{"message":"hello {{runId}}"}'}
                onChange={(event) => {
                  advanced.patchLoadTestConfig({
                    requestTemplateJson: event.target.value,
                  });
                }}
              />
            </label>
          )}
        </div>

        {advanced.loadTestValidationError && (
          <p className="grpc-advanced-hint grpc-advanced-hint--error" data-testid="grpc-load-test-validation-error">
            {advanced.loadTestValidationError}
          </p>
        )}

        <div className="grpc-advanced-card grpc-advanced-card--nested" data-testid="grpc-load-test-profiles">
          <div className="grpc-advanced-card__header">
            <h3 className="grpc-advanced-card__title">Saved profiles</h3>
          </div>
          <div className="grpc-advanced-card__body">
            <div className="grpc-advanced-form-grid grpc-advanced-form-grid--two">
              <label className="grpc-advanced-field">
                <span className="grpc-advanced-field__label">Profile</span>
                <select
                  className="grpc-advanced-select"
                  data-testid="grpc-load-test-profile-select"
                  value={advanced.selectedLoadTestProfileId}
                  disabled={advanced.loadTestProfilesLoading || advanced.loadTestRunning}
                  onChange={(event) => {
                    advanced.setSelectedLoadTestProfileId(event.target.value);
                  }}
                >
                  <option value="">Select a profile…</option>
                  {(advanced.loadTestProfiles ?? []).map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </label>
              <label className="grpc-advanced-field">
                <span className="grpc-advanced-field__label">Profile name</span>
                <input
                  type="text"
                  className="grpc-advanced-input"
                  data-testid="grpc-load-test-profile-name"
                  value={profileName}
                  disabled={advanced.loadTestRunning}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="My load profile"
                />
              </label>
            </div>
            <div className="grpc-advanced-card__actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="grpc-load-test-profile-load"
                disabled={!advanced.selectedLoadTestProfileId || advanced.loadTestRunning}
                onClick={() => advanced.loadLoadTestProfile(advanced.selectedLoadTestProfileId)}
              >
                Load profile
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="grpc-load-test-profile-save"
                disabled={!profileName.trim() || advanced.loadTestRunning}
                onClick={() => { void advanced.saveLoadTestProfile(profileName.trim()); }}
              >
                Save profile
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="grpc-load-test-profile-rename"
                disabled={!advanced.selectedLoadTestProfileId || !profileName.trim() || advanced.loadTestRunning}
                onClick={() => {
                  void advanced.renameLoadTestProfile(advanced.selectedLoadTestProfileId, profileName.trim());
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                data-testid="grpc-load-test-profile-delete"
                disabled={!advanced.selectedLoadTestProfileId || advanced.loadTestRunning}
                onClick={() => { void advanced.removeLoadTestProfile(advanced.selectedLoadTestProfileId); }}
              >
                Delete
              </button>
            </div>
            {advanced.loadTestProfileError && (
              <p className="grpc-advanced-hint grpc-advanced-hint--error" data-testid="grpc-load-test-profile-error">
                {advanced.loadTestProfileError}
              </p>
            )}
          </div>
        </div>

        {advanced.advancedExportError && (
          <p
            className="grpc-advanced-hint grpc-advanced-hint--error"
            data-testid="grpc-load-test-export-error"
          >
            {advanced.advancedExportError}
          </p>
        )}

        <div
          className={`grpc-advanced-status grpc-advanced-status--${status.variant}`}
          data-testid="grpc-load-test-status"
        >
          Status: {status.label}
          {advanced.runtime.loadTest.error?.message && (
            <span className="grpc-advanced-status__detail"> — {advanced.runtime.loadTest.error.message}</span>
          )}
        </div>
      </div>
    </>
  );
}
