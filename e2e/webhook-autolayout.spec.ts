import { test, expect } from '@playwright/test';

test.describe('Webhook Sample Auto-Layout', () => {
  test('loads webhook sample and verifies end node positions', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173/');
    
    // Wait for app to load
    await page.waitForTimeout(1000);
    
    // Go to Workflow tab if not already there
    const workflowTab = page.locator('button:has-text("Workflow")');
    if (await workflowTab.isVisible()) {
      await workflowTab.click();
      await page.waitForTimeout(500);
    }
    
    console.log('✓ App loaded');
    
    // Click Browse Samples
    const browseSamplesButton = page.locator('button:has-text("Browse Samples")');
    await browseSamplesButton.waitFor({ state: 'visible', timeout: 5000 });
    await browseSamplesButton.click();
    await page.waitForTimeout(500);
    
    console.log('✓ Browse Samples clicked');
    
    // Wait for dropdown to appear and select webhook sample
    const webhookSample = page.locator('.wf-sample-dropdown-item', { 
      hasText: 'Webhook Trigger' 
    });
    await webhookSample.waitFor({ state: 'visible', timeout: 5000 });
    await webhookSample.click();
    await page.waitForTimeout(1000);
    
    console.log('✓ Webhook sample selected');
    
    // Wait for nodes to render
    await page.waitForSelector('[data-id="wh-end-success"]', { timeout: 5000 });
    await page.waitForSelector('[data-id="wh-end-failure"]', { timeout: 5000 });
    
    // Helper function to get node position from transform style
    const getNodePosition = async (nodeId: string) => {
      return await page.evaluate((id) => {
        const node = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
        if (!node) return null;
        const transform = node.style.transform;
        const match = transform.match(/translate\(([0-9.-]+)px,\s*([0-9.-]+)px\)/);
        return match ? { x: Math.round(parseFloat(match[1])), y: Math.round(parseFloat(match[2])) } : null;
      }, nodeId);
    };
    
    // Get INITIAL positions (from sample data)
    const initialEndSuccess = await getNodePosition('wh-end-success');
    const initialEndFailure = await getNodePosition('wh-end-failure');
    
    console.log('\n=== INITIAL POSITIONS (from sample) ===');
    console.log('End Success:', initialEndSuccess);
    console.log('End Failure:', initialEndFailure);
    
    if (initialEndSuccess && initialEndFailure) {
      const initialGap = Math.abs(initialEndFailure.x - initialEndSuccess.x);
      console.log(`Gap: ${initialGap}px`);
      
      // Verify initial positions match the manual layout in the sample
      expect(initialEndSuccess.x).toBe(100);
      expect(initialEndSuccess.y).toBe(600);
      expect(initialEndFailure.x).toBe(380);
      expect(initialEndFailure.y).toBe(600);
      expect(initialGap).toBe(280);
      
      console.log('✅ Initial positions are correct (manual layout)!');
    }
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'test-results/webhook-initial.png',
      fullPage: true 
    });
    console.log('✓ Screenshot saved: webhook-initial.png');
    
    // Now click auto-layout button (second button in React Flow controls)
    const autoLayoutButton = page.locator('.react-flow__controls button').nth(1);
    await autoLayoutButton.waitFor({ state: 'visible', timeout: 5000 });
    await autoLayoutButton.click();
    await page.waitForTimeout(1500);
    
    console.log('\n✓ Auto-layout button clicked');
    
    // Get positions AFTER auto-layout
    const afterEndSuccess = await getNodePosition('wh-end-success');
    const afterEndFailure = await getNodePosition('wh-end-failure');
    
    console.log('\n=== AFTER AUTO-LAYOUT ===');
    console.log('End Success:', afterEndSuccess);
    console.log('End Failure:', afterEndFailure);
    
    if (afterEndSuccess && afterEndFailure) {
      const afterGap = Math.abs(afterEndFailure.x - afterEndSuccess.x);
      console.log(`Gap: ${afterGap}px`);
      console.log(`Required minimum: 190px (160px width + 30px MIN_GAP)`);
      console.log(`Status: ${afterGap >= 190 ? '✅ NO OVERLAP' : '❌ OVERLAPPING'}`);
      
      // Verify no overlap
      expect(afterGap).toBeGreaterThanOrEqual(190);
      
      // Verify both nodes have positive coordinates
      expect(afterEndSuccess.x).toBeGreaterThanOrEqual(20);
      expect(afterEndSuccess.y).toBeGreaterThanOrEqual(20);
      expect(afterEndFailure.x).toBeGreaterThanOrEqual(20);
      expect(afterEndFailure.y).toBeGreaterThanOrEqual(20);
      
      console.log('✅ Auto-layout positions are correct!');
    }
    
    // Take screenshot of final state
    await page.screenshot({ 
      path: 'test-results/webhook-autolayout.png',
      fullPage: true 
    });
    console.log('✓ Screenshot saved: webhook-autolayout.png');
  });
});
