/** All demo suites — exported as a single array */
import { websocketBasicsDemo } from './websocket-basics';
import { authTransportDemo } from './auth-transport';
import { consoleDemo } from './console-debugging';
import { filteringDiffDemo } from './filtering-diff-schema';
import { sseStudioDemo } from './sse-studio';
import { apiTestingDemo } from './api-testing';

export const allDemoSuites = [
  websocketBasicsDemo,
  authTransportDemo,
  consoleDemo,
  filteringDiffDemo,
  sseStudioDemo,
  apiTestingDemo,
];
