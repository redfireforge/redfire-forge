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

import { GalleryPage } from './GalleryPage';
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
    expect(domainBtns.length).toBe(6);
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

  it('shows confirm dialog for already-imported samples', () => {
    const firstTest = testSampleCatalog[0];
    const hash = gallerySampleHash(firstTest.factory());
    const importedSamples = { [firstTest.id]: hash };
    const onImportTest = vi.fn();
    const { container } = render(
      <GalleryPage onImportTest={onImportTest} importedSamples={importedSamples} />,
    );
    // Filter to tests
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    // Find and click the imported card
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    // Click the action button in the detail panel (not the card badge)
    const actionBtn = container.querySelector('.gallery-detail-btn-primary') as HTMLElement;
    fireEvent.click(actionBtn);
    // Should show confirm dialog
    expect(screen.getByText(/already loaded/)).toBeTruthy();
    // Confirm re-import
    const confirmBtn = screen.getByRole('button', { name: 'Import Again' });
    fireEvent.click(confirmBtn);
    expect(onImportTest).toHaveBeenCalledTimes(1);
  });

  it('shows updated label for samples with changed hash', () => {
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
    // Should show reload label
    const reloadBtn = container.querySelector('.gallery-detail-btn-primary') as HTMLElement;
    fireEvent.click(reloadBtn);
    // Confirm
    expect(screen.getByText(/updated since/)).toBeTruthy();
    const confirmBtn = screen.getByRole('button', { name: /Re-import/ });
    fireEvent.click(confirmBtn);
    expect(onImportTest).toHaveBeenCalledTimes(1);
  });

  it('cancel reimport confirm dialog does not call handler', () => {
    const firstTest = testSampleCatalog[0];
    const hash = gallerySampleHash(firstTest.factory());
    const importedSamples = { [firstTest.id]: hash };
    const onImportTest = vi.fn();
    const { container } = render(
      <GalleryPage onImportTest={onImportTest} importedSamples={importedSamples} />,
    );
    const domainBtns = container.querySelectorAll('.gallery-domain-btn');
    const testBtn = Array.from(domainBtns).find(btn => btn.textContent?.includes('Tests'));
    fireEvent.click(testBtn!);
    const card = container.querySelector('.gallery-card') as HTMLElement;
    fireEvent.click(card);
    const actionBtn2 = container.querySelector('.gallery-detail-btn-primary') as HTMLElement;
    fireEvent.click(actionBtn2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
