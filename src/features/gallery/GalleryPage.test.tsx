/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../data/galleries/catalog-specs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../data/galleries/catalog-specs')>();
  return {
    ...mod,
    catalogSpecCatalog: [
      ...mod.catalogSpecCatalog,
      {
        id: 'cov-json-stringify-fail',
        domain: 'catalog',
        name: 'Coverage JSON Stringify Fail',
        description: 'Factory returns value that JSON.stringify cannot serialize',
        icon: '📋',
        category: 'rest-api',
        difficulty: 'easy',
        tags: ['coverage'],
        liveApis: [],
        endpointCount: 1,
        specVersion: '3.0.3',
        specYaml: '',
        factory: () => ({ x: BigInt(1) }),
      },
    ],
  };
});

import { GalleryPage, LOADED_SENTINEL } from './GalleryPage';
import { gallerySampleHash } from '../../shared/utils/gallerySampleHash';
import { testSampleCatalog } from '../../data/galleries/tests';

describe('GalleryPage', () => {
  it('renders the gallery grid with entries from all domains', () => {
    render(<GalleryPage />);
    expect(screen.getByText(/samples/)).toBeTruthy();
  });

  it('renders domain filter buttons', () => {
    const { container } = render(<GalleryPage />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    expect(domainBtns.length).toBe(7);
    const labels = Array.from(domainBtns).map(b => b.textContent);
    expect(labels.some(l => l?.includes('Requests'))).toBe(true);
    expect(labels.some(l => l?.includes('Tests'))).toBe(true);
    expect(labels.some(l => l?.includes('Workflows'))).toBe(true);
  });

  it('renders gallery cards', () => {
    const { container } = render(<GalleryPage />);
    const cards = container.querySelectorAll('.gallery-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('filters entries via search', () => {
    const { container } = render(<GalleryPage />);
    const allCards = container.querySelectorAll('.gallery-card').length;
    const input = screen.getByLabelText('Search gallery');
    fireEvent.change(input, { target: { value: 'pokemon' } });
    const filteredCards = container.querySelectorAll('.gallery-card').length;
    expect(filteredCards).toBeLessThan(allCards);
    expect(filteredCards).toBeGreaterThan(0);
  });

  it('opens detail panel when a card is clicked', () => {
    const { container } = render(<GalleryPage />);
    const firstCard = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(firstCard);
    expect(screen.getByLabelText('Close detail panel')).toBeTruthy();
  });

  it('calls onImportWorkflow when a workflow entry is imported', () => {
    const onImportWorkflow = vi.fn();
    const { container } = render(<GalleryPage onImportWorkflow={onImportWorkflow} />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const wfDomainBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Workflows'));
    expect(wfDomainBtn).toBeTruthy();
    fireEvent.click(wfDomainBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(screen.getByText('Load Workflow'));
    expect(onImportWorkflow).toHaveBeenCalledTimes(1);
  });

  it('calls onImportRequest when a request entry is imported', () => {
    const onImportRequest = vi.fn();
    const { container } = render(<GalleryPage onImportRequest={onImportRequest} />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const reqDomainBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Requests'));
    expect(reqDomainBtn).toBeTruthy();
    fireEvent.click(reqDomainBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(screen.getByText('Send Request'));
    expect(onImportRequest).toHaveBeenCalledTimes(1);
  });

  it('calls onTryItRequest when Try It button is clicked on a request entry', () => {
    const onTryItRequest = vi.fn();
    const { container } = render(<GalleryPage onTryItRequest={onTryItRequest} />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const reqDomainBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Requests'));
    fireEvent.click(reqDomainBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(screen.getByText('Try It'));
    expect(onTryItRequest).toHaveBeenCalledTimes(1);
  });

  it('calls onImportCatalog when a catalog spec is imported', () => {
    const onImportCatalog = vi.fn();
    const { container } = render(<GalleryPage onImportCatalog={onImportCatalog} />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const catBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Catalog'));
    fireEvent.click(catBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(screen.getByText('Import Spec'));
    expect(onImportCatalog).toHaveBeenCalledTimes(1);
  });

  it('calls onImportTest when a test sample is loaded', () => {
    const onImportTest = vi.fn();
    const { container } = render(<GalleryPage onImportTest={onImportTest} />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    fireEvent.click(screen.getByText('Load Test'));
    expect(onImportTest).toHaveBeenCalledTimes(1);
  });

  it('navigates to the sample tab when clicking an already-imported sample', () => {
    const firstTest = testSampleCatalog[0];
    const hash = gallerySampleHash(firstTest.factory());
    const importedSamples = { [firstTest.id]: hash };
    const onImportTest = vi.fn();
    const onNavigateTo = vi.fn();
    const { container } = render(
      <GalleryPage onImportTest={onImportTest} onNavigateTo={onNavigateTo} importedSamples={importedSamples} />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    const actionBtn = container.querySelector('.gallery-detail-btn-primary') as HTMLElement;
    fireEvent.click(actionBtn);
    // Should navigate, not re-import, and no confirm dialog
    expect(onNavigateTo).toHaveBeenCalledTimes(1);
    expect(onImportTest).not.toHaveBeenCalled();
    expect(screen.queryByText(/already loaded/)).toBeNull();
  });

  it('shows confirm dialog when a new version of a loaded sample is available', () => {
    const firstTest = testSampleCatalog[0];
    const importedSamples = { [firstTest.id]: 'stale-hash' };
    const onImportTest = vi.fn();
    const { container } = render(
      <GalleryPage onImportTest={onImportTest} importedSamples={importedSamples} />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    const reloadBtn = container.querySelector('.gallery-detail-btn-primary') as HTMLElement;
    fireEvent.click(reloadBtn);
    // Confirm dialog should appear
    expect(screen.getByText(/updated since/)).toBeTruthy();
    const confirmBtn = screen.getByRole('button', { name: 'Update' });
    fireEvent.click(confirmBtn);
    expect(onImportTest).toHaveBeenCalledTimes(1);
  });

  it('cancelling the update dialog does not re-import', () => {
    const firstTest = testSampleCatalog[0];
    const importedSamples = { [firstTest.id]: 'stale-hash' };
    const onImportTest = vi.fn();
    const { container } = render(
      <GalleryPage onImportTest={onImportTest} importedSamples={importedSamples} />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    const reloadBtn = container.querySelector('.gallery-detail-btn-primary') as HTMLElement;
    fireEvent.click(reloadBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onImportTest).not.toHaveBeenCalled();
  });

  it('clicking an already-imported sample does not call the import handler', () => {
    const firstTest = testSampleCatalog[0];
    const hash = gallerySampleHash(firstTest.factory());
    const importedSamples = { [firstTest.id]: hash };
    const onImportTest = vi.fn();
    const onNavigateTo = vi.fn();
    const { container } = render(
      <GalleryPage onImportTest={onImportTest} onNavigateTo={onNavigateTo} importedSamples={importedSamples} />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    const actionBtn = container.querySelector('.gallery-detail-btn-primary') as HTMLElement;
    fireEvent.click(actionBtn);
    expect(onImportTest).not.toHaveBeenCalled();
  });

  it('renders request preview in detail panel', () => {
    const { container } = render(<GalleryPage />);
    // Requests domain is default; click first card
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const reqBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Requests'));
    fireEvent.click(reqBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    // Should render RequestPreview tabs
    expect(container.querySelector('.gallery-detail-preview')).toBeTruthy();
  });

  it('renders non-request preview as text', () => {
    const { container } = render(<GalleryPage />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const wfBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Workflows'));
    fireEvent.click(wfBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    expect(container.querySelector('.gallery-detail-preview')).toBeTruthy();
  });

  it('treats LOADED_SENTINEL as imported without comparing factory hashes', () => {
    const firstTest = testSampleCatalog[0];
    const importedSamples = { [firstTest.id]: LOADED_SENTINEL };
    const onNavigateTo = vi.fn();
    const { container } = render(
      <GalleryPage onImportTest={vi.fn()} onNavigateTo={onNavigateTo} importedSamples={importedSamples} />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    fireEvent.click(screen.getByText(firstTest.name));
    expect(
      container.querySelector('.gallery-detail-btn-primary')?.textContent,
    ).toContain('✓ Loaded');
    fireEvent.click(container.querySelector('.gallery-detail-btn-primary') as HTMLElement);
    expect(onNavigateTo).toHaveBeenCalledWith(expect.objectContaining({ id: firstTest.id }));
  });

  it('treats legacy __name: imports as imported without sample id', () => {
    const firstTest = testSampleCatalog[0];
    const importedSamples = { [`__name:${firstTest.name}`]: 'legacy' };
    const { container } = render(
      <GalleryPage onImportTest={vi.fn()} importedSamples={importedSamples} />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    fireEvent.click(screen.getByText(firstTest.name));
    expect(
      container.querySelector('.gallery-detail-btn-primary')?.textContent,
    ).toContain('✓ Loaded');
  });

  it('does not compute sample status when importedSamples is empty', () => {
    const { container } = render(<GalleryPage onImportTest={vi.fn()} importedSamples={{}} />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    fireEvent.click(container.querySelector('.gallery-card') as HTMLElement);
    expect(container.querySelector('.gallery-detail-btn-primary')?.textContent).toBe('Load Test');
  });

  it('omits primary import action for assertion preset entries', () => {
    const { container } = render(<GalleryPage />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const assertionsBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Assertions'));
    expect(assertionsBtn).toBeTruthy();
    fireEvent.click(assertionsBtn!);
    fireEvent.click(container.querySelector('.gallery-card') as HTMLElement);
    expect(container.querySelector('.gallery-detail-btn-primary')).toBeNull();
  });

  it('preview falls back when factory output is not JSON-serializable', () => {
    const { container } = render(<GalleryPage />);
    const input = screen.getByLabelText('Search gallery');
    fireEvent.change(input, { target: { value: 'Coverage JSON Stringify Fail' } });
    fireEvent.click(container.querySelector('.gallery-card') as HTMLElement);
    const pre = container.querySelector('.gallery-detail-preview-pre');
    expect(pre?.textContent).toContain('[object Object]');
  });

  it('passes Request label when expanding default request tab', () => {
    const { container } = render(<GalleryPage />);
    const reqBtn = Array.from(container.querySelectorAll('.gallery-domain-btn')).find(btn =>
      btn.textContent?.includes('Requests'),
    );
    fireEvent.click(reqBtn!);
    fireEvent.click(container.querySelector('.gallery-card') as HTMLElement);
    fireEvent.click(container.querySelector('.gallery-tab-expand-btn') as HTMLElement);
    expect(screen.getByText(/\s—\sRequest$/)).toBeTruthy();
  });

  it('passes Response label when expanding response tab after fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<GalleryPage />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const reqBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Requests'));
    fireEvent.click(reqBtn!);
    fireEvent.click(container.querySelector('.gallery-card') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Response' }));
    fireEvent.click(screen.getByRole('button', { name: /Fetch Sample/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(container.querySelector('.gallery-tab-code')).toBeTruthy();
    });
    const expandBtn = container.querySelector('.gallery-tab-expand-btn') as HTMLElement;
    fireEvent.click(expandBtn);
    await waitFor(() => {
      expect(screen.getByText(/— Response$/)).toBeTruthy();
    });
  });

  it('calls onImportTest when a data-mapper sample is loaded', () => {
    const onImportTest = vi.fn();
    const { container } = render(<GalleryPage onImportTest={onImportTest} />);
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const dmBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Data Mapper'));
    expect(dmBtn).toBeTruthy();
    fireEvent.click(dmBtn!);
    fireEvent.click(container.querySelector('.gallery-card') as HTMLElement);
    fireEvent.click(screen.getByText('Load Sample'));
    expect(onImportTest).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
