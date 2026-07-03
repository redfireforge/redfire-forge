/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';
import {
  GRPC_CLIENT_STREAM_SEL,
  GRPC_SERVER_STREAM_SEL,
  GRPC_BIDI_STREAM_SEL,
  GRPC_STREAM_MESSAGE,
  GRPC_STREAM_REPEAT_COUNT,
  GRPC_STREAM_INTERVAL_MS,
  ensureClientStreamQueued,
  ensureStreamingMethodSelected,
  fillServerStreamRequest,
  queueClientStreamMessage,
  startAndExchangeBidiStream,
  resetGrpcLessonSessionFlags,
} from './grpc-lesson-helpers';
import {
  buildGrpcStreamingScenarioSnapshot,
} from './grpc-lesson-contract/runtime/snapshots';
import {
  getGrpcStepCheckpoint,
  getGrpcStepCheckpointsForLesson,
} from './grpc-lesson-contract/runtime/stepCheckpoints';
import {
  __resetGrpcLessonRunForTests,
  beginGrpcLessonRun,
  setGrpcLessonRunFlag,
} from './grpc-lesson-contract/runtime';
import { grpcStreamingLesson } from './grpc-streaming';
import { getGrpcLessonRosterEntry } from './grpc-lesson-contract';

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mountExplorerWithStreamingMethods(): void {
  document.body.innerHTML = `
    <input data-testid="grpc-target-input" value="localhost:50051" />
    <span data-testid="grpc-target-status-ok"></span>
    <button data-testid="grpc-reflect-btn"></button>
    <div data-testid="grpc-explorer-tree"></div>
    <button data-testid="${GRPC_SERVER_STREAM_SEL.replace('[data-testid="', '').replace('"]', '')}">ServerStream</button>
    <button data-testid="${GRPC_CLIENT_STREAM_SEL.replace('[data-testid="', '').replace('"]', '')}">ClientStream</button>
    <button data-testid="${GRPC_BIDI_STREAM_SEL.replace('[data-testid="', '').replace('"]', '')}">BidiStream</button>
    <div data-testid="grpc-service-explorer"></div>
  `;
}

function mountCallTypeSelector(activeCallType = 'server_streaming'): void {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div data-testid="grpc-call-type-selector">
      <button data-testid="grpc-call-type-tab-${activeCallType}" aria-selected="true"></button>
    </div>`,
  );
}

function _mountStreamingUi(opts: { pendingItems?: number; streamActive?: boolean; hasLogList?: boolean } = {}): void {
  const { pendingItems = 0, streamActive = false, hasLogList = false } = opts;
  const pendingHtml = Array.from({ length: pendingItems })
    .map((_, i) => `<div data-testid="grpc-stream-pending-item-${i}">msg-${i}</div>`)
    .join('');
  const startBtnTestId = streamActive ? 'grpc-stream-cancel-btn' : 'grpc-stream-start-btn';
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div data-testid="grpc-stream-message-log">
      ${hasLogList ? '<div data-testid="grpc-stream-log-list"><div>msg</div></div>' : ''}
    </div>
    <div data-testid="grpc-stream-status-bar">
      <span data-testid="grpc-stream-status-badge">${streamActive ? 'Streaming' : 'Ended'}</span>
    </div>
    <input data-testid="grpc-proto-field-input-message" />
    <input data-testid="grpc-proto-field-input-repeat_count" />
    <input data-testid="grpc-proto-field-input-interval_ms" />
    <div data-testid="grpc-stream-pending-panel">
      ${pendingHtml}
    </div>
    <button data-testid="grpc-stream-add-queue-btn"></button>
    <button data-testid="grpc-stream-send-all-btn" ${streamActive && pendingItems > 0 ? '' : 'disabled'}></button>
    <button data-testid="grpc-stream-pending-end-btn" ${streamActive ? '' : 'disabled'}></button>
    <button data-testid="${startBtnTestId}"></button>
    <button data-testid="grpc-stream-send-message-btn"></button>
    <button data-testid="grpc-stream-export-log-btn"></button>`,
  );
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

describe('buildGrpcStreamingScenarioSnapshot', () => {
  it('returns a frozen snapshot for grpc-streaming', () => {
    const snap = buildGrpcStreamingScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-streaming');
    expect(snap.callType).toBe('server-stream');
    expect(snap.service).toBe('echo.EchoService');
    expect(snap.method).toBe('ServerStream');
    expect(snap.requestPayload).toMatchObject({
      message: GRPC_STREAM_MESSAGE,
      repeat_count: GRPC_STREAM_REPEAT_COUNT,
      interval_ms: GRPC_STREAM_INTERVAL_MS,
    });
    expect(snap.expectedStatus).toBe('OK');
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('snapshot has a stable fingerprint', () => {
    const a = buildGrpcStreamingScenarioSnapshot();
    const b = buildGrpcStreamingScenarioSnapshot();
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

describe('grpc-streaming step checkpoints', () => {
  it('all required step IDs are registered', () => {
    const checkpoints = getGrpcStepCheckpointsForLesson('grpc-streaming');
    const ids = checkpoints.map((c) => c.stepId);
    expect(ids).toContain('grpc17-server-select');
    expect(ids).toContain('grpc17-server-fill');
    expect(ids).toContain('grpc17-server-status');
    expect(ids).toContain('grpc17-client-select');
    expect(ids).toContain('grpc17-client-queue');
    expect(ids).toContain('grpc17-client-send');
    expect(ids).toContain('grpc17-bidi-select');
    expect(ids).toContain('grpc17-bidi-exchange');
    expect(ids).toContain('grpc17-cancel');
    expect(ids).toContain('grpc17-export');
  });

  it('server-select checkpoint sets methodSelected flag', () => {
    const cp = getGrpcStepCheckpoint('grpc-streaming', 'grpc17-server-select');
    expect(cp?.setsFlags?.methodSelected).toBe(true);
    expect(cp?.verifySelector).toBe('grpc-call-type-selector');
  });

  it('client-send checkpoint sets executed flag', () => {
    const cp = getGrpcStepCheckpoint('grpc-streaming', 'grpc17-client-send');
    expect(cp?.setsFlags?.executed).toBe(true);
    expect(cp?.verifySelector).toBe('grpc-stream-status-bar');
  });

  it('export checkpoint verifies export button', () => {
    const cp = getGrpcStepCheckpoint('grpc-streaming', 'grpc17-export');
    expect(cp?.verifySelector).toBe('grpc-stream-export-log-btn');
  });
});

// ---------------------------------------------------------------------------
// Roster entry
// ---------------------------------------------------------------------------

describe('grpc-streaming roster entry', () => {
  it('is registered as shipped', () => {
    const entry = getGrpcLessonRosterEntry('grpc-streaming');
    expect(entry).toBeDefined();
    expect(entry?.implementationStatus).toBe('shipped');
    expect(entry?.number).toBe(17);
    expect(entry?.estimatedMinutes).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Lesson wrapper
// ---------------------------------------------------------------------------

describe('grpcStreamingLesson wrapper', () => {
  it('has id grpc-streaming', () => {
    expect(grpcStreamingLesson.id).toBe('grpc-streaming');
  });

  it('has 11 steps', () => {
    expect(grpcStreamingLesson.steps.length).toBe(11);
  });

  it('step IDs match expected sequence', () => {
    const ids = grpcStreamingLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'grpc17-intro',
      'grpc17-server-select',
      'grpc17-server-fill',
      'grpc17-server-status',
      'grpc17-client-select',
      'grpc17-client-queue',
      'grpc17-client-send',
      'grpc17-bidi-select',
      'grpc17-bidi-exchange',
      'grpc17-cancel',
      'grpc17-export',
    ]);
  });

  it('has concept body and keyTerms', () => {
    expect(grpcStreamingLesson.concept?.body).toContain('Server streaming');
    expect(grpcStreamingLesson.concept?.keyTerms?.length).toBeGreaterThanOrEqual(4);
  });

  it('concept body references all four streaming types', () => {
    const body = grpcStreamingLesson.concept?.body ?? '';
    expect(body).toContain('Server streaming');
    expect(body).toContain('Client streaming');
    expect(body).toContain('Bidirectional');
    expect(body).toContain('Unary');
  });

  it('server-select step highlights the ServerStream method', () => {
    const step = grpcStreamingLesson.steps.find((s) => s.id === 'grpc17-server-select')!;
    expect(step.highlight).toBe(GRPC_SERVER_STREAM_SEL);
  });

  it('client-queue step highlights the pending panel', () => {
    const step = grpcStreamingLesson.steps.find((s) => s.id === 'grpc17-client-queue')!;
    expect(step.highlight).toBe(GRPC.STREAM_PENDING_PANEL);
  });

  it('cancel step highlights cancel button', () => {
    const step = grpcStreamingLesson.steps.find((s) => s.id === 'grpc17-cancel')!;
    expect(step.highlight).toBe(GRPC.STREAM_CANCEL_BTN);
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of grpcStreamingLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// fillServerStreamRequest
// ---------------------------------------------------------------------------

describe('fillServerStreamRequest', () => {
  beforeEach(() => {
    __resetGrpcLessonRunForTests();
    beginGrpcLessonRun('grpc-streaming');
    resetGrpcLessonSessionFlags();
    document.body.innerHTML = `
      <input data-testid="grpc-proto-field-input-message" />
      <input data-testid="grpc-proto-field-input-repeat_count" />
      <input data-testid="grpc-proto-field-input-interval_ms" />
    `;
  });

  it('fills default message, repeat_count, and interval_ms', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (sel, value) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el) el.value = value;
    });

    await fillServerStreamRequest(ctx);

    const msg = document.querySelector<HTMLInputElement>('[data-testid="grpc-proto-field-input-message"]');
    const repeat = document.querySelector<HTMLInputElement>('[data-testid="grpc-proto-field-input-repeat_count"]');
    const interval = document.querySelector<HTMLInputElement>('[data-testid="grpc-proto-field-input-interval_ms"]');

    expect(msg?.value).toBe(GRPC_STREAM_MESSAGE);
    expect(repeat?.value).toBe(String(GRPC_STREAM_REPEAT_COUNT));
    expect(interval?.value).toBe(String(GRPC_STREAM_INTERVAL_MS));
  });

  it('fills custom values when provided', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (sel, value) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el) el.value = value;
    });

    await fillServerStreamRequest(ctx, { message: 'custom-msg', repeatCount: 10, intervalMs: 500 });

    const msg = document.querySelector<HTMLInputElement>('[data-testid="grpc-proto-field-input-message"]');
    expect(msg?.value).toBe('custom-msg');
  });

  it('skips repeat_count fill when field is absent', async () => {
    document.querySelector<HTMLInputElement>('[data-testid="grpc-proto-field-input-repeat_count"]')?.remove();
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (sel, value) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el) el.value = value;
    });

    await expect(fillServerStreamRequest(ctx)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// queueClientStreamMessage
// ---------------------------------------------------------------------------

describe('queueClientStreamMessage', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input data-testid="grpc-proto-field-input-message" />
      <button data-testid="grpc-stream-add-queue-btn"></button>
    `;
  });

  it('fills message and clicks Add to queue', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (sel, value) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el) el.value = value;
    });

    await queueClientStreamMessage(ctx, 'hello-queue');

    const msgInput = document.querySelector<HTMLInputElement>('[data-testid="grpc-proto-field-input-message"]');
    expect(msgInput?.value).toBe('hello-queue');
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_ADD_QUEUE_BTN);
  });

  it('skips click if add button is disabled', async () => {
    const addBtn = document.querySelector<HTMLButtonElement>('[data-testid="grpc-stream-add-queue-btn"]')!;
    addBtn.disabled = true;
    const ctx = makeCtx();

    await queueClientStreamMessage(ctx, 'msg');
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC.STREAM_ADD_QUEUE_BTN);
  });
});

// ---------------------------------------------------------------------------
// ensureStreamingMethodSelected
// ---------------------------------------------------------------------------

describe('ensureStreamingMethodSelected', () => {
  beforeEach(() => {
    __resetGrpcLessonRunForTests();
    beginGrpcLessonRun('grpc-streaming');
    resetGrpcLessonSessionFlags();
    document.body.innerHTML = '';
    mountExplorerWithStreamingMethods();
    setGrpcLessonRunFlag('targetSet', true);
    setGrpcLessonRunFlag('reflected', true);
  });

  it('clicks ServerStream if call type tab is not active', async () => {
    const ctx = makeCtx();
    await ensureStreamingMethodSelected(ctx, 'ServerStream');
    expect(ctx.click).toHaveBeenCalledWith(GRPC_SERVER_STREAM_SEL);
  });

  it('clicks ClientStream when requested', async () => {
    const ctx = makeCtx();
    await ensureStreamingMethodSelected(ctx, 'ClientStream');
    expect(ctx.click).toHaveBeenCalledWith(GRPC_CLIENT_STREAM_SEL);
  });

  it('clicks BidiStream when requested', async () => {
    const ctx = makeCtx();
    await ensureStreamingMethodSelected(ctx, 'BidiStream');
    expect(ctx.click).toHaveBeenCalledWith(GRPC_BIDI_STREAM_SEL);
  });

  it('skips click when correct call type tab is already active', async () => {
    mountCallTypeSelector('server_streaming');
    const ctx = makeCtx();
    await ensureStreamingMethodSelected(ctx, 'ServerStream');
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC_SERVER_STREAM_SEL);
  });
});

// ---------------------------------------------------------------------------
// ensureClientStreamQueued
// ---------------------------------------------------------------------------

describe('ensureClientStreamQueued', () => {
  beforeEach(() => {
    __resetGrpcLessonRunForTests();
    beginGrpcLessonRun('grpc-streaming');
    resetGrpcLessonSessionFlags();
    document.body.innerHTML = '';
    mountExplorerWithStreamingMethods();
    setGrpcLessonRunFlag('targetSet', true);
    setGrpcLessonRunFlag('reflected', true);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<input data-testid="grpc-proto-field-input-message" />
       <div data-testid="grpc-call-type-selector">
         <button data-testid="grpc-call-type-tab-client_streaming" aria-selected="true"></button>
       </div>`,
    );
  });

  it('skips queueing when pending item 0 already exists', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-testid="grpc-stream-pending-item-0">existing</div>',
    );
    const ctx = makeCtx();
    await ensureClientStreamQueued(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC.STREAM_ADD_QUEUE_BTN);
  });

  it('queues 3 messages when queue is empty', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.fill).mockImplementation(async (sel, value) => {
      const el = document.querySelector<HTMLInputElement>(sel);
      if (el) el.value = value;
    });
    // Mount add-queue button
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button data-testid="grpc-stream-add-queue-btn"></button>',
    );
    // After 3 clicks, simulate the first item appearing.
    let addCount = 0;
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC.STREAM_ADD_QUEUE_BTN) {
        addCount++;
        if (addCount === 3) {
          const item = document.createElement('div');
          item.setAttribute('data-testid', 'grpc-stream-pending-item-0');
          document.body.appendChild(item);
        }
      }
    });

    await ensureClientStreamQueued(ctx);
    expect(addCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// startAndExchangeBidiStream
// ---------------------------------------------------------------------------

describe('startAndExchangeBidiStream', () => {
  beforeEach(() => {
    __resetGrpcLessonRunForTests();
    beginGrpcLessonRun('grpc-streaming');
    resetGrpcLessonSessionFlags();
    document.body.innerHTML = '';
    mountExplorerWithStreamingMethods();
    setGrpcLessonRunFlag('targetSet', true);
    setGrpcLessonRunFlag('reflected', true);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<input data-testid="grpc-proto-field-input-message" />
       <div data-testid="grpc-call-type-selector">
         <button data-testid="grpc-call-type-tab-bidi_streaming" aria-selected="true"></button>
       </div>
       <button data-testid="grpc-stream-start-btn"></button>`,
    );
  });

  it('clicks Start button to open the stream', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GRPC.STREAM_START_BTN) {
        // Simulate stream opening.
        const cancelBtn = document.createElement('button');
        cancelBtn.setAttribute('data-testid', 'grpc-stream-cancel-btn');
        document.body.appendChild(cancelBtn);
        const sendBtn = document.createElement('button');
        sendBtn.setAttribute('data-testid', 'grpc-stream-send-message-btn');
        document.body.appendChild(sendBtn);
      }
    });

    await startAndExchangeBidiStream(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });

  it('skips Start click when stream is already open (cancel btn present)', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button data-testid="grpc-stream-cancel-btn"></button><button data-testid="grpc-stream-send-message-btn"></button>',
    );
    document.querySelector('[data-testid="grpc-stream-start-btn"]')?.remove();

    const ctx = makeCtx();
    await startAndExchangeBidiStream(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GRPC.STREAM_START_BTN);
  });
});
