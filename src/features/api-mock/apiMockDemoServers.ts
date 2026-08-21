/**
 * Lesson-created mock servers use the exact display name `Demo Mock Server`
 * (or `Demo Mock Server 2`, …). Cleanup keys off the pre-demo library ids and
 * that exact name — never a generic `Demo ` prefix, so a user server named
 * `Demo 1` is left alone.
 */
export const API_MOCK_DEMO_SERVER_NAME = 'Demo Mock Server';

const TOUR_CREATED_NAME = /^Demo Mock Server(?: \d+)?$/;
const UNTITLED_MOCK_NAME = /^Mock Server \d+$/;

/** True only for the names this tour assigns — not `Demo 1`, `Demo Health Check`, etc. */
export function isApiMockDemoServerName(name: string | undefined): boolean {
  return TOUR_CREATED_NAME.test(name ?? '');
}

export function nextApiMockDemoServerName(existingNames: readonly string[]): string {
  const used = new Set(existingNames.filter(isApiMockDemoServerName));
  if (!used.has(API_MOCK_DEMO_SERVER_NAME)) return API_MOCK_DEMO_SERVER_NAME;
  for (let n = 2; n < 100; n++) {
    const candidate = `${API_MOCK_DEMO_SERVER_NAME} ${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${API_MOCK_DEMO_SERVER_NAME} ${Date.now()}`;
}

export interface ApiMockDemoServerRef {
  id: string;
  name?: string;
  serverFolder?: string;
}

/**
 * Drop lesson artifacts only:
 * - ids the lesson imported / created (remembered)
 * - exact `Demo Mock Server` names the tour assigned
 * - leftover untitled `Mock Server N` that were never in the pre-demo library
 *
 * Never drop a server whose id was already in the user's library, regardless of name.
 */
export function isApiMockDemoLessonServer(
  server: ApiMockDemoServerRef,
  rememberedIds: ReadonlySet<string>,
  userLibraryIds?: ReadonlySet<string>,
): boolean {
  if (userLibraryIds?.has(server.id)) return false;
  if (rememberedIds.has(server.id)) return true;
  if (isApiMockDemoServerName(server.name)) return true;
  if (!userLibraryIds || userLibraryIds.size === 0) return false;
  if (server.serverFolder) return false;
  return UNTITLED_MOCK_NAME.test(server.name ?? '');
}
