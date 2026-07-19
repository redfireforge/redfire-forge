/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConvertSwaggerResult } from '../utils/swaggerToOpenApi';

vi.mock('../utils/swaggerToOpenApi', async () => {
  const actual = await vi.importActual<typeof import('../utils/swaggerToOpenApi')>('../utils/swaggerToOpenApi');
  return { ...actual, convertSwaggerToOpenApiYaml: vi.fn(), upgradeOpenApi3Yaml: vi.fn() };
});

vi.mock('../utils/convertPrefs', () => ({
  loadConvertPref: vi.fn().mockResolvedValue({ engine: 'swagger2openapi', target: '3.0' }),
  saveConvertPref: vi.fn().mockResolvedValue(undefined),
  loadPrettyPref: vi.fn().mockResolvedValue(false),
  savePrettyPref: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/prettyYaml', () => ({
  prettifyOpenApiYaml: vi.fn().mockResolvedValue({ yaml: 'PRETTY_YAML', applied: true }),
}));

vi.mock('../utils/openApiLint', () => ({
  lintOpenApi: vi.fn(),
}));

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn().mockResolvedValue(undefined),
}));

import { convertSwaggerToOpenApiYaml, upgradeOpenApi3Yaml } from '../utils/swaggerToOpenApi';
import { loadConvertPref, saveConvertPref, loadPrettyPref, savePrettyPref } from '../utils/convertPrefs';
import { prettifyOpenApiYaml } from '../utils/prettyYaml';
import { saveFile } from '../../../shared/utils/fileSaver';
import { lintOpenApi } from '../utils/openApiLint';
import CatalogConvertOpenApiModal from './CatalogConvertOpenApiModal';

const RAW = "swagger: '2.0'\ninfo:\n  title: X\n";

function makeResult(overrides: Partial<ConvertSwaggerResult> = {}): ConvertSwaggerResult {
  return {
    yaml: 'openapi: 3.0.4\npaths:\n  /a:\n    get:\n      responses:\n        200: {}\n',
    openapiVersion: '3.0.4',
    engineUsed: 'swagger2openapi',
    fellBack: false,
    valid: true,
    validationErrors: [],
    warnings: [],
    openapi: { openapi: '3.0.4', paths: { '/a': { get: { responses: { 200: {} } } } } },
    ...overrides,
  };
}

function renderModal(props?: Partial<ComponentProps<typeof CatalogConvertOpenApiModal>>) {
  const onClose = vi.fn();
  const showToast = vi.fn();
  render(
    <CatalogConvertOpenApiModal
      specName="My Service / Prod"
      rawSpec={RAW}
      onClose={onClose}
      showToast={showToast}
      {...props}
    />,
  );
  return { onClose, showToast };
}

beforeEach(() => {
  vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult());
  vi.mocked(loadConvertPref).mockResolvedValue({ engine: 'swagger2openapi', target: '3.0' });
  vi.mocked(loadPrettyPref).mockResolvedValue(false);
  vi.mocked(savePrettyPref).mockResolvedValue(undefined);
  vi.mocked(prettifyOpenApiYaml).mockResolvedValue({ yaml: 'PRETTY_YAML', applied: true });
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText: vi.fn(() => Promise.resolve()) },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('CatalogConvertOpenApiModal', () => {
  it('loads the persisted pref, converts on open, and shows a valid badge', async () => {
    renderModal();

    await waitFor(() => expect(loadConvertPref).toHaveBeenCalled());
    await waitFor(() => expect(convertSwaggerToOpenApiYaml).toHaveBeenCalledWith(RAW, { engine: 'swagger2openapi', target: '3.0' }));
    expect(await screen.findByText('Valid OpenAPI 3.0.4')).toBeInTheDocument();

    const download = screen.getByRole('button', { name: /Download YAML/ });
    expect(download).toBeEnabled();
  });

  it('renders the converted YAML in the preview', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    expect(screen.getByText(/openapi: 3.0.4/)).toBeInTheDocument();
  });

  it('copies the YAML preview to the clipboard and shows transient "Copied" feedback', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    const copyBtn = screen.getByTestId('catalog-convert-copy-btn');
    expect(copyBtn).toBeEnabled();

    fireEvent.click(copyBtn);

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(makeResult().yaml));
    await waitFor(() => expect(copyBtn.textContent).toBe('✓ Copied'));
  });

  it('disables the 3.1 target when swagger2openapi is selected', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    const target31 = screen.getByRole('radio', { name: 'OpenAPI 3.1' });
    expect(target31).toBeDisabled();
  });

  it('re-converts when the engine is switched to Scalar', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    vi.mocked(convertSwaggerToOpenApiYaml).mockClear();

    fireEvent.click(screen.getByRole('radio', { name: /Scalar/ }));

    await waitFor(() => expect(convertSwaggerToOpenApiYaml).toHaveBeenCalledWith(RAW, { engine: 'scalar', target: '3.0' }));
    // 3.1 now selectable
    expect(screen.getByRole('radio', { name: 'OpenAPI 3.1' })).toBeEnabled();
  });

  it('converts to 3.1 when Scalar + 3.1 are selected', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    fireEvent.click(screen.getByRole('radio', { name: /Scalar/ }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'OpenAPI 3.1' })).toBeEnabled());

    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({ openapiVersion: '3.1.1', engineUsed: 'scalar' }));
    fireEvent.click(screen.getByRole('radio', { name: 'OpenAPI 3.1' }));

    await waitFor(() => expect(convertSwaggerToOpenApiYaml).toHaveBeenCalledWith(RAW, { engine: 'scalar', target: '3.1' }));
  });

  it('forces target back to 3.0 when switching from Scalar/3.1 to swagger2openapi', async () => {
    vi.mocked(loadConvertPref).mockResolvedValue({ engine: 'scalar', target: '3.1' });
    renderModal();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'OpenAPI 3.1' })).toHaveAttribute('aria-checked', 'true'));

    fireEvent.click(screen.getByRole('radio', { name: /swagger2openapi/ }));

    await waitFor(() => expect(screen.getByRole('radio', { name: 'OpenAPI 3.0' })).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByRole('radio', { name: 'OpenAPI 3.1' })).toBeDisabled();
  });

  it('persists the engine/target choice after a change', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    vi.mocked(saveConvertPref).mockClear();

    fireEvent.click(screen.getByRole('radio', { name: /Scalar/ }));
    await waitFor(() => expect(saveConvertPref).toHaveBeenCalledWith({ engine: 'scalar', target: '3.0' }));
  });

  it('blocks download and lists validation errors for invalid output', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      valid: false,
      validationErrors: ['broken A', 'broken B'],
      engineUsed: 'scalar',
    }));
    renderModal();

    expect(await screen.findByText('Invalid OpenAPI')).toBeInTheDocument();
    expect(screen.getByText('broken A')).toBeInTheDocument();
    expect(screen.getByText('broken B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download YAML/ })).toBeDisabled();
  });

  it('shows a fallback chip when the converter fell back', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      fellBack: true,
      fallbackReason: 'invalid-output',
      engineUsed: 'swagger2openapi',
    }));
    renderModal();
    // default engine selected is swagger2openapi; force the fallback chip by choosing scalar first
    await screen.findByText('Valid OpenAPI 3.0.4');
    fireEvent.click(screen.getByRole('radio', { name: /Scalar/ }));
    expect(await screen.findByText(/fallback: invalid output/)).toBeInTheDocument();
  });

  it('lists conversion warnings', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({ warnings: ['w1', 'w2'] }));
    renderModal();
    expect(await screen.findByText('2 conversion warnings')).toBeInTheDocument();
    expect(screen.getByText('w1')).toBeInTheDocument();
  });

  it('downloads the YAML, toasts success, and closes on Download', async () => {
    const { onClose, showToast } = renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Download YAML/ }));
    });

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    const [, opts] = vi.mocked(saveFile).mock.calls[0];
    expect(opts.filename).toBe('My_Service___Prod-openapi-3.0.yaml');
    expect(showToast).toHaveBeenCalledWith('success', expect.stringContaining('3.0.4'), expect.stringContaining('My_Service___Prod-openapi-3.0.yaml'));
    expect(onClose).toHaveBeenCalled();
  });

  it('surfaces a conversion throw as a failure state and blocks download', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockRejectedValue(new Error('kaboom'));
    renderModal();

    expect(await screen.findByText('Conversion failed')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download YAML/ })).toBeDisabled();
  });

  it('closes on Cancel', async () => {
    const { onClose } = renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape when search is empty', async () => {
    const { onClose } = renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('finds matches in the YAML preview when searching', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    const search = screen.getByPlaceholderText('Search… (Cmd+F)');
    fireEvent.change(search, { target: { value: 'openapi' } });

    await waitFor(() => expect(screen.getByText('1/1')).toBeInTheDocument());
    expect(document.querySelector('.cat-convert-hit')).toBeTruthy();
  });

  it('highlights matches even when the query contains HTML-special chars', async () => {
    // Regression: the highlighter used to run against HTML-escaped text while the
    // match count ran against the raw YAML, so searching for a token containing
    // `<`/`>`/`&` reported a count but rendered no <mark>. Now both use the raw text.
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      yaml: 'description: List<String> of items\nother: value < 10\n',
    }));
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    const search = screen.getByPlaceholderText('Search… (Cmd+F)');
    fireEvent.change(search, { target: { value: '<String>' } });

    await waitFor(() => expect(screen.getByText('1/1')).toBeInTheDocument());
    // The count says 1 match — the highlight must actually render (and show the raw chars).
    const hit = document.querySelector('.cat-convert-hit');
    expect(hit).toBeTruthy();
    expect(hit?.textContent).toBe('<String>');
  });

  it('navigates matches with buttons, Enter/Shift+Enter, and clears on Escape', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      yaml: 'a: 1\nb: a\nc: a\n',
    }));
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    const search = screen.getByPlaceholderText('Search… (Cmd+F)');
    fireEvent.change(search, { target: { value: 'a' } });
    await waitFor(() => expect(screen.getByText('1/3')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Next match (Enter)' }));
    await waitFor(() => expect(screen.getByText('2/3')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Previous match (Shift+Enter)' }));
    await waitFor(() => expect(screen.getByText('1/3')).toBeInTheDocument());

    fireEvent.keyDown(search, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('2/3')).toBeInTheDocument());

    fireEvent.keyDown(search, { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(screen.getByText('1/3')).toBeInTheDocument());
    expect(document.querySelector('.cat-convert-hit--active')).toBeTruthy();

    fireEvent.keyDown(search, { key: 'Escape' });
    await waitFor(() => expect((search as HTMLInputElement).value).toBe(''));
  });

  it('keeps search navigation stable when there are no matches', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    const search = screen.getByPlaceholderText('Search… (Cmd+F)');
    fireEvent.change(search, { target: { value: '___no_match___' } });
    await waitFor(() => expect(screen.getByText('No match')).toBeInTheDocument());

    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.keyDown(search, { key: 'Enter', shiftKey: true });
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('keeps copy disabled before YAML is available', async () => {
    let resolveConvert: (r: ConvertSwaggerResult) => void = () => {};
    vi.mocked(convertSwaggerToOpenApiYaml).mockReturnValue(new Promise<ConvertSwaggerResult>(res => { resolveConvert = res; }));
    renderModal();

    const copyBtn = screen.getByTestId('catalog-convert-copy-btn');
    expect(copyBtn).toBeDisabled();
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

    await act(async () => { resolveConvert(makeResult()); });
    expect(await screen.findByText('Valid OpenAPI 3.0.4')).toBeInTheDocument();
  });

  it('focuses the search input on Cmd+F', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    const search = screen.getByPlaceholderText('Search… (Cmd+F)');

    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(document.activeElement).toBe(search);
  });

  it('toasts an error and stays open when the download fails', async () => {
    vi.mocked(saveFile).mockRejectedValueOnce(new Error('disk full'));
    const { onClose, showToast } = renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Download YAML/ }));
    });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'Download failed', 'disk full'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('labels the fallback chip as an error when the primary engine threw', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      fellBack: true,
      fallbackReason: 'threw',
      engineUsed: 'scalar',
    }));
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    fireEvent.click(screen.getByRole('radio', { name: /Scalar/ }));
    expect(await screen.findByText(/fallback: error/)).toBeInTheDocument();
  });

  it('renders a singular endpoint/warning label and counts only method keys', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      warnings: ['only-one'],
      openapi: {
        openapi: '3.0.4',
        paths: {
          '/x': { get: {}, parameters: [], summary: 'ignored' },
          '/y': null,
        },
      },
    }));
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    expect(screen.getByText('1 endpoint')).toBeInTheDocument();
    expect(screen.getByText('1 conversion warning')).toBeInTheDocument();
  });

  it('reports 0 endpoints when the converted doc has no paths', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      openapi: { openapi: '3.0.4' },
    }));
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    expect(screen.getByText('0 endpoints')).toBeInTheDocument();
  });

  it('shows a Converting… badge while the conversion is in flight', async () => {
    let resolveConvert: (r: ConvertSwaggerResult) => void = () => {};
    vi.mocked(convertSwaggerToOpenApiYaml).mockReturnValue(
      new Promise<ConvertSwaggerResult>(res => { resolveConvert = res; }),
    );
    renderModal();

    expect(await screen.findByText('Converting…', { selector: '.cat-convert-badge' })).toBeInTheDocument();

    await act(async () => { resolveConvert(makeResult()); });
    expect(await screen.findByText('Valid OpenAPI 3.0.4')).toBeInTheDocument();
  });

  it('surfaces a non-Error conversion rejection as a string', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockRejectedValue('plain failure');
    renderModal();
    expect(await screen.findByText('Conversion failed')).toBeInTheDocument();
    expect(screen.getByText('plain failure')).toBeInTheDocument();
  });

  it('notes fallback and pluralized warnings in the download toast', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      fellBack: true,
      fallbackReason: 'invalid-output',
      engineUsed: 'swagger2openapi',
      warnings: ['w1', 'w2'],
    }));
    const { showToast } = renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Download YAML/ }));
    });

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    const [, , subtitle] = vi.mocked(showToast).mock.calls[0];
    expect(subtitle).toContain('fell back to swagger2openapi');
    expect(subtitle).toContain('2 warnings');
  });

  it('surfaces a non-Error download rejection as a string', async () => {
    vi.mocked(saveFile).mockRejectedValueOnce('nope');
    const { showToast } = renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Download YAML/ }));
    });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('error', 'Download failed', 'nope'));
  });

  it('hides the Save as new version button when no onSaveAsVersion is provided', async () => {
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    expect(screen.queryByRole('button', { name: /Save as new version/ })).not.toBeInTheDocument();
  });

  it('calls onSaveAsVersion with the converted result when Save as new version is clicked', async () => {
    const onSaveAsVersion = vi.fn().mockResolvedValue(undefined);
    renderModal({ onSaveAsVersion });
    await screen.findByText('Valid OpenAPI 3.0.4');

    const save = screen.getByRole('button', { name: 'Save as new version' });
    expect(save).toBeEnabled();

    await act(async () => { fireEvent.click(save); });

    expect(onSaveAsVersion).toHaveBeenCalledWith({
      yaml: 'openapi: 3.0.4\npaths:\n  /a:\n    get:\n      responses:\n        200: {}\n',
      openapiVersion: '3.0.4',
      engineUsed: 'swagger2openapi',
      mode: 'convert',
    });
  });

  it('disables Save as new version for invalid output', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({
      valid: false,
      validationErrors: ['broken'],
      engineUsed: 'scalar',
    }));
    renderModal({ onSaveAsVersion: vi.fn() });
    await screen.findByText('Invalid OpenAPI');
    expect(screen.getByRole('button', { name: 'Save as new version' })).toBeDisabled();
  });

  describe('prettify (canonical YAML normalization)', () => {
    it('shows the raw engine YAML when the prettify toggle is off', async () => {
      vi.mocked(loadPrettyPref).mockResolvedValue(false);
      renderModal();
      await screen.findByText('Valid OpenAPI 3.0.4');
      expect(screen.getByText(/openapi: 3.0.4/)).toBeInTheDocument();
      expect(screen.queryByText('PRETTY_YAML')).not.toBeInTheDocument();
      expect(prettifyOpenApiYaml).not.toHaveBeenCalled();
    });

    it('renders the prettified YAML in the preview when the toggle is on', async () => {
      vi.mocked(loadPrettyPref).mockResolvedValue(true);
      renderModal();
      await screen.findByText('Valid OpenAPI 3.0.4');
      await waitFor(() => expect(prettifyOpenApiYaml).toHaveBeenCalled());
      expect(await screen.findByText('PRETTY_YAML')).toBeInTheDocument();
    });

    it('toggling prettify re-renders the preview and persists the choice', async () => {
      vi.mocked(loadPrettyPref).mockResolvedValue(false);
      renderModal();
      await screen.findByText('Valid OpenAPI 3.0.4');

      const toggle = screen.getByTestId('catalog-convert-pretty-toggle');
      await act(async () => { fireEvent.click(toggle); });

      await waitFor(() => expect(savePrettyPref).toHaveBeenCalledWith(true));
      expect(await screen.findByText('PRETTY_YAML')).toBeInTheDocument();
    });

    it('saves the prettified YAML as the new version when prettify is on', async () => {
      vi.mocked(loadPrettyPref).mockResolvedValue(true);
      const onSaveAsVersion = vi.fn().mockResolvedValue(undefined);
      renderModal({ onSaveAsVersion });
      await screen.findByText('Valid OpenAPI 3.0.4');
      await screen.findByText('PRETTY_YAML');

      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save as new version' })); });

      expect(onSaveAsVersion).toHaveBeenCalledWith(expect.objectContaining({ yaml: 'PRETTY_YAML' }));
    });

    it('falls back to the engine YAML when prettify reports it could not apply', async () => {
      vi.mocked(loadPrettyPref).mockResolvedValue(true);
      vi.mocked(prettifyOpenApiYaml).mockResolvedValue({ yaml: makeResult().yaml, applied: false });
      renderModal();
      await screen.findByText('Valid OpenAPI 3.0.4');
      await waitFor(() => expect(prettifyOpenApiYaml).toHaveBeenCalled());
      expect(screen.getByText(/openapi: 3.0.4/)).toBeInTheDocument();
    });

    it('falls back to engine YAML when prettify throws', async () => {
      vi.mocked(loadPrettyPref).mockResolvedValue(true);
      vi.mocked(prettifyOpenApiYaml).mockRejectedValue(new Error('format failed'));
      renderModal();
      await screen.findByText('Valid OpenAPI 3.0.4');
      await waitFor(() => expect(prettifyOpenApiYaml).toHaveBeenCalled());
      expect(screen.getByText(/openapi: 3.0.4/)).toBeInTheDocument();
    });
  });

  it('shows a Saving… label and disables both actions while the save is in flight', async () => {
    let resolveSave: () => void = () => {};
    const onSaveAsVersion = vi.fn().mockReturnValue(new Promise<void>(res => { resolveSave = res; }));
    renderModal({ onSaveAsVersion });
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as new version' }));
    });

    // Two buttons read "Saving…" is not the case — only the save button flips; download keeps its label but is disabled.
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download YAML/ })).toBeDisabled();

    await act(async () => { resolveSave(); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save as new version' })).toBeEnabled());
  });

  it('runs both engines in compare mode and shows a summary', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockImplementation(async (_raw, opts) => {
      if (opts.engine === 'scalar' && opts.fallbackOnInvalid === false) {
        return makeResult({ engineUsed: 'scalar', openapiVersion: '3.0.3', warnings: ['w1'] });
      }
      return makeResult({ engineUsed: 'swagger2openapi', openapiVersion: '3.0.3' });
    });
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.3');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Compare engines' })); });

    const compare = await screen.findByTestId('catalog-convert-compare-result');
    expect(compare).toBeInTheDocument();
    expect(compare.textContent).toContain('swagger2openapi');
    expect(compare.textContent).toContain('Scalar');
    expect(convertSwaggerToOpenApiYaml).toHaveBeenCalledWith(RAW, {
      engine: 'swagger2openapi',
      target: '3.0',
      fallbackOnInvalid: false,
    });
    expect(convertSwaggerToOpenApiYaml).toHaveBeenCalledWith(RAW, {
      engine: 'scalar',
      target: '3.0',
      fallbackOnInvalid: false,
    });
  });

  it('renders compare failures/invalid output and omits the identical/different note when two valid runs are unavailable', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockImplementation(async (_raw, opts) => {
      if (opts.fallbackOnInvalid !== false) return makeResult();
      if (opts.engine === 'swagger2openapi') throw new Error('engine boom');
      return makeResult({
        engineUsed: 'scalar',
        valid: false,
        validationErrors: ['missing schema'],
      });
    });

    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Compare engines' })); });

    const compare = await screen.findByTestId('catalog-convert-compare-result');
    expect(compare.textContent).toContain('failed: engine boom');
    expect(compare.textContent).toContain('invalid');
    expect(compare.textContent).toContain('1 validation error');
    expect(compare.textContent).not.toContain('Both engines produced identical YAML output for target 3.0.');
    expect(compare.textContent).not.toContain('Engines produced different YAML output for target 3.0.');
  });

  it('shows the compare note when two valid engines produce different YAML', async () => {
    vi.mocked(convertSwaggerToOpenApiYaml).mockImplementation(async (_raw, opts) => {
      if (opts.fallbackOnInvalid !== false) return makeResult();
      if (opts.engine === 'scalar') {
        return makeResult({ engineUsed: 'scalar', yaml: 'openapi: 3.0.4\npaths:\n  /scalar: {}\n' });
      }
      return makeResult({ engineUsed: 'swagger2openapi', yaml: 'openapi: 3.0.4\npaths:\n  /s2o: {}\n' });
    });

    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Compare engines' })); });
    expect(await screen.findByText('Engines produced different YAML output for target 3.0.')).toBeInTheDocument();
  });
});

// ─── Upgrade flow (OpenAPI 3.0 / 3.1 source) — P4-A ──────

const RAW_OAS30 = "openapi: '3.0.3'\ninfo:\n  title: X\n  version: '1'\npaths: {}\n";
const RAW_OAS31 = "openapi: '3.1.0'\ninfo:\n  title: Y\n  version: '1'\npaths: {}\n";

function makeUpgradeResult(overrides: Partial<ConvertSwaggerResult> = {}): ConvertSwaggerResult {
  return {
    yaml: 'openapi: 3.1.1\npaths: {}\n',
    openapiVersion: '3.1.1',
    engineUsed: 'scalar',
    fellBack: false,
    valid: true,
    validationErrors: [],
    warnings: [],
    openapi: { openapi: '3.1.1', paths: {} },
    ...overrides,
  };
}

describe('CatalogConvertOpenApiModal — upgrade flow', () => {
  beforeEach(() => {
    vi.mocked(upgradeOpenApi3Yaml).mockResolvedValue(makeUpgradeResult());
  });

  it('titles the modal "Upgrade OpenAPI" and hides the engine selector for a 3.0 source', async () => {
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS30} onClose={vi.fn()} showToast={vi.fn()} />,
    );
    expect(await screen.findByText('Valid OpenAPI 3.1.1')).toBeInTheDocument();
    expect(screen.getByText(/Upgrade OpenAPI — Svc/)).toBeInTheDocument();
    // No engine radiogroup; a fixed Scalar note is shown instead.
    expect(screen.queryByRole('radiogroup', { name: 'Conversion engine' })).not.toBeInTheDocument();
    expect(screen.getByText(/only engine that emits 3.1 \/ 3.2/)).toBeInTheDocument();
  });

  it('offers only forward targets (3.1, 3.2) for a 3.0 source and upgrades to the first', async () => {
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS30} onClose={vi.fn()} showToast={vi.fn()} />,
    );
    await screen.findByText('Valid OpenAPI 3.1.1');

    expect(screen.getByRole('radio', { name: 'OpenAPI 3.1' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'OpenAPI 3.2' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'OpenAPI 3.0' })).not.toBeInTheDocument();
    // pref default target 3.0 is not allowed → corrected to first available (3.1)
    await waitFor(() => expect(upgradeOpenApi3Yaml).toHaveBeenCalledWith(RAW_OAS30, { target: '3.1' }));
  });

  it('re-upgrades to 3.2 when that target is picked', async () => {
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS30} onClose={vi.fn()} showToast={vi.fn()} />,
    );
    await screen.findByText('Valid OpenAPI 3.1.1');
    vi.mocked(upgradeOpenApi3Yaml).mockResolvedValue(makeUpgradeResult({ openapiVersion: '3.2.0', yaml: 'openapi: 3.2.0\n', openapi: { openapi: '3.2.0' } }));

    fireEvent.click(screen.getByRole('radio', { name: 'OpenAPI 3.2' }));
    await waitFor(() => expect(upgradeOpenApi3Yaml).toHaveBeenCalledWith(RAW_OAS30, { target: '3.2' }));
  });

  it('only offers 3.2 for a 3.1 source', async () => {
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS31} onClose={vi.fn()} showToast={vi.fn()} />,
    );
    await screen.findByText('Valid OpenAPI 3.1.1');
    expect(screen.getByRole('radio', { name: 'OpenAPI 3.2' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'OpenAPI 3.1' })).not.toBeInTheDocument();
    await waitFor(() => expect(upgradeOpenApi3Yaml).toHaveBeenCalledWith(RAW_OAS31, { target: '3.2' }));
  });

  it('does not persist a pref in the upgrade flow', async () => {
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS30} onClose={vi.fn()} showToast={vi.fn()} />,
    );
    await screen.findByText('Valid OpenAPI 3.1.1');
    expect(saveConvertPref).not.toHaveBeenCalled();
  });

  it('hides the compare button in the upgrade flow', async () => {
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS30} onClose={vi.fn()} showToast={vi.fn()} />,
    );
    await screen.findByText('Valid OpenAPI 3.1.1');
    expect(screen.queryByRole('button', { name: 'Compare engines' })).not.toBeInTheDocument();
  });

  it('saves as version with mode "upgrade"', async () => {
    const onSaveAsVersion = vi.fn().mockResolvedValue(undefined);
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS30} onClose={vi.fn()} showToast={vi.fn()} onSaveAsVersion={onSaveAsVersion} />,
    );
    await screen.findByText('Valid OpenAPI 3.1.1');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save as new version' })); });

    expect(onSaveAsVersion).toHaveBeenCalledWith({
      yaml: 'openapi: 3.1.1\npaths: {}\n',
      openapiVersion: '3.1.1',
      engineUsed: 'scalar',
      mode: 'upgrade',
    });
  });

  it('uses an "Upgraded to" verb in the download toast', async () => {
    const showToast = vi.fn();
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS30} onClose={vi.fn()} showToast={showToast} />,
    );
    await screen.findByText('Valid OpenAPI 3.1.1');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Download YAML/ })); });

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('success', expect.stringContaining('Upgraded to OpenAPI 3.1.1'), expect.any(String)));
  });
});

// ─── Deep lint (P4-D) ────────────────────────────────────

describe('CatalogConvertOpenApiModal — deep lint', () => {
  it('runs the lint on click and lists advisory findings', async () => {
    vi.mocked(lintOpenApi).mockResolvedValue({
      supported: true,
      clean: false,
      findings: [
        { pointer: '#/paths/~1a/get', rule: 'operation-operationId', message: 'operation should have an operationId' },
      ],
    });
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });

    expect(lintOpenApi).toHaveBeenCalledWith(
      { openapi: '3.0.4', paths: { '/a': { get: { responses: { 200: {} } } } } },
      '3.0.4',
    );
    expect(await screen.findByText(/1 advisory finding/)).toBeInTheDocument();
    expect(screen.getByText('operation-operationId')).toBeInTheDocument();
    expect(screen.getByText(/operation should have an operationId/)).toBeInTheDocument();
  });

  it('renders lint findings with fallback rule label and without pointer text', async () => {
    vi.mocked(lintOpenApi).mockResolvedValue({
      supported: true,
      clean: false,
      findings: [{ message: 'missing docs' }],
    });
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });
    expect(await screen.findByText('rule')).toBeInTheDocument();
    expect(screen.getByText(/missing docs/)).toBeInTheDocument();
    expect(screen.queryByText(/\(#/)).not.toBeInTheDocument();
  });

  it('shows a clean message when lint passes', async () => {
    vi.mocked(lintOpenApi).mockResolvedValue({ supported: true, clean: true, findings: [] });
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });
    expect(await screen.findByText(/Deep lint passed/)).toBeInTheDocument();
  });

  it('shows a schema error when lint reports one', async () => {
    vi.mocked(lintOpenApi).mockResolvedValue({ supported: true, clean: false, findings: [], schemaError: 'expected responses' });
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });
    expect(await screen.findByText('Deep lint — schema error')).toBeInTheDocument();
    expect(screen.getByText('expected responses')).toBeInTheDocument();
  });

  it('notes when deep lint is unsupported for the target version', async () => {
    vi.mocked(lintOpenApi).mockResolvedValue({ supported: false, clean: true, findings: [] });
    render(
      <CatalogConvertOpenApiModal specName="Svc" rawSpec={RAW_OAS31} onClose={vi.fn()} showToast={vi.fn()} />,
    );
    vi.mocked(upgradeOpenApi3Yaml).mockResolvedValue(makeUpgradeResult({ openapiVersion: '3.2.0' }));
    await screen.findByText('Valid OpenAPI 3.2.0');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });
    expect(await screen.findByText(/Deep lint supports OpenAPI 3.0 only/)).toBeInTheDocument();
  });

  it('notes when the linter is unavailable in this build', async () => {
    vi.mocked(lintOpenApi).mockResolvedValue({ supported: false, clean: true, findings: [], unavailable: true });
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });
    expect(await screen.findByText(/Deep lint is unavailable in this build/)).toBeInTheDocument();
  });

  it('shows a Linting… label while the lint is in flight', async () => {
    let resolveLint: (r: import('../utils/openApiLint').LintResult) => void = () => {};
    vi.mocked(lintOpenApi).mockReturnValue(new Promise(res => { resolveLint = res; }));
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });
    expect(screen.getByRole('button', { name: 'Linting…' })).toBeInTheDocument();

    await act(async () => { resolveLint({ supported: true, clean: true, findings: [] }); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Deep lint' })).toBeInTheDocument());
  });

  it('clears prior lint results when the conversion re-runs', async () => {
    vi.mocked(lintOpenApi).mockResolvedValue({ supported: true, clean: true, findings: [] });
    renderModal();
    await screen.findByText('Valid OpenAPI 3.0.4');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deep lint' })); });
    expect(await screen.findByText(/Deep lint passed/)).toBeInTheDocument();

    // switching the engine triggers a re-convert (fresh result object) → lint panel resets
    vi.mocked(convertSwaggerToOpenApiYaml).mockResolvedValue(makeResult({ engineUsed: 'scalar' }));
    fireEvent.click(screen.getByRole('radio', { name: /Scalar/ }));
    await waitFor(() => expect(screen.queryByText(/Deep lint passed/)).not.toBeInTheDocument());
  });
});
