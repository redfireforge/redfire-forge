// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Sidebar from './Sidebar';
import type { Environment, Microservice, FeatureGroup } from '@shared/types';
import { makeFeatureGroup } from '../test-utils/factories';

afterEach(() => cleanup());

const ENVIRONMENTS: Environment[] = [
  { id: 'e1', name: 'Dev' },
  { id: 'e2', name: 'Prod' },
  { id: 'e3', name: 'Staging' },
];

const MICROSERVICES: Microservice[] = [
  { id: 's1', name: 'Orders', baseUrls: { e1: 'http://o' } },
  {
    id: 's2',
    name: 'Users',
    baseUrls: { e1: 'http://u', e2: 'http://u', ce1: 'http://u' },
    customEnvs: [{ id: 'ce1', name: 'Sandbox' }],
  },
];

const FEATURE_GROUPS: FeatureGroup[] = [
  makeFeatureGroup({ environmentId: 'e1', microserviceId: 's1' }),
];

interface Over {
  environments?: Environment[];
  microservices?: Microservice[];
  featureGroups?: FeatureGroup[];
  selectedEnvId?: string;
  selectedSvcId?: string;
  sidebarView?: 'env' | 'svc';
}

function renderSidebar(over: Over = {}) {
  const onEnvSelect = vi.fn();
  const onSvcSelect = vi.fn();
  const onSidebarViewChange = vi.fn();
  const props = {
    environments: over.environments ?? ENVIRONMENTS,
    microservices: over.microservices ?? MICROSERVICES,
    featureGroups: over.featureGroups ?? FEATURE_GROUPS,
    selectedEnvId: over.selectedEnvId ?? '',
    selectedSvcId: over.selectedSvcId ?? '',
    onEnvSelect,
    onSvcSelect,
    sidebarView: over.sidebarView ?? ('env' as const),
    onSidebarViewChange,
  };
  const utils = render(<Sidebar {...props} />);
  return { ...utils, onEnvSelect, onSvcSelect, onSidebarViewChange, props };
}

describe('Sidebar — view toggle & expand-all', () => {
  it('switches between environment and service views', () => {
    const { onSidebarViewChange } = renderSidebar();
    fireEvent.click(screen.getByText('Microservices'));
    expect(onSidebarViewChange).toHaveBeenCalledWith('svc');
    fireEvent.click(screen.getByText('Environments'));
    expect(onSidebarViewChange).toHaveBeenCalledWith('env');
  });

  it('expands all then collapses all in env view', () => {
    const { container } = renderSidebar();
    const btn = () => container.querySelector('.sidebar-expand-all button') as HTMLButtonElement;
    expect(btn().textContent).toBe('Expand All');
    fireEvent.click(btn());
    expect(btn().textContent).toBe('Collapse All');
    fireEvent.click(btn());
    expect(btn().textContent).toBe('Expand All');
  });

  it('expands all in svc view', () => {
    const { container } = renderSidebar({ sidebarView: 'svc' });
    const btn = container.querySelector('.sidebar-expand-all button') as HTMLButtonElement;
    expect(btn.textContent).toBe('Expand All');
    fireEvent.click(btn);
    expect((container.querySelector('.sidebar-expand-all button') as HTMLButtonElement).textContent).toBe('Collapse All');
  });
});

describe('Sidebar — environment view', () => {
  it('shows an empty hint with no environments', () => {
    renderSidebar({ environments: [] });
    expect(screen.getByText(/No environments/)).toBeTruthy();
  });

  it('marks has-features and no-features environments', () => {
    const { container } = renderSidebar();
    const items = container.querySelectorAll('.sidebar-list > .sidebar-tree-node .sidebar-item');
    expect(items[0].className).toContain('has-features'); // Dev (e1)
    expect(items[1].className).toContain('no-features'); // Prod (e2)
  });

  it('toggles expansion via the expand icon without selecting', () => {
    const { onEnvSelect } = renderSidebar();
    const icon = screen.getByText('Dev').previousElementSibling as HTMLElement;
    fireEvent.click(icon);
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(onEnvSelect).not.toHaveBeenCalled();
  });

  it('selects env and first service when clicking the env name', () => {
    const { onEnvSelect, onSvcSelect } = renderSidebar();
    fireEvent.click(screen.getByText('Dev'));
    expect(onEnvSelect).toHaveBeenCalledWith('e1');
    expect(onSvcSelect).toHaveBeenCalledWith('s1');
  });

  it('shows the empty children hint for an env with no services', () => {
    const { onSvcSelect } = renderSidebar();
    fireEvent.click(screen.getByText('Staging'));
    expect(screen.getByText('No microservices deployed here.')).toBeTruthy();
    expect(onSvcSelect).not.toHaveBeenCalled();
  });

  it('selects env+service when clicking a child service', () => {
    const { container, onEnvSelect, onSvcSelect } = renderSidebar();
    fireEvent.click(screen.getByText('Dev')); // expand e1
    const child = container.querySelector('.sidebar-children .sidebar-child') as HTMLElement;
    fireEvent.click(child);
    expect(onEnvSelect).toHaveBeenLastCalledWith('e1');
    expect(onSvcSelect).toHaveBeenLastCalledWith('s1');
  });

  it('auto-expands and marks the selected environment', () => {
    const { container } = renderSidebar({ selectedEnvId: 'e1', selectedSvcId: 's1' });
    const selectedItem = container.querySelector('.sidebar-item.selected');
    expect(selectedItem?.textContent).toContain('Dev');
    // auto-expanded children visible, selected child highlighted
    const selectedChild = container.querySelector('.sidebar-child.selected');
    expect(selectedChild?.textContent).toContain('Orders');
  });

  it('renders the Additional Environments section and routes its clicks', () => {
    const { onEnvSelect, onSvcSelect } = renderSidebar();
    expect(screen.getByText('Additional Environments')).toBeTruthy();
    fireEvent.click(screen.getByText('Sandbox'));
    expect(onEnvSelect).toHaveBeenCalledWith('ce1');
    expect(onSvcSelect).toHaveBeenCalledWith('s2');
  });

  it('keeps an already-expanded selection stable when other deps change', () => {
    const { rerender, props, container } = renderSidebar({ selectedEnvId: 'e1', sidebarView: 'env' });
    // change selectedSvcId (a dep) — effect re-runs and hits the `prev.has` short-circuit
    rerender(<Sidebar {...props} selectedSvcId="s1" />);
    expect(container.querySelector('.sidebar-child')).toBeTruthy();
  });
});

describe('Sidebar — service view', () => {
  it('shows an empty hint with no microservices', () => {
    renderSidebar({ sidebarView: 'svc', microservices: [] });
    expect(screen.getByText(/No microservices\. Go to Environments/)).toBeTruthy();
  });

  it('marks has-features and no-features services', () => {
    const { container } = renderSidebar({ sidebarView: 'svc' });
    const items = container.querySelectorAll('.sidebar-item');
    expect(items[0].className).toContain('has-features'); // Orders (s1)
    expect(items[1].className).toContain('no-features'); // Users (s2)
  });

  it('toggles a service via its name and lists its environments incl. additional', () => {
    const { container } = renderSidebar({ sidebarView: 'svc' });
    fireEvent.click(screen.getByText('Users')); // expand s2
    const children = Array.from(container.querySelectorAll('.sidebar-children .sidebar-child'));
    const texts = children.map((c) => c.textContent);
    expect(texts.some((t) => t?.includes('Dev'))).toBe(true);
    expect(texts.some((t) => t?.includes('Prod'))).toBe(true);
    // ce1 (Sandbox) is additional → tagged
    const additional = container.querySelector('.sidebar-children .sidebar-additional-env-tag');
    expect(additional?.textContent).toBe('additional');
  });

  it('routes svc+env when clicking an environment child', () => {
    const { container, onEnvSelect, onSvcSelect } = renderSidebar({ sidebarView: 'svc' });
    fireEvent.click(screen.getByText('Orders')); // expand s1 (only e1)
    const child = container.querySelector('.sidebar-children .sidebar-child') as HTMLElement;
    fireEvent.click(child);
    expect(onSvcSelect).toHaveBeenLastCalledWith('s1');
    expect(onEnvSelect).toHaveBeenLastCalledWith('e1');
  });

  it('shows the not-deployed hint for a service with no environments', () => {
    const microservices: Microservice[] = [{ id: 's9', name: 'Lonely', baseUrls: {} }];
    renderSidebar({ sidebarView: 'svc', microservices, featureGroups: [] });
    fireEvent.click(screen.getByText('Lonely'));
    expect(screen.getByText('Not deployed to any environment.')).toBeTruthy();
  });

  it('auto-expands the selected service', () => {
    const { container, rerender, props } = renderSidebar({ sidebarView: 'svc', selectedSvcId: 's2' });
    expect(container.querySelector('.sidebar-children')).toBeTruthy();
    // re-run effect with a changed dep to hit the `prev.has` short-circuit
    rerender(<Sidebar {...props} selectedEnvId="e1" />);
    expect(container.querySelector('.sidebar-item.selected')?.textContent).toContain('Users');
  });
});
