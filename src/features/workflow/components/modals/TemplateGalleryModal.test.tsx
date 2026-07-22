/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { selectOption } from '../../../../test-utils/customSelectHelper';
import '@testing-library/jest-dom';
import type { SampleWorkflowEntry } from '../../../../data/galleries/workflows';

const galleryFixtures = vi.hoisted((): SampleWorkflowEntry[] => {
  const factory = () => ({}) as import('../../types/workflow').Workflow;
  return [
    {
      id: 'mock-orphan-sim',
      name: 'Mock Simulator (main filtered out)',
      description: 'Simulator whose main is not in the event-driven filter',
      domain: 'workflows',
      tags: [],
      liveApis: [],
      category: 'event-driven',
      difficulty: 'easy',
      icon: 'S',
      nodeCount: 1,
      primaryNodes: ['HTTP'],
      secondaryNodes: [],
      simulatorOf: 'mock-orphan-main',
      factory,
    },
    {
      id: 'mock-orphan-main',
      name: 'Mock Main (other category)',
      description: 'Main sample used only to exercise orphan simulator grouping',
      domain: 'workflows',
      tags: [],
      liveApis: [],
      category: 'api-patterns',
      difficulty: 'easy',
      icon: 'M',
      nodeCount: 1,
      primaryNodes: ['HTTP'],
      secondaryNodes: [],
      factory,
    },
    {
      id: 'mock-dangling-sim',
      name: 'Mock Dangling Simulator',
      description: 'simulatorOf points at a missing catalog id',
      domain: 'workflows',
      tags: [],
      liveApis: [],
      category: 'orchestration',
      difficulty: 'easy',
      icon: '?',
      nodeCount: 1,
      primaryNodes: ['HTTP'],
      secondaryNodes: [],
      simulatorOf: '__missing-main__',
      factory,
    },
  ];
});

vi.mock('../../../../data/galleries/workflows', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../data/galleries/workflows')>();
  return {
    ...actual,
    sampleWorkflowCatalog: [...actual.sampleWorkflowCatalog, ...galleryFixtures],
  };
});

import TemplateGalleryModal, { TemplateGalleryContent } from './TemplateGalleryModal';

describe('TemplateGalleryModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <TemplateGalleryModal open={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(container.querySelector('.tg-content')).toBeNull();
  });

  it('renders content when open is true', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('Template Gallery')).toBeTruthy();
  });

  it('renders category tabs', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('All Templates')).toBeTruthy();
    expect(screen.getByText('API Patterns')).toBeTruthy();
    expect(screen.getByText('Flow Control')).toBeTruthy();
  });

  it('renders template cards', () => {
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    const cards = container.querySelectorAll('.tg-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('filters by category when tab is clicked', () => {
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    const allCount = container.querySelectorAll('.tg-card').length;
    fireEvent.click(screen.getByText('API Patterns'));
    const filteredCount = container.querySelectorAll('.tg-card').length;
    expect(filteredCount).toBeLessThanOrEqual(allCount);
  });

  it('calls onSelect when a card is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={onSelect} />,
    );
    const firstCard = container.querySelector('.tg-card') as HTMLElement;
    fireEvent.click(firstCard);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
  });

  it('renders node filter dropdown', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByLabelText('Filter by node type')).toBeTruthy();
  });

  it('renders paired main/simulator group when catalog includes pairs', () => {
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    // Real catalog includes at least one paired sample block
    expect(container.querySelector('.tg-pair')).toBeTruthy();
  });

  it('filters by node type and clears the active filter', () => {
    render(<TemplateGalleryContent onSelect={vi.fn()} />);
    const filter = screen.getByLabelText('Filter by node type').closest('.cs-wrapper')!;
    selectOption(filter, 'HTTP Request');
    expect(screen.getByText(/Showing samples using:/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear node filter'));
    expect(filter.querySelector('.cs-text')?.textContent).toBe('All Nodes');
  });

  it('uses singular result label when exactly one template matches node filter', () => {
    render(<TemplateGalleryContent onSelect={vi.fn()} />);
    selectOption(screen.getByLabelText('Filter by node type').closest('.cs-wrapper')!, 'Wait for Condition');
    expect(screen.getByText(/Showing samples using:/).textContent).toMatch(/\(1 result\)/);
  });

  it('marks orchestration templates with orch data-cat', () => {
    const { container } = render(
      <TemplateGalleryModal open onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(container.querySelector('.tg-card[data-cat="orch"]')).toBeTruthy();
  });

  it('renders orphan simulator as solo card when filtered main is not in the category', () => {
    const { container } = render(<TemplateGalleryContent onSelect={vi.fn()} />);
    const eventTab = [...container.querySelectorAll('.tg-tabs button')].find(b =>
      b.textContent?.includes('Event-Driven'),
    );
    expect(eventTab).toBeTruthy();
    fireEvent.click(eventTab!);
    const card = screen.getByRole('button', { name: /Mock Simulator \(main filtered out\)/i });
    expect(card).toHaveClass('tg-card');
    expect(card).not.toHaveClass('tg-card-sim');
    expect(card.closest('.tg-pair')).toBeNull();
  });

  it('renders simulator with broken simulatorOf as solo card when main id is missing from catalog', () => {
    render(<TemplateGalleryContent onSelect={vi.fn()} />);
    const card = screen.getByRole('button', { name: /Mock Dangling Simulator/i });
    expect(card).toHaveClass('tg-card');
    expect(card.closest('.tg-pair')).toBeNull();
  });

  it('shows loaded badge and styling when loadedSampleIds includes the template id', () => {
    const { container } = render(
      <TemplateGalleryContent onSelect={vi.fn()} loadedSampleIds={new Set(['sample-workflow-001'])} />,
    );
    const btn = container.querySelector(
      '.tg-card-loaded.tg-card',
    );
    expect(btn).toBeTruthy();
    expect(btn?.querySelector('.tg-card-loaded-badge')).toHaveTextContent('✓ Loaded');
  });

  it('shows MAIN and SIMULATOR role tags inside paired layouts', () => {
    const { container } = render(<TemplateGalleryContent onSelect={vi.fn()} />);
    const pairs = container.querySelectorAll('.tg-pair-body');
    expect(pairs.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.tg-card-role-tag[data-role="simulator"]').length).toBeGreaterThan(0);
    expect(container.querySelector('.tg-card-role-tag[data-role="main"]')).toBeTruthy();
  });

  it('applies tg-card-paired-main to main role inside a pair', () => {
    const { container } = render(<TemplateGalleryContent onSelect={vi.fn()} />);
    const mains = container.querySelectorAll('.tg-card-paired-main');
    expect(mains.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /MAIN/ }).length).toBeGreaterThan(0);
  });
});
