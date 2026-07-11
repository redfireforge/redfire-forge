/**
 * grpc-studio-schema-drift.spec.ts — Schema drift UI E2E (Phase 3I).
 *
 * Uses mocked /api/grpc/reflect responses — no Docker or Express required.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
} from '../src/shared/grpc/contractFixtures';
import { GRPC } from '../src/shared/selectors/grpc';
import {
  clickReflect,
  ECHO_METHOD_TESTID,
  ECHO_SERVICE_TESTID,
  gotoGrpcStudio,
  selectGrpcMethod,
  fillProtoField,
  setGrpcTarget,
} from './grpc-helpers';

function descriptorWithoutEchoMethod() {
  return {
    ...FIXTURE_DESCRIPTOR,
    key: 'descriptor-without-echo-e2e',
    contentSha256: 'e2e-without-echo-hash01',
    services: [{
      ...FIXTURE_DESCRIPTOR.services[0]!,
      methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
    }],
  };
}

function descriptorWithEmptyEchoRequest() {
  return {
    ...FIXTURE_DESCRIPTOR,
    key: 'descriptor-empty-echo-request-e2e',
    contentSha256: 'e2e-empty-echo-req-hash',
    services: [{
      ...FIXTURE_DESCRIPTOR.services[0]!,
      methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
        entry.name === 'Echo'
          ? {
            ...entry,
            requestSchema: {
              ...entry.requestSchema,
              fields: [],
            },
          }
          : entry
      )),
    }],
  };
}

function descriptorWithRemovedMessageField() {
  return {
    ...FIXTURE_DESCRIPTOR,
    key: 'descriptor-removed-message-field-e2e',
    contentSha256: 'e2e-removed-message-hash',
    services: [{
      ...FIXTURE_DESCRIPTOR.services[0]!,
      methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
        entry.name === 'Echo'
          ? {
            ...entry,
            requestSchema: {
              ...entry.requestSchema,
              fields: entry.requestSchema.fields.filter((field) => field.name !== 'message'),
            },
          }
          : entry
      )),
    }],
  };
}

async function installReflectMock(
  page: Page,
  secondDescriptor: typeof FIXTURE_DESCRIPTOR,
): Promise<void> {
  await page.unroute('**/api/grpc/reflect').catch(() => undefined);
  let reflectCount = 0;
  await page.route('**/api/grpc/reflect', async (route) => {
    reflectCount += 1;
    const descriptor = reflectCount === 1 ? FIXTURE_DESCRIPTOR : secondDescriptor;
    const envelope = {
      ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
      data: descriptor,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(envelope),
    });
  });
}

async function expectDraftMessageField(page: Page, value: string): Promise<void> {
  const protoInput = page.locator('[data-testid="grpc-proto-field-input-message"]');
  if (await protoInput.isVisible().catch(() => false)) {
    await expect(protoInput).toHaveValue(value);
    return;
  }
  await expect(page.locator('[data-testid="grpc-request-json"]')).toHaveValue(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

async function reflectSelectEchoWithBody(
  page: Page,
  body: string,
  secondDescriptor: typeof FIXTURE_DESCRIPTOR,
): Promise<void> {
  await installReflectMock(page, secondDescriptor);
  await clickReflect(page);
  await selectGrpcMethod(page, {
    serviceTestId: ECHO_SERVICE_TESTID,
    methodTestId: ECHO_METHOD_TESTID,
  });
  await fillProtoField(page, 'message', body);
  await clickReflect(page);
  await expect(page.locator(GRPC.SCHEMA_DRIFT_BANNER)).toBeVisible({ timeout: 15_000 });
}

test.describe('gRPC Studio — schema drift UI (Phase 3I mocked reflect)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
  });

  test('blocking drift shows banner and disables send while preserving draft', async ({ page }) => {
    await reflectSelectEchoWithBody(page, 'drift-e2e-draft', descriptorWithoutEchoMethod());

    await expect(page.locator(GRPC.SCHEMA_DRIFT_MESSAGE)).toContainText(/no longer available/i);
    await expectDraftMessageField(page, 'drift-e2e-draft');
    await expect(page.locator(GRPC.SEND_BTN)).toBeDisabled();
    await expect(page.locator(GRPC.SCHEMA_DRIFT_REBINDS)).toBeVisible();
    await expect(page.locator(GRPC.SCHEMA_DRIFT_DISMISS_BTN)).toHaveCount(0);
  });

  test('rebind from drift banner clears drift and enables stream start', async ({ page }) => {
    await reflectSelectEchoWithBody(page, 'rebind-me', descriptorWithoutEchoMethod());

    const rebindBtn = page.locator(GRPC.SCHEMA_DRIFT_REBIND('echo.EchoService', 'BidiStream'));
    await expect(rebindBtn).toBeVisible({ timeout: 10_000 });
    await rebindBtn.click();

    await expect(page.locator(GRPC.SCHEMA_DRIFT_BANNER)).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-call-method-name"]')).toContainText('BidiStream');
    await expect(page.locator(GRPC.STREAM_START_BTN)).toBeEnabled();
  });

  test('warning drift allows send; dismiss clears drift', async ({ page }) => {
    await reflectSelectEchoWithBody(page, 'warning-draft', descriptorWithEmptyEchoRequest());

    await expect(page.locator(GRPC.SCHEMA_DRIFT_DISMISS_BTN)).toBeVisible();
    // Phase 5H — warning drift is advisory; only blocking drift disables Send/Start.
    await expect(page.locator(GRPC.SEND_BTN)).toBeEnabled();

    await page.locator(GRPC.SCHEMA_DRIFT_DISMISS_BTN).click();
    await expect(page.locator(GRPC.SCHEMA_DRIFT_BANNER)).toHaveCount(0);
    await expect(page.locator(GRPC.SEND_BTN)).toBeEnabled();
  });

  test('prune removes stale fields and clears warning drift', async ({ page }) => {
    await reflectSelectEchoWithBody(page, 'prune-me', descriptorWithRemovedMessageField());

    await expect(page.locator(GRPC.SCHEMA_DRIFT_PRUNE_BTN)).toBeVisible();
    await page.locator(GRPC.SCHEMA_DRIFT_PRUNE_BTN).click();

    await expect(page.locator(GRPC.SCHEMA_DRIFT_BANNER)).toHaveCount(0);
    await expect(page.locator(GRPC.SEND_BTN)).toBeEnabled();
  });
});
