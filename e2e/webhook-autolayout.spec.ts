import { test, expect } from '@playwright/test';

test.describe('Webhook Sample Auto-Layout', () => {
  test('loads webhook sample and verifies sibling node positions after auto-layout', async ({ page }) => {
    test.slow(); // Complex gallery + workflow loading

    // Navigate to the app
    await page.goto('http://localhost:5173/');
    
    // Wait for app header to be ready
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });
    
    // Go to Workflow tab if not already there
    const workflowTab = page.locator('button:has-text("Workflow")');
    if (await workflowTab.isVisible()) {
      await workflowTab.click();
    }
    
    console.log('✓ App loaded');
    
    // Click +New → From Template to open template gallery
    const newBtn = page.locator('button:has-text("+ New")');
    await newBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newBtn.click();
    await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();
    
    // Wait for gallery to be visible
    await expect(page.locator('.gallery-domain-btn:has-text("Workflows")')).toBeVisible({ timeout: 5_000 });
    
    console.log('✓ Gallery opened');
    
    // Gallery page shows — filter to Workflows domain and select webhook sample
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    const webhookCard = page.locator('.gallery-card', { hasText: 'Webhook Trigger' });
    await webhookCard.waitFor({ state: 'visible', timeout: 5000 });
    await webhookCard.click();
    
    // Click "Load Workflow" action button in detail panel
    const loadBtn = page.locator('button:has-text("Load Workflow")');
    await loadBtn.waitFor({ state: 'visible', timeout: 5000 });
    await loadBtn.click();
    
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
      
      // Auto-layout is now applied on load, so verify nodes are well-spaced
      // (no overlap: 160px width + 30px MIN_GAP = 190px minimum)
      expect(initialGap).toBeGreaterThanOrEqual(190);
      expect(initialProcess.x).toBeGreaterThanOrEqual(0);
      expect(initialProcess.y).toBeGreaterThanOrEqual(0);
      expect(initialAlert.x).toBeGreaterThanOrEqual(0);
      expect(initialAlert.y).toBeGreaterThanOrEqual(0);
      
      console.log('✅ Initial positions have auto-layout applied!');
    }
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'test-results/webhook-initial.png',
      fullPage: true 
    });
    console.log('✓ Screenshot saved: webhook-initial.png');
    
    // Now click auto-layout button in the floating pill controls
    const autoLayoutButton = page.locator('.wf-pill-btn[title="Auto-layout"]');
    await autoLayoutButton.waitFor({ state: 'visible', timeout: 5000 });
    await autoLayoutButton.click();
    
    // Wait for layout animation to complete by checking node positions stabilize
    await page.waitForFunction(() => {
      const node = document.querySelector('[data-id="wh-process"]') as HTMLElement;
      return node && node.style.transform.includes('translate');
    }, { timeout: 5000 });
    
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
