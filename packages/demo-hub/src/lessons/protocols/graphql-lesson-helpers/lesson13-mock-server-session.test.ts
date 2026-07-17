/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  L13,
  resetGqlLesson13SessionFlags,
  mockToggleChecked,
  mockUiEnabled,
} from './lesson13-mock-server-session';
import { GQL } from '@shared/selectors';

describe('lesson13-mock-server-session', () => {
  beforeEach(() => {
    resetGqlLesson13SessionFlags();
    document.body.innerHTML = '';
    delete (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__;
  });

  afterEach(() => {
    resetAllMocks();
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

  it('mockToggleChecked falls back to checkbox in normal DOM mode', () => {
    document.body.innerHTML = `<input type="checkbox" data-testid="gql-mock-toggle" checked />`;
    expect(mockToggleChecked()).toBe(true);
    document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!.checked = false;
    expect(mockToggleChecked()).toBe(false);
  });
});
