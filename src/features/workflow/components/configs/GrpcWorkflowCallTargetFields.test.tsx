/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GrpcWorkflowCallTargetFields from './GrpcWorkflowCallTargetFields';

const reflectNow = vi.fn(async () => {});

type ReflectionState = {
  descriptor: unknown;
  services: Array<{ fullName: string }>;
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage?: string;
};

const reflectionState: ReflectionState = {
  descriptor: null,
  services: [],
  status: 'idle',
};

let targetValid = true;
let patchToReturn: Record<string, unknown> = {};
let methodsToReturn: Array<{ name: string; callType: string }> = [];

vi.mock('../../hooks/useGrpcWorkflowTargetReflection', () => ({
  useGrpcWorkflowTargetReflection: () => ({
    descriptor: reflectionState.descriptor,
    services: reflectionState.services,
    status: reflectionState.status,
    errorMessage: reflectionState.errorMessage,
    reflectNow,
  }),
}));

vi.mock('../../utils/grpcWorkflowReflection', () => ({
  buildGrpcWorkflowReflectionPatch: () => patchToReturn,
  listGrpcWorkflowMethods: () => methodsToReturn,
}));

vi.mock('../../../../shared/grpc/targetValidation', () => ({
  validateResolvedGrpcTargetAddress: () => ({ valid: targetValid }),
}));

vi.mock('../../../../engine/grpcConnectionProfileHydration', () => ({
  loadGrpcConnectionProfilesFromStorage: () => [
    {
      id: 'local-echo',
      name: 'Local Echo',
      target: 'localhost:50051',
      tlsMode: 'disabled',
    },
    {
      id: 'no-target',
      name: 'No Target',
      target: '',
      tlsMode: 'disabled',
    },
  ],
}));

type TestData = {
  target: string;
  tlsMode?: 'disabled' | 'tls' | 'mtls';
  connectionId?: string;
  descriptorKey: string;
  service: string;
  method: string;
};

function renderComponent(data: TestData, onChange = vi.fn()) {
  render(
    <GrpcWorkflowCallTargetFields
      data={data}
      onChange={onChange}
      callType="unary"
      testIdPrefix="grpc-test"
    />,
  );
  return { onChange };
}

describe('GrpcWorkflowCallTargetFields', () => {
  beforeEach(() => {
    reflectionState.descriptor = null;
    reflectionState.services = [];
    reflectionState.status = 'idle';
    reflectionState.errorMessage = undefined;
    targetValid = true;
    patchToReturn = {};
    methodsToReturn = [];
    reflectNow.mockClear();
  });

  it('renders loading status copy', () => {
    reflectionState.status = 'loading';
    renderComponent({ target: '127.0.0.1:50051', descriptorKey: '', service: '', method: '' });

    expect(screen.getByTestId('grpc-test-reflect-status').getAttribute('data-status')).toBe('loading');
    expect(screen.getByText('Reflecting target…')).toBeTruthy();
  });

  it('renders ready status with service count pluralization', () => {
    reflectionState.status = 'ready';
    reflectionState.services = [{ fullName: 'pkg.A' }, { fullName: 'pkg.B' }];
    renderComponent({ target: '127.0.0.1:50051', descriptorKey: '', service: '', method: '' });

    expect(screen.getByText('2 services loaded via reflection')).toBeTruthy();
  });

  it('renders error status and triggers retry reflect action', () => {
    reflectionState.status = 'error';
    reflectionState.errorMessage = 'boom';
    renderComponent({ target: '127.0.0.1:50051', descriptorKey: '', service: '', method: '' });

    expect(screen.getByText('boom')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-test-reflect-retry'));
    expect(reflectNow).toHaveBeenCalledTimes(1);
  });

  it('shows validation hint when target is invalid while idle', () => {
    reflectionState.status = 'idle';
    targetValid = false;
    renderComponent({ target: ' bad-target ', descriptorKey: '', service: '', method: '' });

    expect(screen.getByText('Enter a valid host:port to load services')).toBeTruthy();
  });

  it('uses selects for service and method when reflection data exists', () => {
    reflectionState.status = 'ready';
    reflectionState.services = [{ fullName: 'pkg.Greeter' }];
    methodsToReturn = [{ name: 'SayHello', callType: 'unary' }];
    const { onChange } = renderComponent(
      { target: '127.0.0.1:50051', descriptorKey: '', service: 'pkg.Greeter', method: '' },
      vi.fn(),
    );

    const service = screen.getByTestId('grpc-test-service');
    const method = screen.getByTestId('grpc-test-method');
    expect(service.tagName).toBe('SELECT');
    expect(method.tagName).toBe('SELECT');

    fireEvent.change(service, { target: { value: 'pkg.Greeter' } });
    expect(onChange).toHaveBeenCalled();

    fireEvent.change(method, { target: { value: 'SayHello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('applies reflection patch when descriptor is available', () => {
    reflectionState.descriptor = { id: 'd1' };
    patchToReturn = { descriptorKey: 'auto-key', service: 'pkg.Auto', method: 'AutoMethod' };
    const { onChange } = renderComponent({ target: '127.0.0.1:50051', descriptorKey: '', service: '', method: '' });

    expect(onChange).toHaveBeenCalledWith({
      target: '127.0.0.1:50051',
      descriptorKey: 'auto-key',
      service: 'pkg.Auto',
      method: 'AutoMethod',
    });
  });

  it('uses input fields when reflection lists are unavailable and propagates edits', () => {
    reflectionState.status = 'idle';
    reflectionState.services = [];
    methodsToReturn = [];

    const { onChange } = renderComponent(
      { target: '', descriptorKey: '', service: '', method: '' },
      vi.fn(),
    );

    expect(screen.getByText('Service and method lists populate after reflection')).toBeTruthy();

    const targetInput = screen.getByTestId('grpc-test-target');
    const descriptorInput = screen.getByTestId('grpc-test-descriptor-key');
    const serviceInput = screen.getByTestId('grpc-test-service');
    const methodInput = screen.getByTestId('grpc-test-method');

    expect(serviceInput.tagName).toBe('INPUT');
    expect(methodInput.tagName).toBe('INPUT');

    fireEvent.change(targetInput, { target: { value: '10.0.0.5:50051' } });
    fireEvent.change(descriptorInput, { target: { value: 'desc-key' } });
    fireEvent.change(serviceInput, { target: { value: 'pkg.InputService' } });
    fireEvent.change(methodInput, { target: { value: 'InputMethod' } });

    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('skips reflection patch when builder returns an empty patch', () => {
    reflectionState.descriptor = { id: 'd1' };
    patchToReturn = {};
    const onChange = vi.fn();
    renderComponent({ target: '127.0.0.1:50051', descriptorKey: '', service: '', method: '' }, onChange);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps existing target when selecting a profile that already has a target', () => {
    const onChange = vi.fn();
    renderComponent(
      { target: 'custom:50051', descriptorKey: 'k', service: 's', method: 'm' },
      onChange,
    );

    fireEvent.change(screen.getByTestId('grpc-test-connection-profile'), {
      target: { value: 'local-echo' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'local-echo',
      target: 'custom:50051',
      tlsMode: 'disabled',
    }));
  });

  it('renders generic reflection failure copy when error message is absent', () => {
    reflectionState.status = 'error';
    reflectionState.errorMessage = undefined;
    renderComponent({ target: '127.0.0.1:50051', descriptorKey: '', service: '', method: '' });
    expect(screen.getByText('Reflection failed')).toBeTruthy();
  });

  it('renders profile option label when profile target is empty', () => {
    renderComponent({ target: '127.0.0.1:50051', descriptorKey: '', service: '', method: '' });
    expect(screen.getByText('No Target (no target)')).toBeTruthy();
  });

  it('updates connection profile from the paired row', () => {
    const onChange = vi.fn();
    renderComponent(
      { target: '', descriptorKey: 'k', service: 's', method: 'm' },
      onChange,
    );

    fireEvent.change(screen.getByTestId('grpc-test-connection-profile'), {
      target: { value: 'local-echo' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: 'local-echo',
      target: 'localhost:50051',
    }));
  });

  it('renders singular ready status and managed descriptor key with copy action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    reflectionState.status = 'ready';
    reflectionState.services = [{ fullName: 'pkg.Greeter' }];
    renderComponent({
      target: '127.0.0.1:50051',
      descriptorKey: 'grpc://auto-managed-key',
      service: 'pkg.Greeter',
      method: 'SayHello',
    });

    expect(screen.getByText('1 service loaded via reflection')).toBeTruthy();
    expect(screen.getByText('Managed automatically:')).toBeTruthy();

    const descriptor = screen.getByTestId('grpc-test-descriptor-key') as HTMLTextAreaElement;
    expect(descriptor.readOnly).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy descriptor key'));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('grpc://auto-managed-key');
    expect(screen.getByText('Copied')).toBeTruthy();
  });

  it('clears connection profile selection and ignores clipboard copy without a descriptor key', async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const onChange = vi.fn();
    renderComponent(
      { target: '127.0.0.1:50051', descriptorKey: '   ', service: 's', method: 'm', connectionId: 'local-echo' },
      onChange,
    );

    fireEvent.change(screen.getByTestId('grpc-test-connection-profile'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionId: undefined,
    }));

    reflectionState.status = 'ready';
    const { rerender } = render(
      <GrpcWorkflowCallTargetFields
        data={{
          target: '127.0.0.1:50051',
          descriptorKey: 'grpc://auto-managed-key',
          service: 'pkg.Greeter',
          method: 'SayHello',
        }}
        onChange={vi.fn()}
        callType="unary"
        testIdPrefix="grpc-copy-skip"
      />,
    );
    rerender(
      <GrpcWorkflowCallTargetFields
        data={{
          target: '127.0.0.1:50051',
          descriptorKey: '',
          service: 'pkg.Greeter',
          method: 'SayHello',
        }}
        onChange={vi.fn()}
        callType="unary"
        testIdPrefix="grpc-copy-skip"
      />,
    );

    const editableDescriptor = screen.getByTestId('grpc-copy-skip-descriptor-key');
    expect(editableDescriptor.tagName).toBe('TEXTAREA');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('ignores clipboard write failures without surfacing UI errors', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard blocked')),
      },
    });

    reflectionState.status = 'ready';
    renderComponent({
      target: '127.0.0.1:50051',
      descriptorKey: 'grpc://copy-fail',
      service: 'pkg.Greeter',
      method: 'SayHello',
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy descriptor key'));
      await Promise.resolve();
    });
    expect(screen.getByText('Copy')).toBeTruthy();
  });
});
