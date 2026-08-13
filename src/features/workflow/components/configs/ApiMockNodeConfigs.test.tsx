/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  ApiMockStartConfig,
  ApiMockApplyConfig,
  ApiMockResetStateConfig,
  ApiMockStopConfig,
  ApiMockAssertCallsConfig,
} from './ApiMockNodeConfigs';

vi.mock('../../../api-mock/apiMockPersistence', () => ({
  loadApiMockWorkspace: vi.fn(async () => ({
    servers: [
      { id: 'srv-1', name: 'Mock A', port: 4600 },
      { id: 'srv-2', name: 'Mock B', port: 4601 },
    ],
    activeServerId: 'srv-1',
  })),
}));

vi.mock('../../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, options, 'aria-label': aria, 'data-testid': testId }: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <select
      aria-label={aria}
      data-testid={testId}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

function changeRowInput(label: string, value: string) {
  const labelEl = screen.getByText(label, { selector: 'label' });
  const input = labelEl.parentElement?.querySelector('input') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

describe('ApiMockNodeConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Start config and patches all fields', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockStartConfig
        data={{ serverId: '', isolateRun: true, savePortAs: 'mockPort', saveBaseUrlAs: 'mockBaseUrl', onError: 'fail' }}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('api-mock-start-config')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-server')).toBeTruthy());

    fireEvent.change(screen.getByTestId('api-mock-wf-server'), { target: { value: 'srv-1' } });
    expect(onChange).toHaveBeenLastCalledWith({ serverId: 'srv-1' });

    fireEvent.change(screen.getByTestId('api-mock-wf-port-override'), { target: { value: '4700' } });
    expect(onChange).toHaveBeenCalledWith({ portOverride: 4700 });

    fireEvent.click(screen.getByTestId('api-mock-wf-isolate'));
    expect(onChange).toHaveBeenCalledWith({ isolateRun: false });

    changeRowInput('Save port as', 'portVar');
    expect(onChange).toHaveBeenCalledWith({ savePortAs: 'portVar' });
    changeRowInput('Save base URL as', 'baseVar');
    expect(onChange).toHaveBeenCalledWith({ saveBaseUrlAs: 'baseVar' });

    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith({ onError: 'continue' });
  });

  it('clears port override when empty', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockStartConfig
        data={{ serverId: 'srv-1', portOverride: 4700 }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-port-override')).toBeTruthy());
    const input = screen.getByTestId('api-mock-wf-port-override') as HTMLInputElement;
    // jsdom number inputs ignore '' via change; drive the handler with a blank value event.
    fireEvent.input(input, { target: { value: '' } });
    // Fallback: invoke onChange path if input event was a no-op for type=number
    if (!onChange.mock.calls.some(c => c[0]?.portOverride === undefined)) {
      fireEvent.change(input, { target: { value: '' } });
    }
    expect(onChange).toHaveBeenCalledWith({ portOverride: undefined });
  });

  it('toggles isolateRun when currently false', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockStartConfig
        data={{ serverId: 'srv-1', isolateRun: false }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-isolate')).toBeTruthy());
    fireEvent.click(screen.getByTestId('api-mock-wf-isolate'));
    expect(onChange).toHaveBeenLastCalledWith({ isolateRun: true });
  });

  it('renders Apply / Reset / Stop configs', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ApiMockApplyConfig data={{ serverId: 'srv-1', onError: 'fail' }} onChange={onChange} />,
    );
    expect(screen.getByTestId('api-mock-apply-config')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-server')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-wf-server'), { target: { value: 'srv-2' } });
    expect(onChange).toHaveBeenCalledWith({ serverId: 'srv-2' });
    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith({ onError: 'continue' });

    rerender(<ApiMockResetStateConfig data={{ serverId: '' }} onChange={onChange} />);
    expect(screen.getByTestId('api-mock-reset-config')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-server')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-wf-server'), { target: { value: 'srv-1' } });
    expect(onChange).toHaveBeenCalledWith({ serverId: 'srv-1' });
    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith({ onError: 'continue' });

    rerender(<ApiMockStopConfig data={{ serverId: 'srv-1', idempotent: true }} onChange={onChange} />);
    expect(screen.getByTestId('api-mock-stop-config')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-server')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-wf-server'), { target: { value: 'srv-2' } });
    expect(onChange).toHaveBeenCalledWith({ serverId: 'srv-2' });
    fireEvent.click(screen.getAllByRole('switch')[0]);
    expect(onChange).toHaveBeenCalledWith({ idempotent: false });
    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith({ onError: 'continue' });
  });

  it('toggles stop idempotent when currently false', async () => {
    const onChange = vi.fn();
    render(<ApiMockStopConfig data={{ serverId: 'srv-1', idempotent: false }} onChange={onChange} />);
    await waitFor(() => expect(screen.getByTestId('api-mock-stop-config')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('switch')[0]);
    expect(onChange).toHaveBeenLastCalledWith({ idempotent: true });
  });

  it('renders Assert config and patches assertion fields', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ApiMockAssertCallsConfig
        data={{
          serverId: 'srv-1',
          routeId: 'rte-1',
          matchedResponseId: 'rsp-1',
          expectedCount: 3,
          expectedMinCount: 1,
          expectedMaxCount: 5,
          expectedStatus: 200,
          expectedBodyContains: 'ok',
          expectedHeaderKey: 'X-Id',
          expectedHeaderValue: 'abc',
          expectedLastCallWithinMs: 1000,
        }}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('api-mock-assert-config')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-server')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-wf-server'), { target: { value: 'srv-2' } });
    expect(onChange).toHaveBeenCalledWith({ serverId: 'srv-2' });

    changeRowInput('Route id', '');
    expect(onChange).toHaveBeenLastCalledWith({ routeId: undefined });
    changeRowInput('Variant id', '');
    expect(onChange).toHaveBeenLastCalledWith({ matchedResponseId: undefined });
    changeRowInput('Exact count', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedCount: undefined });
    changeRowInput('Min count', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedMinCount: undefined });
    changeRowInput('Max count', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedMaxCount: undefined });
    changeRowInput('Status', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedStatus: undefined });
    changeRowInput('Body contains', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedBodyContains: undefined });
    changeRowInput('Header key', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedHeaderKey: undefined });
    changeRowInput('Header value', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedHeaderValue: undefined });
    changeRowInput('Last call within (ms)', '');
    expect(onChange).toHaveBeenLastCalledWith({ expectedLastCallWithinMs: undefined });

    rerender(
      <ApiMockAssertCallsConfig data={{ serverId: 'srv-1' }} onChange={onChange} />,
    );
    changeRowInput('Route id', 'rte-2');
    expect(onChange).toHaveBeenLastCalledWith({ routeId: 'rte-2' });
    changeRowInput('Exact count', '9');
    expect(onChange).toHaveBeenLastCalledWith({ expectedCount: 9 });
    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenLastCalledWith({ onError: 'continue' });
  });
});
