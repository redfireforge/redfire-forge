// Shared interactivity for WS/SSE redesign mockups (visual only)
(function () {
  // Theme toggle
  var btn = document.getElementById('themeBtn');
  if (btn) {
    btn.addEventListener('click', function () {
      var html = document.documentElement;
      var light = html.getAttribute('data-theme') === 'light';
      html.setAttribute('data-theme', light ? 'default' : 'light');
      btn.textContent = light ? '☀️ Light theme' : '🌙 Dark theme';
    });
  }
  // Connect/Disconnect button
  var cbtn = document.getElementById('connectBtn');
  if (cbtn) {
    cbtn.addEventListener('click', function () {
      var on = cbtn.classList.toggle('danger');
      cbtn.textContent = on ? 'Disconnect' : 'Connect';
    });
  }
  // Tab groups
  document.querySelectorAll('.tabs').forEach(function (group) {
    group.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function (e) {
        if (t.getAttribute('onclick')) return; // navigational tabs
        group.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
      });
    });
  });
  // Segmented controls
  document.querySelectorAll('.seg').forEach(function (group) {
    group.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        group.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
    });
  });
  // Event row selection
  document.querySelectorAll('.ev').forEach(function (e) {
    e.addEventListener('click', function () {
      document.querySelectorAll('.ev').forEach(function (x) { x.classList.remove('sel'); });
      e.classList.add('sel');
    });
  });
  // Mode switch
  document.querySelectorAll('.ws-modes').forEach(function (group) {
    group.querySelectorAll('.ws-mode').forEach(function (m) {
      m.addEventListener('click', function () {
        if (m.getAttribute('data-href')) { location.href = m.getAttribute('data-href'); return; }
        group.querySelectorAll('.ws-mode').forEach(function (x) { x.classList.remove('active'); });
        m.classList.add('active');
      });
    });
  });
  // Collapsible panels
  document.querySelectorAll('.panel-head').forEach(function (h) {
    h.addEventListener('click', function (e) {
      if (e.target.classList.contains('switch')) { e.target.classList.toggle('on'); return; }
      var body = h.nextElementSibling;
      if (body && body.classList.contains('panel-body')) {
        body.style.display = body.style.display === 'none' ? '' : 'none';
      }
    });
  });
  // Standalone switches
  document.querySelectorAll('.switch').forEach(function (s) {
    s.addEventListener('click', function (e) { e.stopPropagation(); s.classList.toggle('on'); });
  });
})();
