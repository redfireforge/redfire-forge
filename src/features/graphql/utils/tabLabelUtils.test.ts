/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import {
  computeAutoTabLabel,
  getTabPresentation,
  withAutoTabLabel,
  normalizeTabLabels,
} from './tabLabelUtils';
import type { GqlStudioTab } from './tabPersistence';

vi.mock('./monacoGraphqlSetup', () => ({
  deriveTabLabel: vi.fn((query: string) => (query.includes('GetUser') ? 'GetUser' : 'Untitled')),
}));

const makeTab = (overrides: Partial<GqlStudioTab> = {}): GqlStudioTab => ({
  id: 'gql-tab-1',
  label: 'Untitled',
  modelUri: 'inmemory://gql-tab-1',
  query: 'query {\n  \n}',
  variables: '{}',
  headers: [],
  operationType: 'query',
  unsavedChanges: false,
  ...overrides,
});

describe('computeAutoTabLabel', () => {
  it('returns operation name when query is named', () => {
    expect(
      computeAutoTabLabel(
        makeTab({ query: 'query GetUser { user { id } }' }),
      ),
    ).toBe('GetUser');
  });

  it('returns endpoint hostname when query is anonymous and endpoint is set', () => {
    expect(
      computeAutoTabLabel(
        makeTab({ endpoint: 'http://localhost:4041/graphql' }),
      ),
    ).toBe('localhost:4041');
  });

  it('returns profile name when query is anonymous and no endpoint override', () => {
    expect(
      computeAutoTabLabel(makeTab(), 'Staging API'),
    ).toBe('Staging API');
  });

  it('prefers endpoint hostname over profile name', () => {
    expect(
      computeAutoTabLabel(
        makeTab({ endpoint: 'http://localhost:4042/graphql' }),
        'Staging API',
      ),
    ).toBe('localhost:4042');
  });

  it('returns Untitled when no operation name, endpoint, or profile', () => {
    expect(computeAutoTabLabel(makeTab())).toBe('Untitled');
  });

  it('uses resolved page default endpoint when tab has no per-tab override', () => {
    expect(
      computeAutoTabLabel(
        makeTab(),
        null,
        'http://localhost:4041/graphql',
      ),
    ).toBe('localhost:4041');
  });
});

describe('withAutoTabLabel', () => {
  it('updates label from endpoint when not manual', () => {
    const tab = makeTab({ endpoint: 'http://localhost:4041/graphql' });
    expect(withAutoTabLabel(tab).label).toBe('localhost:4041');
  });

  it('preserves manual labels', () => {
    const tab = makeTab({
      label: 'My Tab',
      labelManual: true,
      endpoint: 'http://localhost:4041/graphql',
    });
    expect(withAutoTabLabel(tab).label).toBe('My Tab');
  });

  it('returns same tab reference when label unchanged', () => {
    const tab = makeTab({ label: 'GetUser', query: 'query GetUser { id }' });
    expect(withAutoTabLabel(tab)).toBe(tab);
  });
});

describe('getTabPresentation', () => {
  it('returns hostname as title without subtitle when endpoint drives the label', () => {
    expect(
      getTabPresentation(makeTab({ endpoint: 'http://localhost:4041/graphql' })),
    ).toEqual({ title: 'localhost:4041', subtitle: null });
  });

  it('uses page default endpoint when tab has no override', () => {
    expect(
      getTabPresentation(makeTab(), null, 'http://localhost:4041/graphql'),
    ).toEqual({ title: 'localhost:4041', subtitle: null });
  });

  it('returns manual title with endpoint subtitle when they differ', () => {
    expect(
      getTabPresentation(
        makeTab({
          label: 'GetUsers',
          labelManual: true,
          endpoint: 'https://api.example.com/graphql',
        }),
      ),
    ).toEqual({ title: 'GetUsers', subtitle: 'api.example.com' });
  });

  it('omits endpoint subtitle when manual title inherits page default (no override)', () => {
    expect(
      getTabPresentation(
        makeTab({
          label: 'Demo: Multi-Tab',
          labelManual: true,
        }),
        null,
        'http://localhost:4041/graphql',
      ),
    ).toEqual({ title: 'Demo: Multi-Tab', subtitle: null });
  });

  it('prefers profile subtitle only when title differs from profile name', () => {
    expect(
      getTabPresentation(
        makeTab({ label: 'My Tab', labelManual: true, connectionId: 'prof-1' }),
        'Staging',
      ),
    ).toEqual({ title: 'My Tab', subtitle: 'Staging' });
  });

  it('omits subtitle when profile name is the auto title', () => {
    expect(
      getTabPresentation(makeTab({ connectionId: 'prof-1' }), 'Staging'),
    ).toEqual({ title: 'Staging', subtitle: null });
  });

  it('replaces manual Untitled with hostname from resolved endpoint', () => {
    expect(
      getTabPresentation(
        makeTab({ label: 'Untitled', labelManual: true }),
        null,
        'http://localhost:4041/graphql',
      ),
    ).toEqual({ title: 'localhost:4041', subtitle: null });
  });
});

describe('normalizeTabLabels', () => {
  it('returns same array reference when no labels change', () => {
    const tabs = [makeTab({ label: 'GetUser', query: 'query GetUser { id }' })];
    const result = normalizeTabLabels(tabs, () => null);
    expect(result).toBe(tabs);
  });

  it('updates labels using profile resolver', () => {
    const tabs = [makeTab({ connectionId: 'prof-1' })];
    const result = normalizeTabLabels(tabs, () => 'Staging');
    expect(result[0].label).toBe('Staging');
    expect(result).not.toBe(tabs);
  });
});
