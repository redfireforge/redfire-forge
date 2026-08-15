/**
 * @vitest-environment jsdom
 */
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockSimulateHiddenFields, ApiMockSimulateRequestForm } from './ApiMockSimulateRequestForm';

vi.mock('../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange, disabled, 'data-testid': testId }: {
    value: string; onChange: (v: string) => void; disabled?: boolean; 'data-testid'?: string;
  }) => (
    <select data-testid={testId} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
      <option value="GET">GET</option>
      <option value="POST">POST</option>
    </select>
  ),
}));
vi.mock('./ApiMockExpandableText', () => ({
  ApiMockExpandableText: ({ value, onChange, testId, readOnly }: {
    value: string; onChange: (v: string) => void; testId: string; readOnly?: boolean;
  }) => (
    <textarea data-testid={testId} value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />
  ),
}));

describe('ApiMockSimulateHiddenFields', () => {
  it('keeps sr-only fields writable for Rapid Next', () => {
    const setMethod = vi.fn();
    const setPath = vi.fn();
    const setHeaders = vi.fn();
    const setBody = vi.fn();
    const setClientCertSubject = vi.fn();
    const setSeed = vi.fn();
    render(
      <ApiMockSimulateHiddenFields
        method="GET" setMethod={setMethod}
        path="/" setPath={setPath}
        headers="" setHeaders={setHeaders}
        body="" setBody={setBody}
        clientCertSubject="" setClientCertSubject={setClientCertSubject}
        seed="1" setSeed={setSeed}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-simulate-method'), { target: { value: 'POST' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-path'), { target: { value: '/x' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: 'A: 1' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-body'), { target: { value: '{}' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-cert-subject'), { target: { value: 'CN=a' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-seed'), { target: { value: '' } });
    expect(setMethod).toHaveBeenCalledWith('POST');
    expect(setPath).toHaveBeenCalledWith('/x');
    expect(setSeed).toHaveBeenCalledWith('0');
  });
});

describe('ApiMockSimulateRequestForm', () => {
  const fields = {
    method: 'GET', setMethod: vi.fn(),
    path: '/users', setPath: vi.fn(),
    headers: '', setHeaders: vi.fn(),
    body: '', setBody: vi.fn(),
    clientCertSubject: '', setClientCertSubject: vi.fn(),
    seed: '42', setSeed: vi.fn(),
    nameInputRef: createRef<HTMLInputElement>(),
    onSaveAsSample: vi.fn(),
    onRenameSavedSample: vi.fn(),
    onEditInAdhoc: vi.fn(),
  };

  it('saves from the ad-hoc scratch pad', () => {
    render(
      <ApiMockSimulateRequestForm
        {...fields}
        requestReadOnly={false}
        selectedIsAdHoc
        selectedIsFromRules={false}
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-simulate-path'), { target: { value: '/n' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-headers'), { target: { value: 'H: 1' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-body'), { target: { value: '{}' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-cert-subject'), { target: { value: 'CN=x' } });
    fireEvent.change(screen.getByTestId('api-mock-simulate-seed'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('api-mock-simulate-save-sample'));
    expect(fields.onSaveAsSample).toHaveBeenCalled();
    expect(fields.setSeed).toHaveBeenCalledWith('0');
  });

  it('renames a saved sample and offers Edit in Ad-hoc', () => {
    render(
      <ApiMockSimulateRequestForm
        {...fields}
        requestReadOnly
        selectedIsAdHoc={false}
        selectedIsFromRules={false}
        selectedName="Health"
      />,
    );
    fireEvent.change(screen.getByTestId('api-mock-simulate-sample-name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByTestId('api-mock-sim-edit-adhoc'));
    expect(fields.onRenameSavedSample).toHaveBeenCalledWith('Renamed');
    expect(fields.onEditInAdhoc).toHaveBeenCalled();
  });

  it('hides the name field for from-rules probes', () => {
    render(
      <ApiMockSimulateRequestForm
        {...fields}
        requestReadOnly
        selectedIsAdHoc={false}
        selectedIsFromRules
      />,
    );
    expect(screen.queryByTestId('api-mock-simulate-sample-name')).toBeNull();
    expect(screen.getByTestId('api-mock-sim-edit-adhoc')).toBeTruthy();
  });
});
