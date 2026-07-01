/**
 * gRPC Studio mockup shared chrome — Phase 4J UX parity.
 * TLS badge → shared modal (GraphQL/WebSocket TlsConfigModal pattern).
 * Auth badge → focus Auth tab (studio) or settings nav (04).
 * Settings gear → 04-auth-tls.html full drawer.
 */
(function () {
  const TLS_LABELS = {
    disabled: { text: '🔓 Plaintext', className: 'tls-badge plain' },
    tls: { text: '🔒 TLS', className: 'tls-badge' },
    mtls: { text: '🛡 mTLS', className: 'tls-badge mtls' },
  };

  let tlsMode = 'tls';
  let tlsModalDirty = false;
  let tlsSnapshot = null;

  function getPageKind() {
    return document.body.getAttribute('data-grpc-page') || 'chrome';
  }

  function injectTlsModal() {
    if (document.getElementById('grpcTlsModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'grpcTlsModalOverlay';
    overlay.className = 'tls-modal-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
      <div class="tls-modal" role="dialog" aria-labelledby="grpc-tls-modal-title" aria-modal="true" data-testid="grpc-tls-body">
        <div class="tls-modal-header">
          <div class="tls-modal-title" id="grpc-tls-modal-title"><span aria-hidden="true">🔒</span> TLS / mTLS Configuration</div>
          <button type="button" class="btn btn-ghost btn-xs" data-action="tls-close" aria-label="Close">Close</button>
        </div>
        <div class="tls-modal-body">
          <div class="tls-modal-notice">
            Same modal shell as <strong>GraphQL Studio</strong> and <strong>WebSocket Studio</strong>
            (<code>TlsConfigModal</code>). gRPC adds tri-mode: Plaintext / TLS / mTLS + SNI.
            Full drawer with Health, K8s, Compression → <a href="04-auth-tls.html">mockup 04</a>.
          </div>
          <div>
            <span class="tls-field-label">TLS mode</span>
            <div class="tls-mode-row" role="group" aria-label="TLS mode">
              <button type="button" class="tls-mode-chip" data-tls-mode="disabled">
                <div class="chip-icon">🔓</div>
                <div class="chip-label">Plaintext</div>
                <div class="chip-desc">h2c cleartext</div>
              </button>
              <button type="button" class="tls-mode-chip active" data-tls-mode="tls">
                <div class="chip-icon">🔒</div>
                <div class="chip-label">TLS</div>
                <div class="chip-desc">Server verified</div>
              </button>
              <button type="button" class="tls-mode-chip" data-tls-mode="mtls">
                <div class="chip-icon">🛡</div>
                <div class="chip-label">mTLS</div>
                <div class="chip-desc">Mutual auth</div>
              </button>
            </div>
          </div>
          <div id="grpcTlsModalFields">
            <label class="tls-field-label" for="grpc-tls-ca">Server CA certificate (PEM)</label>
            <textarea id="grpc-tls-ca" class="tls-pem-input" rows="3" placeholder="-----BEGIN CERTIFICATE-----&#10;…&#10;-----END CERTIFICATE-----"></textarea>
            <label class="tls-check-row" style="margin-top:8px">
              <input type="checkbox" id="grpc-tls-skip"> Skip server certificate verification
            </label>
            <div id="grpcMtlsFields" style="display:none;margin-top:12px">
              <label class="tls-field-label" for="grpc-tls-client-cert">Client certificate (PEM)</label>
              <textarea id="grpc-tls-client-cert" class="tls-pem-input" rows="2" placeholder="-----BEGIN CERTIFICATE-----"></textarea>
              <label class="tls-field-label" for="grpc-tls-client-key" style="margin-top:8px">Client private key (PEM)</label>
              <textarea id="grpc-tls-client-key" class="tls-pem-input" rows="2" placeholder="-----BEGIN EC PRIVATE KEY-----"></textarea>
            </div>
            <label class="tls-field-label" for="grpc-tls-sni" style="margin-top:12px">Server name override (SNI)</label>
            <input type="text" id="grpc-tls-sni" class="target-input" style="max-width:none" placeholder="Optional — e.g. my-service.internal">
          </div>
        </div>
        <div class="tls-modal-footer">
          <button type="button" class="btn btn-ghost btn-sm" data-action="tls-test" style="margin-right:auto">🔒 Test TLS Connection</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="tls-reset">Reset</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="tls-cancel">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" data-action="tls-save">Save</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeTlsModal(true);
    });

    overlay.querySelector('[data-action="tls-close"]').addEventListener('click', () => closeTlsModal(true));
    overlay.querySelector('[data-action="tls-cancel"]').addEventListener('click', () => closeTlsModal(false));
    overlay.querySelector('[data-action="tls-save"]').addEventListener('click', () => closeTlsModal(true));
    overlay.querySelector('[data-action="tls-reset"]').addEventListener('click', resetTlsModal);
    overlay.querySelector('[data-action="tls-test"]').addEventListener('click', () => {
      const target = document.querySelector('.grpc-target-input')?.value || 'grpc.example.com:50051';
      alert('Test TLS handshake to ' + target + ' (' + tlsMode + ' mode)');
    });

    overlay.querySelectorAll('[data-tls-mode]').forEach((btn) => {
      btn.addEventListener('click', () => selectTlsModeInModal(btn.getAttribute('data-tls-mode')));
    });

    overlay.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('input', () => { tlsModalDirty = true; });
    });
  }

  function selectTlsModeInModal(mode) {
    tlsMode = mode;
    tlsModalDirty = true;
    const overlay = document.getElementById('grpcTlsModalOverlay');
    if (!overlay) return;
    overlay.querySelectorAll('[data-tls-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tls-mode') === mode);
    });
    const fields = document.getElementById('grpcTlsModalFields');
    const mtls = document.getElementById('grpcMtlsFields');
    if (fields) fields.style.display = mode === 'disabled' ? 'none' : '';
    if (mtls) mtls.style.display = mode === 'mtls' ? '' : 'none';
    updateTlsBadge();
  }

  function updateTlsBadge() {
    const badge = document.getElementById('grpcTlsBadge');
    if (!badge) return;
    const cfg = TLS_LABELS[tlsMode] || TLS_LABELS.tls;
    badge.className = cfg.className;
    badge.textContent = cfg.text;
  }

  function openTlsModal() {
    injectTlsModal();
    const overlay = document.getElementById('grpcTlsModalOverlay');
    tlsSnapshot = { mode: tlsMode };
    tlsModalDirty = false;
    selectTlsModeInModal(tlsMode);
    overlay.classList.add('open');
    overlay.querySelector('.tls-modal').focus?.();
  }

  function closeTlsModal(keep) {
    const overlay = document.getElementById('grpcTlsModalOverlay');
    if (!overlay) return;
    if (!keep && tlsSnapshot) {
      selectTlsModeInModal(tlsSnapshot.mode);
    }
    overlay.classList.remove('open');
    if (keep) updateTlsBadge();
  }

  function resetTlsModal() {
    selectTlsModeInModal('tls');
    document.getElementById('grpc-tls-ca').value = '';
    document.getElementById('grpc-tls-skip').checked = false;
    document.getElementById('grpc-tls-client-cert').value = '';
    document.getElementById('grpc-tls-client-key').value = '';
    document.getElementById('grpc-tls-sni').value = '';
    tlsModalDirty = true;
  }

  function focusAuthTab() {
    const authTabBtn = document.querySelector('[data-req-tab="auth"]');
    const authPanel = document.getElementById('req-auth');
    if (authTabBtn && authPanel) {
      document.querySelectorAll('.request-pane .panel-tab').forEach((t) => t.classList.remove('active'));
      authTabBtn.classList.add('active');
      authTabBtn.classList.add('panel-tab--highlight');
      setTimeout(() => authTabBtn.classList.remove('panel-tab--highlight'), 1500);
      ['req-form', 'req-json', 'req-meta', 'req-auth'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === 'req-auth' ? '' : 'none';
      });
      return;
    }
    openSettings('auth');
  }

  function openSettings(panel) {
    const kind = getPageKind();
    if (kind === 'settings') {
      if (typeof window.showPanel === 'function') window.showPanel(panel || 'tls');
      return;
    }
    const hash = panel ? '#' + panel : '';
    window.location.href = '04-auth-tls.html' + hash;
  }

  function wireConnectionBar() {
    const tlsBadge = document.getElementById('grpcTlsBadge');
    const authBadge = document.getElementById('grpcAuthBadge');
    if (tlsBadge) {
      tlsBadge.addEventListener('click', openTlsModal);
    }
    if (authBadge) {
      authBadge.addEventListener('click', focusAuthTab);
    }
    document.querySelectorAll('[data-action="settings"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openSettings(btn.getAttribute('data-settings-panel') || 'tls');
      });
    });

    const hash = window.location.hash.replace('#', '');
    if (getPageKind() === 'settings' && hash && typeof window.showPanel === 'function') {
      window.showPanel(hash);
    }
  }

  function initAuthTabPills() {
    document.querySelectorAll('.auth-type-tab-inline').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.auth-type-tabs-inline')?.querySelectorAll('.auth-type-tab-inline').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const authBadge = document.getElementById('grpcAuthBadge');
        if (authBadge) {
          const label = btn.textContent.trim();
          authBadge.textContent = label === 'None' ? 'Auth: None' : 'Auth: ' + label;
          authBadge.classList.toggle('auth-badge--configured', label !== 'None');
          authBadge.classList.toggle('auth-badge--none', label === 'None');
        }
      });
    });
  }

  function init() {
    injectTlsModal();
    const badge = document.getElementById('grpcTlsBadge');
    if (badge?.classList.contains('mtls')) tlsMode = 'mtls';
    else if (badge?.classList.contains('plain')) tlsMode = 'disabled';
    wireConnectionBar();
    initAuthTabPills();
    updateTlsBadge();
  }

  window.grpcMockup = {
    openTlsModal,
    closeTlsModal,
    focusAuthTab,
    openSettings,
    selectTlsModeInModal,
    getTlsMode: () => tlsMode,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
