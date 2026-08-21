import { describe, expect, it } from 'vitest';
import {
  API_MOCK_DEMO_SERVER_NAME,
  isApiMockDemoLessonServer,
  isApiMockDemoServerName,
  nextApiMockDemoServerName,
} from './apiMockDemoServers';

describe('apiMockDemoServers', () => {
  it('matches only the exact tour name, not any Demo* user name', () => {
    expect(isApiMockDemoServerName('Demo Mock Server')).toBe(true);
    expect(isApiMockDemoServerName('Demo Mock Server 2')).toBe(true);
    expect(isApiMockDemoServerName('Demo 1')).toBe(false);
    expect(isApiMockDemoServerName('Demo Health Check')).toBe(false);
    expect(isApiMockDemoServerName('Mock Server 4')).toBe(false);
    expect(isApiMockDemoServerName('AAAaaa')).toBe(false);
    expect(isApiMockDemoServerName(undefined)).toBe(false);
  });

  it('allocates Demo Mock Server, then numbered copies', () => {
    expect(nextApiMockDemoServerName([])).toBe(API_MOCK_DEMO_SERVER_NAME);
    expect(nextApiMockDemoServerName(['Demo Mock Server'])).toBe('Demo Mock Server 2');
    expect(nextApiMockDemoServerName(['Demo Mock Server', 'Demo Mock Server 2'])).toBe('Demo Mock Server 3');
    expect(nextApiMockDemoServerName(['Demo 1', 'Mock Server 4'])).toBe(API_MOCK_DEMO_SERVER_NAME);
  });

  it('never drops a server that was already in the user library', () => {
    const user = new Set(['srv-demo-1']);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-demo-1', name: 'Demo 1' },
      new Set(),
      user,
    )).toBe(false);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-demo-1', name: 'Demo Mock Server' },
      new Set(['srv-demo-1']),
      user,
    )).toBe(false);
  });

  it('drops remembered lesson ids and exact tour names that are not the user library', () => {
    expect(isApiMockDemoLessonServer(
      { id: 'srv-g', name: 'Keep Me' },
      new Set(['srv-g']),
    )).toBe(true);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-tour', name: 'Demo Mock Server' },
      new Set(),
    )).toBe(true);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-user', name: 'Demo 1' },
      new Set(),
    )).toBe(false);
  });

  it('drops leftover untitled Mock Server N that were never in the user library', () => {
    const user = new Set(['srv-keep']);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-keep', name: 'Mock Server 4' },
      new Set(),
      user,
    )).toBe(false);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-tour', name: 'Mock Server 4' },
      new Set(),
      user,
    )).toBe(true);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-new', name: 'Mock Server 3', serverFolder: 'Folder' },
      new Set(),
      user,
    )).toBe(false);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-aaa', name: 'AAAaaa' },
      new Set(),
      user,
    )).toBe(false);
    expect(isApiMockDemoLessonServer(
      { id: 'x' },
      new Set(),
      user,
    )).toBe(false);
    expect(isApiMockDemoLessonServer(
      { id: 'srv-tour', name: 'Mock Server 4' },
      new Set(),
      new Set(),
    )).toBe(false);
  });

  it('falls back when every Demo Mock Server slot is taken', () => {
    const names = [API_MOCK_DEMO_SERVER_NAME, ...Array.from({ length: 98 }, (_, i) => `${API_MOCK_DEMO_SERVER_NAME} ${i + 2}`)];
    expect(nextApiMockDemoServerName(names).startsWith(`${API_MOCK_DEMO_SERVER_NAME} `)).toBe(true);
    expect(names.includes(nextApiMockDemoServerName(names))).toBe(false);
  });
});
