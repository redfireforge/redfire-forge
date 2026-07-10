/**
 * Shared helpers for gRPC Studio shell E2E specs.
 */
import { gotoGrpcStudio } from '../grpc-helpers';

export const GRPC_STUDIO_SESSION_STORAGE_KEY = 'grpc-studio-session-v1';

export function serverStreamShellRuleSet() {
  return {
    rules: [{
      id: 'server-stream-shell',
      name: 'Server stream shell rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'ServerStream' } as const,
      response: {
        statusCode: 0,
        messages: [
          { message: 'shell-ss [1/2]' },
          { message: 'shell-ss [2/2]' },
        ],
        interMessageDelayMs: 0,
      },
    }],
  };
}

export function clientStreamShellRuleSet() {
  return {
    rules: [{
      id: 'client-stream-shell',
      name: 'Client stream shell rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'ClientStream' } as const,
      response: {
        statusCode: 0,
        body: { message: 'shell-client-aggregate' },
      },
    }],
  };
}

export function bidiStreamShellRuleSet() {
  return {
    rules: [{
      id: 'bidi-stream-shell',
      name: 'Bidi stream shell rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'BidiStream' } as const,
      response: {
        statusCode: 0,
        body: { message: 'shell-bidi-ack' },
      },
    }],
  };
}

export async function gotoFreshGrpcStudio(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('__grpc_e2e_session_cleared__')) {
      return;
    }
    localStorage.removeItem(key);
    sessionStorage.setItem('__grpc_e2e_session_cleared__', '1');
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithCorruptedSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, '{not-valid-json');
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithStaleSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'stale-tab',
      tabs: [{
        id: 'stale-tab',
        title: 'Stale tab',
        target: 'stale.example.com:50051',
        tlsMode: 'plaintext',
        auth: { type: 'bearer', bearerToken: 'stale-token' },
        metadata: {},
        timeoutMs: 30000,
        connectionId: null,
        requestMode: 'form',
        body: {},
        envVarOverrides: {},
        servicesCollapsed: true,
      }],
      tabDescriptors: {},
      timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithWrongVersionSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 99,
      activeTabId: 'wrong-version-tab',
      tabs: [{
        id: 'wrong-version-tab',
        title: 'Wrong version tab',
        target: 'wrong-version.example.com:50051',
        tlsMode: 'plaintext',
        auth: { type: 'bearer', bearerToken: 'wrong-version-token' },
        metadata: {},
        timeoutMs: 30000,
        connectionId: null,
        requestMode: 'form',
        body: {},
        envVarOverrides: {},
        servicesCollapsed: true,
      }],
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithInvalidTabsSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'invalid-tabs-tab',
      tabs: {
        id: 'invalid-tabs-tab',
        target: 'invalid-tabs.example.com:50051',
      },
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithMissingActiveTabSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'missing-tab',
      tabs: [
        {
          id: 'restored-tab-1',
          title: 'Restored tab 1',
          target: 'fallback-one.example.com:50051',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'fallback-one-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: true,
        },
        {
          id: 'restored-tab-2',
          title: 'Restored tab 2',
          target: 'fallback-two.example.com:50052',
          tlsMode: 'plaintext',
          auth: undefined,
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: false,
        },
      ],
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithOverflowTabsSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    const tabs = Array.from({ length: 10 }, (_, index) => ({
      id: `overflow-tab-${index + 1}`,
      title: `Overflow tab ${index + 1}`,
      target: `overflow-${index + 1}.example.com:${50051 + index}`,
      tlsMode: 'plaintext',
      auth: index === 0 ? { type: 'bearer', bearerToken: 'overflow-one-token' } : undefined,
      metadata: {},
      timeoutMs: 30000,
      connectionId: null,
      requestMode: 'form',
      body: {},
      envVarOverrides: {},
      servicesCollapsed: index === 0,
    }));

    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'overflow-tab-10',
      tabs,
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithSecondActiveSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'seeded-tab-2',
      tabs: [
        {
          id: 'seeded-tab-1',
          title: 'Seeded tab 1',
          target: 'seeded-one.example.com:50051',
          tlsMode: 'plaintext',
          auth: undefined,
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: false,
        },
        {
          id: 'seeded-tab-2',
          title: 'Seeded tab 2',
          target: 'seeded-two.example.com:50052',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'seeded-two-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: true,
        },
      ],
      tabDescriptors: {
        orphaned: {
          sourceSelection: { type: 'reflection' },
          expandedServiceIds: ['unused.service'],
        },
      },
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithEmptyTabsSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'empty-tab',
      tabs: [],
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithLegacyMissingDescriptorMapSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'legacy-tab-2',
      tabs: [
        {
          id: 'legacy-tab-1',
          title: 'Legacy tab 1',
          target: 'legacy-one.example.com:50051',
          tlsMode: 'plaintext',
          auth: undefined,
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
        },
        {
          id: 'legacy-tab-2',
          title: 'Legacy tab 2',
          target: 'legacy-two.example.com:50052',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'legacy-two-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
        },
      ],
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

export async function gotoGrpcStudioWithNullDescriptorMapSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'legacy-null-descriptor-tab',
      tabs: [
        {
          id: 'legacy-null-descriptor-tab',
          title: 'Legacy null descriptor tab',
          target: 'legacy-null.example.com:50051',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'legacy-null-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: true,
        },
      ],
      tabDescriptors: null,
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}
