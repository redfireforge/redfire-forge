/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestItem } from '@shared/types';
import {
  getCustomSelectOptionLabels,
  selectOptionByIndex,
} from '../../../test-utils/customSelectHelper';
import { SpecVersionCompareModal } from './SpecVersionCompareModal';

const computeSpecVersionDiff = vi.fn();

vi.mock('../../catalog/utils/versionDiff', () => ({
  computeSpecVersionDiff: (...a: unknown[]) => computeSpecVersionDiff(...a),
}));

afterEach(() => {
  cleanup();
  computeSpecVersionDiff.mockReset();
});

function baseReq(): RequestItem {
  return {
    id: 'rq',
    name: 'R',
    method: 'GET',
    url: '/',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { rules: [], expectedStatus: '^200$', expectedBody: '' },
  };
}

describe('SpecVersionCompareModal', () => {
  it('shows empty selectors when snapshots are unavailable', () => {
    computeSpecVersionDiff.mockReturnValue([]);
    const request = baseReq();
    render(<SpecVersionCompareModal request={request} onClose={() => {}} />);

    expect(screen.getByText(/No differences/)).toBeInTheDocument();
  });

  it('recomputes diff when selectors move and escapes on overlay', () => {
    computeSpecVersionDiff
      .mockReturnValueOnce([{ type: 'added', field: 'url', newValue: 'x' }])
      .mockReturnValue([]);

    const onClose = vi.fn();
    const request: RequestItem = {
      ...baseReq(),
      activeSpecVersionId: 'vb',
      specVersions: [
        { id: 'va', catalogVersion: '1.1', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 1, url: '/a', method: 'GET', headers: [], body: '' },
        { id: 'vb', catalogVersion: '2.2', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 2, url: '/b', method: 'POST', headers: [], body: '' },
      ],
    };

    render(<SpecVersionCompareModal request={request} onClose={onClose} />);

    const modal = document.querySelector('.spec-compare-modal')!;
    selectOptionByIndex(modal, 0, 'v2.2');
    expect(computeSpecVersionDiff).toHaveBeenCalled();

    selectOptionByIndex(modal, 1, 'v1.1');
    expect(screen.getByText(/No differences/)).toBeInTheDocument();

    fireEvent.click(document.querySelector('.spec-compare-overlay')!);
    expect(onClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders added rows with plus markers and survives undefined diff payloads', () => {
    computeSpecVersionDiff.mockReturnValue([
      { type: 'added', field: 'scope', newValue: undefined },
      { type: 'removed', field: 'retiredFlag', oldValue: undefined },
      { type: 'modified', field: 'trace', oldValue: undefined, newValue: undefined },
    ]);

    const request: RequestItem = {
      ...baseReq(),
      activeSpecVersionId: 'vb',
      specVersions: [
        { id: 'va', catalogVersion: 'a', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 1, url: '/', method: 'GET', headers: [], body: '' },
        { id: 'vb', catalogVersion: 'b', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 2, url: '/', method: 'POST', headers: [], body: '' },
      ],
    };

    render(<SpecVersionCompareModal request={request} onClose={() => {}} />);

    const rows = document.querySelectorAll('.spec-compare-row');
    expect(rows[0].querySelector('.spec-compare-icon')).toHaveTextContent('+');
    expect(rows[1].querySelector('.spec-compare-icon')).toHaveTextContent('−');
    expect(rows[2].querySelector('.spec-compare-icon')).toHaveTextContent('~');
  });

  it('shows modified glyphs for diff rows', () => {
    computeSpecVersionDiff.mockReturnValue([
      { type: 'modified', field: 'method', oldValue: 'GET', newValue: 'POST' },
      { type: 'removed', field: 'legacy', oldValue: 'gone' },
    ]);

    const request: RequestItem = {
      ...baseReq(),
      activeSpecVersionId: 'vb',
      specVersions: [
        { id: 'va', catalogVersion: 'a', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 1, url: '/', method: 'GET', headers: [], body: '' },
        { id: 'vb', catalogVersion: 'b', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 2, url: '/', method: 'POST', headers: [], body: '' },
      ],
    };

    render(<SpecVersionCompareModal request={request} onClose={() => {}} />);

    expect(screen.getByText(/GET → POST/)).toBeInTheDocument();
    expect(screen.getByText(/method/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  });

  it('lets operators diff three semantic versions sequentially', () => {
    computeSpecVersionDiff.mockReturnValue([
      { type: 'added', field: 'path', newValue: '/widgets' },
      { type: 'removed', field: 'deprecated', oldValue: 'true' },
    ]);

    const request: RequestItem = {
      ...baseReq(),
      activeSpecVersionId: 'vb',
      specVersions: [
        { id: 'va', catalogVersion: '1.0.0', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 1, url: '/a', method: 'GET', headers: [], body: '' },
        { id: 'vb', catalogVersion: '1.5.5', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 2, url: '/b', method: 'POST', headers: [], body: '' },
        { id: 'vc', catalogVersion: '2.0.0-rc', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 3, url: '/c', method: 'PUT', headers: [], body: '' },
      ],
    };

    render(<SpecVersionCompareModal request={request} onClose={() => {}} />);

    const modal = document.querySelector('.spec-compare-modal')!;
    expect(getCustomSelectOptionLabels(modal, 0).filter(l => /^v\d/.test(l))).toHaveLength(3);
    expect(getCustomSelectOptionLabels(modal, 1).filter(l => /^v\d/.test(l))).toHaveLength(3);

    selectOptionByIndex(modal, 0, 'v2.0.0-rc');
    selectOptionByIndex(modal, 1, 'v1.0.0');
    expect(screen.getByText('path')).toBeInTheDocument();
    expect(screen.getByText('deprecated')).toBeInTheDocument();
  });

  it('closes when Escape fires after subscribing to keydown listeners', () => {
    computeSpecVersionDiff.mockReturnValue([]);
    const onClose = vi.fn();
    render(
      <SpecVersionCompareModal
        request={{
          ...baseReq(),
          activeSpecVersionId: 'vb',
          specVersions: [
            { id: 'va', catalogVersion: 'aa', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 1, url: '/', method: 'GET', headers: [], body: '' },
            { id: 'vb', catalogVersion: 'bb', catalogEntryId: 'e', catalogEndpointId: 'x', importedAt: 2, url: '/', method: 'GET', headers: [], body: '' },
          ],
        }}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks pure additions without active snapshot pairs', () => {
    computeSpecVersionDiff
      .mockReturnValueOnce([])
      .mockReturnValue([{ type: 'added', field: 'savedPathParams', newValue: '[]' }]);

    render(<SpecVersionCompareModal request={{ ...baseReq(), specVersions: [] }} onClose={() => {}} />);
    expect(screen.getByText('No differences')).toBeInTheDocument();

    cleanup();
    const solo: RequestItem = {
      ...baseReq(),
      activeSpecVersionId: 'solo',
      specVersions: [{ id: 'solo', catalogVersion: '0.9', catalogEntryId: 'e', catalogEndpointId: 'ep', importedAt: 1, url: '/', method: 'GET', headers: [], body: '' }],
    };

    render(<SpecVersionCompareModal request={solo} onClose={() => {}} />);
    expect(document.querySelector('.spec-compare-row.added .spec-compare-icon')).toHaveTextContent('+');
    const modal = document.querySelector('.spec-compare-modal')!;
    expect(getCustomSelectOptionLabels(modal, 0)).toContain('v0.9');
    expect(getCustomSelectOptionLabels(modal, 1)).toContain('v0.9');
  });
});