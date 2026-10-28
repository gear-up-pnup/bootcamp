/* Landing page logic: event info, registration, ticket lookup. */
(function () {
  'use strict';
  const { $, $$, api, esc, toast, busy, setFieldErrors } = MEB;

  // ---- Nav ----
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  const toggle = $('#nav-toggle'), links = $('#nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', (e) => { if (e.target.closest('a')) { links.classList.remove('open'); toggle.setAttribute('aria-expanded', false); } });

  // ---- Reveal on scroll ----
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
    $$('.section-head, .topic, .stat, .steps li, .reg-aside, .reg-card, .lookup > *, details').forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  // ---- Demo QR on hero pass ----
  try {
    const c = MEB.qrCanvas('MEB26.CONTOH-TIKET-DEMO', 180, 1);
    const target = $('#demo-qr');
    target.width = target.height = c.width;
    target.getContext('2d').drawImage(c, 0, 0);
  } catch { /* abaikan */ }

  // ---- Event info ----
  let EVENT = null;
  let countdownTimer = null;

  function setMeta(id, value, fallback) {
    const el = $(id);
    if (value) { el.textContent = value; el.classList.remove('tba'); }
    else { el.textContent = fallback; el.classList.add('tba'); }
  }

  function startCountdown(date, timeText) {
    clearInterval(countdownTimer);
    const box = $('#countdown');
    if (!date) { box.hidden = true; return; }
    const m = (timeText || '').match(/(\d{1,2})[.:](\d{2})/);
    const hh = m ? m[1].padStart(2, '0') : '08', mm = m ? m[2] : '00';
    const target = new Date(`${date}T${hh}:${mm}:00+08:00`).getTime();
    if (isNaN(target)) { box.hidden = true; return; }
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { box.hidden = true; clearInterval(countdownTimer); return; }
      box.hidden = false;
      const p = (n) => String(n).padStart(2, '0');
      $('#cd-d').textContent = p(Math.floor(diff / 864e5));
      $('#cd-h').textContent = p(Math.floor(diff / 36e5) % 24);
      $('#cd-m').textContent = p(Math.floor(diff / 6e4) % 60);
      $('#cd-s').textContent = p(Math.floor(diff / 1e3) % 60);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function renderEvent(ev) {
    EVENT = ev;
    document.title = `${ev.event_title} — Pendaftaran | Teknik Mesin PNUP`;
    $('#hero-subtitle').textContent = ev.event_subtitle;
    $('#hero-organizer').textContent = ev.organizer;
    setMeta('#m-date', ev.event_date ? MEB.fmtDate(ev.event_date) : '', 'Segera diumumkan');
    setMeta('#m-time', ev.event_time, 'Segera diumumkan');
    setMeta('#m-venue', ev.venue, 'Segera diumumkan');
    $('#s-registered').textContent = ev.registered;

    const q = $('#m-quota'), prog = $('#m-progress');
    if (ev.quota > 0) {
      q.textContent = `${ev.registered} / ${ev.quota} terdaftar`;
      prog.hidden = false;
      prog.firstElementChild.style.width = Math.min(100, (ev.registered / ev.quota) * 100) + '%';
      q.classList.remove('tba');
    } else {
      q.textContent = `${ev.registered} peserta terdaftar`;
      prog.hidden = true;
    }
    startCountdown(ev.event_date, ev.event_time);

    // kontak
    if (ev.contact_phone) {
      $('#reg-contact').hidden = false;
      $('#contact-text').textContent = `${ev.contact_name ? ev.contact_name + ' · ' : ''}${ev.contact_phone}`;
    }
    // opsi minat
    const sel = $('#f-interest');
    if (sel.options.length <= 1) {
      Object.entries(ev.interests).forEach(([k, v]) => sel.add(new Option(v, k)));
    }
    // status pendaftaran
    const card = $('.reg-card'), closed = $('#reg-closed');
    const msgs = {
      closed: ['Pendaftaran ditutup', 'Pendaftaran saat ini belum/tidak dibuka. Silakan pantau informasi dari panitia.'],
      deadline: ['Batas pendaftaran berakhir', 'Batas waktu pendaftaran telah terlewati.'],
      full: ['Kuota peserta penuh', 'Seluruh kuota peserta telah terisi.'],
    };
    const isOpen = ev.state === 'open';
    card.classList.toggle('is-closed', !isOpen);
    closed.hidden = isOpen;
    if (!isOpen) { $('#closed-title').textContent = msgs[ev.state][0]; $('#closed-text').textContent = msgs[ev.state][1]; }
    $$('#register-form input, #register-form select, #register-form textarea, #btn-submit').forEach((el) => (el.disabled = !isOpen));
  }

  async function loadEvent() {
    try { renderEvent(await api('/api/public/event')); }
    catch (e) { toast(e.message, 'err'); }
  }
  loadEvent();

  // ---- Registration ----
  const form = $('#register-form');
  const formAlert = $('#form-alert');

  function validate(d) {
    const e = {};
    if (d.full_name.trim().length < 3) e.full_name = 'Nama lengkap minimal 3 karakter.';
    if (!/^[A-Za-z0-9.\-]{5,20}$/.test(d.nim.trim())) e.nim = 'NIM tidak valid (5-20 karakter huruf/angka).';
    if (d.program_studi.trim().length < 2) e.program_studi = 'Program studi wajib diisi.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(d.email.trim())) e.email = 'Format email tidak valid.';
    const ph = d.phone.replace(/[\s\-().]/g, '').replace(/^\+62/, '0').replace(/^62(?=\d{9,})/, '0');
    if (!/^0\d{8,14}$/.test(ph)) e.phone = 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.';
    if (!d.status) e.status = 'Pilih status Anda.';
    if (!d.interest) e.interest = 'Pilih bidang karier yang diminati.';
    if (!d.consent) e.consent = 'Persetujuan wajib dicentang.';
    return e;
  }

  function readForm() {
    const fd = new FormData(form);
    return {
      full_name: fd.get('full_name') || '', nim: fd.get('nim') || '', program_studi: fd.get('program_studi') || '',
      email: fd.get('email') || '', phone: fd.get('phone') || '', status: fd.get('status') || '',
      grad_year: fd.get('grad_year'), interest: fd.get('interest') || '', note: fd.get('note') || '',
      website: fd.get('website') || '', consent: form.consent.checked,
    };
  }

  // hapus error saat user mengetik
  form.addEventListener('input', (e) => { const f = e.target.closest('.field'); if (f) f.classList.remove('has-error'); });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    formAlert.hidden = true;
    const data = readForm();
    const errs = validate(data);
    setFieldErrors(form, errs);
    if (Object.keys(errs).length) return;
    const btn = $('#btn-submit');
    busy(btn, true, 'Memproses…');
    try {
      const res = await api('/api/register', { method: 'POST', body: data });
      try { localStorage.setItem('meb_ticket', res.code); } catch { /* private mode */ }
      location.href = `/ticket?c=${encodeURIComponent(res.code)}&new=1`;
    } catch (e) {
      busy(btn, false);
      if (e.fields && Object.keys(e.fields).length) setFieldErrors(form, e.fields);
      else { formAlert.hidden = false; formAlert.querySelector('span').textContent = e.message; }
      if (e.data && e.data.state) loadEvent();
    }
  });

  // ---- Lookup ----
  const lf = $('#lookup-form'), la = $('#lookup-alert');
  lf.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    la.hidden = true;
    const nim = lf.nim.value.trim(), email = lf.email.value.trim();
    if (!nim || !email) { la.hidden = false; la.querySelector('span').textContent = 'NIM dan email wajib diisi.'; return; }
    const btn = $('#btn-lookup');
    busy(btn, true, 'Mencari…');
    try {
      const res = await api('/api/ticket/lookup', { method: 'POST', body: { nim, email } });
      location.href = `/ticket?c=${encodeURIComponent(res.code)}`;
    } catch (e) {
      busy(btn, false);
      la.hidden = false;
      la.querySelector('span').textContent = e.message;
    }
  });

  // Tiket tersimpan di perangkat ini → tawarkan pintasan
  try {
    const saved = localStorage.getItem('meb_ticket');
    if (saved) {
      const link = Object.assign(document.createElement('a'), {
        href: `/ticket?c=${encodeURIComponent(saved)}`, textContent: 'Tiket Saya', id: 'nav-saved-ticket',
      });
      $('#nav-links').insertBefore(link, $('#nav-links .btn'));
    }
  } catch { /* abaikan */ }
})();
