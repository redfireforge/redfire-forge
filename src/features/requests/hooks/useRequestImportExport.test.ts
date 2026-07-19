/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRequestImportExport } from './useRequestImportExport';
import type { RequestItem, AuthConfig, Scenario } from '../../../shared/types';

const mockToastShow = vi.fn();
vi.mock('../../../shared/hooks/useToast', () => ({
  useToast: () => ({ show: mockToastShow }),
}));

vi.mock('../../../shared/utils/curlParser', () => ({
  parseCurl: vi.fn((text: string) => ({
    id: 'parsed',
    name: 'Parsed',
    url: 'https://api.example.com/v1',
    method: 'POST',
    headers: [{ key: 'Accept', value: 'json' }],
    body: '{}',
    bodyType: 'json',
    validation: { mode: 'none' },
  })),
}));

vi.mock('../../../shared/utils/curlGenerator', () => ({
  buildCurlCommand: vi.fn(async () => 'curl -X POST https://api.example.com'),
}));

vi.mock('../../scenarios/utils/testEditorUtils', () => ({
  pickJsonFile: vi.fn(),
  unwrapImport: vi.fn((raw: unknown) => raw),
}));

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn(async () => {}),
}));

function makeRequest(overrides: Partial<RequestItem> = {}): RequestItem {
  return {
    id: 'r1',
    name: 'Test',
    url: '/api/test',
    method: 'GET',
    headers: [],
    body: '',
    bodyType: 'none',
    auth: { type: 'none' },
    ...overrides,
  } as RequestItem;
}

function makeOptions(overrides: Partial<Parameters<typeof useRequestImportExport>[0]> = {}) {
  return {
    request: makeRequest(),
    onUpdateRequest: vi.fn(),
    stripToRelative: vi.fn((url: string) => url),
    resolveAuth: vi.fn(() => ({ type: 'none' }) as AuthConfig),
    asDraftScenario: vi.fn(() => ({
      id: 'r1', name: 'Test', url: '/api/test', method: 'GET',
      headers: [], body: '', bodyType: 'none',
      auth: { type: 'none' }, validation: { mode: 'none' },
    })) as () => Scenario,
    subColEnvId: undefined,
    selectedEnvId: undefined,
    setInputMode: vi.fn(),
    setActiveTab: vi.fn(),
    ...overrides,
  };
}

describe('useRequestImportExport', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('initial state', () => {
    it('starts with empty curl text and no generation state', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useRequestImportExport(opts));
      expect(result.current.curlText).toBe('');
      expect(result.current.generatedCurl).toBe('');
      expect(result.current.curlGenerating).toBe(false);
      expect(result.current.curlCopied).toBe(false);
    });
  });

  describe('handleCurlImport', () => {
    it('does nothing when curlText is empty', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.handleCurlImport());
      expect(opts.onUpdateRequest).not.toHaveBeenCalled();
    });

    it('parses curl and updates request', () => {
      const opts = makeOptions();
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.setCurlText('curl -X POST https://api.example.com'));
      act(() => result.current.handleCurlImport());
      expect(opts.onUpdateRequest).toHaveBeenCalled();
      expect(opts.setInputMode).toHaveBeenCalledWith('builder');
    });
  });

  describe('triggerCurlGeneration', () => {
    it('does nothing when URL is empty', async () => {
      const opts = makeOptions({ request: makeRequest({ url: '' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      await act(async () => { await result.current.triggerCurlGeneration(); });
      expect(result.current.generatedCurl).toBe('');
    });

    it('generates curl command for valid URL', async () => {
      const opts = makeOptions({ request: makeRequest({ url: '/api/test' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      await act(async () => { await result.current.triggerCurlGeneration(); });
      expect(result.current.generatedCurl).toBe('curl -X POST https://api.example.com');
    });
  });

  describe('handleCopyToClipboard', () => {
    it('copies generatedCurl to clipboard', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn(async () => {}) },
      });
      const opts = makeOptions({ request: makeRequest({ url: '/api/test' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      await act(async () => { await result.current.triggerCurlGeneration(); });
      await act(async () => { await result.current.handleCopyToClipboard(); });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('curl -X POST https://api.example.com');
      expect(result.current.curlCopied).toBe(true);
    });

    it('resets curlCopied after timeout', async () => {
      vi.useFakeTimers();
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn(async () => {}) },
      });
      const opts = makeOptions({ request: makeRequest({ url: '/api/test' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      await act(async () => { await result.current.triggerCurlGeneration(); });
      await act(async () => { await result.current.handleCopyToClipboard(); });
      expect(result.current.curlCopied).toBe(true);
      act(() => { vi.advanceTimersByTime(2100); });
      expect(result.current.curlCopied).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('handleJsonExport', () => {
    it('exports request as JSON', async () => {
      const { saveFile } = await import('../../../shared/utils/fileSaver');
      const opts = makeOptions({ request: makeRequest({ name: 'MyReq' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      await act(async () => { await result.current.handleJsonExport(); });
      expect(saveFile).toHaveBeenCalled();
      const [blob, fileOpts] = (saveFile as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fileOpts.filename).toBe('MyReq.json');
      expect(blob).toBeInstanceOf(Blob);
    });

    it('uses "request" as fallback filename when name is empty', async () => {
      const { saveFile } = await import('../../../shared/utils/fileSaver');
      const opts = makeOptions({ request: makeRequest({ name: '' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      await act(async () => { await result.current.handleJsonExport(); });
      const [, fileOpts] = (saveFile as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fileOpts.filename).toBe('request.json');
    });
  });

  describe('handleJsonImport', () => {
    it('invokes pickJsonFile and updates request on valid data', async () => {
      const { pickJsonFile } = await import('../../scenarios/utils/testEditorUtils');
      const mockPick = pickJsonFile as ReturnType<typeof vi.fn>;
      mockPick.mockImplementation((cb: (raw: unknown) => void) => {
        cb({ name: 'Imported', url: 'https://api.test.com/v1', method: 'POST', headers: [{ key: 'X', value: 'Y' }], body: '{}', bodyType: 'json' });
      });
      const opts = makeOptions();
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.handleJsonImport());
      expect(opts.onUpdateRequest).toHaveBeenCalledWith(expect.objectContaining({ name: 'Imported', method: 'POST' }));
      expect(opts.setInputMode).toHaveBeenCalledWith('builder');
    });

    it('shows error toast when imported data is invalid', async () => {
      const { pickJsonFile } = await import('../../scenarios/utils/testEditorUtils');
      const mockPick = pickJsonFile as ReturnType<typeof vi.fn>;
      mockPick.mockImplementation((cb: (raw: unknown) => void) => {
        cb({ invalid: true });
      });
      const opts = makeOptions();
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.handleJsonImport());
      expect(opts.onUpdateRequest).not.toHaveBeenCalled();
      expect(mockToastShow).toHaveBeenCalledWith(
        'error',
        'Invalid file',
        'Expected a request with name, url, and method.',
      );
    });
  });

  describe('handleCurlImport — switches to body tab for POST with body', () => {
    it('sets active tab to body when parsed body type is json and method is POST', () => {
      const opts = makeOptions({ request: makeRequest({ name: '' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.setCurlText('curl -X POST https://api.example.com -d "{}"'));
      act(() => result.current.handleCurlImport());
      expect(opts.setActiveTab).toHaveBeenCalledWith('body');
    });

    it('does not switch to body tab when parsed method is GET', async () => {
      const { parseCurl } = await import('../../../shared/utils/curlParser');
      (parseCurl as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        id: 'parsed', name: 'Parsed', url: 'https://api.example.com',
        method: 'GET', headers: [], body: '', bodyType: 'none',
        validation: { mode: 'none' },
      });
      const opts = makeOptions({ request: makeRequest({ name: '' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.setCurlText('curl https://api.example.com'));
      act(() => result.current.handleCurlImport());
      expect(opts.setActiveTab).not.toHaveBeenCalledWith('body');
    });
  });

  describe('handleJsonImport — fallback defaults for missing fields', () => {
    it('uses empty header and inherit auth when imported data has no headers/body/auth', async () => {
      const { pickJsonFile } = await import('../../scenarios/utils/testEditorUtils');
      const mockPick = pickJsonFile as ReturnType<typeof vi.fn>;
      mockPick.mockImplementation((cb: (raw: unknown) => void) => {
        cb({ name: 'Bare', url: '/bare', method: 'GET', bodyType: 'none' });
      });
      const opts = makeOptions();
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.handleJsonImport());
      const call = opts.onUpdateRequest.mock.calls[0][0];
      expect(call.headers).toEqual([{ key: '', value: '' }]);
      expect(call.body).toBe('');
      expect(call.auth).toEqual({ type: 'inherit' });
    });
  });

  describe('handleCurlImport — sets name when request name is empty', () => {
    it('copies parsed name when request has no name', () => {
      const opts = makeOptions({ request: makeRequest({ name: '' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.setCurlText('curl https://x'));
      act(() => result.current.handleCurlImport());
      const call = opts.onUpdateRequest.mock.calls[0][0];
      expect(call.name).toBe('Parsed');
    });

    it('does not overwrite existing request name', () => {
      const opts = makeOptions({ request: makeRequest({ name: 'Existing' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      act(() => result.current.setCurlText('curl https://x'));
      act(() => result.current.handleCurlImport());
      const call = opts.onUpdateRequest.mock.calls[0][0];
      expect(call.name).toBeUndefined();
    });
  });

  describe('triggerCurlGeneration — error handling', () => {
    it('shows error comment when buildCurlCommand throws', async () => {
      const { buildCurlCommand } = await import('../../../shared/utils/curlGenerator');
      (buildCurlCommand as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('auth failed'));
      const opts = makeOptions({ request: makeRequest({ url: '/api/x' }) });
      const { result } = renderHook(() => useRequestImportExport(opts));
      await act(async () => { await result.current.triggerCurlGeneration(); });
      expect(result.current.generatedCurl).toContain('# Error:');
    });
  });
});
