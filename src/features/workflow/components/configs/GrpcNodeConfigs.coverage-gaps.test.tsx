/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GrpcAssertConfig from './GrpcAssertConfig';
import GrpcLoadTestConfig from './GrpcLoadTestConfig';
import GrpcMockAssertConfig from './GrpcMockAssertConfig';
import GrpcUnaryConfig from './GrpcUnaryConfig';
import GrpcServerStreamConfig from './GrpcServerStreamConfig';
import GrpcSchemaDiffConfig from './GrpcSchemaDiffConfig';

vi.mock('../../hooks/useGrpcWorkflowTargetReflection', () => ({
  useGrpcWorkflowTargetReflection: () => ({
    descriptor: null,
    services: [],
    status: 'idle',
    errorMessage: undefined,
    reflectNow: vi.fn(),
  }),
}));

vi.mock('../../../../engine/grpcConnectionProfileHydration', () => ({
  loadGrpcConnectionProfilesFromStorage: () => [],
}));

vi.mock('../../../../shared/grpc/targetValidation', () => ({
  validateResolvedGrpcTargetAddress: () => ({ valid: true }),
}));

vi.mock('../../utils/grpcWorkflowReflection', () => ({
  buildGrpcWorkflowReflectionPatch: () => ({}),
  listGrpcWorkflowMethods: () => [],
}));

vi.mock('./GrpcWorkflowConnectionSecurityFields', () => ({
  default: () => null,
}));

function getTextareas(container: HTMLElement): HTMLTextAreaElement[] {
  return Array.from(container.querySelectorAll('textarea')) as HTMLTextAreaElement[];
}

function textareaByLabel(container: HTMLElement, labelText: string): HTMLTextAreaElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === labelText);
  const control = label?.parentElement?.querySelector('textarea');
  if (!control) {
    throw new Error(`Could not find textarea for label "${labelText}"`);
  }
  return control as HTMLTextAreaElement;
}

function rowControl<T extends HTMLElement>(container: HTMLElement, labelText: string, selector: string): T {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === labelText);
  const control = label?.parentElement?.querySelector(selector);
  if (!control) {
    throw new Error(`Could not find ${selector} for label "${labelText}"`);
  }
  return control as T;
}

describe('Grpc node config coverage gaps', () => {
  it('GrpcAssertConfig updates scalar fields and accepts only JSON array assertions', () => {
    const onChange = vi.fn();
    const data = {
      label: 'assert',
      source: 'grpc-unary-1',
      onError: 'fail',
      assertions: [{ grpcStatus: 0 }],
    } as any;
    const { container, getByDisplayValue, rerender } = render(<GrpcAssertConfig data={data} onChange={onChange} />);

    fireEvent.change(getByDisplayValue('assert'), { target: { value: 'assert-2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'assert-2' }));

    fireEvent.change(getByDisplayValue('grpc-unary-1'), { target: { value: 'saved.alias' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'saved.alias' }));

    fireEvent.change(container.querySelector('select')!, { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onError: 'continue' }));

    const textarea = getTextareas(container)[0];
    fireEvent.change(textarea, { target: { value: '[{"path":"$.ok","equals":true}]' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assertions: [{ path: '$.ok', equals: true }] }));

    const callsBeforeInvalid = onChange.mock.calls.length;
    fireEvent.change(textarea, { target: { value: '{"not":"array"}' } });
    expect(onChange.mock.calls.length).toBe(callsBeforeInvalid);

    fireEvent.change(textarea, { target: { value: 'invalid-json' } });
    expect(onChange.mock.calls.length).toBe(callsBeforeInvalid);

    // Cover assertions sync effect branch.
    rerender(<GrpcAssertConfig data={{ ...data, assertions: [{ grpcStatus: 1 }] }} onChange={onChange} />);
    expect(textarea).toHaveValue(JSON.stringify([{ grpcStatus: 1 }], null, 2));

    // Cover undefined fallback branches.
    rerender(<GrpcAssertConfig data={{ ...data, onError: undefined, assertions: undefined }} onChange={onChange} />);
    expect(container.querySelector('select')).toHaveValue('fail');
    expect(textarea).toHaveValue('[]');

    // Cover useState initializer undefined branch on first mount.
    const initUndefined = render(
      <GrpcAssertConfig data={{ ...data, assertions: undefined, onError: undefined }} onChange={vi.fn()} />,
    );
    expect(getTextareas(initUndefined.container)[0]).toHaveValue('[]');
    expect(initUndefined.container.querySelector('select')).toHaveValue('fail');
  });

  it('GrpcLoadTestConfig handles object JSON parsing and optional fields', () => {
    const onChange = vi.fn();
    const data = {
      label: 'load',
      target: '127.0.0.1:50051',
      descriptorKey: 'dk',
      service: 'pkg.Svc',
      method: 'Run',
      profileId: 'p1',
      timeoutMs: 30000,
      onError: 'fail',
      saveAs: 'summary',
      body: { id: 1 },
      loadTest: { concurrency: 1, totalCalls: 10 },
    } as any;
    const { container, rerender } = render(<GrpcLoadTestConfig data={data} onChange={onChange} />);
    const prefix = 'grpc-load-test-config';

    fireEvent.change(container.querySelector('.wf-config-body > .wf-config-field--row input')!, { target: { value: 'load-2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'load-2' }));

    fireEvent.change(screen.getByTestId(`${prefix}-target`), { target: { value: 'localhost:50052' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: 'localhost:50052' }));

    fireEvent.change(screen.getByTestId(`${prefix}-descriptor-key`), { target: { value: 'descriptor.v2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ descriptorKey: 'descriptor.v2' }));

    fireEvent.change(screen.getByTestId(`${prefix}-service`), { target: { value: 'pkg.OtherSvc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ service: 'pkg.OtherSvc' }));

    fireEvent.change(screen.getByTestId(`${prefix}-method`), { target: { value: 'Execute' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'Execute' }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Profile ID', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ profileId: undefined }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Profile ID', 'input'), { target: { value: 'p2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'p2' }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Timeout (ms)', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Timeout (ms)', 'input'), { target: { value: '9000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 9000 }));

    fireEvent.change(rowControl<HTMLSelectElement>(container, 'On Error', 'select'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onError: 'continue' }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Save As', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: undefined }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Save As', 'input'), { target: { value: 'lt.summary' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: 'lt.summary' }));

    const bodyTextarea = textareaByLabel(container, 'Request Body (JSON object)');
    const loadTestTextarea = textareaByLabel(container, 'Load Test Config (JSON object)');
    fireEvent.change(bodyTextarea, { target: { value: '{"name":"alpha"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ body: { name: 'alpha' } }));

    fireEvent.change(loadTestTextarea, { target: { value: '{"concurrency":2,"totalCalls":20}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ loadTest: { concurrency: 2, totalCalls: 20 } }));

    const callsBeforeInvalid = onChange.mock.calls.length;
    fireEvent.change(bodyTextarea, { target: { value: '[1,2,3]' } });
    fireEvent.change(bodyTextarea, { target: { value: 'null' } });
    fireEvent.change(loadTestTextarea, { target: { value: 'invalid-json' } });
    fireEvent.change(loadTestTextarea, { target: { value: 'null' } });
    expect(onChange.mock.calls.length).toBe(callsBeforeInvalid);

    rerender(<GrpcLoadTestConfig data={{ ...data, body: { id: 2 }, loadTest: { concurrency: 3 } }} onChange={onChange} />);
    expect(bodyTextarea).toHaveValue(JSON.stringify({ id: 2 }, null, 2));
    expect(loadTestTextarea).toHaveValue(JSON.stringify({ concurrency: 3 }, null, 2));

    rerender(
      <GrpcLoadTestConfig
        data={{ ...data, profileId: undefined, timeoutMs: undefined, onError: undefined, saveAs: undefined, body: undefined, loadTest: undefined }}
        onChange={onChange}
      />,
    );
    expect(rowControl<HTMLSelectElement>(container, 'On Error', 'select')).toHaveValue('fail');
    expect(rowControl<HTMLInputElement>(container, 'Profile ID', 'input')).toHaveValue('');
    expect(rowControl<HTMLInputElement>(container, 'Timeout (ms)', 'input')).toHaveValue(null);
    expect(rowControl<HTMLInputElement>(container, 'Save As', 'input')).toHaveValue('');

    // Cover useState initializer undefined branches on first mount.
    const initUndefined = render(
      <GrpcLoadTestConfig
        data={{ ...data, body: undefined, loadTest: undefined, onError: undefined, saveAs: undefined, timeoutMs: undefined }}
        onChange={vi.fn()}
      />,
    );
    expect(textareaByLabel(initUndefined.container, 'Request Body (JSON object)')).toHaveValue('{}');
    expect(textareaByLabel(initUndefined.container, 'Load Test Config (JSON object)')).toHaveValue('{}');
    expect(rowControl<HTMLSelectElement>(initUndefined.container, 'On Error', 'select')).toHaveValue('fail');
    expect(rowControl<HTMLInputElement>(initUndefined.container, 'Save As', 'input')).toHaveValue('');
    expect(rowControl<HTMLInputElement>(initUndefined.container, 'Timeout (ms)', 'input')).toHaveValue(null);
  });

  it('GrpcMockAssertConfig handles JSON object fields and expectedBodyValue branches', () => {
    const onChange = vi.fn();
    const data = {
      label: 'mock-assert',
      listenTarget: '127.0.0.1:50061',
      descriptorKey: 'dk',
      service: 'pkg.Mock',
      method: 'Call',
      expectedStatus: 0,
      expectedBodyPath: '$.ok',
      timeoutMs: 1000,
      onError: 'fail',
      saveAs: 'alias',
      body: { a: 1 },
      metadata: { 'x-id': '1' },
      expectedBodyValue: { ok: true },
    } as any;

    const { container, rerender } = render(<GrpcMockAssertConfig data={data} onChange={onChange} />);
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    const textareas = getTextareas(container);

    fireEvent.change(inputs[0], { target: { value: 'mock-assert-2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'mock-assert-2' }));

    fireEvent.change(inputs[1], { target: { value: '127.0.0.1:50062' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ listenTarget: '127.0.0.1:50062' }));

    fireEvent.change(inputs[2], { target: { value: 'dk.v2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ descriptorKey: 'dk.v2' }));

    fireEvent.change(inputs[3], { target: { value: 'pkg.MockSvc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ service: 'pkg.MockSvc' }));

    fireEvent.change(inputs[4], { target: { value: 'AssertCall' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'AssertCall' }));

    fireEvent.change(inputs[5], { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expectedStatus: 0 }));

    fireEvent.change(inputs[6], { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expectedBodyPath: undefined }));

    fireEvent.change(inputs[7], { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));

    fireEvent.change(container.querySelector('select')!, { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onError: 'continue' }));

    fireEvent.change(inputs[8], { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: undefined }));

    fireEvent.change(textareas[0], { target: { value: '{"k":"v"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ body: { k: 'v' } }));

    fireEvent.change(textareas[1], { target: { value: '{"x":"y"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ metadata: { x: 'y' } }));

    fireEvent.change(textareas[2], { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expectedBodyValue: undefined }));

    fireEvent.change(textareas[2], { target: { value: '{"ok":false}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ expectedBodyValue: { ok: false } }));

    const callsBeforeInvalid = onChange.mock.calls.length;
    fireEvent.change(textareas[0], { target: { value: 'not-json' } });
    fireEvent.change(textareas[1], { target: { value: '[1,2]' } });
    fireEvent.change(textareas[2], { target: { value: 'not-json' } });
    expect(onChange.mock.calls.length).toBe(callsBeforeInvalid);

    // Cover expectedBodyValue effect branch for undefined.
    rerender(<GrpcMockAssertConfig data={{ ...data, expectedBodyValue: undefined }} onChange={onChange} />);
    expect(textareas[2]).toHaveValue('');

    // Cover nullish fallback branches across optional fields.
    rerender(
      <GrpcMockAssertConfig
        data={{
          ...data,
          expectedStatus: undefined,
          expectedBodyPath: undefined,
          timeoutMs: undefined,
          onError: undefined,
          saveAs: undefined,
          body: undefined,
          metadata: undefined,
          expectedBodyValue: undefined,
        }}
        onChange={onChange}
      />,
    );
    expect(container.querySelector('select')).toHaveValue('fail');
    expect(inputs[5]).toHaveValue(0);
    expect(inputs[6]).toHaveValue('');
    expect(inputs[7]).toHaveValue(null);
    expect(inputs[8]).toHaveValue('');

    // Cover useState initializer branches on first mount when values are undefined.
    const initUndefined = render(
      <GrpcMockAssertConfig
        data={{
          ...data,
          timeoutMs: undefined,
          onError: undefined,
          saveAs: undefined,
          body: undefined,
          metadata: undefined,
          expectedBodyValue: undefined,
        }}
        onChange={vi.fn()}
      />,
    );
    const initInputs = Array.from(initUndefined.container.querySelectorAll('input')) as HTMLInputElement[];
    const initTextareas = getTextareas(initUndefined.container);
    expect(initInputs[7]).toHaveValue(null);
    expect(initUndefined.container.querySelector('select')).toHaveValue('fail');
    expect(initTextareas[0]).toHaveValue('{}');
    expect(initTextareas[1]).toHaveValue('{}');
    expect(initTextareas[2]).toHaveValue('');
  });

  it('GrpcUnaryConfig handles object-only JSON fields and optional updates', () => {
    const onChange = vi.fn();
    const data = {
      label: 'unary',
      target: '127.0.0.1:50051',
      descriptorKey: 'dk',
      service: 'pkg.Svc',
      method: 'Unary',
      timeoutMs: 5000,
      onError: 'fail',
      saveAs: 'u1',
      body: { a: 1 },
      metadata: { b: 2 },
    } as any;
    const { container, rerender } = render(<GrpcUnaryConfig data={data} onChange={onChange} />);
    const prefix = 'grpc-unary-config';

    fireEvent.change(screen.getByTestId(`${prefix}-label`), { target: { value: 'unary-2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'unary-2' }));

    fireEvent.change(screen.getByTestId(`${prefix}-target`), { target: { value: 'localhost:50052' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: 'localhost:50052' }));

    fireEvent.change(screen.getByTestId(`${prefix}-descriptor-key`), { target: { value: 'dk.v2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ descriptorKey: 'dk.v2' }));

    fireEvent.change(screen.getByTestId(`${prefix}-service`), { target: { value: 'pkg.NewSvc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ service: 'pkg.NewSvc' }));

    fireEvent.change(screen.getByTestId(`${prefix}-method`), { target: { value: 'Unary2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'Unary2' }));

    fireEvent.change(screen.getByTestId(`${prefix}-timeout`), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));

    fireEvent.change(screen.getByTestId(`${prefix}-timeout`), { target: { value: '7000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 7000 }));

    fireEvent.change(screen.getByTestId(`${prefix}-save-as`), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: undefined }));

    fireEvent.change(screen.getByTestId(`${prefix}-save-as`), { target: { value: 'u.alias' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: 'u.alias' }));

    fireEvent.change(screen.getByTestId(`${prefix}-on-error`), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onError: 'continue' }));

    fireEvent.change(screen.getByTestId(`${prefix}-body`), { target: { value: '{"v":1}' } });
    fireEvent.change(screen.getByTestId(`${prefix}-metadata`), { target: { value: '{"m":2}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ body: { v: 1 } }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ metadata: { m: 2 } }));

    const callsBeforeInvalid = onChange.mock.calls.length;
    fireEvent.change(screen.getByTestId(`${prefix}-body`), { target: { value: '[1]' } });
    fireEvent.change(screen.getByTestId(`${prefix}-body`), { target: { value: 'null' } });
    fireEvent.change(screen.getByTestId(`${prefix}-metadata`), { target: { value: 'bad-json' } });
    fireEvent.change(screen.getByTestId(`${prefix}-metadata`), { target: { value: 'null' } });
    expect(onChange.mock.calls.length).toBe(callsBeforeInvalid);

    rerender(
      <GrpcUnaryConfig
        data={{ ...data, timeoutMs: undefined, onError: undefined, saveAs: undefined, body: undefined, metadata: undefined }}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId(`${prefix}-on-error`)).toHaveValue('fail');
    expect(screen.getByTestId(`${prefix}-timeout`)).toHaveValue(null);
    expect(screen.getByTestId(`${prefix}-save-as`)).toHaveValue('');
    expect(container).toBeTruthy();

    // Cover useState initializer undefined branches on first mount.
    const initUndefined = render(
      <GrpcUnaryConfig
        data={{ ...data, timeoutMs: undefined, onError: undefined, saveAs: undefined, body: undefined, metadata: undefined }}
        onChange={vi.fn()}
      />,
    );
    const q = (testId: string) => initUndefined.container.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
    expect(q(`${prefix}-on-error`)).toHaveValue('fail');
    expect(q(`${prefix}-timeout`)).toHaveValue(null);
    expect(q(`${prefix}-save-as`)).toHaveValue('');
    expect(q(`${prefix}-body`)).toHaveValue('{}');
    expect(q(`${prefix}-metadata`)).toHaveValue('{}');
    expect(initUndefined.container).toBeTruthy();
  });

  it('GrpcServerStreamConfig updates collect fields and guards invalid JSON', () => {
    const onChange = vi.fn();
    const data = {
      label: 'stream',
      target: '127.0.0.1:50051',
      descriptorKey: 'dk',
      service: 'pkg.Svc',
      method: 'ServerStream',
      timeoutMs: 5000,
      collect: { maxMessages: 10, maxDurationMs: 2000, untilExpression: '{{grpc.stream.count}} >= 3' },
      onError: 'fail',
      saveAs: 'stream1',
      body: { q: 1 },
      metadata: { x: '1' },
    } as any;

    const { container, rerender } = render(<GrpcServerStreamConfig data={data} onChange={onChange} />);
    const prefix = 'grpc-server-stream-config';

    fireEvent.change(container.querySelector('.wf-config-body > .wf-config-field--row input')!, { target: { value: 'stream-2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'stream-2' }));

    fireEvent.change(screen.getByTestId(`${prefix}-target`), { target: { value: 'localhost:50053' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: 'localhost:50053' }));

    fireEvent.change(screen.getByTestId(`${prefix}-descriptor-key`), { target: { value: 'dk.v2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ descriptorKey: 'dk.v2' }));

    fireEvent.change(screen.getByTestId(`${prefix}-service`), { target: { value: 'pkg.StreamSvc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ service: 'pkg.StreamSvc' }));

    fireEvent.change(screen.getByTestId(`${prefix}-method`), { target: { value: 'ServerStream2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'ServerStream2' }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Timeout (ms)', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: undefined }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Timeout (ms)', 'input'), { target: { value: '6000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 6000 }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Collect Max Messages', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ collect: expect.objectContaining({ maxMessages: undefined }) }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Collect Max Messages', 'input'), { target: { value: '25' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ collect: expect.objectContaining({ maxMessages: 25 }) }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Collect Max Duration (ms)', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ collect: expect.objectContaining({ maxDurationMs: undefined }) }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Collect Max Duration (ms)', 'input'), { target: { value: '9000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ collect: expect.objectContaining({ maxDurationMs: 9000 }) }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Collect Until Expression', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ collect: expect.objectContaining({ untilExpression: undefined }) }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Collect Until Expression', 'input'), { target: { value: '{{grpc.stream.count}} >= 7' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ collect: expect.objectContaining({ untilExpression: '{{grpc.stream.count}} >= 7' }) }));

    fireEvent.change(rowControl<HTMLSelectElement>(container, 'On Error', 'select'), { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onError: 'continue' }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Save As', 'input'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: undefined }));

    fireEvent.change(rowControl<HTMLInputElement>(container, 'Save As', 'input'), { target: { value: 'stream.alias' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: 'stream.alias' }));

    const bodyTextarea = textareaByLabel(container, 'Request Body (JSON object)');
    const metadataTextarea = textareaByLabel(container, 'Metadata (JSON object)');
    fireEvent.change(bodyTextarea, { target: { value: '{"a":1}' } });
    fireEvent.change(metadataTextarea, { target: { value: '{"b":2}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ body: { a: 1 } }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ metadata: { b: 2 } }));

    const callsBeforeInvalid = onChange.mock.calls.length;
    fireEvent.change(bodyTextarea, { target: { value: '[1,2]' } });
    fireEvent.change(bodyTextarea, { target: { value: 'null' } });
    fireEvent.change(metadataTextarea, { target: { value: 'oops' } });
    fireEvent.change(metadataTextarea, { target: { value: 'null' } });
    expect(onChange.mock.calls.length).toBe(callsBeforeInvalid);

    rerender(
      <GrpcServerStreamConfig
        data={{
          ...data,
          timeoutMs: undefined,
          collect: { maxMessages: undefined, maxDurationMs: undefined, untilExpression: undefined },
          onError: undefined,
          saveAs: undefined,
          body: undefined,
          metadata: undefined,
        }}
        onChange={onChange}
      />,
    );
    expect(rowControl<HTMLSelectElement>(container, 'On Error', 'select')).toHaveValue('fail');
    expect(rowControl<HTMLInputElement>(container, 'Timeout (ms)', 'input')).toHaveValue(null);
    expect(rowControl<HTMLInputElement>(container, 'Collect Max Messages', 'input')).toHaveValue(null);
    expect(rowControl<HTMLInputElement>(container, 'Collect Max Duration (ms)', 'input')).toHaveValue(null);
    expect(rowControl<HTMLInputElement>(container, 'Collect Until Expression', 'input')).toHaveValue('');
    expect(rowControl<HTMLInputElement>(container, 'Save As', 'input')).toHaveValue('');

    // Cover useState initializer undefined branches on first mount.
    const initUndefined = render(
      <GrpcServerStreamConfig
        data={{
          ...data,
          timeoutMs: undefined,
          collect: { maxMessages: undefined, maxDurationMs: undefined, untilExpression: undefined },
          onError: undefined,
          saveAs: undefined,
          body: undefined,
          metadata: undefined,
        }}
        onChange={vi.fn()}
      />,
    );
    expect(textareaByLabel(initUndefined.container, 'Request Body (JSON object)')).toHaveValue('{}');
    expect(textareaByLabel(initUndefined.container, 'Metadata (JSON object)')).toHaveValue('{}');
    expect(rowControl<HTMLSelectElement>(initUndefined.container, 'On Error', 'select')).toHaveValue('fail');
    expect(rowControl<HTMLInputElement>(initUndefined.container, 'Timeout (ms)', 'input')).toHaveValue(null);
    expect(rowControl<HTMLInputElement>(initUndefined.container, 'Save As', 'input')).toHaveValue('');
  });

  it('GrpcSchemaDiffConfig handles checkbox default branch and optional fields', () => {
    const onChange = vi.fn();
    const data = {
      label: 'schema-diff',
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      failOnBreaking: undefined,
      onError: 'fail',
      saveAs: 'diff1',
    } as any;

    const { container, rerender } = render(<GrpcSchemaDiffConfig data={data} onChange={onChange} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    const allInputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    fireEvent.change(allInputs[0], { target: { value: 'schema-diff-2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'schema-diff-2' }));

    fireEvent.change(allInputs[1], { target: { value: 'left.v2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ leftDescriptorKey: 'left.v2' }));

    fireEvent.change(allInputs[2], { target: { value: 'right.v2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rightDescriptorKey: 'right.v2' }));

    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ failOnBreaking: false }));

    const saveAsInput = container.querySelector('input[placeholder="Optional summary alias"]') as HTMLInputElement;
    fireEvent.change(saveAsInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ saveAs: undefined }));

    fireEvent.change(container.querySelector('select')!, { target: { value: 'continue' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onError: 'continue' }));

    rerender(<GrpcSchemaDiffConfig data={{ ...data, failOnBreaking: false }} onChange={onChange} />);
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);

    // Cover onError/saveAs undefined render defaults.
    rerender(<GrpcSchemaDiffConfig data={{ ...data, onError: undefined, saveAs: undefined }} onChange={onChange} />);
    expect(container.querySelector('select')).toHaveValue('fail');
    expect(saveAsInput).toHaveValue('');
  });
});
