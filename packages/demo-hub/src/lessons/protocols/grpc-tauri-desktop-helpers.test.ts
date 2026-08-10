/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CURRENT_RULE_HIGHLIGHT_SELECTOR,
  grpcTauriDesktopSession,
  hasMockRulesInDom,
  isMockRuntimeTabActive,
  isMockServerPanelVisible,
  readMockListenTargetValue,
  resetGrpcTauriDesktopSession,
  tagCurrentRuleHighlight,
} from './grpc-tauri-desktop-helpers';

describe('grpc-tauri-desktop-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    grpcTauriDesktopSession.transportSwitched = true;
    grpcTauriDesktopSession.firstCallDone = true;
    grpcTauriDesktopSession.inDiagnostics = true;
    grpcTauriDesktopSession.mockRuleAdded = true;
    grpcTauriDesktopSession.mockRunning = true;
    grpcTauriDesktopSession.listenerEnabled = true;
    grpcTauriDesktopSession.authConfigured = true;
  });

  it('resets lesson session flags', () => {
    resetGrpcTauriDesktopSession();
    expect(grpcTauriDesktopSession).toEqual({
      transportSwitched: false,
      firstCallDone: false,
      inDiagnostics: false,
      mockRuleAdded: false,
      mockRunning: false,
      listenerEnabled: false,
      authConfigured: false,
    });
  });

  it('reads listen target value and detects panel/runtime state', () => {
    document.body.innerHTML = `
      <span class="grpc-mock-listen-target-chip__value">127.0.0.1:50099</span>
      <button data-testid="grpc-mock-tab-builder"></button>
      <button data-testid="grpc-mock-tab-runtime" aria-selected="true"></button>
    `;
    expect(readMockListenTargetValue()).toBe('127.0.0.1:50099');
    expect(isMockServerPanelVisible()).toBe(true);
    expect(isMockRuntimeTabActive()).toBe(true);
  });

  it('detects rule DOM and moves the active highlight tag', () => {
    document.body.innerHTML = `
      <div data-testid="grpc-mock-builder-rule-a" data-rule-highlight="true"></div>
      <div data-testid="grpc-mock-builder-rule-b"></div>
    `;
    expect(hasMockRulesInDom()).toBe(true);
    tagCurrentRuleHighlight('b');
    expect(document.querySelectorAll(CURRENT_RULE_HIGHLIGHT_SELECTOR)).toHaveLength(1);
    expect(document.querySelector('[data-testid="grpc-mock-builder-rule-a"]')?.getAttribute('data-rule-highlight')).toBeNull();
    expect(document.querySelector('[data-testid="grpc-mock-builder-rule-b"]')?.getAttribute('data-rule-highlight')).toBe('true');
  });
});