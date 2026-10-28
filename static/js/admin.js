/* Admin panel SPA: login, dashboard, peserta, absensi QR, pengaturan. */
(function () {
  'use strict';
  const { $, $$, esc, toast, busy, setFieldErrors, icon } = MEB;
  const view = $('#view');
  let ME = null;
  let META = { interests: {}, statuses: MEB.statusLabel };
  let cleanup = null;

  // API wrapper: sesi berakhir -> kembali ke login
  const A = async (path, opt) => {
    try { return await MEB.api(path, opt); }
    catch (e) { if (e.status === 401 && ME) { ME = null; showLogin('Sesi berakhir. Silakan masuk kembali.'); } throw e; }
  };

  const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const statusChip = (s) => `<span class="chip ${s === 'alumni_baru' ? 'chip-gold' : 'chip-info'}">${esc(MEB.statusLabel[s] || s)}</span>`;
  const attChip = (p) => p.checked_in_at
    ? `<span class="chip chip-success" title="${esc(MEB.fmtDateTime(p.checked_in_at))}">Hadir · ${esc(MEB.fmtTime(p.checked_in_at).slice(0, 5))}</span>`
    : '<span class="chip chip-pending">Belum hadir</span>';
  const isAdmin = () => ME && ME.role === 'admin';

  // ====================================================================== //
  // Login / shell
  // ====================================================================== //
  function showLogin(msg) {
    if (cleanup) { cleanup(); cleanup = null; }
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    const al = $('#login-alert');
    al.hidden = !msg;
    if (msg) al.querySelector('span').textContent = msg;
    $('#lg-user').focus();
  }

  function showApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#me-name').textContent = ME.username;
    $('#me-role').textContent = ME.role;
    $$('[data-admin-only]').forEach((el) => (el.hidden = !isAdmin()));
    router();
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, al = $('#login-alert'), btn = $('#btn-login');
    al.hidden = true;
    if (!f.username.value.trim() || !f.password.value) { al.hidden = false; al.querySelector('span').textContent = 'Username dan kata sandi wajib diisi.'; return; }
    busy(btn, true, 'Masuk…');
    try {
      ME = await MEB.api('/api/admin/login', { method: 'POST', body: { username: f.username.value.trim(), password: f.password.value } });
      f.password.value = '';
      busy(btn, false);
      if (!location.hash) location.hash = '#/dashboard';
      showApp();
    } catch (err) {
      busy(btn, false);
      al.hidden = false;
      al.querySelector('span').textContent = err.message;
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    try { await MEB.api('/api/admin/logout', { method: 'POST', body: {} }); } catch { /* abaikan */ }
    ME = null;
    showLogin();
  });

  // Sidebar mobile
  const sidebar = $('#sidebar'), scrim = $('#side-scrim');
  const closeSide = () => { sidebar.classList.remove('open'); scrim.classList.remove('show'); };
  $('#btn-menu').addEventListener('click', () => { sidebar.classList.toggle('open'); scrim.classList.toggle('show'); });
  scrim.addEventListener('click', closeSide);

  // ====================================================================== //
  // Router
  // ====================================================================== //
  const routes = { dashboard: viewDashboard, peserta: viewPeserta, absensi: viewAbsensi, pengaturan: viewPengaturan };

  async function router() {
    if (!ME) return;
    closeSide();
    let name = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
    if (!routes[name] || (name === 'pengaturan' && !isAdmin())) name = 'dashboard';
    if (cleanup) { cleanup(); cleanup = null; }
    $$('.sidebar nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    view.innerHTML = '<div class="skeleton" style="height:36px;width:260px;margin-bottom:24px"></div><div class="stats"><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:120px"></div></div>';
    try {
      const out = await routes[name](view);
      if (typeof out === 'function') cleanup = out;
      view.classList.remove('view-in'); void view.offsetWidth; view.classList.add('view-in');
      MEB.hydrateIcons(view);
    } catch (e) {
      if (e.status !== 401) view.innerHTML = `<div class="alert alert-error">${icon('alert')}<span>${esc(e.message)}</span></div>`;
    }
  }
  window.addEventListener('hashchange', router);

  // ====================================================================== //
  // Dashboard
  // ====================================================================== //
  async function viewDashboard(el) {
    const render = async () => {
      const s = await A('/api/admin/stats');
      const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
      const stateMap = { open: ['Dibuka', 'chip-success'], closed: ['Ditutup', 'chip-error'], full: ['Kuota Penuh', 'chip-pending'], deadline: ['Batas Berakhir', 'chip-error'] };
      const [stLabel, stCls] = stateMap[s.state] || ['—', ''];
      const days = Object.entries(s.per_day);
      const max = Math.max(1, ...days.map(([, v]) => v));
      const sumBy = (o) => Object.values(o).reduce((a, b) => a + b, 0) || 1;
      const hbars = (obj, labels) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
        `<div class="hbar"><span>${esc(labels[k] || k)}</span><div class="progress"><i style="width:${(v / sumBy(obj)) * 100}%"></i></div><b>${v}</b></div>`).join('') || '<p class="muted sm">Belum ada data.</p>';

      el.innerHTML = `
        <div class="page-head"><div><h1>Dashboard</h1><p>Ringkasan pendaftaran dan kehadiran peserta secara langsung.</p></div>
          <div class="page-actions"><a class="btn btn-primary" href="#/absensi">${icon('qr')} Buka Pemindai QR</a></div></div>
        <div class="stats">
          <div class="stat-card"><small>Total Terdaftar</small><b>${s.total}</b><span>${s.quota ? `dari kuota ${s.quota} peserta` : 'tanpa batas kuota'}</span><div class="ic">${icon('users')}</div></div>
          <div class="stat-card" style="--accent:var(--c-success)"><small>Sudah Hadir</small><b>${s.present}</b><span>${pct}% dari peserta terdaftar</span><div class="ic">${icon('checkCircle')}</div></div>
          <div class="stat-card" style="--accent:var(--c-warning)"><small>Belum Hadir</small><b>${s.absent}</b><span>menunggu check-in</span><div class="ic">${icon('clock')}</div></div>
          <div class="stat-card" style="--accent:var(--c-secondary)"><small>Pendaftaran</small><b style="font-size:1.7rem;margin-top:14px"><span class="chip ${stCls}" style="font-size:.9rem">${stLabel}</span></b><span>${isAdmin() ? '<a href="#/pengaturan">Ubah pengaturan →</a>' : 'status saat ini'}</span><div class="ic">${icon('ticket')}</div></div>
        </div>
        <div class="grid-2">
          <section class="card card-flush"><div class="card-head"><h3>Pendaftar 14 Hari Terakhir</h3></div>
            <div class="pad"><div class="bars">${days.map(([d, v]) => `<div class="bar"><i data-v="${v}" style="height:${(v / max) * 100}%"></i><span>${d.slice(8)}/${d.slice(5, 7)}</span></div>`).join('')}</div></div></section>
          <section class="card card-flush"><div class="card-head"><h3>Check-in Terbaru</h3><a class="btn btn-ghost btn-sm" href="#/absensi">Semua</a></div>
            ${s.recent.length ? `<ul class="list">${s.recent.map((r) => `<li><span class="avatar">${esc(initials(r.full_name))}</span><div class="grow"><b>${esc(r.full_name)}</b><small>${esc(r.reg_no)} · ${esc(MEB.fmtTime(r.checked_in_at))}</small></div><span class="chip chip-success no-dot">${r.method === 'manual' ? 'Manual' : 'QR'}</span></li>`).join('')}</ul>`
              : `<div class="empty">${icon('qr')}<p>Belum ada peserta yang check-in.</p></div>`}</section>
        </div>
        <div class="grid-eq">
          <section class="card"><h3>Berdasarkan Status</h3>${hbars(s.by_status, MEB.statusLabel)}</section>
          <section class="card"><h3>Minat Bidang Karier</h3>${hbars(s.by_interest, META.interests)}</section>
        </div>`;
      MEB.hydrateIcons(el);
    };
    await render();
    const t = setInterval(() => render().catch(() => {}), 20000);
    return () => clearInterval(t);
  }

  // ====================================================================== //
  // Peserta
  // ====================================================================== //
  const PS = { q: '', status: '', att: '', interest: '', sort: 'created', dir: 'desc', page: 1, per: 20 };

  async function viewPeserta(el) {
    el.innerHTML = `
      <div class="page-head"><div><h1>Data Peserta</h1><p id="p-sub">Memuat…</p></div>
        <div class="page-actions">
          ${isAdmin() ? `<button class="btn btn-secondary" id="btn-export">${icon('download')} Ekspor CSV</button><button class="btn btn-primary" id="btn-add">${icon('plus')} Tambah Peserta</button>` : ''}
        </div></div>
      <section class="card card-flush">
        <div class="toolbar">
          <div class="search">${icon('search')}<input class="input" id="p-q" type="search" placeholder="Cari nama, NIM, email, No. registrasi…" aria-label="Cari peserta" value="${esc(PS.q)}"></div>
          <div class="chips" role="group" aria-label="Filter status">
            <button class="chip chip-filter" data-st="" aria-pressed="${!PS.status}">Semua</button>
            <button class="chip chip-filter" data-st="calon_alumni" aria-pressed="${PS.status === 'calon_alumni'}">Calon Alumni</button>
            <button class="chip chip-filter" data-st="alumni_baru" aria-pressed="${PS.status === 'alumni_baru'}">Alumni Baru</button>
          </div>
          <select class="select" id="p-att" aria-label="Filter kehadiran">
            <option value="">Semua kehadiran</option><option value="present">Sudah hadir</option><option value="absent">Belum hadir</option></select>
          <select class="select" id="p-int" aria-label="Filter minat"><option value="">Semua minat</option>${Object.entries(META.interests).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        </div>
        <div class="table-wrap"><table class="tbl" id="p-table">
          <thead><tr>
            <th data-sort="reg">No. Reg</th><th data-sort="name">Peserta</th><th>Prodi</th><th data-sort="status">Status</th><th>Minat</th><th data-sort="created">Terdaftar</th><th data-sort="checkin">Kehadiran</th><th></th>
          </tr></thead><tbody id="p-body"></tbody></table></div>
        <div class="pager"><span id="p-count"></span><div class="btns" id="p-pager"></div></div>
      </section>`;
    $('#p-att').value = PS.att; $('#p-int').value = PS.interest;

    let reqId = 0, rows = [];
    const load = async () => {
      const id = ++reqId;
      const qs = new URLSearchParams(Object.entries(PS).filter(([, v]) => v !== '')).toString();
      const d = await A(`/api/admin/participants?${qs}`);
      if (id !== reqId) return;
      rows = d.items;
      $('#p-sub').textContent = `${d.total} peserta ditemukan`;
      $('#p-body').innerHTML = rows.length ? rows.map((p) => `
        <tr data-id="${p.id}">
          <td class="num">${esc(p.reg_no)}</td>
          <td class="cell-name"><b>${esc(p.full_name)}</b><small class="mono">${esc(p.nim)}</small></td>
          <td>${esc(p.program_studi)}<br><small class="muted">Lulus ${p.grad_year}</small></td>
          <td>${statusChip(p.status)}</td>
          <td>${esc(META.interests[p.interest] || p.interest)}</td>
          <td class="sm">${esc(MEB.fmtDateTime(p.created_at))}</td>
          <td>${attChip(p)}</td>
          <td><div class="row-actions">
            ${p.checked_in_at
              ? (isAdmin() ? `<button class="btn btn-ghost btn-sm" data-act="undo" title="Batalkan check-in" aria-label="Batalkan check-in ${esc(p.full_name)}">${icon('undo')}</button>` : '')
              : `<button class="btn btn-ghost btn-sm" data-act="checkin" title="Check-in manual" aria-label="Check-in manual ${esc(p.full_name)}">${icon('checkCircle')}</button>`}
            ${isAdmin() ? `<button class="btn btn-ghost btn-sm" data-act="qr" title="Tiket & QR" aria-label="Tiket QR ${esc(p.full_name)}">${icon('qr')}</button>
            <button class="btn btn-ghost btn-sm" data-act="edit" title="Ubah" aria-label="Ubah ${esc(p.full_name)}">${icon('edit')}</button>
            <button class="btn btn-ghost btn-sm" data-act="del" title="Hapus" aria-label="Hapus ${esc(p.full_name)}" style="color:var(--c-error)">${icon('trash')}</button>` : ''}
          </div></td></tr>`).join('')
        : `<tr><td colspan="8"><div class="empty">${icon('users')}<p>${PS.q || PS.status || PS.att || PS.interest ? 'Tidak ada peserta yang cocok dengan filter.' : 'Belum ada peserta terdaftar.'}</p></div></td></tr>`;
      const from = d.total ? (d.page - 1) * d.per + 1 : 0, to = Math.min(d.total, d.page * d.per);
      $('#p-count').textContent = `Menampilkan ${from}–${to} dari ${d.total}`;
      $('#p-pager').innerHTML = `<button class="btn btn-secondary btn-sm" data-pg="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>← Sebelumnya</button><span style="padding:6px 10px">Hal. ${d.page}/${d.pages}</span><button class="btn btn-secondary btn-sm" data-pg="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>Berikutnya →</button>`;
      $$('#p-table th[data-sort]').forEach((th) => {
        th.querySelector('.sort-ind')?.remove();
        if (th.dataset.sort === PS.sort) th.insertAdjacentHTML('beforeend', `<span class="sort-ind">${PS.dir === 'asc' ? '▲' : '▼'}</span>`);
      });
      MEB.hydrateIcons(el);
    };
    const reload = () => load().catch((e) => toast(e.message, 'err'));

    let tm;
    $('#p-q').addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(() => { PS.q = e.target.value.trim(); PS.page = 1; reload(); }, 300); });
    $$('.chip-filter', el).forEach((b) => b.addEventListener('click', () => {
      PS.status = b.dataset.st; PS.page = 1;
      $$('.chip-filter', el).forEach((x) => x.setAttribute('aria-pressed', x === b));
      reload();
    }));
    $('#p-att').addEventListener('change', (e) => { PS.att = e.target.value; PS.page = 1; reload(); });
    $('#p-int').addEventListener('change', (e) => { PS.interest = e.target.value; PS.page = 1; reload(); });
    $('#p-table thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]'); if (!th) return;
      if (PS.sort === th.dataset.sort) PS.dir = PS.dir === 'asc' ? 'desc' : 'asc'; else { PS.sort = th.dataset.sort; PS.dir = 'asc'; }
      reload();
    });
    $('#p-pager').addEventListener('click', (e) => { const b = e.target.closest('[data-pg]'); if (b && !b.disabled) { PS.page = +b.dataset.pg; reload(); } });

    $('#p-body').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const p = rows.find((r) => r.id === +btn.closest('tr').dataset.id); if (!p) return;
      const act = btn.dataset.act;
      try {
        if (act === 'checkin') {
          const r = await A('/api/admin/checkin', { method: 'POST', body: { code: p.reg_no, method: 'manual' } });
          toast(r.result === 'ok' ? `${p.full_name} tercatat hadir.` : `${p.full_name} sudah check-in sebelumnya.`);
          reload();
        } else if (act === 'undo') {
          if (await MEB.confirm({ title: 'Batalkan check-in?', message: `Kehadiran <b>${esc(p.full_name)}</b> akan dihapus dari catatan absensi.`, confirmText: 'Batalkan check-in', danger: true })) {
            await A(`/api/admin/attendance/${p.id}`, { method: 'DELETE', body: {} }); toast('Check-in dibatalkan.'); reload();
          }
        } else if (act === 'del') {
          if (await MEB.confirm({ title: 'Hapus peserta?', message: `Data <b>${esc(p.full_name)}</b> (${esc(p.nim)}) beserta catatan kehadirannya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`, confirmText: 'Hapus permanen', danger: true })) {
            await A(`/api/admin/participants/${p.id}`, { method: 'DELETE', body: {} }); toast('Peserta dihapus.'); reload();
          }
        } else if (act === 'edit') { if (await participantForm(p)) reload(); }
        else if (act === 'qr') showQR(p);
      } catch (err) { toast(err.message, 'err'); }
    });

    if (isAdmin()) {
      $('#btn-add').addEventListener('click', async () => { if (await participantForm(null)) reload(); });
      $('#btn-export').addEventListener('click', () => {
        const qs = new URLSearchParams(Object.entries({ q: PS.q, status: PS.status, att: PS.att, interest: PS.interest }).filter(([, v]) => v)).toString();
        location.href = `/api/admin/export.csv${qs ? '?' + qs : ''}`;
      });
    }
    await load();
  }

  function participantForm(p) {
    const edit = !!p;
    const d = p || { full_name: '', nim: '', email: '', phone: '', program_studi: '', status: '', grad_year: 2026, interest: '', note: '' };
    const f = (name, label, type = 'text', extra = '') => `<div class="field" data-field="${name}"><label for="pf-${name}">${label}</label><input class="input" id="pf-${name}" name="${name}" type="${type}" value="${esc(d[name])}" ${extra}><span class="err-msg" role="alert"></span></div>`;
    const body = document.createElement('form');
    body.noValidate = true;
    body.innerHTML = `<div class="form-grid">
      <div class="span-2">${f('full_name', 'Nama Lengkap', 'text', 'maxlength="100"')}</div>
      ${f('nim', 'NIM', 'text', 'maxlength="20"')}${f('program_studi', 'Program Studi', 'text', 'maxlength="80"')}
      ${f('email', 'Email', 'email', 'maxlength="120"')}${f('phone', 'Nomor WhatsApp', 'tel', 'maxlength="25"')}
      <div class="field" data-field="status"><label for="pf-status">Status</label><select class="select" id="pf-status" name="status"><option value="">Pilih…</option>${Object.entries(MEB.statusLabel).map(([k, v]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="err-msg" role="alert"></span></div>
      <div class="field" data-field="grad_year"><label for="pf-grad_year">Tahun Lulus</label><input class="input" id="pf-grad_year" name="grad_year" type="number" min="2020" max="2030" value="${esc(d.grad_year)}"><span class="err-msg" role="alert"></span></div>
      <div class="field span-2" data-field="interest"><label for="pf-interest">Minat Karier</label><select class="select" id="pf-interest" name="interest"><option value="">Pilih…</option>${Object.entries(META.interests).map(([k, v]) => `<option value="${k}" ${d.interest === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select><span class="err-msg" role="alert"></span></div>
      <div class="field span-2" data-field="note"><label for="pf-note">Catatan</label><textarea class="textarea" id="pf-note" name="note" maxlength="300" rows="2">${esc(d.note)}</textarea><span class="err-msg" role="alert"></span></div></div>
      <div class="alert alert-error" id="pf-alert" hidden style="margin-top:14px"><span></span></div>`;
    const foot = document.createElement('div');
    foot.style.display = 'contents';
    foot.innerHTML = `<button class="btn btn-secondary" type="button" data-no>Batal</button><button class="btn btn-primary" type="button" data-save>${edit ? 'Simpan Perubahan' : 'Tambah Peserta'}</button>`;
    const prom = MEB.modal({ title: edit ? `Ubah Peserta · ${p.reg_no}` : 'Tambah Peserta', body, footer: foot, width: 640 });
    const back = MEB._lastModal;
    foot.querySelector('[data-no]').addEventListener('click', () => back._close(false));
    const save = async () => {
      const btn = foot.querySelector('[data-save]');
      const data = Object.fromEntries(new FormData(body));
      const al = body.querySelector('#pf-alert'); al.hidden = true;
      busy(btn, true, 'Menyimpan…');
      try {
        await A(edit ? `/api/admin/participants/${p.id}` : '/api/admin/participants', { method: edit ? 'PUT' : 'POST', body: data });
        toast(edit ? 'Data peserta diperbarui.' : 'Peserta ditambahkan.');
        back._close(true);
      } catch (e) {
        busy(btn, false);
        if (e.fields && Object.keys(e.fields).length) setFieldErrors(body, e.fields);
        else { al.hidden = false; al.querySelector('span').textContent = e.message; }
      }
    };
    foot.querySelector('[data-save]').addEventListener('click', save);
    body.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    return prom.then((v) => v === true);
  }

  function showQR(p) {
    const url = `${location.origin}/ticket?c=${encodeURIComponent(p.code)}`;
    const body = document.createElement('div');
    body.className = 'qr-modal';
    const c = MEB.qrCanvas('MEB26.' + p.code, 320, 1);
    body.append(c);
    body.insertAdjacentHTML('beforeend', `<h3 style="margin:14px 0 2px">${esc(p.full_name)}</h3><p class="muted sm" style="margin:0">${esc(p.reg_no)} · ${esc(p.nim)}</p>
      <div class="copy-row"><input class="input" readonly value="${esc(url)}" aria-label="Tautan tiket"><button class="btn btn-secondary" data-copy>Salin</button></div>
      <div class="scan-controls" style="justify-content:center"><a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="${esc(url)}">${icon('ticket')} Buka Tiket</a></div>`);
    body.querySelector('[data-copy]').addEventListener('click', async () => {
      const inp = body.querySelector('.copy-row input');
      try { await navigator.clipboard.writeText(url); } catch { inp.select(); document.execCommand('copy'); }
      toast('Tautan tiket disalin.');
    });
    MEB.modal({ title: 'Tiket & QR Peserta', body, width: 440 });
  }

  // ====================================================================== //
  // Absensi QR
  // ====================================================================== //
  const beep = (type) => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const seq = type === 'ok' ? [[880, 0, .12], [1320, .13, .16]] : type === 'dup' ? [[520, 0, .12], [520, .18, .12]] : [[200, 0, .35]];
      seq.forEach(([f, at, dur]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type === 'bad' ? 'sawtooth' : 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, ac.currentTime + at);
        g.gain.exponentialRampToValueAtTime(.25, ac.currentTime + at + .02);
        g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + at + dur);
        o.connect(g).connect(ac.destination); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + dur + .02);
      });
      setTimeout(() => ac.close(), 1000);
    } catch { /* audio tidak tersedia */ }
    if (navigator.vibrate) navigator.vibrate(type === 'ok' ? 80 : [120, 60, 120]);
  };

  async function viewAbsensi(el) {
    el.innerHTML = `
      <div class="page-head"><div><h1>Absensi QR Code</h1><p>Pindai e-ticket peserta untuk mencatat kehadiran.</p></div></div>
      <div class="scan-grid">
        <section class="card">
          <div class="scanner" id="scanner">
            <video id="scan-video" playsinline muted hidden></video>
            <div class="scan-frame" id="scan-frame" hidden><i></i><i></i><i></i><i></i><span class="scan-line"></span></div>
            <div class="scanner-idle" id="scan-idle">${icon('camera')}<b>Kamera belum aktif</b><p>Tekan “Mulai Pindai” lalu arahkan QR Code tiket ke dalam bingkai.</p></div>
          </div>
          <div id="scan-warn" class="alert alert-warn" hidden style="margin-top:14px"><span>${icon('alert')}</span><span></span></div>
          <div class="scan-controls">
            <button class="btn btn-primary" id="btn-scan">${icon('camera')} Mulai Pindai</button>
            <select class="select" id="cam-select" aria-label="Pilih kamera" hidden></select>
            <label class="btn btn-secondary" for="scan-file" id="lbl-file">${icon('upload')} Foto QR<input id="scan-file" type="file" accept="image/*" capture="environment" hidden></label>
          </div>
          <form class="manual" id="manual-form" autocomplete="off">
            <input class="input" id="manual-code" placeholder="No. Reg atau NIM" aria-label="Kode manual atau pemindai USB" autocapitalize="characters">
            <button class="btn btn-gold" type="submit">Check-in</button>
          </form>
          <p class="hint" style="margin:8px 0 0">Pemindai barcode USB juga didukung: klik kolom di atas lalu pindai.</p>
        </section>
        <div class="stack">
          <section class="result" id="result" aria-live="assertive"><div>${icon('qr')}<h3>Menunggu pemindaian</h3><p class="muted" style="margin:0">Hasil check-in akan tampil di sini.</p></div></section>
          <section class="card card-flush">
            <div class="card-head"><h3>Kehadiran</h3><b id="att-num" class="mono">—</b></div>
            <div class="pad" style="padding-bottom:8px"><div class="progress progress-lg"><i id="att-bar" style="width:0"></i></div></div>
            <ul class="list" id="att-recent"></ul>
          </section>
        </div>
      </div>`;
    MEB.hydrateIcons(el);

    const video = $('#scan-video'), frame = $('#scan-frame'), idle = $('#scan-idle'), warn = $('#scan-warn');
    const btn = $('#btn-scan'), camSel = $('#cam-select'), result = $('#result');
    const work = document.createElement('canvas');
    const wctx = work.getContext('2d', { willReadFrequently: true });
    let stream = null, running = false, timer = 0, busyScan = false, last = { text: '', t: 0 };
    let detector = null;
    try { if ('BarcodeDetector' in window) detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }

    const showWarn = (m) => { warn.hidden = !m; if (m) warn.lastElementChild.textContent = m; };

    async function refreshRecent() {
      try {
        const s = await A('/api/admin/stats');
        $('#att-num').textContent = `${s.present} / ${s.total}`;
        $('#att-bar').style.width = (s.total ? (s.present / s.total) * 100 : 0) + '%';
        $('#att-recent').innerHTML = s.recent.length
          ? s.recent.map((r) => `<li><span class="avatar">${esc(initials(r.full_name))}</span><div class="grow"><b>${esc(r.full_name)}</b><small>${esc(r.reg_no)} · ${esc(MEB.fmtTime(r.checked_in_at))}</small></div><span class="chip chip-success no-dot">${r.method === 'manual' ? 'Manual' : 'QR'}</span></li>`).join('')
          : '<li class="muted">Belum ada check-in.</li>';
      } catch { /* abaikan */ }
    }

    function showResult(kind, title, who, sub) {
      const cfg = { ok: ['ok', 'checkCircle'], dup: ['dup', 'alert'], bad: ['bad', 'xCircle'] }[kind];
      result.className = `result ${cfg[0]} flash`;
      result.innerHTML = `<div>${icon(cfg[1])}<h3>${esc(title)}</h3>${who ? `<div class="who">${esc(who)}</div>` : ''}<p style="margin:4px 0 0">${sub}</p></div>`;
    }

    async function submitCode(text, method) {
      if (busyScan) return;
      const now = Date.now();
      if (text === last.text && now - last.t < 3000) return;
      last = { text, t: now };
      busyScan = true;
      try {
        const r = await A('/api/admin/checkin', { method: 'POST', body: { code: text, method } });
        const p = r.participant;
        const meta = `${esc(p.reg_no)} · <span class="mono">${esc(p.nim)}</span><br>${esc(p.program_studi)} · ${esc(MEB.statusLabel[p.status] || '')}`;
        if (r.result === 'ok') { showResult('ok', 'Check-in berhasil', p.full_name, meta); beep('ok'); }
        else { showResult('dup', 'Sudah check-in sebelumnya', p.full_name, `${meta}<br><b>${esc(MEB.fmtDateTime(p.checked_in_at))}</b> oleh ${esc(r.checked_by)}`); beep('dup'); }
        refreshRecent();
      } catch (e) {
        if (e.status === 404) showResult('bad', 'Kode tidak dikenali', '', 'Peserta tidak ditemukan. Pastikan QR berasal dari e-ticket resmi.');
        else showResult('bad', 'Gagal memproses', '', esc(e.message));
        beep('bad');
      } finally { busyScan = false; }
    }

    async function decodeFrame() {
      if (!running || video.readyState < 2) return null;
      if (detector) {
        try { const codes = await detector.detect(video); if (codes.length) return codes[0].rawValue; } catch { detector = null; }
        return null;
      }
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw) return null;
      const scale = Math.min(1, 640 / vw);
      work.width = Math.round(vw * scale); work.height = Math.round(vh * scale);
      wctx.drawImage(video, 0, 0, work.width, work.height);
      const img = wctx.getImageData(0, 0, work.width, work.height);
      const q = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      return q ? q.data : null;
    }

    async function loop() {
      if (!running) return;
      const text = await decodeFrame();
      if (text) await submitCode(text, 'qr');
      timer = setTimeout(loop, 120);
    }

    async function listCameras() {
      try {
        const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        if (devs.length > 1) {
          const cur = stream?.getVideoTracks()[0]?.getSettings().deviceId;
          camSel.innerHTML = devs.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || 'Kamera ' + (i + 1))}</option>`).join('');
          camSel.hidden = false;
        }
      } catch { /* abaikan */ }
    }

    async function start(deviceId) {
      showWarn('');
      if (!navigator.mediaDevices?.getUserMedia) {
        showWarn(window.isSecureContext ? 'Peramban ini tidak mendukung akses kamera. Gunakan kolom manual atau “Foto QR”.'
          : 'Kamera hanya dapat diakses melalui HTTPS atau localhost. Buka panel ini lewat http://localhost:8000, gunakan HTTPS (lihat README), atau pakai tombol “Foto QR”.');
        return;
      }
      stop(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      } catch (e) {
        showWarn(e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera pada peramban lalu coba lagi.' : `Kamera tidak dapat dibuka (${e.name}). Gunakan kolom manual atau “Foto QR”.`);
        return;
      }
      video.srcObject = stream; video.hidden = false; frame.hidden = false; idle.hidden = true;
      await video.play().catch(() => {});
      running = true;
      btn.innerHTML = `${icon('x')} Hentikan`;
      btn.classList.replace('btn-primary', 'btn-secondary');
      listCameras();
      loop();
    }

    function stop(keepUI) {
      running = false; clearTimeout(timer);
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      video.srcObject = null;
      if (!keepUI) {
        video.hidden = true; frame.hidden = true; idle.hidden = false;
        btn.innerHTML = `${icon('camera')} Mulai Pindai`;
        btn.classList.replace('btn-secondary', 'btn-primary');
      }
    }

    btn.addEventListener('click', () => (running ? stop() : start(camSel.hidden ? undefined : camSel.value)));
    camSel.addEventListener('change', () => start(camSel.value));

    // Foto QR (fallback untuk HTTP / tanpa kamera langsung)
    $('#scan-file').addEventListener('change', async (e) => {
      const file = e.target.files[0]; e.target.value = '';
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        let text = null;
        for (const max of [1400, 900, 600]) {
          const sc = Math.min(1, max / Math.max(img.width, img.height));
          work.width = Math.round(img.width * sc); work.height = Math.round(img.height * sc);
          wctx.drawImage(img, 0, 0, work.width, work.height);
          const d = wctx.getImageData(0, 0, work.width, work.height);
          const q = window.jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
          if (q) { text = q.data; break; }
        }
        if (text) { last = { text: '', t: 0 }; await submitCode(text, 'qr'); }
        else { showResult('bad', 'QR tidak terbaca', '', 'Ambil ulang foto dengan QR memenuhi bingkai dan pencahayaan cukup.'); beep('bad'); }
      } catch { toast('Gambar tidak dapat dibaca.', 'err'); }
      finally { URL.revokeObjectURL(url); }
    });

    // Manual / pemindai USB (keyboard wedge: mengetik lalu Enter)
    $('#manual-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const inp = $('#manual-code'); const v = inp.value.trim();
      if (!v) return;
      last = { text: '', t: 0 };
      await submitCode(v, v.startsWith('MEB26.') ? 'qr' : 'manual');
      inp.value = ''; inp.focus();
    });

    await refreshRecent();
    return () => stop();
  }

  // ====================================================================== //
  // Pengaturan (admin)
  // ====================================================================== //
  async function viewPengaturan(el) {
    el.innerHTML = `<div class="page-head"><div><h1>Pengaturan</h1><p>Informasi acara, pendaftaran, akun panitia, dan data.</p></div></div>
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="acara" aria-selected="true">Acara &amp; Pendaftaran</button>
        <button class="tab" role="tab" data-tab="pengguna" aria-selected="false">Akun Panitia</button>
        <button class="tab" role="tab" data-tab="data" aria-selected="false">Keamanan &amp; Data</button>
      </div><div id="tab-body"></div>`;
    const body = $('#tab-body');
    const tabs = { acara: tabAcara, pengguna: tabPengguna, data: tabData };
    const open = async (name) => {
      $$('.tab', el).forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === name));
      body.innerHTML = '<div class="skeleton" style="height:240px"></div>';
      try { await tabs[name](body); MEB.hydrateIcons(body); } catch (e) { body.innerHTML = `<div class="alert alert-error"><span>${esc(e.message)}</span></div>`; }
    };
    $$('.tab', el).forEach((t) => t.addEventListener('click', () => open(t.dataset.tab)));
    await open('acara');
  }

  async function tabAcara(body) {
    const s = await A('/api/admin/settings');
    const t = (name, label, type = 'text', extra = '') => `<div class="field" data-field="${name}"><label for="s-${name}">${label}</label><input class="input" id="s-${name}" name="${name}" type="${type}" value="${esc(s[name])}" ${extra}><span class="err-msg" role="alert"></span></div>`;
    body.innerHTML = `<form class="card" id="set-form" novalidate><div class="form-grid">
      <div class="span-2">${t('event_title', 'Judul Acara', 'text', 'maxlength="120"')}</div>
      <div class="span-2">${t('event_subtitle', 'Subjudul', 'text', 'maxlength="240"')}</div>
      <div class="span-2">${t('organizer', 'Penyelenggara', 'text', 'maxlength="140"')}</div>
      ${t('event_date', 'Tanggal Pelaksanaan', 'date')}${t('event_time', 'Waktu (teks bebas)', 'text', 'maxlength="60" placeholder="Contoh: 08.00 – 16.00 WITA"')}
      <div class="span-2">${t('venue', 'Lokasi / Tempat', 'text', 'maxlength="160" placeholder="Contoh: Aula Politeknik Negeri Ujung Pandang"')}</div>
      ${t('contact_name', 'Narahubung', 'text', 'maxlength="80"')}${t('contact_phone', 'Nomor Kontak (WhatsApp)', 'tel', 'maxlength="25"')}
      ${t('quota', 'Kuota Peserta (0 = tanpa batas)', 'number', 'min="0" max="100000"')}${t('reg_deadline', 'Batas Akhir Pendaftaran', 'date')}
      <div class="span-2"><label class="switch"><input type="checkbox" name="reg_open" ${s.reg_open === '1' ? 'checked' : ''}> Pendaftaran dibuka</label></div></div>
      <div class="alert alert-error" id="set-alert" hidden style="margin-top:14px"><span></span></div>
      <div style="margin-top:20px;display:flex;gap:8px"><button class="btn btn-primary" id="btn-save-set" type="submit">Simpan Pengaturan</button></div></form>`;
    $('#set-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = $('#btn-save-set');
      const data = Object.fromEntries(new FormData(f));
      data.reg_open = f.reg_open.checked;
      busy(btn, true, 'Menyimpan…');
      try { await A('/api/admin/settings', { method: 'PUT', body: data }); toast('Pengaturan disimpan.'); setFieldErrors(f, {}); }
      catch (err) { setFieldErrors(f, err.fields); if (!Object.keys(err.fields).length) toast(err.message, 'err'); }
      busy(btn, false);
    });
  }

  async function tabPengguna(body) {
    const d = await A('/api/admin/users');
    body.innerHTML = `<div class="grid-2" style="grid-template-columns:1.3fr 1fr;align-items:start">
      <section class="card card-flush"><div class="card-head"><h3>Daftar Akun</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Username</th><th>Peran</th><th>Dibuat</th><th></th></tr></thead><tbody>
        ${d.items.map((u) => `<tr><td><b>${esc(u.username)}</b>${u.id === d.me ? ' <span class="chip chip-gold no-dot">Anda</span>' : ''}</td><td><span class="chip ${u.role === 'admin' ? 'chip-info' : 'chip-pending'} no-dot">${u.role === 'admin' ? 'Admin' : 'Petugas'}</span></td><td class="sm">${esc(MEB.fmtDateTime(u.created_at))}</td><td>${u.id === d.me ? '' : `<button class="btn btn-ghost btn-sm" data-del="${u.id}" data-name="${esc(u.username)}" aria-label="Hapus ${esc(u.username)}" style="color:var(--c-error)">${icon('trash')}</button>`}</td></tr>`).join('')}
      </tbody></table></div></section>
      <form class="card" id="user-form" novalidate><h3>Tambah Akun</h3>
        <div class="stack" style="gap:14px">
          <div class="field" data-field="username"><label for="u-name">Username</label><input class="input" id="u-name" name="username" autocomplete="off"><span class="err-msg" role="alert"></span></div>
          <div class="field" data-field="password"><label for="u-pass">Kata Sandi</label><input class="input" id="u-pass" name="password" type="password" autocomplete="new-password"><span class="err-msg" role="alert"></span></div>
          <div class="field"><label for="u-role">Peran</label><select class="select" id="u-role" name="role"><option value="petugas">Petugas (absensi saja)</option><option value="admin">Admin (akses penuh)</option></select><span class="hint">Petugas hanya dapat memindai QR dan melihat data peserta.</span></div>
          <button class="btn btn-primary" type="submit">${icon('plus')} Tambah Akun</button></div></form></div>`;
    $('#user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await A('/api/admin/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Akun ditambahkan.'); tabPengguna(body).then(() => MEB.hydrateIcons(body)); }
      catch (err) { setFieldErrors(e.target, err.fields); if (!Object.keys(err.fields).length) toast(err.message, 'err'); }
    });
    body.firstElementChild.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (await MEB.confirm({ title: 'Hapus akun?', message: `Akun <b>${esc(b.dataset.name)}</b> tidak akan dapat masuk lagi.`, confirmText: 'Hapus akun', danger: true })) {
        try { await A(`/api/admin/users/${b.dataset.del}`, { method: 'DELETE', body: {} }); toast('Akun dihapus.'); await tabPengguna(body); MEB.hydrateIcons(body); } catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  async function tabData(body) {
    const log = await A('/api/admin/activity');
    body.innerHTML = `<div class="grid-eq" style="align-items:start">
      <form class="card" id="pw-form" novalidate><h3>Ganti Kata Sandi</h3><div class="stack" style="gap:14px">
        <div class="field" data-field="current"><label for="pw-cur">Kata sandi saat ini</label><input class="input" id="pw-cur" name="current" type="password" autocomplete="current-password"><span class="err-msg" role="alert"></span></div>
        <div class="field" data-field="new"><label for="pw-new">Kata sandi baru</label><input class="input" id="pw-new" name="new" type="password" autocomplete="new-password"><span class="err-msg" role="alert"></span></div>
        <button class="btn btn-primary" type="submit">${icon('key')} Perbarui Kata Sandi</button></div></form>
      <section class="card"><h3>Data &amp; Cadangan</h3>
        <p class="muted sm">Database disimpan sebagai berkas SQLite di <span class="mono">data/bootcamp.db</span> pada server. Unduh cadangan secara berkala, terutama sebelum dan sesudah acara.</p>
        <a class="btn btn-secondary" href="/api/admin/backup" id="btn-backup">${icon('db')} Unduh Cadangan Database</a></section></div>
      <section class="card card-flush" style="margin-top:20px"><div class="card-head"><h3>Log Aktivitas Terakhir</h3></div><div class="table-wrap" style="max-height:380px"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>
        ${log.items.map((r) => `<tr><td class="sm" style="white-space:nowrap">${esc(MEB.fmtDateTime(r.ts))}</td><td>${esc(r.actor)}</td><td><span class="chip chip-info no-dot">${esc(r.action)}</span></td><td class="sm">${esc(r.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Belum ada aktivitas.</td></tr>'}
      </tbody></table></div></section>`;
    $('#pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await A('/api/admin/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Kata sandi diperbarui.'); e.target.reset(); setFieldErrors(e.target, {}); }
      catch (err) { setFieldErrors(e.target, err.fields); if (!Object.keys(err.fields).length) toast(err.message, 'err'); }
    });
  }

  // ====================================================================== //
  // Boot
  // ====================================================================== //
  (async function boot() {
    try { const ev = await MEB.api('/api/public/event'); META = { interests: ev.interests, statuses: ev.statuses }; } catch { /* abaikan */ }
    try { ME = await MEB.api('/api/admin/me'); showApp(); } catch { showLogin(); }
  })();
})();
