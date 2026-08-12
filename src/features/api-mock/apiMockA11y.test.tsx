/**
 * @vitest-environment jsdom
 *
 * Phase 12B — API Mock Studio accessibility tests. Verifies the WAI-ARIA tabs
 * pattern (roving tabindex, aria-controls/labelledby, arrow-key activation),
 * tree keyboard navigation, the polite live region, switch semantics, and
 * accessible names on icon-only controls.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockStudioPage } from './ApiMockStudioPage';

beforeEach(() => localStorage.clear());

function createServer() {
  render(<ApiMockStudioPage />);
  fireEvent.click(screen.getByTestId('api-mock-create-first'));
}

function serverTablist() {
  return screen.getByRole('tablist', { name: 'Mock server tabs' });
}

describe('API Mock Studio — live region', () => {
  it('announces server creation via a polite status region', () => {
    createServer();
    const live = screen.getByTestId('api-mock-live-region');
    expect(live).toHaveAttribute('role', 'status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live.textContent).toMatch(/created on port/i);
  });

  it('announces route creation', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    expect(screen.getByTestId('api-mock-live-region').textContent).toMatch(/added/i);
  });
});

describe('API Mock Studio — server tabs (ARIA tabs pattern)', () => {
  it('applies roving tabindex and aria-controls', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-tab-add'));
    const tabs = within(serverTablist()).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    const selected = tabs.find(t => t.getAttribute('aria-selected') === 'true')!;
    const unselected = tabs.find(t => t.getAttribute('aria-selected') === 'false')!;
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(unselected).toHaveAttribute('tabindex', '-1');
    expect(selected).toHaveAttribute('aria-controls', 'api-mock-workspace-panel');
  });

  it('navigates and activates tabs with arrow keys', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-tab-add'));
    const list = serverTablist();
    const tabs = within(list).getAllByRole('tab');
    tabs[1].focus();
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('closes the focused tab on Delete', async () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-tab-add'));
    const list = serverTablist();
    within(list).getAllByRole('tab')[1].focus();
    fireEvent.keyDown(list, { key: 'Delete' });
    await waitFor(() => expect(within(serverTablist()).getAllByRole('tab')).toHaveLength(1));
  });

  it('labels the workspace panel by the active server tab', () => {
    createServer();
    const panel = document.getElementById('api-mock-workspace-panel')!;
    expect(panel).toHaveAttribute('role', 'tabpanel');
    const active = within(serverTablist()).getByRole('tab', { selected: true });
    expect(panel.getAttribute('aria-labelledby')).toBe(active.id);
  });
});

describe('API Mock Studio — builder tabs', () => {
  it('wires an ARIA tablist with a labelled panel', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const list = screen.getByRole('tablist', { name: 'Route editor sections' });
    const match = within(list).getAllByRole('tab').find(t => t.textContent?.startsWith('Match'))!;
    expect(match).toHaveAttribute('aria-selected', 'true');
    expect(match).toHaveAttribute('tabindex', '0');
    expect(match).toHaveAttribute('aria-controls', 'api-mock-builder-panel');
    const panel = document.getElementById('api-mock-builder-panel')!;
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'api-mock-btab-match');
  });

  it('navigates builder tabs with arrow keys', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const list = screen.getByRole('tablist', { name: 'Route editor sections' });
    within(list).getAllByRole('tab')[0].focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(document.getElementById('api-mock-builder-panel')).toHaveAttribute('aria-labelledby', 'api-mock-btab-response');
  });
});

describe('API Mock Studio — dock tabs', () => {
  it('wires an ARIA tablist with a labelled panel', () => {
    createServer();
    const dock = screen.getByTestId('api-mock-dock');
    const list = within(dock).getByRole('tablist', { name: 'Runtime inspector' });
    const tx = within(list).getAllByRole('tab').find(t => t.textContent?.startsWith('Transactions'))!;
    expect(tx).toHaveAttribute('aria-selected', 'true');
    expect(tx).toHaveAttribute('tabindex', '0');
    expect(tx).toHaveAttribute('aria-controls', 'api-mock-dock-panel');
    expect(document.getElementById('api-mock-dock-panel')).toHaveAttribute('role', 'tabpanel');
  });
});

describe('API Mock Studio — route tree', () => {
  it('applies roving tabindex to the selected route', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const tree = screen.getByRole('tree', { name: 'Rule list' });
    const items = within(tree).getAllByRole('treeitem');
    expect(items).toHaveLength(2);
    const selected = items.find(i => i.getAttribute('aria-selected') === 'true')!;
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(items.filter(i => i.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('moves focus with arrow keys without changing selection', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const tree = screen.getByRole('tree', { name: 'Rule list' });
    const items = within(tree).getAllByRole('treeitem');
    const selectedBefore = items.find(i => i.getAttribute('aria-selected') === 'true')!;
    items[1].focus();
    fireEvent.keyDown(tree, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
    expect(selectedBefore).toHaveAttribute('aria-selected', 'true');
  });
});

describe('API Mock Studio — names, tooltips, and switch', () => {
  it('gives icon-only controls accessible names and tooltips', () => {
    createServer();
    const addServer = screen.getByTestId('api-mock-tab-add');
    expect(addServer).toHaveAccessibleName('New mock server');
    expect(addServer).toHaveAttribute('title', 'New mock server');
    const addRoute = screen.getByTestId('api-mock-add-route');
    expect(addRoute).toHaveAccessibleName('Add rule');
    expect(addRoute).toHaveAttribute('title', 'Add rule');
  });

  it('exposes the route enabled control as a switch', () => {
    createServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const toggle = screen.getByTestId('api-mock-route-enabled');
    expect(toggle).toHaveAttribute('role', 'switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
