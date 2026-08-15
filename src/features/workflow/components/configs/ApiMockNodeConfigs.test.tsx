/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { loadApiMockWorkspace } from '../../../api-mock/apiMockPersistence';
import {
  ApiMockStartConfig,
  ApiMockApplyConfig,
  ApiMockResetStateConfig,
  ApiMockStopConfig,
  ApiMockAssertCallsConfig,
} from './ApiMockNodeConfigs';
import { pickHealedMockServerId } from './apiMockNodeConfigHelpers';

vi.mock('../../../api-mock/apiMockPersistence', () => ({
  API_MOCK_WORKSPACE_PERSISTED_EVENT: 'api-mock:workspace-persisted',
  API_MOCK_RUNTIME_CHANGED_EVENT: 'api-mock:runtime-changed',
  peekApiMockWorkspaceSnapshot: vi.fn(() => null),
  loadApiMockWorkspace: vi.fn(async () => ({
    servers: [
      { id: 'srv-1', name: 'Mock A', port: 4600 },
      { id: 'srv-2', name: 'Mock B', port: 4601 },
    ],
    activeServerId: 'srv-1',
  })),
}));

vi.mock('../../../api-mock/apiMockGalleryImport', () => ({
  API_MOCK_WORKSPACE_CHANGED_EVENT: 'api-mock:workspace-changed',
}));

vi.mock('../../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, options, 'aria-label': aria, 'data-testid': testId }: {
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string; disabled?: boolean }>;
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

const defaultWorkspace = {
  servers: [
    { id: 'srv-1', name: 'Mock A', port: 4600 },
    { id: 'srv-2', name: 'Mock B', port: 4601 },
  ],
  activeServerId: 'srv-1',
};

describe('ApiMockNodeConfigs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadApiMockWorkspace).mockResolvedValue(defaultWorkspace);
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

    expect(screen.getByTestId('api-mock-wf-port-vars')).toBeTruthy();
    fireEvent.change(screen.getByTestId('api-mock-wf-save-port'), { target: { value: 'portVar' } });
    expect(onChange).toHaveBeenCalledWith({ savePortAs: 'portVar' });
    fireEvent.change(screen.getByTestId('api-mock-wf-save-base-url'), { target: { value: 'baseVar' } });
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

  it('reloads the server list when Studio publishes an empty workspace', async () => {
    vi.mocked(loadApiMockWorkspace)
      .mockResolvedValueOnce({
        servers: [{ id: 'srv-1', name: 'Mock A', port: 4600 }],
        activeServerId: 'srv-1',
      })
      .mockResolvedValue({ servers: [], activeServerId: undefined });
    render(
      <ApiMockStartConfig
        data={{ serverId: 'srv-1', isolateRun: true }}
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Mock A (:4600)')).toBeTruthy());

    window.dispatchEvent(new CustomEvent('api-mock:workspace-persisted'));

    await waitFor(() => expect(screen.getByText('No Studio servers')).toBeTruthy());
  });

  it('heals a remapped-stale id to the active Studio server', async () => {
    const onChange = vi.fn();
    render(
      <ApiMockStartConfig
        data={{ serverId: 'srv-gallery-checkout' }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ serverId: 'srv-1' }));
    expect(screen.queryByText('No Studio servers')).toBeNull();
  });

  it('says Select server when several mocks exist and the node has no id', async () => {
    render(
      <ApiMockStartConfig
        data={{ serverId: '' }}
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Select server…')).toBeTruthy());
    expect(screen.queryByText('No Studio servers')).toBeNull();
    expect(screen.getByText('Mock A (:4600)')).toBeTruthy();
  });

  it('picks a healed mock server id for stale, single, and empty libraries', () => {
    const a = { id: 'srv-1', name: 'A', port: 4600 };
    const b = { id: 'srv-2', name: 'B', port: 4601 };
    expect(pickHealedMockServerId([], 'stale')).toBeUndefined();
    expect(pickHealedMockServerId([a], 'srv-1')).toBeUndefined();
    expect(pickHealedMockServerId([a, b], 'stale', 'srv-2')).toBe('srv-2');
    expect(pickHealedMockServerId([a, b], 'stale')).toBe('srv-1');
    expect(pickHealedMockServerId([a], '')).toBeUndefined();
    expect(pickHealedMockServerId([a, b], '')).toBeUndefined();
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
    expect(screen.getByTestId('api-mock-wf-apply-isolate-hint')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Mock B (:4601)')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-wf-server'), { target: { value: 'srv-2' } });
    expect(onChange).toHaveBeenCalledWith({ serverId: 'srv-2' });
    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith({ onError: 'continue' });

    rerender(<ApiMockResetStateConfig data={{ serverId: '' }} onChange={onChange} />);
    expect(screen.getByTestId('api-mock-reset-config')).toBeTruthy();
    expect(screen.getByTestId('api-mock-wf-reset-option')).toBeTruthy();
    expect(screen.getByText('Clears')).toBeTruthy();
    expect(screen.getByText('Sequence cursors')).toBeTruthy();
    expect(screen.getByText('Match counters')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Mock A (:4600)')).toBeTruthy());
    fireEvent.change(screen.getByTestId('api-mock-wf-server'), { target: { value: 'srv-1' } });
    expect(onChange).toHaveBeenCalledWith({ serverId: 'srv-1' });
    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith({ onError: 'continue' });

    rerender(<ApiMockStopConfig data={{ serverId: 'srv-1', idempotent: true }} onChange={onChange} />);
    expect(screen.getByTestId('api-mock-stop-config')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Mock B (:4601)')).toBeTruthy());
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
    expect(screen.getByText('Target')).toBeTruthy();
    expect(screen.getByText('Call count')).toBeTruthy();
    expect(screen.getByText('Last matching call')).toBeTruthy();
    expect(screen.getByText('Request headers')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Mock B (:4601)')).toBeTruthy());
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
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-status'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ expectedStatus: undefined });
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-body'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ expectedBodyContains: undefined });
    expect(screen.getByTestId('api-mock-wf-assert-body').tagName).toBe('TEXTAREA');
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-body-match'), { target: { value: 'equals' } });
    expect(onChange).toHaveBeenLastCalledWith({ expectedBodyMatch: 'equals' });
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-header'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ expectedHeaderKey: undefined }));
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-header-value'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ expectedHeaderValue: undefined }));
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-recency'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ expectedLastCallWithinMs: undefined });

    rerender(
      <ApiMockAssertCallsConfig data={{ serverId: 'srv-1' }} onChange={onChange} />,
    );
    changeRowInput('Route id', 'rte-2');
    expect(onChange).toHaveBeenLastCalledWith({ routeId: 'rte-2' });
    changeRowInput('Exact count', '9');
    expect(onChange).toHaveBeenLastCalledWith({ expectedCount: 9 });
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-status'), { target: { value: '201' } });
    expect(onChange).toHaveBeenLastCalledWith({ expectedStatus: 201 });
    fireEvent.change(screen.getByLabelText('On error'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenLastCalledWith({ onError: 'continue' });
  });

  it('adds and removes request header rows', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ApiMockAssertCallsConfig
        data={{ serverId: 'srv-1', expectedHeaderKey: 'X-Id', expectedHeaderValue: 'abc' }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('api-mock-wf-assert-headers')).toBeTruthy());
    fireEvent.click(screen.getByTestId('api-mock-wf-assert-header-add'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedHeaders: [
        { key: 'X-Id', value: 'abc' },
        { key: '', value: '' },
      ],
    }));

    rerender(
      <ApiMockAssertCallsConfig
        data={{
          serverId: 'srv-1',
          expectedHeaders: [
            { key: 'X-Id', value: 'abc' },
            { key: '', value: '' },
          ],
        }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-wf-assert-header-1'), { target: { value: 'X-Trace' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedHeaders: [
        { key: 'X-Id', value: 'abc' },
        { key: 'X-Trace', value: '' },
      ],
      expectedHeaderKey: 'X-Id',
      expectedHeaderValue: 'abc',
    }));

    fireEvent.click(screen.getByLabelText('Remove header 2'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedHeaders: [{ key: 'X-Id', value: 'abc' }],
    }));
  });
});
