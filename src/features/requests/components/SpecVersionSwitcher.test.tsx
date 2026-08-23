/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { selectOption, getCustomSelectOptionLabels } from '../../../test-utils/customSelectHelper';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestItem } from '@shared/types';
import * as versionMerge from '../../catalog/utils/versionMerge';
import { SpecVersionSwitcher } from './SpecVersionSwitcher';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

describe('SpecVersionSwitcher', () => {
  it('returns null without specVersions', () => {
    expect(render(<SpecVersionSwitcher request={baseReq()} onUpdateRequest={vi.fn()} />).container.childElementCount).toBe(0);
  });

  it('returns null with only one version row', () => {
    expect(render(<SpecVersionSwitcher request={baseReq({
      activeSpecVersionId: 'va',
      specVersions: [{
        id: 'va',
        catalogVersion: '1',
        catalogEntryId: 'e',
        catalogEndpointId: 'x',
        importedAt: 1,
        url: '/',
        method: 'GET',
        headers: [],
        body: '',
      }],
    })} onUpdateRequest={() => {}} />).container.childElementCount).toBe(0);
  });

  it('shows active badge, applies selection, and invokes compare shortcut', () => {
    const stub = vi.spyOn(versionMerge, 'applySpecVersion').mockReturnValue({
      headers: [{ key: 'X', value: '1' }],
      activeSpecVersionId: 'vb',
    });

    const onUpdateRequest = vi.fn();
    const onCompare = vi.fn();

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
        onCompare={onCompare}
      />,
    );

    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    selectOption(screen.getByLabelText('Switch spec version').closest('.cs-wrapper')!, 'v2.0');

    expect(stub).toHaveBeenCalled();
    expect(onUpdateRequest).toHaveBeenCalledWith({
      headers: [{ key: 'X', value: '1' }],
      activeSpecVersionId: 'vb',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(onCompare).toHaveBeenCalled();
  });

  it('ignores synthetic selects that do not resolve to a version row', () => {
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

    const labels = getCustomSelectOptionLabels(screen.getByLabelText('Switch spec version').closest('.cs-wrapper')!);
    expect(labels).not.toContain('__missing__');
    expect(onUpdateRequest).not.toHaveBeenCalled();
  });
});
