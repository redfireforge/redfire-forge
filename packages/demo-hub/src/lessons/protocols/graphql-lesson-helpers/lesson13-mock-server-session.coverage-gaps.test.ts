/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import {
  L13,
  resetGqlLesson13SessionFlags,
  mockToggleChecked,
  mockUiEnabled,
  responseLatencyMs,
  liveRestoreComplete,
  clickMockToggleOn,
  clickMockToggleOff,
  expandMockQueryGroup,
} from './lesson13-mock-server-session';

describe('lesson13-mock-server-session — coverage gaps', () => {
  beforeEach(() => {
    resetGqlLesson13SessionFlags();
    document.body.innerHTML = '';
    delete (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('mockToggleChecked reads E2E session flags when desktop mock mode is active', () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    L13.mockEnabled = true;
    expect(mockToggleChecked()).toBe(true);
    L13.mockDisabled = true;
    expect(mockToggleChecked()).toBe(false);
  });

  it('mockUiEnabled requires status row in normal DOM mode', () => {
    document.body.innerHTML = `
      <input type="checkbox" data-testid="gql-mock-toggle" checked />
    `;
    expect(mockUiEnabled()).toBe(false);
    document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-mock-status-row"></div>');
    expect(mockUiEnabled()).toBe(true);
  });

  it('mockToggleChecked reads DOM checkbox when E2E flag absent', () => {
    document.body.innerHTML = `<input type="checkbox" data-testid="gql-mock-toggle" checked />`;
    expect(mockToggleChecked()).toBe(true);
  });

  it('mockUiEnabled returns false when toggle unchecked', () => {
    document.body.innerHTML = `
      <input type="checkbox" data-testid="gql-mock-toggle" />
      <div data-testid="gql-mock-status-row"></div>
    `;
    expect(mockUiEnabled()).toBe(false);
  });

  it('mockToggleChecked returns false when checkbox unchecked in DOM mode', () => {
    document.body.innerHTML = `<input type="checkbox" data-testid="gql-mock-toggle" />`;
    expect(mockToggleChecked()).toBe(false);
  });

  it('mockUiEnabled returns true in E2E desktop mode when mock enabled', () => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
    L13.mockEnabled = true;
    expect(mockUiEnabled()).toBe(true);
  });

  it('responseLatencyMs parses numeric latency from response panel', () => {
    document.body.innerHTML = `<span data-testid="gql-response-latency">Latency: 842 ms</span>`;
    expect(responseLatencyMs()).toBe(842);
  });

  it('responseLatencyMs returns 0 when latency element is missing', () => {
    expect(responseLatencyMs()).toBe(0);
  });

  it('liveRestoreComplete returns false when endpoint uses mock port 3001', () => {
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="http://localhost:3001/graphql" />
      <div data-testid="gql-response-body">{"data":{"health":"ok"}}</div>
    `;
    expect(liveRestoreComplete()).toBe(false);
  });

  it('clickMockToggleOn uses controlled checkbox fallback when dispatch does not stick', async () => {
    const ctx = makeCtx();
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'gql-mock-toggle');
    document.body.appendChild(toggle);
    await clickMockToggleOn(ctx);
    expect(toggle.checked).toBe(true);
  });

  it('clickMockToggleOff uses controlled checkbox fallback when dispatch does not stick', async () => {
    const ctx = makeCtx();
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'gql-mock-toggle');
    toggle.checked = true;
    document.body.appendChild(toggle);
    await clickMockToggleOff(ctx);
    expect(toggle.checked).toBe(false);
  });

  it('expandMockQueryGroup no-ops when Query type group is missing', async () => {
    const ctx = makeCtx();
    await expandMockQueryGroup(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});
