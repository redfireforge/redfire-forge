import { test, expect } from '@playwright/test';

test.describe('Webhook Sample Auto-Layout', () => {
  test('loads webhook sample and verifies sibling node positions after auto-layout', async ({ page }) => {
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
    
    // Click Gallery tab to open template gallery
    const galleryTab = page.locator('button.main-nav-tab:has-text("Gallery")');
    await galleryTab.waitFor({ state: 'visible', timeout: 5000 });
    await galleryTab.click();
    await page.waitForTimeout(500);
    
    console.log('✓ Gallery opened');
    
    // Wait for gallery modal and select webhook sample
    const webhookSample = page.locator('.tg-card', { 
      hasText: 'Webhook Trigger' 
    });
    await webhookSample.waitFor({ state: 'visible', timeout: 5000 });
    await webhookSample.click();
    await page.waitForTimeout(1000);
    
    console.log('✓ Webhook sample selected');
    
    // Wait for the sibling nodes to render (Process Order and Out of Stock Alert)
    await page.waitForSelector('[data-id="wh-process"]', { timeout: 5000 });
    await page.waitForSelector('[data-id="wh-alert"]', { timeout: 5000 });
    await page.waitForSelector('[data-id="wh-end"]', { timeout: 5000 });
    
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
    const initialProcess = await getNodePosition('wh-process');
    const initialAlert = await getNodePosition('wh-alert');
    
    console.log('\n=== INITIAL POSITIONS (from sample) ===');
    console.log('Process Order:', initialProcess);
    console.log('Out of Stock Alert:', initialAlert);
    
    if (initialProcess && initialAlert) {
      const initialGap = Math.abs(initialAlert.x - initialProcess.x);
      console.log(`Gap: ${initialGap}px`);
      
      // Verify initial positions match the manual layout in the sample
      expect(initialProcess.x).toBe(100);
      expect(initialProcess.y).toBe(460);
      expect(initialAlert.x).toBe(380);
      expect(initialAlert.y).toBe(460);
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
    const afterProcess = await getNodePosition('wh-process');
    const afterAlert = await getNodePosition('wh-alert');
    
    console.log('\n=== AFTER AUTO-LAYOUT ===');
    console.log('Process Order:', afterProcess);
    console.log('Out of Stock Alert:', afterAlert);
    
    if (afterProcess && afterAlert) {
      const afterGap = Math.abs(afterAlert.x - afterProcess.x);
      console.log(`Gap: ${afterGap}px`);
      console.log(`Required minimum: 190px (160px width + 30px MIN_GAP)`);
      console.log(`Status: ${afterGap >= 190 ? '✅ NO OVERLAP' : '❌ OVERLAPPING'}`);
      
      // Verify no overlap between sibling nodes
      expect(afterGap).toBeGreaterThanOrEqual(190);
      
      // Verify both nodes have positive coordinates
      expect(afterProcess.x).toBeGreaterThanOrEqual(20);
      expect(afterProcess.y).toBeGreaterThanOrEqual(20);
      expect(afterAlert.x).toBeGreaterThanOrEqual(20);
      expect(afterAlert.y).toBeGreaterThanOrEqual(20);
      
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
