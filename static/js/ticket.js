/* Ticket page: render e-ticket + QR, download PNG, print. */
(function () {
  'use strict';
  const { $, esc, api } = MEB;
  const root = $('#ticket-root');
  const params = new URLSearchParams(location.search);
  let code = params.get('c');
  try { if (!code) code = localStorage.getItem('meb_ticket'); } catch { /* abaikan */ }

  function fail(msg) {
    root.innerHTML = `<div class="ticket-error">${MEB.icon('xCircle')}
      <h3 style="margin-top:12px">Tiket tidak ditemukan</h3><p class="muted">${esc(msg)}</p>
      <a class="btn btn-primary" href="/#tiket">Cek Tiket dengan NIM &amp; Email</a></div>`;
  }

  async function render() {
    if (!code) return fail('Tautan tiket tidak lengkap.');
    let t;
    try { t = await api(`/api/ticket/${encodeURIComponent(code)}`); }
    catch (e) { return fail(e.message); }
    try { localStorage.setItem('meb_ticket', t.code); } catch { /* abaikan */ }
    document.title = `E-Ticket ${t.reg_no} — ${t.full_name}`;

    const ev = t.event;
    const date = ev.event_date ? MEB.fmtDate(ev.event_date) : 'Segera diumumkan';
    const time = ev.event_time || 'Segera diumumkan';
    const venue = ev.venue || 'Segera diumumkan';
    const isNew = params.get('new') === '1';

    root.innerHTML = `
      ${isNew ? `<div class="alert alert-success" style="margin-bottom:16px;background:#fff"><span>${MEB.icon('checkCircle')}</span><div><b>Pendaftaran berhasil.</b><br>Simpan atau unduh tiket ini. Tunjukkan QR Code saat registrasi ulang.</div></div>` : ''}
      <article class="eticket" id="eticket">
        <div class="et-head">
          <span class="brand-logo"><img src="/img/logo-pnup.png" alt="Logo PNUP"></span>
          <div><h1>${esc(ev.event_title)}</h1><small>${esc(ev.organizer)}</small></div>
        </div>
        <div class="et-body">
          <div class="et-qr ${t.checked_in_at ? 'checked' : ''}" id="et-qr-box"><span id="et-qr-slot"></span><div class="et-stamp"><span>HADIR</span></div></div>
          <h2 class="et-name">${esc(t.full_name)}</h2>
          <div class="et-sub">${esc(t.nim)} · ${esc(t.program_studi)}</div>
          <span class="et-reg">${esc(t.reg_no)}</span>
        </div>
        <div class="et-status">
          ${t.checked_in_at
            ? `<span class="chip chip-success">Telah check-in · ${esc(MEB.fmtDateTime(t.checked_in_at))}</span>`
            : `<span class="chip chip-info">Terdaftar · ${esc(MEB.statusLabel[t.status] || '')}</span>`}
        </div>
        <div class="et-tear"></div>
        <div class="et-info">
          <div class="et-row">${MEB.icon('calendar')}<div><small>Tanggal</small><b>${esc(date)}</b></div></div>
          <div class="et-row">${MEB.icon('clock')}<div><small>Waktu</small><b>${esc(time)}</b></div></div>
          <div class="et-row">${MEB.icon('pin')}<div><small>Lokasi</small><b>${esc(venue)}</b></div></div>
        </div>
      </article>
      <div class="ticket-actions">
        <button class="btn btn-gold" id="btn-dl">${MEB.icon('download')} Unduh PNG</button>
        <button class="btn" id="btn-print">${MEB.icon('printer')} Cetak</button>
      </div>
      <p class="ticket-note">Jaga kerahasiaan tiket ini. QR Code bersifat unik dan hanya berlaku untuk satu peserta.</p>`;

    const qrCanvas = MEB.qrCanvas(t.qr, 480, 1);
    qrCanvas.setAttribute('aria-label', `QR Code tiket ${t.reg_no}`);
    qrCanvas.setAttribute('role', 'img');
    $('#et-qr-slot').replaceWith(qrCanvas);

    $('#btn-print').addEventListener('click', () => window.print());
    $('#btn-dl').addEventListener('click', () => download(t, { date, time, venue }, ev));
  }

  async function download(t, info, ev) {
    const W = 900, H = 1480;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const css = getComputedStyle(document.documentElement);
    const maroon = css.getPropertyValue('--c-primary').trim() || '#7F1D1D';
    const gold = css.getPropertyValue('--c-secondary').trim() || '#CA8A04';
    try { await Promise.all(['700 40px Vollkorn', '400 28px "DM Sans"', '600 30px "Source Code Pro"'].map((f) => document.fonts.load(f))); } catch { /* abaikan */ }

    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
    g.fillStyle = '#3F0D0D'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; rr(40, 40, W - 80, H - 80, 36); g.fill();

    // header
    g.save(); rr(40, 40, W - 80, H - 80, 36); g.clip();
    const grad = g.createLinearGradient(0, 0, W, 260); grad.addColorStop(0, maroon); grad.addColorStop(1, '#5E1616');
    g.fillStyle = grad; g.fillRect(40, 40, W - 80, 220);
    g.fillStyle = gold; g.fillRect(40, 252, W - 80, 10);
    g.restore();

    const logo = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '/img/logo-pnup.png'; });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(135, 150, 52, 0, Math.PI * 2); g.fill();
    if (logo) g.drawImage(logo, 135 - 40, 150 - 40, 80, 80 * (logo.height / logo.width));

    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = '700 38px Vollkorn, Georgia, serif';
    wrap(g, ev.event_title, 215, 135, W - 280, 44, 2);
    g.font = '400 22px "DM Sans", sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)';
    wrap(g, ev.organizer, 215, 215, W - 280, 28, 2);

    // QR
    const qr = MEB.qrCanvas(t.qr, 560, 1);
    g.strokeStyle = '#E2E8F0'; g.lineWidth = 3; rr(W / 2 - 310, 310, 620, 620, 24); g.stroke();
    g.imageSmoothingEnabled = false;
    g.drawImage(qr, W / 2 - 280, 340, 560, 560);

    // name
    g.textAlign = 'center'; g.fillStyle = '#0F172A';
    g.font = '700 54px Vollkorn, Georgia, serif';
    wrap(g, t.full_name, W / 2, 1010, W - 160, 60, 2, 'center');
    g.font = '400 28px "DM Sans", sans-serif'; g.fillStyle = '#475569';
    g.fillText(`${t.nim} · ${t.program_studi}`.slice(0, 60), W / 2, 1090);
    g.fillStyle = '#F6EFEF'; rr(W / 2 - 150, 1118, 300, 60, 10); g.fill();
    g.fillStyle = maroon; g.font = '600 32px "Source Code Pro", monospace';
    g.fillText(t.reg_no, W / 2, 1160);

    // tear line
    g.strokeStyle = '#CBD5E1'; g.lineWidth = 3; g.setLineDash([14, 10]);
    g.beginPath(); g.moveTo(60, 1230); g.lineTo(W - 60, 1230); g.stroke(); g.setLineDash([]);

    // info
    g.textAlign = 'left';
    [['TANGGAL', info.date], ['WAKTU', info.time], ['LOKASI', info.venue]].forEach(([k, v], i) => {
      const y = 1285 + i * 62;
      g.fillStyle = '#64748B'; g.font = '600 18px "DM Sans", sans-serif'; g.fillText(k, 100, y);
      g.fillStyle = '#0F172A'; g.font = '600 26px "DM Sans", sans-serif'; g.fillText(String(v).slice(0, 48), 240, y);
    });

    c.toBlob((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `e-ticket-${t.reg_no}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  function wrap(g, text, x, y, maxW, lh, maxLines, align) {
    const words = String(text).split(/\s+/); const lines = []; let line = '';
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    lines.push(line);
    const out = lines.slice(0, maxLines);
    if (lines.length > maxLines) out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '…');
    const startY = maxLines > 1 && out.length === 1 ? y : y - (out.length - 1) * (align === 'center' ? 0 : lh / 2);
    out.forEach((l, i) => g.fillText(l, x, startY + i * lh));
  }

  render();
})();
