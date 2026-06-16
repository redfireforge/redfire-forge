/**
 * Diagnostic: find where TLS config is persisted so it survives page reload.
 * The user still sees 504 after reload — something is saving skip-cert to storage.
 */
import { test, expect } from '@playwright/test';
import { WS } from '../src/shared/selectors';

const BASE = 'http://localhost:5173/?tab=websocket-studio';
const WSS_URL = 'wss://echo.websocket.org';
const SKIP_CERT_CHECKBOX = `${WS.TLS_SKIP_CERT} input[type="checkbox"]`;

test('DIAG: dump all localStorage + sessionStorage after enabling skip-cert', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click(WS.MODE_CLIENT);
  await page.click(WS.LEFT_TAB_CONNECT);

  // Enable skip-cert (dirty state)
  await page.fill(WS.URL_INPUT, WSS_URL);
  await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });
  const toggle = page.locator(WS.TLS_TOGGLE);
  if (await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click();
    await page.waitForTimeout(300);
  }
  await page.locator(SKIP_CERT_CHECKBOX).check();
  await page.waitForTimeout(500);

  // Dump all storage
  const storage = await page.evaluate(() => {
    const ls: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      ls[k] = localStorage.getItem(k) ?? '';
    }
    const ss: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)!;
      ss[k] = sessionStorage.getItem(k) ?? '';
    }
    return { ls, ss, lsCount: Object.keys(ls).length, ssCount: Object.keys(ss).length };
  });

  console.log(`\n=== localStorage (${storage.lsCount} keys) ===`);
  for (const [k, v] of Object.entries(storage.ls)) {
    // Flag keys that might contain TLS info
    const flagged = v.includes('rejectUnauthorized') || v.includes('tls') || v.includes('TLS') || v.includes('skipCert') || v.includes('skip_cert');
    console.log(`${flagged ? '⚠️ TLS!' : '   '} [${k}] = ${v.slice(0, 300)}`);
  }

  console.log(`\n=== sessionStorage (${storage.ssCount} keys) ===`);
  for (const [k, v] of Object.entries(storage.ss)) {
    const flagged = v.includes('rejectUnauthorized') || v.includes('tls') || v.includes('TLS');
    console.log(`${flagged ? '⚠️ TLS!' : '   '} [${k}] = ${v.slice(0, 300)}`);
  }

  // Now RELOAD and check if skip-cert is still true
  await page.reload({ waitUntil: 'networkidle' });
  await page.click(WS.MODE_CLIENT);
  await page.click(WS.LEFT_TAB_CONNECT);

  // The URL should be blank after reload (no persistence)
  const urlVal = await page.locator(WS.URL_INPUT).inputValue();
  console.log(`\nAfter reload — URL input = "${urlVal}"`);

  // Fill wss:// URL again so TLS panel appears
  await page.fill(WS.URL_INPUT, WSS_URL);
  await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });
  if (await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click();
    await page.waitForTimeout(300);
  }

  const skipCertAfterReload = await page.locator(SKIP_CERT_CHECKBOX).isChecked();
  console.log(`After reload — skip-cert = ${skipCertAfterReload}`);

  if (skipCertAfterReload) {
    console.log('\n⚠️  CONFIRMED: skip-cert=true PERSISTS through reload!');
    // Find what storage key holds it
    const storageAfter = await page.evaluate(() => {
      const ls: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        ls[k] = localStorage.getItem(k) ?? '';
      }
      return ls;
    });
    for (const [k, v] of Object.entries(storageAfter)) {
      if (v.includes('rejectUnauthorized') || v.includes('false') || v.includes('true')) {
        console.log(`  KEY: [${k}] = ${v.slice(0, 500)}`);
      }
    }
  } else {
    console.log('\n✅ skip-cert=false after reload — state does NOT persist through reload.');
    console.log('   The user may be seeing a different issue (connection profile? existing tab?)');
  }
});

test('DIAG: check if connecting with wss:// triggers proxy even without skip-cert', async ({ page }) => {
  const proxyRequests: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/api/ws') || req.url().includes('ws/connect')) {
      proxyRequests.push(req.url());
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click(WS.MODE_CLIENT);
  await page.click(WS.LEFT_TAB_CONNECT);

  // Connect with wss:// URL — NO skip-cert enabled
  await page.fill(WS.URL_INPUT, WSS_URL);
  await page.waitForTimeout(300);

  // Make sure skip-cert is NOT enabled
  await page.waitForSelector(WS.TLS_PANEL, { timeout: 3000 });
  const toggle = page.locator(WS.TLS_TOGGLE);
  if (await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click();
    await page.waitForTimeout(300);
  }
  const skipCert = await page.locator(SKIP_CERT_CHECKBOX).isChecked();
  console.log(`\nConnecting with skip-cert = ${skipCert} (should be false)`);

  // Connect
  await page.locator(WS.CONNECT_BTN).click();
  await page.waitForTimeout(4000);

  // Check result
  const has504 = await page.locator('text=504 Gateway Timeout').isVisible().catch(() => false);
  const isConnected = await page.locator('text=Connected').first().isVisible().catch(() => false);
  console.log(`proxy requests: ${proxyRequests.length}`);
  console.log(`504 error: ${has504}`);
  console.log(`Connected: ${isConnected}`);

  if (has504) {
    console.log('⚠️  504 even without skip-cert! The proxy is being triggered by something else.');
  }
  expect(has504).toBe(false);
  expect(isConnected).toBe(true);
});
