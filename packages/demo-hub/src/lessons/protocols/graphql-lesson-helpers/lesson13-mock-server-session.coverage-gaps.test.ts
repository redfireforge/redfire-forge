/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  L13,
  resetGqlLesson13SessionFlags,
  mockToggleChecked,
  mockUiEnabled,
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
});
