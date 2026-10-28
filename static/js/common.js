/* Shared helpers: API client, escaping, icons, toast, modal, formatting. */
(function () {
  'use strict';

  const ICONS = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>',
    xCircle: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
    camera: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
    download: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    ticket: '<path d="M2 9a3 3 0 010-6h20a3 3 0 010 6v6a3 3 0 010 6H2a3 3 0 010-6z" transform="translate(0 -0.5) scale(1 .96)"/><path d="M13 5v2M13 11v2M13 17v2"/>',
    printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
    file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    award: '<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    mic: '<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>',
    trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    mail: '<path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M22 6l-10 7L2 6"/>',
    phone: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>',
    undo: '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    flash: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>',
  };

  const MEB = (window.MEB = {});

  MEB.icon = (name, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // Hydrate <i data-icon="name"> placeholders
  MEB.hydrateIcons = (root = document) => {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.done) return;
      el.insertAdjacentHTML('afterbegin', MEB.icon(el.dataset.icon));
      el.dataset.done = '1';
    });
  };

  MEB.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  MEB.$ = (sel, root = document) => root.querySelector(sel);
  MEB.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---- API ----
  class ApiError extends Error {
    constructor(status, data) {
      super((data && data.error) || 'Terjadi kesalahan.');
      this.status = status;
      this.fields = (data && data.fields) || {};
      this.data = data || {};
    }
  }
  MEB.ApiError = ApiError;

  MEB.api = async (path, { method = 'GET', body } = {}) => {
    const opt = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, opt);
    } catch {
      throw new ApiError(0, { error: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.' });
    }
    let data = null;
    try { data = await res.json(); } catch { /* bukan JSON */ }
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  };

  // ---- Toast ----
  MEB.toast = (msg, type = 'ok') => {
    let box = MEB.$('.toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${MEB.icon(type === 'err' ? 'alert' : 'checkCircle')}<span>${MEB.esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3800);
  };

  // ---- Modal ----
  MEB.modal = ({ title, body, footer, width }) =>
    new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${MEB.esc(title)}" ${width ? `style="max-width:${width}px"` : ''}>
        <div class="modal-head"><h3>${MEB.esc(title)}</h3><button class="btn btn-ghost btn-sm" data-close aria-label="Tutup">${MEB.icon('x')}</button></div>
        <div class="modal-body"></div>${footer ? '<div class="modal-foot"></div>' : ''}</div>`;
      const bodyEl = back.querySelector('.modal-body');
      typeof body === 'string' ? (bodyEl.innerHTML = body) : bodyEl.appendChild(body);
      const footEl = back.querySelector('.modal-foot');
      if (footer && footEl) typeof footer === 'string' ? (footEl.innerHTML = footer) : footEl.appendChild(footer);
      const close = (val) => { document.removeEventListener('keydown', onKey); back.remove(); resolve(val); };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
      back.querySelector('[data-close]').addEventListener('click', () => close(null));
      back._close = close;
      document.addEventListener('keydown', onKey);
      document.body.appendChild(back);
      const first = back.querySelector('input,select,textarea,button.btn-primary,button.btn-danger');
      if (first) first.focus();
      MEB._lastModal = back;
    });

  MEB.confirm = ({ title, message, confirmText = 'Ya, lanjutkan', danger = false }) => {
    const foot = document.createElement('div');
    foot.style.display = 'contents';
    foot.innerHTML = `<button class="btn btn-secondary" data-no>Batal</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${MEB.esc(confirmText)}</button>`;
    const p = MEB.modal({ title, body: `<p style="margin:0">${message}</p>`, footer: foot, width: 460 });
    const back = MEB._lastModal;
    foot.querySelector('[data-yes]').addEventListener('click', () => back._close(true));
    foot.querySelector('[data-no]').addEventListener('click', () => back._close(false));
    return p.then((v) => v === true);
  };

  // ---- Format ----
  const TZ = 'Asia/Makassar';
  MEB.fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(/\./g, ':').replace(',', '') + ' WITA';
  };
  MEB.fmtTime = (iso) => {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso)).replace(/\./g, ':');
  };
  MEB.fmtDate = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d)));
  };
  MEB.statusLabel = { calon_alumni: 'Calon Alumni', alumni_baru: 'Alumni Baru' };

  // ---- Form helpers ----
  MEB.setFieldErrors = (form, fields) => {
    MEB.$$('.field', form).forEach((f) => f.classList.remove('has-error'));
    let first = null;
    Object.entries(fields || {}).forEach(([name, msg]) => {
      const field = form.querySelector(`[data-field="${name}"]`);
      if (!field) return;
      field.classList.add('has-error');
      const em = field.querySelector('.err-msg');
      if (em) em.textContent = msg;
      if (!first) first = field;
    });
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inp = first.querySelector('input,select,textarea');
      if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 250);
    }
  };

  MEB.busy = (btn, on, label) => {
    if (on) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>${label ? ' ' + MEB.esc(label) : ''}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  };

  // QR generator wrapper (qrcode-generator lib, vendored)
  MEB.qrCanvas = (text, size = 320, margin = 2) => {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const cell = Math.floor(size / (n + margin * 2));
    const px = cell * (n + margin * 2);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#1a0606';
    for (let r = 0; r < n; r++)
      for (let col = 0; col < n; col++)
        if (qr.isDark(r, col)) ctx.fillRect((col + margin) * cell, (r + margin) * cell, cell, cell);
    return c;
  };

  document.addEventListener('DOMContentLoaded', () => MEB.hydrateIcons());
})();
