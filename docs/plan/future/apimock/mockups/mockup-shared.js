(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  function activateTab(button) {
    const scope = button.closest('.tab-scope') || document;
    const target = button.dataset.tabTarget;
    if (!target) return;
    all('[data-tab-target]', button.parentElement).forEach((item) => item.classList.toggle('active', item === button));
    all('.builder-tab-content', scope).forEach((panel) => panel.classList.toggle('active', panel.id === target));
  }

  all('[data-tab-target]').forEach((button) => button.addEventListener('click', () => activateTab(button)));

  all('.server-tab').forEach((button) => button.addEventListener('click', () => {
    all('.server-tab', button.parentElement).forEach((item) => item.classList.toggle('active', item === button));
    const title = document.querySelector('[data-server-title]');
    const address = document.querySelector('[data-server-address]');
    if (title && button.dataset.serverName) title.textContent = button.dataset.serverName;
    if (address && button.dataset.serverPort) address.textContent = `http://127.0.0.1:${button.dataset.serverPort}`;
  }));

  all('.route-item').forEach((button) => button.addEventListener('click', () => {
    all('.route-item', button.closest('.route-tree') || document).forEach((item) => item.classList.toggle('active', item === button));
    const title = document.querySelector('[data-route-title]');
    if (title && button.dataset.route) title.textContent = button.dataset.route;
  }));

  all('[data-segment]').forEach((button) => button.addEventListener('click', () => {
    all('[data-segment]', button.parentElement).forEach((item) => item.classList.toggle('active', item === button));
    const target = button.dataset.show;
    if (target) {
      const scope = button.closest('.tab-scope') || document;
      all('[data-segment-panel]', scope).forEach((panel) => panel.classList.toggle('hidden', panel.dataset.segmentPanel !== target));
    }
  }));

  all('.toggle').forEach((button) => button.addEventListener('click', () => {
    button.classList.toggle('on');
    button.setAttribute('aria-checked', String(button.classList.contains('on')));
  }));

  all('[data-dropdown]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const holder = button.closest('.dropdown');
    all('.dropdown.open').forEach((item) => { if (item !== holder) item.classList.remove('open'); });
    holder?.classList.toggle('open');
  }));
  document.addEventListener('click', () => all('.dropdown.open').forEach((item) => item.classList.remove('open')));

  all('[data-open-modal]').forEach((button) => button.addEventListener('click', () => {
    document.getElementById(button.dataset.openModal)?.classList.add('open');
  }));
  all('[data-close-modal]').forEach((button) => button.addEventListener('click', () => button.closest('.modal-overlay')?.classList.remove('open')));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelector('.modal-overlay.open')?.classList.remove('open');
      all('.dropdown.open').forEach((item) => item.classList.remove('open'));
    }
  });

  all('[data-toast]').forEach((button) => button.addEventListener('click', () => {
    const toast = document.querySelector('.toast');
    if (!toast) return;
    toast.textContent = button.dataset.toast;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 1800);
  }));

  all('[data-run-simulation]').forEach((button) => button.addEventListener('click', () => {
    const label = button.querySelector('span') || button;
    const original = label.textContent;
    label.textContent = 'Running…';
    button.disabled = true;
    window.setTimeout(() => {
      label.textContent = 'Run again';
      button.disabled = false;
      all('[data-sim-result]').forEach((node) => node.classList.remove('hidden'));
      showToast('Simulation completed: 4 passed, 1 conflict');
      if (original === 'Run again') label.textContent = original;
    }, 650);
  }));

  all('[data-conflict-filter]').forEach((button) => button.addEventListener('click', () => {
    all('[data-conflict-filter]', button.parentElement).forEach((item) => item.classList.toggle('active', item === button));
    const filter = button.dataset.conflictFilter;
    all('[data-conflict-kind]').forEach((row) => row.classList.toggle('hidden', filter !== 'all' && row.dataset.conflictKind !== filter));
  }));

  all('[data-device]').forEach((button) => button.addEventListener('click', () => {
    all('[data-device]', button.parentElement).forEach((item) => item.classList.toggle('active', item === button));
    const frame = document.querySelector('.device-frame');
    if (!frame) return;
    frame.classList.toggle('mobile', button.dataset.device === 'mobile');
    frame.classList.toggle('tablet', button.dataset.device !== 'mobile');
    document.querySelector('.mobile-shell')?.classList.remove('drawer-open');
  }));
  all('[data-toggle-drawer]').forEach((button) => button.addEventListener('click', () => document.querySelector('.mobile-shell')?.classList.toggle('drawer-open')));

  all('[data-copy-value]').forEach((button) => button.addEventListener('click', async () => {
    const target = document.querySelector(button.dataset.copyValue);
    if (target) await navigator.clipboard?.writeText(target.value || target.textContent || '');
    showToast('Copied to clipboard');
  }));

  function showToast(message) {
    const toast = document.querySelector('.toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 1800);
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons({ attrs: { class: 'icon', 'aria-hidden': 'true' } });
  });
})();
