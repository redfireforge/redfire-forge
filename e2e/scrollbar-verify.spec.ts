import { test, expect } from '@playwright/test';

test.describe('Response Detail Modal Scrollbar', () => {
  test('scrollbar changes from 5px to 10px when expanded', async ({ page }) => {
    // Setup test data
    await page.addInitScript(() => {
      localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
      localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'http://localhost:5173' },
      }]));
      
      // Create long response body to ensure scrollbar appears
      const longBody = JSON.stringify({
        data: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        })),
      });
      
      localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
        id: 'fg-1', name: 'Test Feature', microserviceId: 'svc-1', environmentId: 'env-1',
        scenarios: [{ id: 'sc-1', name: 'Test Scenario', tests: [{
          id: 'test-1', name: 'GET Test', url: 'http://localhost:5173/',
          method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
        }] }],
      }]));
      localStorage.setItem('perf-test-v3-selected-env', 'env-1');
      localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
      localStorage.setItem('perf-test-v3-migrated', 'true');

      const testRun = {
        id: 'run-1', timestamp: Date.now(),
        envName: 't01', svcName: 'test-service',
        baseUrl: 'http://localhost:5173',
        config: { concurrency: 1, totalTransactions: 1, scenarioWeights: [], executionMode: 'sequential' },
        summary: {
          tps: 10, avgResponseTime: 50, minResponseTime: 20, maxResponseTime: 80,
          p95ResponseTime: 75, p99ResponseTime: 79, errorRate: 0,
          errorsByStatus: {}, totalRequests: 1, successfulRequests: 1,
          failedRequests: 0, failedValidations: 0, totalDurationMs: 100,
        },
        results: [{
          id: 'r1', scenarioId: 'test-1', scenarioName: 'GET Test',
          featureGroupName: 'Test Feature', groupName: 'Test Scenario',
          url: 'http://localhost:5173/', method: 'GET', httpStatus: 200, responseTimeMs: 50,
          responseBody: longBody, timestamp: Date.now(), passed: true,
          validationMode: 'none', failureDetails: [],
          timing: {
            dnsLookupMs: 2, tcpConnectionMs: 3, tlsHandshakeMs: 4,
            ttfbMs: 5, contentDownloadMs: 6,
          },
        }],
      };
      localStorage.setItem('perf-test-runs', JSON.stringify([testRun]));
      localStorage.setItem('perf-test-theme', 'dark');
    });

    // Navigate to results page
    await page.goto('/?tab=results');
    await page.waitForLoadState('networkidle');
    
    // Wait for "GET Test" row to appear
    await page.waitForSelector('text=GET Test', { timeout: 10000 });
    
    // Click the GET Test row to open modal
    await page.click('text=GET Test');
    
    // Wait for modal to appear
    await page.waitForSelector('.response-detail-modal', { timeout: 5000 });
    
    // Step 1: Check scrollbar in normal mode
    const normalScrollbarWidth = await page.evaluate(() => {
      const body = document.querySelector('.response-detail-body') as HTMLElement;
      if (!body) return null;
      const scrollbarStyle = window.getComputedStyle(body, '::-webkit-scrollbar');
      return scrollbarStyle.width;
    });
    
    console.log('Normal mode scrollbar width:', normalScrollbarWidth);
    
    // Step 2: Click expand button
    await page.click('.modal-expand-btn');
    
    // Wait a bit for transition
    await page.waitForTimeout(200);
    
    // Verify modal has fullscreen class
    await page.waitForSelector('.modal-fullscreen', { timeout: 2000 });
    
    // Step 3: Check scrollbar in expanded mode
    const expandedScrollbarWidth = await page.evaluate(() => {
      const body = document.querySelector('.response-detail-body') as HTMLElement;
      if (!body) return null;
      const modal = document.querySelector('.response-detail-modal') as HTMLElement;
      const modalClasses = modal?.className || '';
      const scrollbarStyle = window.getComputedStyle(body, '::-webkit-scrollbar');
      
      return {
        width: scrollbarStyle.width,
        display: scrollbarStyle.display,
        modalClasses,
        bodyOverflow: window.getComputedStyle(body).overflowY,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
      };
    });
    
    console.log('Expanded mode scrollbar:', expandedScrollbarWidth);
    
    // Assertions
    expect(normalScrollbarWidth).toBe('5px');
    expect(expandedScrollbarWidth?.width).toBe('10px');
    
    // Take screenshots for verification
    await page.screenshot({ path: 'test-results/scrollbar-expanded.png', fullPage: true });
  });
});
