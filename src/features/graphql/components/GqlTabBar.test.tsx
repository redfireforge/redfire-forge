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
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
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

  it('arrow keys, Home, and End move focus across tabs', () => {
    render(<GqlTabBar {...defaultProps} tabs={[makeTab('t1'), makeTab('t2'), makeTab('t3')]} />);
    const tab1 = screen.getByTestId('gql-tab-t1');
    const tab2 = screen.getByTestId('gql-tab-t2');
    const tab3 = screen.getByTestId('gql-tab-t3');

    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab2);

    fireEvent.keyDown(tab2, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab1);

    fireEvent.keyDown(tab1, { key: 'End' });
    expect(document.activeElement).toBe(tab3);

    fireEvent.keyDown(tab3, { key: 'Home' });
    expect(document.activeElement).toBe(tab1);
  });

  it('Enter and Space on a tab activate it', () => {
    render(<GqlTabBar {...defaultProps} />);
    const tab2 = screen.getByTestId('gql-tab-t2');
    fireEvent.keyDown(tab2, { key: 'Enter' });
    fireEvent.keyDown(tab2, { key: ' ' });
    expect(defaultProps.onTabClick).toHaveBeenNthCalledWith(1, 't2');
    expect(defaultProps.onTabClick).toHaveBeenNthCalledWith(2, 't2');
  });

  it('Delete closes a non-demo tab and focus can move to the next active tab after rerender', () => {
    const onTabClose = vi.fn();
    const { rerender } = render(
      <GqlTabBar
        {...defaultProps}
        tabs={[makeTab('t1'), makeTab('t2')]}
        activeTabId="t1"
        onTabClose={onTabClose}
      />,
    );

    const tab1 = screen.getByTestId('gql-tab-t1');
    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'Delete' });
    expect(onTabClose).toHaveBeenCalledWith('t1', expect.any(Object));

    rerender(
      <GqlTabBar
        {...defaultProps}
        tabs={[makeTab('t2')]}
        activeTabId="t2"
        onTabClose={onTabClose}
      />,
    );

    expect(document.activeElement).toBe(screen.getByTestId('gql-tab-t2'));
  });

  it('Delete does not close a demo tab or unknown key paths', () => {
    const onTabClose = vi.fn();
    render(
      <GqlTabBar
        {...defaultProps}
        tabs={[makeTab('user-1'), makeTab('demo-1', { demoLessonId: 'lesson-1' })]}
        activeTabId="demo-1"
        onTabClose={onTabClose}
      />,
    );

    const demoTab = screen.getByTestId('gql-tab-demo-1');
    fireEvent.keyDown(demoTab, { key: 'Delete' });
    fireEvent.keyDown(demoTab, { key: 'A' });
    expect(onTabClose).not.toHaveBeenCalled();
  });

  it('F2 starts rename from keyboard when rename is enabled', () => {
    render(<GqlTabBar {...defaultProps} onRenameTab={vi.fn()} />);
    const tab1 = screen.getByTestId('gql-tab-t1');
    fireEvent.keyDown(tab1, { key: 'F2' });
    expect(screen.getByTestId('gql-tab-rename-t1')).toBeInTheDocument();
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

    it('does not commit blank rename values on blur', () => {
      const onRenameTab = vi.fn();
      render(<GqlTabBar {...defaultProps} onRenameTab={onRenameTab} />);
      fireEvent.doubleClick(screen.getByTestId('gql-tab-t1').querySelector('.gql-tab-label')!);
      const input = screen.getByTestId('gql-tab-rename-t1') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.blur(input);
      expect(onRenameTab).not.toHaveBeenCalled();
    });
  });

  describe('duplicate controls', () => {
    it('calls onDuplicateTab from the duplicate button when below cap', () => {
      const onDuplicateTab = vi.fn();
      render(<GqlTabBar {...defaultProps} onDuplicateTab={onDuplicateTab} />);
      fireEvent.click(screen.getByTestId('gql-tab-duplicate-t1'));
      expect(onDuplicateTab).toHaveBeenCalledWith('t1');
    });

    it('marks duplicate button disabled and blocks click when at cap', () => {
      const onDuplicateTab = vi.fn();
      const maxUserTabs = Array.from({ length: 7 }, (_, i) => makeTab(`t${i + 1}`));
      render(<GqlTabBar {...defaultProps} tabs={maxUserTabs} onDuplicateTab={onDuplicateTab} />);
      const duplicate = screen.getByTestId('gql-tab-duplicate-t1');
      expect(duplicate).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(duplicate);
      expect(onDuplicateTab).not.toHaveBeenCalled();
    });

    it('hides duplicate button for demo tabs', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          onDuplicateTab={vi.fn()}
          tabs={[makeTab('user-1'), makeTab('demo-1', { demoLessonId: 'lesson-1' })]}
        />,
      );
      expect(screen.getByTestId('gql-tab-duplicate-user-1')).toBeInTheDocument();
      expect(screen.queryByTestId('gql-tab-duplicate-demo-1')).toBeNull();
    });

    it('executes drag-and-drop tab handlers for non-demo tabs', () => {
      render(<GqlTabBar {...defaultProps} tabs={[makeTab('t1'), makeTab('t2')]} />);
      const tab1 = screen.getByTestId('gql-tab-t1');
      const tab2 = screen.getByTestId('gql-tab-t2');
      const getBoundingClientRect = vi.spyOn(tab2, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 200,
        bottom: 40,
        width: 200,
        height: 40,
        toJSON: () => ({}),
      });
      const dataTransfer = {
        effectAllowed: 'move',
        dropEffect: 'move',
        types: ['text/x-gql-tab-index'],
        setData: vi.fn(),
        getData: vi.fn(() => '0'),
      };

      fireEvent.dragStart(tab1, {
        dataTransfer,
      });
      fireEvent.dragOver(tab2, {
        dataTransfer,
        clientX: 180,
      });
      fireEvent.dragLeave(tab2);
      fireEvent.drop(tab2, {
        dataTransfer,
        clientX: 180,
      });
      fireEvent.dragEnd(tab1);

      expect(tab1).toBeInTheDocument();
      expect(tab2).toBeInTheDocument();
      getBoundingClientRect.mockRestore();
    });
  });

  describe('context menu actions', () => {
    it('opens the context menu and dispatches rename, duplicate, copy, close, close-others, and close-right', () => {
      const onRenameTab = vi.fn();
      const onDuplicateTab = vi.fn();
      const onCloseOtherTabs = vi.fn();
      const onCloseTabsToRight = vi.fn();
      const onTabClose = vi.fn();
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={[makeTab('t1'), makeTab('t2'), makeTab('t3')]}
          onRenameTab={onRenameTab}
          onDuplicateTab={onDuplicateTab}
          onCloseOtherTabs={onCloseOtherTabs}
          onCloseTabsToRight={onCloseTabsToRight}
          onTabClose={onTabClose}
        />,
      );

      fireEvent.contextMenu(screen.getByTestId('gql-tab-t2'));
      fireEvent.click(screen.getByTestId('studio-tab-ctx-rename'));
      expect(screen.getByTestId('gql-tab-rename-t2')).toBeInTheDocument();

      fireEvent.contextMenu(screen.getByTestId('gql-tab-t2'));
      fireEvent.click(screen.getByTestId('studio-tab-ctx-duplicate'));
      expect(onDuplicateTab).toHaveBeenCalledWith('t2');

      fireEvent.contextMenu(screen.getByTestId('gql-tab-t2'));
      fireEvent.click(screen.getByTestId('studio-tab-ctx-copy-label'));
      expect(navigator.clipboard.writeText).toHaveBeenCalled();

      fireEvent.contextMenu(screen.getByTestId('gql-tab-t2'));
      fireEvent.click(screen.getByTestId('studio-tab-ctx-close'));
      expect(onTabClose).toHaveBeenCalledWith('t2', expect.any(Object));

      fireEvent.contextMenu(screen.getByTestId('gql-tab-t2'));
      fireEvent.click(screen.getByTestId('studio-tab-ctx-close-others'));
      expect(onCloseOtherTabs).toHaveBeenCalledWith('t2');

      fireEvent.contextMenu(screen.getByTestId('gql-tab-t2'));
      fireEvent.click(screen.getByTestId('studio-tab-ctx-close-right'));
      expect(onCloseTabsToRight).toHaveBeenCalledWith('t2');
    });

    it('disables duplicate and close actions in the menu for demo tabs', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={[makeTab('user-1'), makeTab('demo-1', { demoLessonId: 'lesson-1' })]}
          activeTabId="demo-1"
          onDuplicateTab={vi.fn()}
        />,
      );

      fireEvent.contextMenu(screen.getByTestId('gql-tab-demo-1'));
      expect(screen.getByTestId('studio-tab-ctx-duplicate')).toBeDisabled();
      expect(screen.getByTestId('studio-tab-ctx-close')).toBeDisabled();
    });

    it('disables close-right for the last tab and duplicate when the user tab cap is reached', () => {
      const maxUserTabs = Array.from({ length: 7 }, (_, i) => makeTab(`t${i + 1}`));
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={maxUserTabs}
          activeTabId="t7"
          onDuplicateTab={vi.fn()}
        />,
      );

      fireEvent.contextMenu(screen.getByTestId('gql-tab-t7'));
      expect(screen.getByTestId('studio-tab-ctx-duplicate')).toBeDisabled();
      expect(screen.getByTestId('studio-tab-ctx-close-right')).toBeDisabled();
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

    it('treats explicit no-auth tab auth as an override dot in the tab bar', () => {
      render(
        <GqlTabBar
          {...defaultProps}
          tabs={[
            makeTab('t1'),
            makeTab('t2', { auth: { type: 'none' } as GqlStudioTab['auth'] }),
          ]}
          activeTabId="t2"
        />,
      );
      expect(screen.getByTestId('gql-tab-auth-dot-t2')).toHaveAttribute('aria-label', 'Tab auth override');
    });
  });
});
