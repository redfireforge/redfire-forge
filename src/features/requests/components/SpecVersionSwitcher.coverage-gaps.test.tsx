/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RequestItem } from '@shared/types';

const { applySpecVersionMock } = vi.hoisted(() => ({
  applySpecVersionMock: vi.fn((version: { id: string }) => ({ activeSpecVersionId: version.id })),
}));

vi.mock('../../../shared/components/CustomSelect', () => ({
  CustomSelect: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <div data-testid="mock-spec-select" data-value={value}>
      <button type="button" onClick={() => onChange('__missing__')}>Missing version</button>
    </div>
  ),
}));

vi.mock('../../catalog/utils/versionMerge', () => ({
  applySpecVersion: applySpecVersionMock,
}));

import { SpecVersionSwitcher } from './SpecVersionSwitcher';

function baseReq(overrides: Partial<RequestItem> = {}): RequestItem {
  return {
    id: 'r',
    name: 'Nm',
    method: 'GET',
    url: '/',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
    ...overrides,
  };
}

describe('SpecVersionSwitcher coverage gaps', () => {
  it('shows a fallback badge when the active spec version id no longer resolves', () => {
    render(
      <SpecVersionSwitcher
        request={baseReq({
          activeSpecVersionId: 'missing',
          specVersions: [
            { id: 'va', catalogVersion: '1.0', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 1, url: '/', method: 'GET', headers: [], body: '' },
            { id: 'vb', catalogVersion: '2.0', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 2, url: '/', method: 'GET', headers: [], body: '' },
          ],
        })}
        onUpdateRequest={vi.fn()}
      />,
    );

    expect(screen.getByText('v?')).toBeInTheDocument();
  });

  it('ignores select values that do not match any known version id', () => {
    const onUpdateRequest = vi.fn();
    render(
      <SpecVersionSwitcher
        request={baseReq({
          activeSpecVersionId: 'va',
          specVersions: [
            { id: 'va', catalogVersion: '1.0', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 1, url: '/', method: 'GET', headers: [], body: '' },
            { id: 'vb', catalogVersion: '2.0', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 2, url: '/', method: 'GET', headers: [], body: '' },
          ],
        })}
        onUpdateRequest={onUpdateRequest}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Missing version' }));

    expect(applySpecVersionMock).not.toHaveBeenCalled();
    expect(onUpdateRequest).not.toHaveBeenCalled();
  });
});