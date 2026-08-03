/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { kafkaTlsLesson, KAFKA_TLS_DEMO_CA_PEM } from './kafka-tls';
import { KAFKA } from '@shared/selectors';

describe('kafka-tls lesson', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('has valid lesson structure', () => {
    expect(kafkaTlsLesson.id).toBe('kafka-tls');
    expect(kafkaTlsLesson.domainId).toBe('protocols');
    expect(kafkaTlsLesson.category).toBe('kafka');
    expect(kafkaTlsLesson.estimatedMinutes).toBeGreaterThan(0);
    expect(kafkaTlsLesson.initialTab).toBe('kafka-settings');
    expect(kafkaTlsLesson.allowedTabs).toContain('kafka-settings');
  });

  it('has concept with title, body, keyTerms, and SVG diagram', () => {
    expect(kafkaTlsLesson.concept.title).toBeTruthy();
    expect(kafkaTlsLesson.concept.body).toBeTruthy();
    expect(kafkaTlsLesson.concept.keyTerms!.length).toBeGreaterThan(0);
    expect(kafkaTlsLesson.concept.diagram).toContain('<svg');
  });

  it('embeds the demo CA PEM from docker/kafka/tls/certs/ca.crt', () => {
    expect(KAFKA_TLS_DEMO_CA_PEM).toContain('BEGIN CERTIFICATE');
    expect(KAFKA_TLS_DEMO_CA_PEM).toContain('END CERTIFICATE');
    expect(KAFKA_TLS_DEMO_CA_PEM.length).toBeGreaterThan(400);
  });

  it('has exactly 8 steps with unique IDs', () => {
    expect(kafkaTlsLesson.steps.length).toBe(8);
    const ids = kafkaTlsLesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('saves before testing (Test Connection needs a saved selected cluster)', () => {
    const ids = kafkaTlsLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'tls-intro',
      'tls-broker',
      'tls-auth',
      'tls-enable',
      'tls-ca',
      'tls-test',
      'tls-connect',
      'tls-publish',
    ]);
    expect(ids.indexOf('tls-ca')).toBeLessThan(ids.indexOf('tls-test'));
    expect(ids.indexOf('tls-test')).toBeLessThan(ids.indexOf('tls-connect'));
  });

  it('has dockerEndpoint and dockerCommand', () => {
    expect(kafkaTlsLesson.dockerEndpoint).toBeTruthy();
    expect(kafkaTlsLesson.dockerCommand).toContain('tls');
  });

  it('step tls-intro action waits for settings page and clicks New Cluster', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('kafka-settings-page'), expect.any(Number));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('kafka-add-cluster-btn'));
  });

  it('step tls-intro preAction removes selected class from cluster cards', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-intro')!;
    const selectedCard = document.createElement('div');
    selectedCard.className = 'kafka-cluster-card selected';
    document.body.appendChild(selectedCard);

    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(selectedCard.classList.contains('selected')).toBe(false);
  });

  it('step tls-auth action selects SCRAM-SHA-256 and fills credentials', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-auth')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.stringContaining('auth-mode'), 'scram-sha-256');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('username'), 'redfireforge-app');
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('password'), 'app-password');
  });

  it('step tls-broker preAction clears/fills cluster name when name input exists', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-broker')!;
    const nameInput = document.createElement('input');
    nameInput.id = 'kafka-cluster-name';
    nameInput.value = 'old';
    document.body.appendChild(nameInput);

    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(nameInput.value).toBe('');
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('#kafka-cluster-name'),
      'Local TLS',
    );
    expect(ctx.fill).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1:19092'), '127.0.0.1:19095');
  });

  it('step tls-enable action clicks TLS toggle when NOT already checked', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-enable')!;
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.setAttribute('data-testid', 'kafka-tls-toggle');
    toggle.checked = false;
    const clickSpy = vi.fn();
    toggle.addEventListener('click', clickSpy);
    document.body.appendChild(toggle);
    const ca = document.createElement('textarea');
    ca.id = 'kafka-tls-ca';
    document.body.appendChild(ca);
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tls-ca pastes CA PEM, skips verify, and saves before Test', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-ca')!;
    expect(step.highlight).toBe(KAFKA.TLS_CA_PEM);
    expect(step.verify).toBe(KAFKA.TEST_BTN);

    document.body.innerHTML = `
      <input type="checkbox" data-testid="kafka-tls-verify-toggle" checked />
      <textarea id="kafka-tls-ca"></textarea>
      <button data-testid="kafka-save-cluster-btn"></button>
      <button data-testid="kafka-test-btn"></button>
    `;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.fill).toHaveBeenCalledWith(KAFKA.TLS_CA_PEM, KAFKA_TLS_DEMO_CA_PEM);
    expect(ctx.click).toHaveBeenCalledWith(KAFKA.SAVE_BTN);
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('step tls-test clicks Test Connection and waits for Verified badge', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-test')!;
    expect(step.verify).toBe(KAFKA.TEST_RESULT);

    document.body.innerHTML = `
      <button data-testid="kafka-test-btn"></button>
      <span data-testid="kafka-test-result">✓ Verified</span>
    `;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(KAFKA.TEST_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(KAFKA.TEST_RESULT, expect.any(Number));
    expect(document.querySelector('.demo-spotlight-ring')).toBeTruthy();
  });

  it('step tls-test skips click when Test Connection is disabled', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-test')!;
    document.body.innerHTML = '<button data-testid="kafka-test-btn" disabled></button>';
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step tls-connect clicks Connect when enabled', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-connect')!;
    expect(step.highlight).toBe(KAFKA.CONNECT_BTN);
    document.body.innerHTML = `
      <button data-testid="kafka-connect-btn"></button>
      <button data-testid="kafka-disconnect-btn" disabled></button>
    `;
    const ctx = makeCtx();
    ctx.click = vi.fn(async () => {
      const dc = document.querySelector<HTMLButtonElement>('[data-testid="kafka-disconnect-btn"]');
      if (dc) dc.disabled = false;
    });
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(KAFKA.CONNECT_BTN);
  });

  it('step tls-publish action clicks send button', async () => {
    const step = kafkaTlsLesson.steps.find((s) => s.id === 'tls-publish')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  it('setup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTlsLesson.setup) {
      await expect(kafkaTlsLesson.setup(ctx)).resolves.not.toThrow();
    }
  });

  it('cleanup runs without throwing when DOM is empty', async () => {
    const ctx = makeCtx();
    if (kafkaTlsLesson.cleanup) {
      await expect(kafkaTlsLesson.cleanup(ctx)).resolves.not.toThrow();
    }
  });

  it('all step preActions run without throwing', async () => {
    for (const step of kafkaTlsLesson.steps) {
      const ctx = makeCtx();
      if (step.preAction) await expect(step.preAction(ctx)).resolves.not.toThrow();
    }
  });

  it('all step actions run without throwing', async () => {
    for (const step of kafkaTlsLesson.steps) {
      const ctx = makeCtx();
      if (step.action) await expect(step.action(ctx)).resolves.not.toThrow();
    }
  });

  it('has Docker badge tag', () => {
    expect(kafkaTlsLesson.tag).toBe('🐳 Docker');
  });
});
