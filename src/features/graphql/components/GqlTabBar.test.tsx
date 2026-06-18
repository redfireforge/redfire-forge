/**
 * @vitest-environment jsdom
 * GqlTabBar.test.tsx — unit tests for the GraphQL Studio tab bar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GqlTabBar } from './GqlTabBar';
import type { GqlStudioTab } from '../utils/tabPersistence';

// GqlTabBar → tabPersistence → monacoGraphqlSetup pulls the full Monaco runtime
// which calls document.queryCommandSupported (not available in jsdom). Mock it.
vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql/vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

function makeTab(id: string, overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id,
    label: `Tab ${id}`,
    modelUri: `inmemory://graphql/${id}`,
    query: 'query { }',
    variables: '{}',
    headers: [],
    operationType: 'query',
    unsavedChanges: false,
    connectionId: undefined,
    ...overrides,
  };
}

describe('GqlTabBar', () => {
  const defaultProps = {
    tabs: [makeTab('t1'), makeTab('t2')],
    activeTabId: 't1',
    confirmingCloseTabId: null,
    onTabClick: vi.fn(),
    onTabClose: vi.fn(),
    onAddTab: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all tabs', () => {
    render(<GqlTabBar {...defaultProps} />);
    expect(screen.getByTestId('gql-tab-t1')).toBeTruthy();
    expect(screen.getByTestId('gql-tab-t2')).toBeTruthy();
  });

  it('marks active tab with aria-selected=true', () => {
    render(<GqlTabBar {...defaultProps} />);
    const activeTab = screen.getByTestId('gql-tab-t1');
    expect(activeTab.getAttribute('aria-selected')).toBe('true');
    const otherTab = screen.getByTestId('gql-tab-t2');
    expect(otherTab.getAttribute('aria-selected')).toBe('false');
  });

  it('calls onTabClick when a tab is clicked', () => {
    render(<GqlTabBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-tab-t2'));
    expect(defaultProps.onTabClick).toHaveBeenCalledWith('t2');
  });

  it('renders add button', () => {
    render(<GqlTabBar {...defaultProps} />);
    expect(screen.getByTestId('gql-tab-add-btn')).toBeTruthy();
  });

  it('calls onAddTab when + button is clicked', () => {
    render(<GqlTabBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-tab-add-btn'));
    expect(defaultProps.onAddTab).toHaveBeenCalled();
  });

  it('disables + button when MAX_TABS reached', () => {
    const maxTabs = Array.from({ length: 8 }, (_, i) => makeTab(`t${i + 1}`));
    render(<GqlTabBar {...defaultProps} tabs={maxTabs} />);
    const addBtn = screen.getByTestId('gql-tab-add-btn') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('shows close button only when more than one tab', () => {
    const singleTabProps = { ...defaultProps, tabs: [makeTab('t1')], activeTabId: 't1' };
    render(<GqlTabBar {...singleTabProps} />);
    expect(screen.queryByTestId('gql-tab-close-t1')).toBeNull();
  });

  it('shows close button on multi-tab scenario', () => {
    render(<GqlTabBar {...defaultProps} />);
    expect(screen.getByTestId('gql-tab-close-t1')).toBeTruthy();
  });

  it('calls onTabClose when close button is clicked', () => {
    render(<GqlTabBar {...defaultProps} />);
    fireEvent.click(screen.getByTestId('gql-tab-close-t1'));
    expect(defaultProps.onTabClose).toHaveBeenCalledWith('t1', expect.any(Object));
  });

  it('shows unsaved dot for tab with unsavedChanges', () => {
    const props = {
      ...defaultProps,
      tabs: [makeTab('t1', { unsavedChanges: true }), makeTab('t2')],
    };
    render(<GqlTabBar {...props} />);
    const tab = screen.getByTestId('gql-tab-t1');
    expect(tab.querySelector('.gql-tab-dot')).toBeTruthy();
  });

  it('shows confirming class on close button when confirmingCloseTabId matches', () => {
    const props = { ...defaultProps, confirmingCloseTabId: 't1' };
    render(<GqlTabBar {...props} />);
    const closeBtn = screen.getByTestId('gql-tab-close-t1');
    expect(closeBtn.className).toContain('gql-tab-close--confirming');
  });

  it('applies mutation type class for mutation tab', () => {
    const tabs = [makeTab('t1', { operationType: 'mutation' }), makeTab('t2')];
    render(<GqlTabBar {...defaultProps} tabs={tabs} />);
    expect(screen.getByTestId('gql-tab-t1').className).toContain('gql-tab--mutation');
  });

  it('applies subscription type class for subscription tab', () => {
    const tabs = [makeTab('t1', { operationType: 'subscription' }), makeTab('t2')];
    render(<GqlTabBar {...defaultProps} tabs={tabs} />);
    expect(screen.getByTestId('gql-tab-t1').className).toContain('gql-tab--subscription');
  });

  it('applies query type class by default', () => {
    render(<GqlTabBar {...defaultProps} />);
    expect(screen.getByTestId('gql-tab-t1').className).toContain('gql-tab--query');
  });

  it('keyboard Enter on close button calls onTabClose', () => {
    render(<GqlTabBar {...defaultProps} />);
    const closeBtn = screen.getByTestId('gql-tab-close-t1');
    fireEvent.keyDown(closeBtn, { key: 'Enter' });
    expect(defaultProps.onTabClose).toHaveBeenCalled();
  });

  it('keyboard Space on close button calls onTabClose', () => {
    render(<GqlTabBar {...defaultProps} />);
    const closeBtn = screen.getByTestId('gql-tab-close-t1');
    fireEvent.keyDown(closeBtn, { key: ' ' });
    expect(defaultProps.onTabClose).toHaveBeenCalled();
  });
});
