# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: run-test.spec.ts >> Run Test flow >> navigate to results after run
- Location: e2e/run-test.spec.ts:41:3

# Error details

```
Test timeout of 10000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('View Full Results')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for getByText('View Full Results')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - heading "🔥 RedfireForgev0.5.7-beta.2" [level=1] [ref=e5]:
        - text: 🔥 RedfireForge
        - generic [ref=e6]: v0.5.7-beta.2
      - generic [ref=e7]:
        - combobox [ref=e9] [cursor=pointer]:
          - option "Environment…"
          - option "t01" [selected]
        - combobox [ref=e11] [cursor=pointer]:
          - option "Service…"
          - option "test-service" [selected]
        - button "🌙" [ref=e13] [cursor=pointer]
    - generic [ref=e14]:
      - navigation [ref=e15]:
        - button "🔌" [ref=e16] [cursor=pointer]:
          - generic [ref=e17]: 🔌
        - button "🔧" [ref=e18] [cursor=pointer]:
          - generic [ref=e19]: 🔧
        - button "🏋" [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: 🏋
        - button "🏪" [ref=e22] [cursor=pointer]:
          - generic [ref=e23]: 🏪
        - button "⚙️" [ref=e24] [cursor=pointer]:
          - generic [ref=e25]: ⚙️
      - complementary [ref=e26]:
        - generic [ref=e28]:
          - generic [ref=e29]:
            - button "Environments" [ref=e30] [cursor=pointer]
            - button "Microservices" [ref=e31] [cursor=pointer]
          - button "Collapse All" [ref=e33] [cursor=pointer]
          - generic [ref=e35]:
            - generic [ref=e36]:
              - generic [ref=e37] [cursor=pointer]: ▸
              - generic [ref=e38] [cursor=pointer]: t01
              - generic [ref=e39]: "1"
            - generic [ref=e41] [cursor=pointer]: ●test-service
        - button "⚙ Settings" [ref=e42] [cursor=pointer]
      - button "◀" [ref=e44] [cursor=pointer]
      - main [ref=e45]:
        - generic [ref=e47]:
          - button "Feature Groups" [ref=e48] [cursor=pointer]
          - button "Test Runner" [ref=e49] [cursor=pointer]
          - button "Parameterized Runner" [ref=e50] [cursor=pointer]
          - button "Workflow Runner" [ref=e51] [cursor=pointer]
          - button "Results" [ref=e52] [cursor=pointer]
        - generic [ref=e54]:
          - generic [ref=e55]:
            - heading "Test Runner" [level=2] [ref=e56]
            - generic [ref=e57]:
              - generic [ref=e58]: test-service
              - generic [ref=e59]: t01
          - generic [ref=e60]:
            - generic [ref=e61]: "Host:"
            - generic [ref=e62] [cursor=pointer]:
              - radio "Original" [disabled] [ref=e63]
              - text: Original
            - generic [ref=e64] [cursor=pointer]:
              - radio "Settings http://localhost:5173" [checked] [disabled] [ref=e65]
              - text: Settings
              - code [ref=e66]: http://localhost:5173
            - generic [ref=e67] [cursor=pointer]:
              - radio "Custom" [disabled] [ref=e68]
              - text: Custom
            - textbox "https://my-host.example.com:8080" [disabled] [ref=e69]
          - generic [ref=e70]:
            - generic [ref=e72]:
              - generic [ref=e73]: "Execution Mode:"
              - generic "Executes requests one by one in sequence. No parallelism." [ref=e74] [cursor=pointer]:
                - radio "Sequential" [disabled] [ref=e75]
                - text: Sequential
              - generic "Fires N requests, waits for ALL to finish, then fires the next N." [ref=e76] [cursor=pointer]:
                - radio "Batch" [checked] [disabled] [ref=e77]
                - text: Batch
              - generic "Maintains N concurrent requests at all times." [ref=e78] [cursor=pointer]:
                - radio "Continuous Pool" [disabled] [ref=e79]
                - text: Continuous Pool
              - 'generic "Time-based load profiles: ramp-up, sustained, spike, soak" [ref=e80] [cursor=pointer]':
                - radio "Load Profile" [disabled] [ref=e81]
                - text: Load Profile
              - generic [ref=e82]: Fires N requests, waits for all to complete, then fires next N
            - generic [ref=e84]:
              - generic [ref=e85]:
                - generic [ref=e86]: Concurrency
                - spinbutton [disabled] [ref=e87]: "1"
              - generic [ref=e88]:
                - generic [ref=e89]: Iterations
                - spinbutton [disabled] [ref=e90]: "1"
              - generic [ref=e92]:
                - generic [ref=e93]: Timeout
                - generic [ref=e94]:
                  - spinbutton [disabled] [ref=e95]: "10"
                  - generic [ref=e96]: sec
              - generic [ref=e97]:
                - generic [ref=e98]: Retry
                - generic [ref=e99]:
                  - spinbutton [disabled] [ref=e100]: "0"
                  - generic [ref=e101]: times
                - generic [ref=e102]: No retry
              - generic [ref=e104]:
                - generic [ref=e105]: On Error
                - generic [ref=e106]:
                  - generic [ref=e107] [cursor=pointer]:
                    - radio "Continue" [checked] [disabled] [ref=e108]
                    - text: Continue
                  - generic [ref=e109] [cursor=pointer]:
                    - radio "Stop 1st" [disabled] [ref=e110]
                    - text: Stop 1st
                  - generic [ref=e111] [cursor=pointer]:
                    - radio "Threshold" [disabled] [ref=e112]
                    - text: Threshold
              - generic [ref=e113]:
                - generic [ref=e114]: Max Errors
                - spinbutton [disabled] [ref=e115]: "10"
              - generic [ref=e116]:
                - generic [ref=e117]: Error Rate
                - generic [ref=e118]:
                  - spinbutton [disabled] [ref=e119]: "50"
                  - generic [ref=e120]: "%"
            - generic [ref=e122]:
              - generic [ref=e123]: "Think Time:"
              - generic [ref=e124] [cursor=pointer]:
                - radio "None" [checked] [disabled] [ref=e125]
                - text: None
              - generic [ref=e126] [cursor=pointer]:
                - radio "Constant" [disabled] [ref=e127]
                - text: Constant
              - generic [ref=e128] [cursor=pointer]:
                - radio "Uniform" [disabled] [ref=e129]
                - text: Uniform
              - generic [ref=e130] [cursor=pointer]:
                - radio "Gaussian" [disabled] [ref=e131]
                - text: Gaussian
          - generic [ref=e132]:
            - generic [ref=e133]:
              - heading "Select Scenarios to Test" [level=3] [ref=e134]
              - generic [ref=e135]:
                - button "Select All" [disabled] [ref=e136]
                - button "Deselect All" [disabled] [ref=e137]
                - generic [ref=e138] [cursor=pointer]:
                  - checkbox "Skip validation" [disabled] [ref=e139]
                  - text: Skip validation
                - generic "Runtime validation override — Default uses each test's configured mode" [ref=e140] [cursor=pointer]:
                  - combobox [disabled] [ref=e141]:
                    - 'option "Validation: Default" [selected]'
                    - 'option "Validate: No Rows"'
                    - 'option "Validate: Sample Rows Only"'
                    - 'option "Validate: All Rows"'
                - generic "Match array items by content regardless of order — useful when APIs return arrays in non-deterministic order" [ref=e142] [cursor=pointer]:
                  - checkbox "Unordered arrays" [disabled] [ref=e143]
                  - text: Unordered arrays
                - generic "Automatically download a report when the test finishes" [ref=e144] [cursor=pointer]:
                  - checkbox "Auto-report" [disabled] [ref=e145]
                  - text: Auto-report
                - generic [ref=e146]: 1 scenario selected (1 test)
            - generic [ref=e148]: YOUR TESTS
            - generic [ref=e150]:
              - generic [ref=e151]:
                - generic [ref=e152] [cursor=pointer]:
                  - checkbox "E2E Feature" [checked] [disabled] [ref=e153]
                  - strong [ref=e154]: E2E Feature
                - generic [ref=e155] [cursor=pointer]: −
              - generic [ref=e158] [cursor=pointer]:
                - checkbox "E2E Scenario 1 test" [checked] [disabled] [ref=e159]
                - generic [ref=e160]: E2E Scenario
                - generic [ref=e161]: 1 test
          - generic [ref=e162]:
            - group "▶ Test Distribution (weights) 1 tests" [ref=e163]:
              - generic [ref=e164] [cursor=pointer]:
                - generic [ref=e165]: ▶
                - text: Test Distribution (weights)
                - generic [ref=e166]: 1 tests
              - generic [ref=e167]:
                - button "Reset All to 1" [disabled] [ref=e168]
                - button "Reset All to 0" [disabled] [ref=e169]
              - generic [ref=e170]:
                - generic [ref=e171]:
                  - generic [ref=e172]: "1"
                  - generic [ref=e173]: GET
                  - text: GET Homepage
                - spinbutton [disabled] [ref=e174]: "1"
            - generic [ref=e175]:
              - generic [ref=e176]: Execution Plan
              - generic [ref=e177]:
                - generic [ref=e178]: 1 iteration × 1 test
                - generic [ref=e179]: = 1 requests
              - generic [ref=e180]: "Total: 1 request"
            - button "■ Stop" [active] [ref=e182] [cursor=pointer]
          - generic [ref=e183]:
            - heading "Progress Batch · C:1 · I:1 http://localhost:5173" [level=3] [ref=e185]:
              - text: Progress
              - generic [ref=e186]: Batch · C:1 · I:1
              - generic [ref=e187]: http://localhost:5173
            - generic [ref=e189]: 0 / 1 requests (0%)
        - text: • • •
  - status
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { seedAppDataWithTest } from './helpers';
  3  | 
  4  | test.describe('Run Test flow', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await seedAppDataWithTest(page);
  7  |     await page.goto('/?tab=runner');
  8  |     await page.waitForSelector('.app-header', { timeout: 10000 });
  9  |     await page.waitForLoadState('networkidle');
  10 |   });
  11 | 
  12 |   test('navigate to Test Runner tab', async ({ page }) => {
  13 |     // Already on Test Runner tab from beforeEach
  14 |     await expect(page.locator('.sub-nav-tab.active')).toHaveText('Test Runner');
  15 |   });
  16 | 
  17 |   test('shows scenarios to select', async ({ page }) => {
  18 |     // Already on Test Runner tab from beforeEach
  19 |     await expect(page.getByText('E2E Scenario')).toBeVisible();
  20 |   });
  21 | 
  22 |   test('run a test and see completion banner', async ({ page }) => {
  23 |     // Already on Test Runner tab from beforeEach
  24 | 
  25 |     // Check the scenario checkbox
  26 |     const scenarioLabel = page.getByText('E2E Scenario');
  27 |     await expect(scenarioLabel).toBeVisible();
  28 |     const scenarioCheckbox = scenarioLabel.locator('..').locator('input[type="checkbox"]');
  29 |     await scenarioCheckbox.check();
  30 | 
  31 |     // Click Run Test
  32 |     await page.click('button:has-text("Run Test")');
  33 | 
  34 |     // Wait for completion banner to appear (test runs against localhost, should be fast)
  35 |     await expect(page.getByText('Test completed')).toBeVisible({ timeout: 30000 });
  36 | 
  37 |     // View Full Results button should appear
  38 |     await expect(page.getByText('View Full Results')).toBeVisible();
  39 |   });
  40 | 
  41 |   test('navigate to results after run', async ({ page }) => {
  42 |     // Already on Test Runner tab from beforeEach
  43 | 
  44 |     const scenarioLabel = page.getByText('E2E Scenario');
  45 |     await scenarioLabel.locator('..').locator('input[type="checkbox"]').check();
  46 | 
  47 |     await page.click('button:has-text("Run Test")');
  48 | 
  49 |     // Wait for completion then click "View Full Results →"
> 50 |     await expect(page.getByText('View Full Results')).toBeVisible({ timeout: 30000 });
     |                                                       ^ Error: expect(locator).toBeVisible() failed
  51 |     await page.click('button:has-text("View Full Results")');
  52 | 
  53 |     // Wait for navigation to complete
  54 |     await page.waitForLoadState('networkidle');
  55 | 
  56 |     // Now we should be on Results tab
  57 |     await expect(page.locator('.sub-nav-tab.active')).toHaveText('Results', { timeout: 10000 });
  58 |   });
  59 | });
  60 | 
```