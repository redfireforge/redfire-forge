/**
 * @vitest-environment jsdom
 * GqlTabBar.test.tsx — unit tests for the GraphQL Studio tab bar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
    resetAllMocks();
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

  it('disables + button when MAX_USER_TABS reached', () => {
    const maxUserTabs = Array.from({ length: 7 }, (_, i) => makeTab(`t${i + 1}`));
    render(<GqlTabBar {...defaultProps} tabs={maxUserTabs} />);
    const addBtn = screen.getByTestId('gql-tab-add-btn') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('hides close button on demo tabs', () => {
    const user = makeTab('user-1');
    const demo = makeTab('demo-1', { demoLessonId: 'gql-first-query', label: 'Demo: Test' });
    render(
      <GqlTabBar
        {...defaultProps}
        tabs={[user, demo]}
        activeTabId="demo-1"
      />,
    );
    expect(screen.getByTestId('gql-tab-close-user-1')).toBeTruthy();
    expect(screen.queryByTestId('gql-tab-close-demo-1')).toBeNull();
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

  describe('batch mode', () => {
    it('renders read-only batch badge on included tabs', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          batchEnabled
          batchIncludedTabIds={new Set(['t1'])}
        />,
      );
      expect(screen.getByTestId('gql-tab-batch-badge-t1')).toBeInTheDocument();
      expect(screen.queryByTestId('gql-tab-batch-badge-t2')).toBeNull();
    });

    it('does not render batch badge when batch is disabled', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          batchEnabled={false}
          batchIncludedTabIds={new Set(['t1'])}
        />,
      );
      expect(screen.queryByTestId('gql-tab-batch-badge-t1')).toBeNull();
    });

    it('does not render batch badge on tabs not in batchIncludedTabIds', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={[makeTab('t1'), makeTab('t2')]}
          batchEnabled
          batchIncludedTabIds={new Set(['t2'])}
        />,
      );
      expect(screen.queryByTestId('gql-tab-batch-badge-t1')).toBeNull();
      expect(screen.getByTestId('gql-tab-batch-badge-t2')).toBeInTheDocument();
    });
  });

  describe('tab rename', () => {
    it('shows rename input on double-click when onRenameTab is provided', () => {
      render(<GqlTabBar {...defaultProps} onRenameTab={vi.fn()} />);
      const label = screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')!;
      fireEvent.doubleClick(label);
      expect(screen.getByTestId('gql-tab-rename-t1')).toBeTruthy();
    });

    it('calls onRenameTab on Enter in rename input', () => {
      const onRenameTab = vi.fn();
      render(<GqlTabBar {...defaultProps} onRenameTab={onRenameTab} />);
      fireEvent.doubleClick(screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')!);
      const input = screen.getByTestId('gql-tab-rename-t1') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'My Query' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRenameTab).toHaveBeenCalledWith('t1', 'My Query');
    });

    it('commits rename on blur', () => {
      const onRenameTab = vi.fn();
      render(<GqlTabBar {...defaultProps} onRenameTab={onRenameTab} />);
      fireEvent.doubleClick(screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')!);
      const input = screen.getByTestId('gql-tab-rename-t1') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Blurred Name' } });
      fireEvent.blur(input);
      expect(onRenameTab).toHaveBeenCalledWith('t1', 'Blurred Name');
    });

    it('cancels rename on Escape without calling onRenameTab', () => {
      const onRenameTab = vi.fn();
      render(<GqlTabBar {...defaultProps} onRenameTab={onRenameTab} />);
      fireEvent.doubleClick(screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')!);
      const input = screen.getByTestId('gql-tab-rename-t1') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Discarded' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onRenameTab).not.toHaveBeenCalled();
      expect(screen.queryByTestId('gql-tab-rename-t1')).toBeNull();
    });

    it('stops click propagation on rename input', () => {
      const onTabClick = vi.fn();
      render(<GqlTabBar {...defaultProps} onTabClick={onTabClick} onRenameTab={vi.fn()} />);
      fireEvent.doubleClick(screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')!);
      fireEvent.click(screen.getByTestId('gql-tab-rename-t1'));
      expect(onTabClick).not.toHaveBeenCalled();
    });

    it('does not start rename on double-click when onRenameTab is missing', () => {
      render(<GqlTabBar {...defaultProps} />);
      fireEvent.doubleClick(screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')!);
      expect(screen.queryByTestId('gql-tab-rename-t1')).toBeNull();
    });
  });

  describe('tab presentation — title and subtitle', () => {
    it('uses endpoint hostname as tab title without duplicate subtitle', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={[
            makeTab('t1'),
            makeTab('t2', { label: '127.0.0.1:4041', endpoint: 'http://127.0.0.1:4041/graphql' }),
          ]}
          activeTabId="t2"
        />,
      );
      expect(screen.getByTestId('gql-tab-t2').querySelector('.gql-tab-label')).toHaveTextContent('127.0.0.1:4041');
      expect(screen.queryByTestId('gql-tab-subtitle-t2')).toBeNull();
    });

    it('shows endpoint subtitle when manual title differs from connection', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={[
            makeTab('t1'),
            makeTab('t2', {
              label: 'GetUsers',
              labelManual: true,
              endpoint: 'https://api.io/graphql',
            }),
          ]}
        />,
      );
      expect(screen.queryByTestId('gql-tab-subtitle-t1')).toBeNull();
      expect(screen.getByTestId('gql-tab-subtitle-t2')).toHaveTextContent('api.io');
      expect(screen.getByTestId('gql-tab-t2').querySelector('.gql-tab-label')).toHaveTextContent('GetUsers');
    });

    it('does not show subtitle when tab has no endpoint override', () => {
      render(<GqlTabBar {...defaultProps} />);
      expect(screen.queryByTestId('gql-tab-subtitle-t1')).toBeNull();
      expect(screen.queryByTestId('gql-tab-subtitle-t2')).toBeNull();
    });

    it('uses page default endpoint as title for tab without per-tab override', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          pageDefaultEndpoint="http://127.0.0.1:4041/graphql"
          tabs={[
            makeTab('t1'),
            makeTab('t2', { endpoint: 'http://127.0.0.1:4042/graphql' }),
          ]}
        />,
      );
      expect(screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')).toHaveTextContent('127.0.0.1:4041');
      expect(screen.queryByTestId('gql-tab-subtitle-t1')).toBeNull();
      expect(screen.getByTestId('gql-tab-t2').querySelector('.gql-tab-label')).toHaveTextContent('127.0.0.1:4042');
    });

    it('applies stacked layout when subtitle is present', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={[
            makeTab('t1'),
            makeTab('t2', { label: 'My Query', labelManual: true, endpoint: 'https://api.io/graphql' }),
          ]}
        />,
      );
      expect(screen.getByTestId('gql-tab-t2').className).toContain('gql-tab--stacked');
      expect(screen.getByTestId('gql-tab-t1').className).not.toContain('gql-tab--stacked');
    });
  });

  describe('Phase 6F — profile-linked tabs', () => {
    const profiles = [{
      id: 'prof-staging',
      name: 'Staging',
      endpoint: 'https://staging.example/graphql',
      auth: null,
      createdAt: 1,
    }];

    it('uses profile endpoint hostname as title when profile is linked', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          profiles={profiles}
          tabs={[
            makeTab('t1'),
            makeTab('t2', { connectionId: 'prof-staging' }),
          ]}
        />,
      );
      expect(screen.getByTestId('gql-tab-t2').querySelector('.gql-tab-label')).toHaveTextContent('staging.example');
      expect(screen.getByTestId('gql-tab-subtitle-t2')).toHaveTextContent('Staging');
    });

    it('shows profile subtitle when endpoint is title and profile is linked', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          profiles={profiles}
          tabs={[makeTab('t1'), makeTab('t2', { connectionId: 'prof-staging', endpoint: 'https://staging.example/graphql' })]}
          activeTabId="t2"
        />,
      );
      expect(screen.getByTestId('gql-tab-t2').querySelector('.gql-tab-label')).toHaveTextContent('staging.example');
      expect(screen.getByTestId('gql-tab-subtitle-t2')).toHaveTextContent('Staging');
    });
  });

  describe('Phase 6H Slice 4 — auth dots', () => {
    const profiles = [{
      id: 'prof-staging',
      name: 'Staging',
      endpoint: 'https://staging.example/graphql',
      auth: { type: 'bearer' as const, token: 'x' },
      createdAt: 1,
    }];

    it('does not render auth dots for a single tab', () => {
      render(<GqlTabBar {...defaultProps} tabs={[makeTab('t1')]} activeTabId="t1" />);
      expect(screen.queryByTestId('gql-tab-auth-dot-t1')).toBeNull();
    });

    it('renders inherit dot for inheriting tab in multi-tab session', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          profiles={profiles}
          tabs={[makeTab('t1'), makeTab('t2')]}
          activeTabId="t1"
        />,
      );
      const dot = screen.getByTestId('gql-tab-auth-dot-t1');
      expect(dot.className).toContain('gql-tab-auth-dot--inherit');
    });

    it('renders profile dot for profile-linked tab without auth override', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          profiles={profiles}
          tabs={[
            makeTab('t1'),
            makeTab('t2', { connectionId: 'prof-staging', endpoint: 'https://staging.example/graphql' }),
          ]}
          activeTabId="t2"
        />,
      );
      const dot = screen.getByTestId('gql-tab-auth-dot-t2');
      expect(dot.className).toContain('gql-tab-auth-dot--profile');
    });

    it('renders override dot when tab stores bearer auth override', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          profiles={profiles}
          tabs={[
            makeTab('t1'),
            makeTab('t2', { auth: { type: 'bearer', token: 'tab-only' } }),
          ]}
          activeTabId="t2"
        />,
      );
      const dot = screen.getByTestId('gql-tab-auth-dot-t2');
      expect(dot.className).toContain('gql-tab-auth-dot--override');
    });
  });
});
