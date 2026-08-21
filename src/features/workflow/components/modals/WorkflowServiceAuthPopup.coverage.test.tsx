/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ServiceAuthPopup } from './WorkflowServiceAuthPopup';
import type { EnvAuthState } from '../../../requests/utils/requestAuthState';
import type { GlobalAuthProfile } from '../../../../shared/types';

vi.mock('../../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) => (
    <select
      data-testid="mock-custom-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));

function makeState(overrides?: Partial<EnvAuthState>): EnvAuthState {
  return {
    authType: 'none',
    bearerPrefix: 'Bearer',
    bearerToken: '',
    basicUser: '',
    basicPass: '',
    apiKeyName: '',
    apiKeyValue: '',
    apiKeyIn: 'header',
    tokenUrl: '',
    clientId: '',
    clientSecret: '',
    selectedProfileId: '',
    ...overrides,
  };
}

function renderPopup(authState: EnvAuthState) {
  const props = {
    envName: 'dev',
    authState,
    globalAuthProfiles: [{
      id: 'p1',
      name: 'Profile One',
      auth: { type: 'bearer', token: 'abc' },
    }] as unknown as GlobalAuthProfile[],
    anchor: { top: 20, left: 580 },
    onUpdate: vi.fn(),
    onReset: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
  const view = render(<ServiceAuthPopup {...props} />);
  return { ...view, props };
}

describe('ServiceAuthPopup coverage branches', () => {
  it('handles unknown auth type with no validation error and allows save', () => {
    const { props } = renderPopup(makeState({ authType: 'mystery' as unknown as EnvAuthState['authType'] }));

    fireEvent.click(screen.getByText('Save'));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('No authentication configured')).toBeNull();
  });

  it('clamps popup position to viewport when anchor would place it off-screen', async () => {
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });

    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getRect(this: HTMLElement): DOMRect {
      if (this.classList?.contains('wf-svc-auth-popup')) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 700,
          bottom: 500,
          width: 700,
          height: 500,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return original.call(this);
    };

    try {
      const { container } = renderPopup(makeState());
      const popup = container.querySelector('.wf-svc-auth-popup') as HTMLElement;

      await waitFor(() => {
        expect(popup.style.left).toBe('12px');
        expect(popup.style.top).toBe('12px');
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
    }
  });

  it('returns early from resize when popup rect is unavailable', () => {
    const { container } = renderPopup(makeState());
    const popup = container.querySelector('.wf-svc-auth-popup') as HTMLDivElement;
    const handle = container.querySelector('.wf-svc-auth-resize--e') as HTMLDivElement;

    const originalRect = popup.getBoundingClientRect;
    popup.getBoundingClientRect = (() => null) as unknown as typeof popup.getBoundingClientRect;

    fireEvent.mouseDown(handle, { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 100, clientY: 20 });

    expect(popup.style.width).toBe('560px');

    popup.getBoundingClientRect = originalRect;
  });

  it('shows global profile validation error when no profile is selected', () => {
    const { props } = renderPopup(makeState({ authType: 'global-profile', selectedProfileId: '' }));

    fireEvent.click(screen.getByText('Save'));

    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Please select a profile')).toBeTruthy();
  });
});
