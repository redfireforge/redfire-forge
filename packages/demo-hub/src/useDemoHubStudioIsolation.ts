/** gRPC / WebSocket studio tab isolation — dedicated demo tab per live lesson. */
import { useCallback, useRef } from 'react';
import type { DemoLesson } from './types';

export type StudioIsolationKind = 'grpc' | 'websocket';

export type StudioIsolationSession = {
  kind: StudioIsolationKind;
  previousActiveTabTestId: string | null;
  demoTabTestId: string | null;
};

export function useDemoHubStudioIsolation(pause: (ms: number) => Promise<void>) {
  const studioIsolationRef = useRef<StudioIsolationSession | null>(null);

  const waitForStudioTabChrome = useCallback(async (
    kind: StudioIsolationKind,
    timeoutMs = 3500,
  ): Promise<{ tabBar: HTMLElement; addBtn: HTMLButtonElement } | null> => {
    const tabBarSel = kind === 'grpc' ? '[data-testid="grpc-tab-bar"]' : '[data-testid="conn-tab-bar"]';
    const addBtnSel = kind === 'grpc' ? '[data-testid="grpc-add-tab"]' : '[data-testid="conn-tab-add"]';
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const tabBar = document.querySelector<HTMLElement>(tabBarSel);
      const addBtn = document.querySelector<HTMLButtonElement>(addBtnSel);
      if (tabBar && addBtn && !addBtn.disabled) {
        return { tabBar, addBtn };
      }
      await pause(80);
    }
    return null;
  }, [pause]);

  const setTextInputValue = useCallback((input: HTMLInputElement, value: string) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, []);

  const renameStudioActiveTabToDemo = useCallback(async (kind: StudioIsolationKind): Promise<void> => {
    const tabBarSel = kind === 'grpc' ? '[data-testid="grpc-tab-bar"]' : '[data-testid="conn-tab-bar"]';
    const renameInputSel = kind === 'grpc' ? '.grpc-tab-rename-input' : '[data-testid^="conn-tab-rename-"]';
    const activeTab = document.querySelector<HTMLElement>(`${tabBarSel} [role="tab"][aria-selected="true"]`);
    if (!activeTab) return;

    const dblClickEvent = new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 });
    activeTab.dispatchEvent(dblClickEvent);

    let renameInput: HTMLInputElement | null = null;
    const start = Date.now();
    while (Date.now() - start < 1200) {
      const candidate = document.querySelector<HTMLInputElement>(renameInputSel);
      if (candidate) {
        renameInput = candidate;
        break;
      }
      await pause(50);
    }
    if (!renameInput) return;

    setTextInputValue(renameInput, 'demo');
    renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    renameInput.blur();
    await pause(80);
  }, [pause, setTextInputValue]);

  const findDemoTabByLabel = useCallback((kind: StudioIsolationKind): HTMLElement | null => {
    const tabBarSel = kind === 'grpc' ? '[data-testid="grpc-tab-bar"]' : '[data-testid="conn-tab-bar"]';
    const labelSel = kind === 'grpc' ? '.grpc-tab-label' : '.ws-conn-tab-label';
    const tabs = Array.from(document.querySelectorAll<HTMLElement>(`${tabBarSel} [role="tab"]`));
    return tabs.find((tab) => {
      const label = tab.querySelector<HTMLElement>(labelSel)?.textContent?.trim().toLowerCase();
      return label === 'demo';
    }) ?? null;
  }, []);

  const findDemoTabsByLabel = useCallback((kind: StudioIsolationKind, tabBar?: HTMLElement): HTMLElement[] => {
    const tabBarSel = kind === 'grpc' ? '[data-testid="grpc-tab-bar"]' : '[data-testid="conn-tab-bar"]';
    const labelSel = kind === 'grpc' ? '.grpc-tab-label' : '.ws-conn-tab-label';
    const root = tabBar ?? document.querySelector<HTMLElement>(tabBarSel);
    if (!root) return [];
    const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
    return tabs.filter((tab) => {
      const label = tab.querySelector<HTMLElement>(labelSel)?.textContent?.trim().toLowerCase();
      return label === 'demo';
    });
  }, []);

  const closeStudioDemoTabsByLabel = useCallback(async (kind: StudioIsolationKind): Promise<void> => {
    const closeClass = kind === 'grpc' ? '.grpc-tab-action--close' : '.ws-conn-tab-close';
    while (true) {
      const demoTab = findDemoTabByLabel(kind);
      if (!demoTab) break;
      const closeBtn = demoTab.querySelector<HTMLButtonElement>(closeClass);
      if (!closeBtn || closeBtn.disabled) break;
      closeBtn.click();
      await pause(120);
    }
  }, [findDemoTabByLabel, pause]);

  const resolveStudioIsolationKind = useCallback((lesson: DemoLesson): StudioIsolationKind | null => {
    // Tab-bar lessons must keep the user's real connection tabs — creating a
    // temporary "demo" tab (add → rename → later close) is visible flashing.
    if (lesson.skipStudioTabIsolation) return null;
    // Workflow Designer / Runner lessons never mount WS/gRPC studio chrome.
    // Waiting for conn-tab-bar / grpc-tab-bar would burn ~3.5s in Preparing.
    const tab = lesson.initialTab;
    if (tab === 'workflow' || tab === 'workflow-runner') return null;
    if (lesson.category === 'grpc') return 'grpc';
    if (lesson.category === 'websocket') return 'websocket';
    return null;
  }, []);

  const openIsolatedStudioDemoTabSession = useCallback(async (lesson: DemoLesson): Promise<void> => {
    const kind = resolveStudioIsolationKind(lesson);
    if (!kind) return;

    const chrome = await waitForStudioTabChrome(kind);
    if (!chrome) return;
    const { tabBar, addBtn } = chrome;

    const prevActive = tabBar.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    const previousActiveTabTestId = prevActive?.getAttribute('data-testid') ?? null;

    const existingDemoTabs = findDemoTabsByLabel(kind, tabBar);
    if (existingDemoTabs.length > 0) {
      const keepTab = existingDemoTabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? existingDemoTabs[0]!;
      const keepTabId = keepTab.getAttribute('data-testid') ?? null;

      const closeClass = kind === 'grpc' ? '.grpc-tab-action--close' : '.ws-conn-tab-close';
      for (const tab of existingDemoTabs) {
        if (tab === keepTab) continue;
        const closeBtn = tab.querySelector<HTMLButtonElement>(closeClass);
        if (closeBtn && !closeBtn.disabled) {
          closeBtn.click();
          await pause(120);
        }
      }

      if (keepTab.getAttribute('aria-selected') !== 'true') {
        keepTab.click();
        await pause(100);
      }

      studioIsolationRef.current = {
        kind,
        previousActiveTabTestId,
        demoTabTestId: keepTabId,
      };
      return;
    }

    addBtn.click();
    const start = Date.now();
    let nextActive: HTMLElement | null = null;
    while (Date.now() - start < 1500) {
      nextActive = tabBar.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (nextActive && nextActive.getAttribute('data-testid') !== previousActiveTabTestId) {
        break;
      }
      await pause(60);
    }

    const demoTabTestId = nextActive?.getAttribute('data-testid') ?? null;

    await renameStudioActiveTabToDemo(kind);

    studioIsolationRef.current = { kind, previousActiveTabTestId, demoTabTestId };
  }, [findDemoTabsByLabel, pause, renameStudioActiveTabToDemo, resolveStudioIsolationKind, waitForStudioTabChrome]);

  const closeIsolatedStudioDemoTabSession = useCallback(async (
    options?: { restorePreviousTab?: boolean },
  ): Promise<void> => {
    const session = studioIsolationRef.current;
    if (!session) return;
    const restorePreviousTab = options?.restorePreviousTab ?? true;

    const closeSelector = (() => {
      if (!session.demoTabTestId) return null;
      if (session.kind === 'grpc') {
        return `[data-testid="grpc-tab-close-${session.demoTabTestId}"]`;
      }
      const wsTabId = session.demoTabTestId.replace(/^conn-tab-/, '');
      return `[data-testid="conn-tab-close-${wsTabId}"]`;
    })();

    let didCloseDemoTab = false;
    if (closeSelector) {
      const closeBtn = document.querySelector<HTMLButtonElement>(closeSelector);
      if (closeBtn && !closeBtn.disabled) {
        closeBtn.click();
        didCloseDemoTab = true;
        await pause(120);
      }
    }

    if (!didCloseDemoTab) {
      const demoTab = findDemoTabByLabel(session.kind);
      const fallbackCloseBtn = demoTab?.querySelector<HTMLButtonElement>(
        session.kind === 'grpc' ? '.grpc-tab-action--close' : '.ws-conn-tab-close',
      );
      if (fallbackCloseBtn && !fallbackCloseBtn.disabled) {
        fallbackCloseBtn.click();
        await pause(120);
      }
    }

    await closeStudioDemoTabsByLabel(session.kind);

    if (restorePreviousTab && session.previousActiveTabTestId) {
      const prevTab = document.querySelector<HTMLElement>(`[data-testid="${session.previousActiveTabTestId}"]`);
      if (prevTab && prevTab.getAttribute('aria-selected') !== 'true') {
        prevTab.click();
        await pause(100);
      }
    }

    studioIsolationRef.current = null;
  }, [closeStudioDemoTabsByLabel, findDemoTabByLabel, pause]);

  const ensureActiveDemoTabOrCreate = useCallback(async (lesson: DemoLesson): Promise<void> => {
    const kind = resolveStudioIsolationKind(lesson);
    if (!kind) return;
    const session = studioIsolationRef.current;
    if (session?.kind === kind && session.demoTabTestId) {
      const existingTab = document.querySelector<HTMLElement>(`[data-testid="${session.demoTabTestId}"]`);
      if (existingTab) {
        if (existingTab.getAttribute('aria-selected') !== 'true') {
          existingTab.click();
          await pause(80);
        }
        return;
      }
    }
    await openIsolatedStudioDemoTabSession(lesson);
  }, [resolveStudioIsolationKind, openIsolatedStudioDemoTabSession, pause]);

  return {
    openIsolatedStudioDemoTabSession,
    closeIsolatedStudioDemoTabSession,
    ensureActiveDemoTabOrCreate,
  };
}
