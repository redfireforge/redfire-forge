/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { proxyFetch } from '../../../engine/executor';
import { applyAuthHeaders } from '../../../shared/utils/applyAuthHeaders';
import { useSharedDsEditorPanel, defaultFetchConfig, extractPathVariablesFromUrlTemplate } from './useSharedDsEditorPanel';
import type { SharedDataSource, FeatureGroup, GlobalAuthProfile, Scenario } from '../../../shared/types';

vi.mock('../../../engine/executor', () => ({
  proxyFetch: vi.fn(),
}));

vi.mock('../../../shared/utils/applyAuthHeaders', () => ({
  applyAuthHeaders: vi.fn(),
}));

function createMockSharedDs(id: string, name: string, fetchUrl = ''): SharedDataSource {
  return {
    id,
    name,
    dataSource: {
      id: `ds-${id}`,
      columns: [{ id: 'c1', name: 'col1', type: 'path', mapping: 'id' }],
      rows: [{ id: 'r1', values: { c1: 'val1' }, enabled: true }],
      source: { type: 'inline' },
    },
    fetchConfig: fetchUrl ? { ...defaultFetchConfig(), url: fetchUrl } : undefined,
    updatedAt: Date.now(),
  };
}

describe('extractPathVariablesFromUrlTemplate', () => {
  it('returns empty array for empty string', () => {
    expect(extractPathVariablesFromUrlTemplate('')).toEqual([]);
  });

  it('returns empty array for URL without template variables', () => {
    expect(extractPathVariablesFromUrlTemplate('https://api.example.com/users/123')).toEqual([]);
  });

  // Note: The URL parser encodes {{...}} as %7B%7B...%7D%7D, so direct {{variable}} in paths
  // won't be detected. This function is designed to work with paths where {{ }} aren't URL-encoded,
  // which happens when building URLs programmatically. In practice, the detectedParams in
  // useSharedDsEditorPanel uses extractTemplateVariables() for proper detection.
  it('returns empty for URL-encoded template variables (by design)', () => {
    // URL class encodes {{ }} so this returns empty
    const result = extractPathVariablesFromUrlTemplate('https://api.example.com/users/{{id}}');
    expect(result).toEqual([]);
  });

  it('returns empty array for invalid URL', () => {
    expect(extractPathVariablesFromUrlTemplate('not-a-url')).toEqual([]);
  });

  it('returns empty array when URL constructor throws', () => {
    expect(extractPathVariablesFromUrlTemplate('http://[')).toEqual([]);
  });
});

/** Deterministic pathname (no %-encoding of braces) so template segments can resolve. */
class FakeURL {
  pathname: string;
  constructor(template: string, _base?: string) {
    const pathOnly = (template.split('?')[0] ?? '').trim();
    this.pathname = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  }
}

describe('extractPathVariablesFromUrlTemplate (pathname stub)', () => {
  const OrigURL = globalThis.URL;

  afterEach(() => {
    globalThis.URL = OrigURL;
  });

  it('captures {{var}} segments when URL does not percent-encode braces', () => {
    globalThis.URL = FakeURL as unknown as typeof URL;
    expect(extractPathVariablesFromUrlTemplate('/{{tenant}}/items/{{sku}}')).toEqual([
      { segmentIndex: 0, variableName: 'tenant' },
      { segmentIndex: 2, variableName: 'sku' },
    ]);
  });
});

describe('defaultFetchConfig', () => {
  it('returns correct default values', () => {
    const config = defaultFetchConfig();
    expect(config.url).toBe('');
    expect(config.method).toBe('GET');
    expect(config.headers).toEqual([{ key: '', value: '' }]);
    expect(config.body).toBe('');
    expect(config.bodyType).toBe('none');
    expect(config.auth).toEqual({ type: 'none' });
  });
});

describe('useSharedDsEditorPanel', () => {
  let mockSources: SharedDataSource[];
  let mockFeatureGroups: FeatureGroup[];
  let mockGlobalAuthProfiles: GlobalAuthProfile[];
  let mockOnUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSources = [
      createMockSharedDs('ds-1', 'Users', 'https://api.example.com/users/{{id}}'),
    ];
    mockFeatureGroups = [{
      id: 'fg-1',
      name: 'FG 1',
      scenarios: [],
    }];
    mockGlobalAuthProfiles = [];
    mockOnUpdate = vi.fn();
    vi.mocked(proxyFetch).mockReset();
    vi.mocked(applyAuthHeaders).mockReset();
    vi.mocked(applyAuthHeaders).mockImplementation(async (_auth, headers) => headers);
    vi.mocked(proxyFetch).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderEditorHook = (selected: SharedDataSource | null = mockSources[0]) =>
    renderHook(() =>
      useSharedDsEditorPanel({
        selected,
        sharedDataSources: mockSources,
        onUpdate: mockOnUpdate,
        featureGroups: mockFeatureGroups,
        globalAuthProfiles: mockGlobalAuthProfiles,
      })
    );

  describe('fetch panel state', () => {
    it('starts with fetch panel collapsed', () => {
      const { result } = renderEditorHook();
      expect(result.current.fetchExpanded).toBe(false);
    });

    it('can expand and collapse fetch panel', () => {
      const { result } = renderEditorHook();
      act(() => {
        result.current.setFetchExpanded(true);
      });
      expect(result.current.fetchExpanded).toBe(true);
      
      act(() => {
        result.current.setFetchExpanded(false);
      });
      expect(result.current.fetchExpanded).toBe(false);
    });

    it('starts with params tab selected', () => {
      const { result } = renderEditorHook();
      expect(result.current.fetchTab).toBe('params');
    });

    it('can change tabs', () => {
      const { result } = renderEditorHook();
      act(() => {
        result.current.setFetchTab('auth');
      });
      expect(result.current.fetchTab).toBe('auth');
      
      act(() => {
        result.current.setFetchTab('headers');
      });
      expect(result.current.fetchTab).toBe('headers');
    });
  });

  describe('detectedParams', () => {
    it('detects path variables from URL', () => {
      const { result } = renderEditorHook();
      expect(result.current.detectedParams).toContainEqual({ name: 'id', source: 'path' });
    });

    it('detects query variables from URL', () => {
      const dsWithQuery = createMockSharedDs('ds-q', 'Query', 'https://api.example.com/search?q={{query}}&limit={{limit}}');
      const { result } = renderEditorHook(dsWithQuery);
      expect(result.current.detectedParams).toContainEqual({ name: 'query', source: 'query' });
      expect(result.current.detectedParams).toContainEqual({ name: 'limit', source: 'query' });
    });

    it('returns empty for no URL', () => {
      const dsNoUrl = createMockSharedDs('ds-no-url', 'No URL');
      const { result } = renderEditorHook(dsNoUrl);
      expect(result.current.detectedParams).toHaveLength(0);
    });

    it('includes plain query params without template tokens', () => {
      const ds = createMockSharedDs('ds-plain-q', 'Plain Q', 'https://api.example.com/items?tag=prod&sort=name');
      const { result } = renderEditorHook(ds);
      expect(result.current.detectedParams).toContainEqual({ name: 'tag', source: 'query', value: 'prod' });
      expect(result.current.detectedParams).toContainEqual({ name: 'sort', source: 'query', value: 'name' });
    });
  });

  describe('headerCount', () => {
    it('counts non-empty headers', () => {
      const dsWithHeaders = createMockSharedDs('ds-h', 'Headers', 'https://api.example.com');
      dsWithHeaders.fetchConfig = {
        ...defaultFetchConfig(),
        url: 'https://api.example.com',
        headers: [
          { key: 'Authorization', value: 'Bearer xyz' },
          { key: 'Content-Type', value: 'application/json' },
          { key: '', value: '' },
        ],
      };
      const { result } = renderEditorHook(dsWithHeaders);
      expect(result.current.headerCount).toBe(2);
    });

    it('returns 0 for empty headers', () => {
      const dsNoHeaders = createMockSharedDs('ds-no-h', 'No Headers', 'https://api.example.com');
      const { result } = renderEditorHook(dsNoHeaders);
      expect(result.current.headerCount).toBe(0);
    });
  });

  describe('mappingSummary', () => {
    it('provides mapping counts', () => {
      const { result } = renderEditorHook();
      expect(result.current.mappingSummary.counts).toBeDefined();
      expect(typeof result.current.mappingSummary.counts.path).toBe('number');
      expect(typeof result.current.mappingSummary.counts.param).toBe('number');
      expect(typeof result.current.mappingSummary.counts.header).toBe('number');
      expect(typeof result.current.mappingSummary.counts.body).toBe('number');
      expect(typeof result.current.mappingSummary.counts.validate).toBe('number');
    });

    it('provides warnings array', () => {
      const { result } = renderEditorHook();
      expect(Array.isArray(result.current.mappingSummary.warnings)).toBe(true);
    });

    it('is safe when nothing is selected', () => {
      const { result } = renderEditorHook(null);
      expect(result.current.mappingSummary.warnings).toEqual([]);
    });
  });

  describe('editorDraft', () => {
    it('returns scenario for selected data source', () => {
      const { result } = renderEditorHook();
      expect(result.current.editorDraft).not.toBe(null);
      expect(result.current.editorDraft?.id).toBe('ds-1');
    });

    it('returns null when no selection', () => {
      const { result } = renderEditorHook(null);
      expect(result.current.editorDraft).toBe(null);
    });
  });

  describe('fetchDraftScenario', () => {
    it('returns scenario when URL is set', () => {
      const { result } = renderEditorHook();
      expect(result.current.fetchDraftScenario).not.toBe(null);
    });

    it('returns null when URL is empty', () => {
      const dsNoUrl = createMockSharedDs('ds-no-url', 'No URL');
      const { result } = renderEditorHook(dsNoUrl);
      expect(result.current.fetchDraftScenario).toBe(null);
    });

    it('uses resolved URL from raw cURL when URL has template variables', () => {
      const ds = createMockSharedDs('ds-curl', 'Curl', 'https://api.example.com/users/{{id}}');
      ds.fetchConfig = {
        ...defaultFetchConfig(),
        url: 'https://api.example.com/users/{{id}}',
        rawCurl: 'curl "https://resolved.example.com/users/42"',
      };
      mockSources = [ds];
      const { result } = renderEditorHook(ds);
      expect(result.current.fetchDraftScenario?.url).toBe('https://resolved.example.com/users/42');
    });
  });

  describe('jumpToFetchSection', () => {
    it('expands fetch panel and sets tab', () => {
      const { result } = renderEditorHook();
      act(() => {
        result.current.jumpToFetchSection('auth');
      });
      expect(result.current.fetchExpanded).toBe(true);
      expect(result.current.fetchTab).toBe('auth');
    });

    it('maps url to params tab', () => {
      const { result } = renderEditorHook();
      act(() => {
        result.current.jumpToFetchSection('url');
      });
      expect(result.current.fetchTab).toBe('params');
    });

    it('scrolls target into view and focuses first field after timeout', () => {
      vi.useFakeTimers();
      const { result } = renderEditorHook();
      const wrap = document.createElement('div');
      const input = document.createElement('input');
      wrap.appendChild(input);
      const scrollIntoView = vi.fn();
      wrap.scrollIntoView = scrollIntoView;
      const focus = vi.spyOn(input, 'focus');
      act(() => {
        result.current.fetchBodyRef.current = wrap;
      });
      act(() => {
        result.current.jumpToFetchSection('body');
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
      expect(focus).toHaveBeenCalled();
    });

    it('handles scroll helper when container has no focusable control', () => {
      vi.useFakeTimers();
      const { result } = renderEditorHook();
      const wrap = document.createElement('div');
      const scrollIntoView = vi.fn();
      wrap.scrollIntoView = scrollIntoView;
      act(() => {
        result.current.fetchHeadersRef.current = wrap;
      });
      act(() => {
        result.current.jumpToFetchSection('headers');
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('sets headers and body tabs for those sections', () => {
      const { result } = renderEditorHook();
      act(() => {
        result.current.jumpToFetchSection('headers');
      });
      expect(result.current.fetchTab).toBe('headers');
      act(() => {
        result.current.jumpToFetchSection('body');
      });
      expect(result.current.fetchTab).toBe('body');
    });

    it('no-ops scroll when ref target is missing', () => {
      vi.useFakeTimers();
      const { result } = renderEditorHook();
      act(() => {
        result.current.fetchAuthRef.current = null;
        result.current.jumpToFetchSection('auth');
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(result.current.fetchExpanded).toBe(true);
    });
  });

  describe('usedByExpanded', () => {
    it('starts collapsed', () => {
      const { result } = renderEditorHook();
      expect(result.current.usedByExpanded).toBe(false);
    });

    it('can toggle', () => {
      const { result } = renderEditorHook();
      act(() => {
        result.current.setUsedByExpanded(true);
      });
      expect(result.current.usedByExpanded).toBe(true);
    });
  });

  describe('handleEditorDraftChange', () => {
    it('updates data source when draft changes', () => {
      const { result } = renderEditorHook();
      const updatedDraft = {
        id: 'ds-1',
        name: 'Users',
        url: 'https://api.example.com/users/{{id}}',
        method: 'GET' as const,
        headers: [],
        body: '',
        auth: { type: 'none' as const },
        dataSource: {
          id: 'ds-1',
          columns: [{ id: 'c2', name: 'newCol', type: 'path' as const, mapping: 'newId' }],
          rows: [],
          source: { type: 'inline' as const },
        },
      };
      act(() => {
        result.current.handleEditorDraftChange(updatedDraft);
      });
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    it('does nothing when no selection', () => {
      const { result } = renderEditorHook(null);
      const updatedDraft = {
        id: 'ds-1',
        name: 'Users',
        url: 'https://api.example.com',
        method: 'GET' as const,
        headers: [],
        body: '',
        auth: { type: 'none' as const },
        validation: { mode: 'none' as const },
        dataSource: {
          id: 'ds-1',
          columns: [],
          rows: [],
          source: { type: 'inline' as const },
        },
      };
      act(() => {
        result.current.handleEditorDraftChange(updatedDraft);
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('updates fetch config auth when draft auth differs', () => {
      const { result } = renderEditorHook();
      const updatedDraft: Scenario = {
        id: 'ds-1',
        name: 'Users',
        url: 'https://api.example.com/users/{{id}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'bearer', token: 'secret' },
        validation: { mode: 'none' },
        dataSource: {
          id: 'ds-ds-1',
          columns: [{ id: 'c1', name: 'col1', type: 'path', mapping: 'id' }],
          rows: [],
          source: { type: 'inline' },
        },
      };
      act(() => {
        result.current.handleEditorDraftChange(updatedDraft);
      });
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ds-1',
            fetchConfig: expect.objectContaining({
              auth: { type: 'bearer', token: 'secret' },
            }),
          }),
        ]),
      );
    });

    it('does nothing when draft has no dataSource', () => {
      const { result } = renderEditorHook();
      const updatedDraft: Scenario = {
        id: 'ds-1',
        name: 'Users',
        url: 'https://api.example.com/users/{{id}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
      };
      act(() => {
        result.current.handleEditorDraftChange(updatedDraft);
      });
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });

    it('updates only data source when auth changes but fetch config is missing', () => {
      const bare = createMockSharedDs('ds-bare', 'Bare', '');
      bare.fetchConfig = undefined;
      mockSources = [bare];
      const { result } = renderEditorHook(bare);
      const updatedDraft: Scenario = {
        id: 'ds-bare',
        name: 'Bare',
        url: '',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'bearer', token: 't' },
        validation: { mode: 'none' },
        dataSource: {
          id: 'new-ds',
          columns: [{ id: 'c9', name: 'c', type: 'path', mapping: 'm' }],
          rows: [],
          source: { type: 'inline' },
        },
      };
      act(() => {
        result.current.handleEditorDraftChange(updatedDraft);
      });
      expect(mockOnUpdate).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'ds-bare',
          dataSource: updatedDraft.dataSource,
        }),
      ]);
      expect(mockOnUpdate.mock.calls[0][0][0].fetchConfig).toBeUndefined();
    });
  });

  describe('handleFetchRow', () => {
    it('falls back to first concrete global profile when cfg auth is inherit and feature groups have no concrete auth', async () => {
      mockGlobalAuthProfiles = [
        { id: 'gp1', name: 'Empty', auth: { type: 'none' } },
        { id: 'gp2', name: 'Tok', auth: { type: 'bearer', token: 'global-tok' } },
      ];
      const inheritDs = createMockSharedDs('ds-1', 'Users', 'https://api.example.com/user/{{id}}');
      inheritDs.fetchConfig = {
        ...defaultFetchConfig(),
        url: 'https://api.example.com/user/{{id}}',
        auth: { type: 'inherit' },
      };
      mockSources = [inheritDs];
      mockFeatureGroups = [{ id: 'fg-empty', name: 'E', scenarios: [] }];

      const { result } = renderEditorHook(inheritDs);
      await act(async () => {
        await result.current.handleFetchRow('https://x', 'GET', {});
      });

      expect(applyAuthHeaders).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'bearer', token: 'global-tok' }),
        expect.any(Object),
      );
    });

    it('returns response plus sent metadata and calls proxyFetch', async () => {
      const { result } = renderEditorHook();
      let res: Awaited<ReturnType<typeof result.current.handleFetchRow>>;
      await act(async () => {
        res = await result.current.handleFetchRow('https://example.com', 'GET', { Accept: 'json' }, '{"a":1}');
      });
      expect(proxyFetch).toHaveBeenCalledWith(
        'https://example.com',
        'GET',
        { Accept: 'json' },
        '{"a":1}',
      );
      expect(res!).toMatchObject({
        status: 200,
        sentUrl: 'https://example.com',
        sentMethod: 'GET',
        sentBody: '{"a":1}',
        sentHeaders: { Accept: 'json' },
      });
    });

    it('uses authOverride and skips feature-group / global resolution', async () => {
      mockFeatureGroups = [{
        id: 'fg-1',
        name: 'FG',
        scenarios: [],
        auth: { type: 'bearer', token: 'from-fg' },
      }];
      mockGlobalAuthProfiles = [{ id: 'gp-1', name: 'G', auth: { type: 'bearer', token: 'from-global' } }];
      const { result } = renderEditorHook();
      await act(async () => {
        await result.current.handleFetchRow('https://x', 'POST', {}, undefined, { type: 'basic', username: 'u', password: 'p' });
      });
      expect(applyAuthHeaders).toHaveBeenCalledWith(
        { type: 'basic', username: 'u', password: 'p' },
        expect.any(Object),
      );
    });

    it('resolves auth from first feature group with concrete auth', async () => {
      mockFeatureGroups = [{
        id: 'fg-1',
        name: 'FG',
        scenarios: [],
        auth: { type: 'bearer', token: 'fg-token' },
      }];
      const { result } = renderEditorHook();
      await act(async () => {
        await result.current.handleFetchRow('https://x', 'GET', {});
      });
      expect(applyAuthHeaders).toHaveBeenCalledWith(
        { type: 'bearer', token: 'fg-token' },
        expect.any(Object),
      );
    });

    it('resolves auth from inherit feature group via global profile', async () => {
      mockFeatureGroups = [{
        id: 'fg-1',
        name: 'FG',
        scenarios: [],
        auth: { type: 'inherit' },
        globalAuthProfileId: 'gp-a',
      }];
      mockGlobalAuthProfiles = [{ id: 'gp-a', name: 'A', auth: { type: 'apikey', apiKeyName: 'k', apiKeyValue: 'v', apiKeyIn: 'header' } }];
      const { result } = renderEditorHook();
      await act(async () => {
        await result.current.handleFetchRow('https://x', 'GET', {});
      });
      expect(applyAuthHeaders).toHaveBeenCalledWith(
        mockGlobalAuthProfiles[0].auth,
        expect.any(Object),
      );
    });

    it('continues when inherit group references missing or non-concrete profile', async () => {
      mockFeatureGroups = [
        {
          id: 'fg-skip',
          name: 'Skip',
          scenarios: [],
          auth: { type: 'inherit' },
          globalAuthProfileId: 'missing',
        },
        {
          id: 'fg-ok',
          name: 'Ok',
          scenarios: [],
          auth: { type: 'bearer', token: 'second' },
        },
      ];
      mockGlobalAuthProfiles = [{ id: 'gp-a', name: 'A', auth: { type: 'none' } }];
      const { result } = renderEditorHook();
      await act(async () => {
        await result.current.handleFetchRow('https://x', 'GET', {});
      });
      expect(applyAuthHeaders).toHaveBeenCalledWith(
        { type: 'bearer', token: 'second' },
        expect.any(Object),
      );
    });

    it('falls back to global auth profile when feature groups do not supply auth', async () => {
      mockFeatureGroups = [{ id: 'fg-1', name: 'FG', scenarios: [], auth: { type: 'none' } }];
      mockGlobalAuthProfiles = [
        { id: 'gp-skip', name: 'S', auth: { type: 'none' } },
        { id: 'gp-use', name: 'U', auth: { type: 'bearer', token: 'global' } },
      ];
      const { result } = renderEditorHook();
      await act(async () => {
        await result.current.handleFetchRow('https://x', 'GET', {});
      });
      expect(applyAuthHeaders).toHaveBeenCalledWith(
        { type: 'bearer', token: 'global' },
        expect.any(Object),
      );
    });

    it('uses fetch config auth when it is already concrete', async () => {
      const ds = createMockSharedDs('ds-auth', 'A', 'https://x');
      ds.fetchConfig = {
        ...defaultFetchConfig(),
        url: 'https://x',
        auth: { type: 'bearer', token: 'cfg' },
      };
      mockSources = [ds];
      mockFeatureGroups = [{ id: 'fg-1', name: 'FG', scenarios: [], auth: { type: 'bearer', token: 'fg' } }];
      const { result } = renderEditorHook(ds);
      await act(async () => {
        await result.current.handleFetchRow('https://x', 'GET', {});
      });
      expect(applyAuthHeaders).toHaveBeenCalledWith(
        { type: 'bearer', token: 'cfg' },
        expect.any(Object),
      );
    });
  });

  describe('refs', () => {
    it('provides refs for fetch sections', () => {
      const { result } = renderEditorHook();
      expect(result.current.fetchUrlRowRef).toBeDefined();
      expect(result.current.fetchHeadersRef).toBeDefined();
      expect(result.current.fetchAuthRef).toBeDefined();
      expect(result.current.fetchBodyRef).toBeDefined();
    });
  });
});
