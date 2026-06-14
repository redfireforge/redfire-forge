/** Demo suite: API Testing with the Harness */
import type { DemoSuite } from '../types-v1';

export const apiTestingDemo: DemoSuite = {
  id: 'api-testing',
  name: 'API Test Runner',
  description: 'Build test suites, run them against your API, and check results with SLA thresholds.',
  icon: '🧪',
  estimatedMinutes: 4,
  initialTab: 'runner',
  steps: [
    {
      id: 'api-intro',
      title: 'Welcome to the Test Runner',
      description: 'The Test Runner executes test suites against live APIs. You can run individual tests, full suites, or batch-run multiple files. Results are shown with pass/fail badges and timing metrics.',
      highlight: '[data-testid="runner-tab"]',
    },
    {
      id: 'api-catalog',
      title: 'Test Catalog',
      description: 'Switch to the Catalog tab to browse and manage your test library. Tests are organized by file and can be tagged, searched, and filtered. You can import from JSON, YAML, or CSV formats.',
      highlight: '[data-testid="catalog-tab"]',
      action: async (ctx) => {
        ctx.navigateToTab('catalog');
        await ctx.delay(300);
      },
    },
    {
      id: 'api-import',
      title: 'Import Tests',
      description: 'Click the Import button to load test files. Supported formats: JSON (structured), YAML (human-readable), and CSV (spreadsheet-friendly). Each format has a template you can download.',
      highlight: '[data-testid="catalog-import-btn"]',
    },
    {
      id: 'api-requests',
      title: 'Request Builder',
      description: 'The Requests tab lets you build API calls from scratch. Set the method, URL, headers, and body. Send a quick test to verify your endpoint before adding it to a test suite.',
      highlight: '[data-testid="requests-tab"]',
      action: async (ctx) => {
        ctx.navigateToTab('requests');
        await ctx.delay(300);
      },
    },
    {
      id: 'api-envs',
      title: 'Environments',
      description: 'Define environment profiles (dev, staging, prod) in the Environments tab under Settings. Use {{variable}} syntax in URLs and headers to parameterize tests across environments.',
      highlight: '[data-testid="env-tab"]',
    },
    {
      id: 'api-results',
      title: 'Results Dashboard',
      description: 'After running tests, the Results tab shows a rich dashboard with pass/fail rates, response time distributions, group-by analysis, and comparison across runs. You can export results to PDF or JSON.',
      highlight: '[data-testid="results-tab"]',
      action: async (ctx) => {
        ctx.navigateToTab('results');
        await ctx.delay(300);
      },
    },
    {
      id: 'api-sla',
      title: 'SLA Thresholds',
      description: 'Set SLA targets for your tests: max response time, min uptime percentage, and expected status codes. Tests exceeding SLA limits get a warning badge. SLA results are tracked over time.',
    },
  ],
};
