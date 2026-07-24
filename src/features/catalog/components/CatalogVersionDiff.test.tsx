/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CatalogVersionDiff from './CatalogVersionDiff';
import type { CatalogSpecDiff, EndpointDiff } from '../types/catalog';

function makeDiff(overrides: Partial<CatalogSpecDiff> = {}): CatalogSpecDiff {
  const added: EndpointDiff[] = [];
  const removed: EndpointDiff[] = [];
  const changed: EndpointDiff[] = [];
  return {
    fromVersion: '1.0.0',
    toVersion: '2.0.0',
    added,
    removed,
    changed,
    summary: { totalAdded: 0, totalRemoved: 0, totalChanged: 0 },
    ...overrides,
  };
}

describe('CatalogVersionDiff', () => {
  it('renders empty state when there are no differences', () => {
    render(<CatalogVersionDiff diff={makeDiff()} />);
    expect(screen.getByText(/No differences found/)).toBeInTheDocument();
    expect(screen.getByText(/v1.0.0 and v2.0.0/)).toBeInTheDocument();
  });

  it('renders added, removed and changed sections with summary badges', () => {
    const diff = makeDiff({
      added: [{ method: 'POST', path: '/users', changeType: 'added', details: ['new field'] }],
      removed: [{ method: 'DELETE', path: '/old', changeType: 'removed' }],
      changed: [{ method: 'GET', path: '/users/{id}', changeType: 'changed', details: ['param added', 'response changed'] }],
      summary: { totalAdded: 1, totalRemoved: 1, totalChanged: 1 },
    });
    render(<CatalogVersionDiff diff={diff} />);

    expect(screen.getByText(/Changes from v1.0.0/)).toBeInTheDocument();
    expect(screen.getByText('+ 1 added')).toBeInTheDocument();
    expect(screen.getByText('− 1 removed')).toBeInTheDocument();
    expect(screen.getByText('~ 1 changed')).toBeInTheDocument();

    expect(screen.getByText('Added Endpoints')).toBeInTheDocument();
    expect(screen.getByText('Removed Endpoints')).toBeInTheDocument();
    expect(screen.getByText('Changed Endpoints')).toBeInTheDocument();

    expect(screen.getByText('/users')).toBeInTheDocument();
    expect(screen.getByText('new field')).toBeInTheDocument();
    expect(screen.getByText('param added')).toBeInTheDocument();
    expect(screen.getByText('response changed')).toBeInTheDocument();
  });

  it('handles an unknown method color gracefully and omits empty sections', () => {
    const diff = makeDiff({
      added: [{ method: 'TRACE' as EndpointDiff['method'], path: '/trace', changeType: 'added' }],
      summary: { totalAdded: 1, totalRemoved: 0, totalChanged: 0 },
    });
    render(<CatalogVersionDiff diff={diff} />);
    expect(screen.getByText('Added Endpoints')).toBeInTheDocument();
    expect(screen.queryByText('Removed Endpoints')).not.toBeInTheDocument();
    expect(screen.queryByText('Changed Endpoints')).not.toBeInTheDocument();
    expect(screen.getByText('TRACE')).toBeInTheDocument();
  });

  it('renders metadata section and badge when metadata exists', () => {
    const diff = makeDiff({
      metadata: ['Title changed', 'Servers changed'],
    });
    render(<CatalogVersionDiff diff={diff} />);
    expect(screen.getByText('⚙ metadata')).toBeInTheDocument();
    expect(screen.getByText('Metadata Changes')).toBeInTheDocument();
    expect(screen.getByText('Title changed')).toBeInTheDocument();
    expect(screen.getByText('Servers changed')).toBeInTheDocument();
  });

  it('renders sub-detail rows trimmed with sub class', () => {
    const diff = makeDiff({
      changed: [{
        method: 'PATCH',
        path: '/users/{id}',
        changeType: 'changed',
        details: ['Request body content types changed', '  Before: application/json', '  After: application/xml'],
      }],
      summary: { totalAdded: 0, totalRemoved: 0, totalChanged: 1 },
    });
    const { container } = render(<CatalogVersionDiff diff={diff} />);
    const subItems = container.querySelectorAll('.cat-vd-sub');
    expect(subItems.length).toBe(2);
    expect(screen.getByText('Before: application/json')).toBeInTheDocument();
    expect(screen.getByText('After: application/xml')).toBeInTheDocument();
  });
});
