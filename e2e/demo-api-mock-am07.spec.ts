/**
 * Demo lesson smoke — AM-07 `am-07-payload-formats`
 * (Forms, Multipart, XML & Binary Matching).
 *
 * Run: npm run test:e2e:demo:am07
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson binds no listener and
 * sends no traffic — every verdict comes from Simulate — so the companion on :3001 is
 * not required.
 *
 * Proves the lesson's own beats end to end: a form field pair authored on the token rule
 * and widened to a regex, two multipart matchers (text part by value, file part by
 * filename) on the upload rule, a namespace-safe XPath composed in the toolbox plus an
 * XML element list on the SOAP rule, and a digest matcher on the firmware rule — four
 * rules, four payload families, no rule ever added.
 */
import { test, expect } from '@playwright/test';
import { API_MOCK } from '../src/shared/selectors/apiMock';
import { advanceSteps, completeCurrentStepAction, launchApiMockLesson } from './demo-player-helpers';
import {
  AM_LESSON_NAMES,
  AM_LESSON_STEPS,
  AM_LESSON_STEP_TIMEOUT,
  AM_LESSON_TIMEOUT,
  cleanupApiMockLessonRun,
  prepareApiMockLessonRun,
  readStepCounter,
  walkApiMockLesson,
} from './api-mock-lesson-smoke-helpers';

/** The corpus ships four bare rules and the lesson never adds a fifth. */
const RULE_COUNT = 4;

const FORM_FIELD = 'username';
const FORM_VALUE = 'ada.lovelace';
const FORM_PATTERN = '^ada\\.';
const MULTIPART_FIELD = 'title';
const MULTIPART_FIELD_VALUE = 'Q3 revenue report';
const MULTIPART_FILE_PART = 'document';
const MULTIPART_FILENAME = 'report.pdf';
const XPATH = "//*[local-name()='orderId']/text()";
const ORDER_ID = 'A-1098';
const XML_ELEMENTS = 'Envelope, SubmitOrder, orderId, customer';
const SHA256 = 'd5a4c05a0eeeea787fce65ebe5c6d1d7bcfe5fbfd419a14125a46b74ff0b7d6d';

/** Operator pickers carry the chosen operator on `data-value`. */
const CONDITION_OPERATORS = '[data-testid^="api-mock-condition-operator-"]';
/** First box of a two-part matcher: the field name, or the XPath expression. */
const CONDITION_EXPRS = '[data-testid^="api-mock-condition-expr-"]';
const CONDITION_VALUES = `${API_MOCK.CONDITION_ROWS} input[aria-label="Condition value"]`;
/** Expected-JSON / element-list textarea of a schema row. */
const CONDITION_SCHEMAS = 'textarea[aria-label="Condition schema"]';
/** Body rows have nothing to name — the key box is present but greyed out. */
const CONDITION_KEYS = '[data-testid^="api-mock-condition-selector-"]';

/** The explorer row for a corpus rule — ids are re-minted on import, paths are not. */
const ruleRow = (path: string) =>
  `${API_MOCK.ROUTE_ROW}:has(.am-route-path:text-is("${path}"))`;

test.describe('Demo lesson AM-07 — Forms, Multipart, XML & Binary', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 7 steps and ends with a digest matcher on the firmware rule', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am07');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am07} / ${AM_LESSON_STEPS.am07}`);
    // Every matcher was authored onto a corpus rule — no rule was ever added.
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    // The last step leaves the firmware rule open on its single digest row.
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
    await expect(page.locator(CONDITION_OPERATORS).first())
      .toHaveAttribute('data-value', 'binary_sha256');
    await expect(page.locator(CONDITION_VALUES).first()).toHaveValue(SHA256);
    // Both overlays were closed on the way out, so the Studio is back on screen.
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });

  test('opens on four bare non-JSON rules and authors a form field pair', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am07);

    // The corpus is the problem statement: four rules, not one condition between them.
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    for (const path of ['/oauth/token', '/uploads', '/soap/orders', '/firmware']) {
      await expect(page.locator(ruleRow(path))).toHaveCount(1);
    }

    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
    await expect(page.locator(CONDITION_OPERATORS).first())
      .toHaveAttribute('data-value', 'form_field_exact');
    // The pair carries the field name and its value; the key box stays empty and disabled.
    await expect(page.locator(CONDITION_EXPRS).first()).toHaveValue(FORM_FIELD);
    await expect(page.locator(CONDITION_VALUES).first()).toHaveValue(FORM_VALUE);
    await expect(page.locator(CONDITION_KEYS).first()).toHaveValue('');
    await expect(page.locator(CONDITION_KEYS).first()).toBeDisabled();
  });

  test('proves the form matcher, then widens the field to a pattern', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am07);
    // 1 advance from step 1 → step 2 reading: the form pair is already authored.
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);

    // Step 2 runs the exact matcher, switches to regex, and re-runs the regional body.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(CONDITION_OPERATORS).first())
      .toHaveAttribute('data-value', 'form_field_regex');
    // Same field, looser value — one row, never a duplicate per region.
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
    await expect(page.locator(CONDITION_EXPRS).first()).toHaveValue(FORM_FIELD);
    await expect(page.locator(CONDITION_VALUES).first()).toHaveValue(FORM_PATTERN);
  });

  test('authors a text-part and a file-part matcher on the upload rule', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am07);
    // 2 advances from step 1 → step 3 reading: through the form proof.
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);

    // Step 3 switches rules and adds both multipart rows.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(2, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(CONDITION_OPERATORS).nth(0))
      .toHaveAttribute('data-value', 'multipart_field');
    await expect(page.locator(CONDITION_OPERATORS).nth(1))
      .toHaveAttribute('data-value', 'multipart_file');
    await expect(page.locator(CONDITION_EXPRS).nth(0)).toHaveValue(MULTIPART_FIELD);
    await expect(page.locator(CONDITION_VALUES).nth(0)).toHaveValue(MULTIPART_FIELD_VALUE);
    // The file row matches on the filename, never on the bytes.
    await expect(page.locator(CONDITION_EXPRS).nth(1)).toHaveValue(MULTIPART_FILE_PART);
    await expect(page.locator(CONDITION_VALUES).nth(1)).toHaveValue(MULTIPART_FILENAME);
  });

  test('matches a real multipart body offline and reads Normalized then Rendered', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am07);
    // 3 advances from step 1 → step 4 reading: through the multipart authoring beat.
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);

    // Step 4 runs the boundary-delimited payload, then tours the result tabs.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    // Simulate never edits the rule, and the step closes it before advancing.
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(2);
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT);
  });

  test('composes a namespace-safe XPath in the toolbox and applies it', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am07);
    // 4 advances from step 1 → step 5 reading: through the multipart proof.
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);

    // Step 5 switches to the SOAP rule and applies from the XPath tab.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
    // A filled Equals value is what makes this equals rather than exists.
    await expect(page.locator(CONDITION_OPERATORS).first())
      .toHaveAttribute('data-value', 'xpath_equals');
    await expect(page.locator(CONDITION_EXPRS).first()).toHaveValue(XPATH);
    await expect(page.locator(CONDITION_VALUES).first()).toHaveValue(ORDER_ID);
  });

  test('adds an XML element list beside the XPath row', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am07);
    // 5 advances from step 1 → step 6 reading: through the XPath beat.
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);

    // Step 6 applies the element list, then runs the full and the truncated envelope.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(2);
    await expect(page.locator(CONDITION_OPERATORS).nth(1))
      .toHaveAttribute('data-value', 'xmlSchema');
    // The expected value is a plain element list — no XSD anywhere.
    await expect(page.locator(CONDITION_SCHEMAS).first()).toHaveValue(XML_ELEMENTS);
  });

  test('swaps a pasted blob for the digest that pins the build', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am07);
    // 6 advances from step 1 → step 7 reading: through the XML schema beat.
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);

    // Step 7 pins the firmware by bytes, switches to SHA-256, then proves both verdicts.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    // One row, re-pointed rather than duplicated: bytes gave way to the digest.
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
    await expect(page.locator(CONDITION_OPERATORS).first())
      .toHaveAttribute('data-value', 'binary_sha256');
    await expect(page.locator(CONDITION_VALUES).first()).toHaveValue(SHA256);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });
});
