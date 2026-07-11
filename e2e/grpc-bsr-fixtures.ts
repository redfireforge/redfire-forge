/**
 * BSR E2E helpers — support corporate VPN (buf.build blocked) and public networks.
 *
 * When the registry is reachable, tests use the real BSR fetch path on the server.
 * When blocked, Playwright intercepts POST /api/grpc/describe for BSR requests and
 * returns an Eliza descriptor built from the local docker fixture proto, patched with
 * BSR source metadata while preserving the server-side descriptor key for invoke.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext, Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const ELIZA_PROTO_PATH = resolve(REPO_ROOT, 'docker/grpc/proto/eliza.proto');
const GRPC_DESCRIBE_URL = 'http://localhost:3001/api/grpc/describe';

export interface BsrFixtureOptions {
  bsrModule: string;
  bsrVersion: string;
}

type DescribeEnvelope = {
  ok: boolean;
  data?: {
    source?: string;
    sourceRef?: string;
    key?: string;
    sourceFingerprint?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

let cachedFallbackEnvelope: DescribeEnvelope | null = null;

function buildBsrDescriptorUrl(bsrModule: string, bsrVersion: string): string {
  const trimmed = bsrModule.trim().replace(/^buf\.build\//, '');
  const [owner, repo] = trimmed.split('/').filter(Boolean);
  if (!owner || !repo) {
    throw new Error(`Invalid BSR module reference: ${bsrModule}`);
  }
  return `https://buf.build/${owner}/${repo}/descriptor/${encodeURIComponent(bsrVersion)}`;
}

/**
 * Probe BSR through the Express backend — same network path as the UI load button.
 * A direct buf.build fetch from Playwright can succeed while the Node server fails on VPN.
 */
export async function isBsrRegistryReachableViaBackend(
  request: APIRequestContext,
  bsrModule: string,
  bsrVersion: string,
): Promise<boolean> {
  try {
    const response = await request.post(GRPC_DESCRIBE_URL, {
      data: {
        source: 'bsr',
        bsrModule,
        bsrVersion,
      },
      timeout: 20_000,
    });
    if (!response.ok()) {
      return false;
    }
    const body = await response.json() as DescribeEnvelope;
    return body.ok === true && Array.isArray(body.data?.services) && body.data.services.length > 0;
  } catch {
    return false;
  }
}

/** Direct buf.build probe — diagnostics only; prefer isBsrRegistryReachableViaBackend. */
export async function isBsrRegistryReachable(
  request: APIRequestContext,
  bsrModule: string,
  bsrVersion: string,
): Promise<boolean> {
  const url = buildBsrDescriptorUrl(bsrModule, bsrVersion);
  try {
    const response = await request.get(url, { timeout: 8_000 });
    return response.ok();
  } catch {
    return false;
  }
}

async function buildElizaProtoDescribeEnvelope(request: APIRequestContext): Promise<DescribeEnvelope> {
  const elizaProto = readFileSync(ELIZA_PROTO_PATH, 'utf-8');
  const response = await request.post(GRPC_DESCRIBE_URL, {
    data: {
      source: 'proto_files',
      protoRoots: [{
        id: 'eliza-e2e',
        mountPath: '/',
        files: [{ path: 'eliza.proto', content: elizaProto }],
      }],
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to build Eliza proto describe envelope: HTTP ${response.status()}`);
  }
  return response.json() as Promise<DescribeEnvelope>;
}

function patchDescribeEnvelopeAsBsr(
  envelope: DescribeEnvelope,
  options: BsrFixtureOptions,
): DescribeEnvelope {
  if (!envelope.data) {
    throw new Error('Describe envelope is missing data');
  }
  const sourceRef = `${options.bsrModule}@${options.bsrVersion}`;
  return {
    ...envelope,
    data: {
      ...envelope.data,
      source: 'bsr',
      sourceRef,
      sourceFingerprint: {
        ...(envelope.data.sourceFingerprint ?? {}),
        sourceRef,
        bsrModule: options.bsrModule,
      },
    },
  };
}

async function getBsrFallbackDescribeEnvelope(
  request: APIRequestContext,
  options: BsrFixtureOptions,
): Promise<DescribeEnvelope> {
  if (!cachedFallbackEnvelope) {
    const protoEnvelope = await buildElizaProtoDescribeEnvelope(request);
    cachedFallbackEnvelope = patchDescribeEnvelopeAsBsr(protoEnvelope, options);
  }
  return cachedFallbackEnvelope;
}

/**
 * When buf.build is unreachable, stub BSR describe responses in the browser.
 * Returns whether the test should expect live BSR or the local fallback path.
 */
export async function setupBsrDescribeFallbackIfNeeded(
  page: Page,
  request: APIRequestContext,
  options: BsrFixtureOptions,
): Promise<'live' | 'fallback'> {
  const reachable = await isBsrRegistryReachableViaBackend(request, options.bsrModule, options.bsrVersion);
  if (reachable) {
    return 'live';
  }

  const fallbackEnvelope = await getBsrFallbackDescribeEnvelope(request, options);

  await page.route('**/api/grpc/describe', async (route) => {
    const postData = route.request().postDataJSON() as { source?: string } | null;
    if (postData?.source !== 'bsr') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fallbackEnvelope),
    });
  });

  return 'fallback';
}
