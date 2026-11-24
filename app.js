/* The Next Generation Institute - shared logic (front-end demo, data kept in browser localStorage) */
const App = (() => {
  const KEY = 'tngi_fees_v2', SESSION = 'tngi_session', FLASH = 'tngi_flash';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const LIMIT = 3; // more than 3 unpaid months => overdue
  const mk = (paid) => Object.fromEntries(MONTHS.map((m) => [m, paid.includes(m)]));

  const defaults = () => ({
    isOnline: true,
    admin: { username: 'admin', passwordHash: btoa('admin123'), phone: '+923001234567' },
    pendingOtp: null,
    students: [
      { id: 1, name: 'Hamza Tariq', className: 'Class 9 - Science', phone: '+923009876543', monthlyFee: 5000, channel: 'WhatsApp', months: mk(['May', 'Jun']) },
      { id: 2, name: 'Ayesha Siddiqui', className: 'Class 7 - B', phone: '+923215554433', monthlyFee: 4000, channel: 'SMS', months: mk(['Jan', 'Feb', 'May', 'Jun']) },
      { id: 3, name: 'Zainab Raza', className: 'Class 10 - A', phone: '+923334445566', monthlyFee: 5500, channel: 'WhatsApp', months: mk(['Jun']) }
    ],
    queue: [], sent: [], notified: []
  });

  let state = load();
  function load() {
    try { const r = localStorage.getItem(KEY); return r ? { ...defaults(), ...JSON.parse(r) } : defaults(); }
    catch { return defaults(); }
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'PKR ' + Number(n).toLocaleString();
  const unpaid = (s) => MONTHS.filter((m) => !s.months[m]);
  const dues = (s) => unpaid(s).length * s.monthlyFee;
  const isOverdue = (s) => unpaid(s).length > LIMIT;
  const validPhone = (p) => /^\+?\d{10,14}$/.test(p.replace(/[\s-]/g, ''));

  /* ---- session ---- */
  const loggedIn = () => sessionStorage.getItem(SESSION) === '1';
  const login = (u, p) => {
    if (u === state.admin.username && btoa(p) === state.admin.passwordHash) { sessionStorage.setItem(SESSION, '1'); return true; }
    return false;
  };
  const logout = () => { sessionStorage.removeItem(SESSION); location.href = 'index.html'; };

  /* ---- toast / flash ---- */
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
  }
  const flash = (msg) => sessionStorage.setItem(FLASH, msg);

  /* ---- messaging ---- */
  function flush() {
    if (!state.isOnline || !state.queue.length) return 0;
    const n = state.queue.length;
    state.sent.push(...state.queue.map((m) => ({ ...m, sentAt: Date.now() })));
    state.queue = []; save(); return n;
  }
  function checkOverdue() {
    let created = 0;
    state.students.filter(isOverdue).forEach((s) => {
      if (state.notified.includes(s.id)) return;
      const list = unpaid(s);
      const msg = {
        id: Date.now() + Math.random(), studentId: s.id, phone: s.phone, channel: s.channel, at: Date.now(),
        text: `The Next Generation Institute: Reminder for ${s.name} (${s.className}). Unpaid months (${list.length}): ${list.join(', ')}. Total due: PKR ${dues(s)}.`
      };
      state.notified.push(s.id); state.queue.push(msg); created++;
    });
    const sentNow = flush(); save();
    return { created, sentNow };
  }

  /* ---- page shell ---- */
  const NAV = [
    ['dashboard.html', 'dashboard', '📊', 'Dashboard'],
    ['students.html', 'students', '🎓', 'Students'],
    ['fees.html', 'fees', '💰', 'Fee Tracker'],
    ['reminders.html', 'reminders', '🔔', 'Reminders'],
    ['settings.html', 'settings', '⚙️', 'Settings']
  ];
  function page(active, title, subtitle) {
    if (!loggedIn()) { location.replace('index.html'); return false; }
    document.title = title + ' | The Next Generation Institute';
    document.getElementById('sidebar').innerHTML = `
      <div class="sb-brand"><b>The Next Generation Institute</b><span>Fee Management System</span></div>
      <nav class="sb-nav">${NAV.map((n) => `<a href="${n[0]}" class="${n[1] === active ? 'active' : ''}">${n[2]} ${n[3]}</a>`).join('')}</nav>
      <div class="sb-foot"><button class="btn ghost" style="width:100%;justify-content:center" id="logoutBtn">Logout</button></div>`;
    document.getElementById('topbar').innerHTML = `
      <button class="menu-btn" id="menuBtn" aria-label="Menu">☰</button>
      <div><h1>${esc(title)}</h1><p>${esc(subtitle || '')}</p></div>
      <div class="tb-right"><button class="badge-conn" id="connBtn" title="Click to switch"></button></div>`;
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('menuBtn').onclick = () => document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('connBtn').onclick = () => {
      state.isOnline = !state.isOnline;
      const n = flush(); save(); connBadge();
      toast(state.isOnline ? (n ? `Online - ${n} queued message(s) sent` : 'Online mode') : 'Offline mode - messages will be queued');
      if (App.onChange) App.onChange();
    };
    connBadge();
    const f = sessionStorage.getItem(FLASH);
    if (f) { sessionStorage.removeItem(FLASH); toast(f); }
    return true;
  }
  function connBadge() {
    const b = document.getElementById('connBtn'); if (!b) return;
    b.className = 'badge-conn ' + (state.isOnline ? 'on' : 'off');
    b.textContent = state.isOnline ? '● Online' : '● Offline';
  }

  return {
    MONTHS, LIMIT, get state() { return state; }, save, esc, money, unpaid, dues, isOverdue, validPhone,
    loggedIn, login, logout, toast, flash, flush, checkOverdue, page, connBadge, onChange: null,
    resetData() { state = defaults(); save(); },
    replaceState(s) { state = { ...defaults(), ...s }; save(); },
    toggleMonth(id, m) {
      const s = state.students.find((x) => x.id === id); if (!s) return;
      s.months[m] = !s.months[m];
      if (!isOverdue(s)) state.notified = state.notified.filter((x) => x !== id);
      save();
    },
    monthPills(s, clickable) {
      return `<div class="months">${MONTHS.map((m) => `<span class="m ${s.months[m] ? 'paid' : 'due'} ${clickable ? '' : 'static'}" ${clickable ? `data-id="${s.id}" data-m="${m}"` : ''}>${m}</span>`).join('')}</div>`;
    }
  };
})();
