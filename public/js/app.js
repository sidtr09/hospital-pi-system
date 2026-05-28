'use strict';

/* ════════════════════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const setText = (id, val) => { const e = $(id); if (e) e.textContent = val; };
const setHTML = (id, val) => { const e = $(id); if (e) e.innerHTML  = val; };
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
       + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}
const fmtDateOnly = iso => iso ? new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';

function badge(text, tone='gray') {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

/* ─── Toast ──────────────────────────────────────────── */
function toast(message, kind = 'success') {
  const host = $('toast-host');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  const ico = { success: '✓', error: '⚠', warning: '!', info: 'ℹ' }[kind] || '✓';
  el.innerHTML = `<div class="ico">${ico}</div><div class="body">${escapeHtml(message)}</div>`;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s, transform .2s';
    el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 200);
  }, 3000);
}

/* ─── Skeletons ──────────────────────────────────────── */
const skelLines = n => Array.from({length:n}, (_,i) =>
  `<div class="skel skel-line ${i % 2 ? 'med' : 'short'}"></div>`).join('');
const skelRows  = n => Array.from({length:n}, () =>
  `<div class="skel skel-row"></div>`).join('');

/* ════════════════════════════════════════════════════════════════
   SECTIONS — top-level icons + sub-pages
════════════════════════════════════════════════════════════════ */
const SECTIONS = {
  home: {
    icon: '🏠', title: 'Dashboard', sub: 'Overview',
    pages: [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    ],
  },
  patients: {
    icon: '👥', title: 'Patients', sub: 'Records & registration',
    pages: [
      { id: 'patient-search',   icon: '🔍', label: '[ Patient Search ]' },
      { id: 'patient-register', icon: '➕', label: '[ New Patient ]' },
    ],
  },
  clinical: {
    icon: '🩺', title: 'Clinical', sub: 'Triage & rosters',
    pages: [
      { id: 'triage-queue',  icon: '🚑', label: '[ Triage Queue ]' },
      { id: 'staff-roster',  icon: '👨‍⚕️', label: '[ Staff Roster ]' },
    ],
  },
  inventory: {
    icon: '📦', title: 'Inventory', sub: 'Pharmacy & supplies',
    pages: [
      { id: 'stock-ledger',  icon: '📋', label: '[ Stock Ledger ]' },
      { id: 'low-stock',     icon: '⚠️', label: '[ Low Stock ]' },
    ],
  },
  docs: {
    icon: '📚', title: 'Resources', sub: 'Clinical references',
    pages: [
      { id: 'doc-library',   icon: '📖', label: '[ Document Library ]' },
    ],
  },
};

const ROLE_ACCESS = {
  Administrator: ['home', 'patients', 'clinical', 'inventory', 'docs'],
  Doctor:        ['home', 'patients', 'clinical', 'docs'],
  Nurse:         ['home', 'patients', 'clinical', 'inventory'],
};

const PAGE_TO_SECTION = (() => {
  const m = {};
  for (const [secId, sec] of Object.entries(SECTIONS))
    for (const p of sec.pages) m[p.id] = secId;
  return m;
})();

let currentRole = null;
let currentUser = null;
let currentPage = null;
let currentSection = null;

/* ════════════════════════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════════════════════════ */
let _clockTimer = null;
function startClock() {
  if (_clockTimer) clearInterval(_clockTimer);
  const tick = () => {
    setText('clock', new Date().toLocaleTimeString('en-GB',
      { weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit' }));
  };
  tick(); _clockTimer = setInterval(tick, 30000);
}

/* ════════════════════════════════════════════════════════════════
   MODAL
════════════════════════════════════════════════════════════════ */
function openModal(title, html) {
  setText('modal-title', title);
  setHTML('modal-body', html);
  $('modal-overlay').classList.add('open');
}
function closeModal() { $('modal-overlay').classList.remove('open'); }
$('modal-close').onclick = closeModal;
$('modal-overlay').onclick = e => { if (e.target === $('modal-overlay')) closeModal(); };

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === '/' && $('app').style.display === 'block' &&
      document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault(); $('global-search-input')?.focus();
  }
});

/* ════════════════════════════════════════════════════════════════
   NAVIGATION (two-tier)
════════════════════════════════════════════════════════════════ */
function buildRail(role) {
  const allowed = ROLE_ACCESS[role] || [];
  $('rail-items').innerHTML = allowed.map(secId => {
    const sec = SECTIONS[secId];
    return `<div class="rail-item" data-section="${secId}" title="${sec.title}">
      ${sec.icon}<span class="rail-tip">${sec.title}</span>
    </div>`;
  }).join('');

  $('rail-items').querySelectorAll('.rail-item').forEach(el => {
    el.onclick = () => activateSection(el.dataset.section);
  });
}

function activateSection(secId, navigateFirst = true) {
  currentSection = secId;
  const sec = SECTIONS[secId];
  if (!sec) return;

  $('rail-items').querySelectorAll('.rail-item').forEach(el =>
    el.classList.toggle('active', el.dataset.section === secId));

  setText('section-title', sec.title);
  setText('section-sub',   sec.sub);

  $('section-items').innerHTML = sec.pages.map(p => `
    <div class="section-item" data-page="${p.id}">
      <span class="ico-circle">${p.icon}</span>${escapeHtml(p.label)}
    </div>`).join('');

  $('section-items').querySelectorAll('.section-item').forEach(el => {
    el.onclick = () => navigate(el.dataset.page);
  });

  if (navigateFirst) navigate(sec.pages[0].id);
}

const PAGES = {};
function navigate(pageId) {
  currentPage = pageId;
  const secId = PAGE_TO_SECTION[pageId];
  if (secId && secId !== currentSection) activateSection(secId, false);

  $('section-items').querySelectorAll('.section-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === pageId));

  const fn = PAGES[pageId];
  if (fn) fn($('main-content'));
  else $('main-content').innerHTML = `<div class="empty"><div class="icon">🚧</div><p>${escapeHtml(pageId)} — coming soon</p></div>`;
}

/* ════════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════════ */
async function tryLogin() {
  const u = $('username').value.trim();
  const p = $('password').value;
  setText('login-error', '');
  setText('login-btn', 'Signing in…');
  try {
    const { name, role } = await api('POST', '/auth/login', { username: u, password: p });
    currentRole = role; currentUser = name;

    document.body.className = `role-${role.toLowerCase()}`;
    const initial = (name||'?').charAt(0).toUpperCase();
    setText('user-name', name);
    setText('user-role', role);
    setText('rail-avatar', initial);
    setText('foot-avatar', initial);
    setText('top-avatar',  initial);

    buildRail(role);
    $('login-screen').style.display = 'none';
    $('app').style.display = 'block';
    startClock();
    setupGlobalSearch();
    activateSection('home');
    toast(`Welcome, ${name.split(' ')[0]}`, 'success');
  } catch (err) {
    setText('login-error', err.message);
  }
  setText('login-btn', 'Sign In');
}
$('login-btn').onclick = tryLogin;
$('password').onkeydown = e => { if (e.key === 'Enter') tryLogin(); };
$('logout-btn').onclick = async () => {
  await api('POST', '/auth/logout');
  document.body.className = '';
  currentRole = null; currentUser = null; currentSection = null; currentPage = null;
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
  $('username').value = ''; $('password').value = '';
};

/* Global search (top bar) — jumps to patient search */
function setupGlobalSearch() {
  const input = $('global-search-input');
  if (!input) return;
  const run = debounce(() => {
    const q = input.value.trim();
    if (!q) return;
    if (currentPage !== 'patient-search') navigate('patient-search');
    setTimeout(() => {
      const local = $('ps-input');
      if (local) { local.value = q; local.dispatchEvent(new Event('input')); }
    }, 60);
  }, 300);
  input.oninput = run;
  input.onkeydown = e => { if (e.key === 'Escape') input.blur(); };
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD — routed per role
════════════════════════════════════════════════════════════════ */
PAGES['dashboard'] = (el) => {
  if (currentRole === 'Doctor')      renderDoctorDashboard(el);
  else if (currentRole === 'Nurse')  renderNurseDashboard(el);
  else                                renderAdminDashboard(el);
};

/* ─── Helper: build an area chart from values ───────────────── */
function areaChart(values, opts={}) {
  const W = opts.width  || 700;
  const H = opts.height || 200;
  const padL = 36, padR = 8, padT = 10, padB = 24;
  if (!values.length || values.every(v => v === 0))
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <text x="${W/2}" y="${H/2}" text-anchor="middle" class="tick">No data yet</text></svg>`;
  const max = Math.max(...values, 1);
  const stepX = (W - padL - padR) / Math.max(values.length - 1, 1);
  const pts = values.map((v,i) => [padL + i*stepX, padT + (H - padT - padB) * (1 - v/max)]);
  const linePath = pts.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = `${linePath} L${pts[pts.length-1][0].toFixed(1)},${H-padB} L${pts[0][0].toFixed(1)},${H-padB} Z`;
  const gridY = [0.25, 0.5, 0.75, 1].map(f => padT + (H - padT - padB)*f);
  const gridX = (opts.xTicks || []).map((t,i) => ({ x: padL + i*((W-padL-padR)/(opts.xTicks.length-1||1)), t }));
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${gridY.map(y => `<line class="grid-line" x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"/>`).join('')}
    <text x="${padL-6}" y="${padT+4}" text-anchor="end" class="tick">${max}</text>
    <text x="${padL-6}" y="${H-padB+4}" text-anchor="end" class="tick">0</text>
    <path d="${areaPath}" class="area"/>
    <path d="${linePath}" class="line"/>
    ${gridX.map(g => `<text x="${g.x}" y="${H-6}" text-anchor="middle" class="tick">${g.t}</text>`).join('')}
  </svg>`;
}

/* ─── Helper: donut chart from [{label, value, color}] ──────── */
function donutChart(slices, size=120, thickness=14) {
  const total = slices.reduce((a,b) => a + b.value, 0);
  if (!total) return `<svg width="${size}" height="${size}" class="donut-svg"><circle cx="${size/2}" cy="${size/2}" r="${size/2-thickness}" fill="none" stroke="var(--border)" stroke-width="${thickness}"/></svg>`;
  const r = size/2 - thickness/2;
  const cx = size/2, cy = size/2;
  let offset = 0;
  const C = 2 * Math.PI * r;
  const arcs = slices.map(s => {
    const len = (s.value/total) * C;
    const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${s.color}" stroke-width="${thickness}"
      stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;
    return arc;
  }).join('');
  return `<svg width="${size}" height="${size}" class="donut-svg">${arcs}</svg>`;
}

/* ═══════════════════════════════════════════════════════════
   ADMIN DASHBOARD
═══════════════════════════════════════════════════════════ */
async function renderAdminDashboard(el) {
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Welcome, ${escapeHtml(currentUser?.split(' ')[0] || 'Admin')}</h1>
        <div class="sub">${today}</div>
      </div>
      <button class="pill-btn" onclick="navigate('dashboard')">📅 Today</button>
    </div>

    <div class="grid cols-7030 mb-4">
      <!-- Hero card: snapshot + chart -->
      <div class="card">
        <div class="card-body">
          <div class="hero-card">
            <div class="hero-head">
              <div>
                <div class="title">Today's Snapshot</div>
                <div class="sub">Live overview from the local database</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="navigate('dashboard')">↻ Refresh</button>
            </div>
            <div class="stat-tiles" id="ad-tiles">
              ${[
                ['gray',   'Total Patients'],
                ['orange', 'In Queue'],
                ['green',  'On Duty'],
                ['blue',   'Low Stock'],
              ].map(([tone,lbl]) => `
                <div class="stat-tile ${tone}">
                  <div class="lbl">${lbl}</div>
                  <div class="ring"></div>
                  <div class="val"><span class="skel skel-line" style="width:60%;height:24px;margin:0"></span></div>
                </div>`).join('')}
            </div>
            <div id="ad-chart">${skelRows(1)}</div>
          </div>
        </div>
      </div>

      <!-- Right column: users-style kpi card -->
      <div class="card">
        <div class="card-body kpi-card">
          <div class="top">
            <div>
              <div class="lbl">In Triage Queue</div>
              <div class="sub">All severity levels</div>
            </div>
            <div class="num" id="ad-queue-num">—</div>
          </div>
          <div id="ad-queue-bars" style="margin-bottom:14px">${skelRows(1)}</div>
          <div class="rank-list">
            <div class="rank-head"><span>Top Triage Levels</span><span>Patients</span></div>
            <div id="ad-queue-rank">${skelLines(4)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom row metric cards -->
    <div class="grid cols-4 mb-4">
      <div class="card metric-card">
        <div class="lbl-row"><div class="lbl">Patients Registered</div><div class="ico blue">👤</div></div>
        <div class="num" id="ad-m-pat">—</div>
        <div class="trend up" id="ad-m-pat-tr">—</div>
        <div class="meta">All time</div>
      </div>
      <div class="card metric-card">
        <div class="lbl-row"><div class="lbl">Inventory Items</div><div class="ico orange">📦</div></div>
        <div class="num" id="ad-m-inv">—</div>
        <div class="trend up" id="ad-m-inv-tr">—</div>
        <div class="meta">In ledger</div>
      </div>
      <div class="card metric-card">
        <div class="lbl-row"><div class="lbl">Active Cases</div><div class="ico violet">🚑</div></div>
        <div class="donut-wrap" style="margin-top:14px">
          <div id="ad-donut-tri"></div>
          <div class="donut-legend" id="ad-donut-legend"></div>
        </div>
      </div>
      <div class="card metric-card">
        <div class="lbl-row"><div class="lbl">Staff Mix</div><div class="ico green">👥</div></div>
        <div class="donut-wrap" style="margin-top:14px">
          <div id="ad-donut-staff"></div>
          <div class="donut-legend" id="ad-donut-staff-legend"></div>
        </div>
      </div>
    </div>

    <!-- System health -->
    <div class="card">
      <div class="card-head"><div><div class="title">🖥 System Health</div><div class="sub">Raspberry Pi resources</div></div></div>
      <div class="card-body" id="ad-health">${skelLines(2)}</div>
    </div>`;

  // Fetch in parallel
  const [pAll, q, ls, st, inv, h] = await Promise.allSettled([
    api('GET', '/patients?limit=9999'),
    api('GET', '/queue?status=waiting'),
    api('GET', '/inventory/alerts/low-stock'),
    api('GET', '/queue/roster'),
    api('GET', '/inventory?limit=9999'),
    fetch('/api/health').then(r => r.json()),
  ]);

  // Stat tiles
  const tiles = $('ad-tiles');
  if (tiles) {
    const counts = [
      pAll.status==='fulfilled' ? pAll.value.count ?? 0 : 0,
      q.status==='fulfilled' ? (q.value.data?.length ?? 0) : 0,
      st.status==='fulfilled' ? (st.value.data?.length ?? 0) : 0,
      ls.status==='fulfilled' ? (ls.value.alert_count ?? 0) : 0,
    ];
    tiles.querySelectorAll('.stat-tile').forEach((node, i) => {
      const v = node.querySelector('.val');
      if (v) v.textContent = counts[i].toLocaleString();
    });
  }

  // Chart: Patient registrations per day (last 14 days)
  if (pAll.status === 'fulfilled') {
    const series = lastNDays(14, (pAll.value.data || []).map(p => p.registered_at));
    setHTML('ad-chart', areaChart(series.values, { xTicks: series.ticks }));
    setText('ad-m-pat', (pAll.value.count ?? 0).toLocaleString());
    const todays = (pAll.value.data || []).filter(p => isToday(p.registered_at)).length;
    setText('ad-m-pat-tr', `+${todays} today`);
  }
  if (inv.status === 'fulfilled') {
    setText('ad-m-inv', (inv.value.data?.length ?? 0).toLocaleString());
    setText('ad-m-inv-tr', '↗ tracked');
  }

  // Queue widget
  if (q.status === 'fulfilled') {
    const rows = q.value.data || [];
    setText('ad-queue-num', rows.length);
    const byLevel = [1,2,3,4,5].map(L => rows.filter(r => r.triage_level === L).length);
    const maxLv = Math.max(...byLevel, 1);
    setHTML('ad-queue-bars', `<div class="bar-mini">
      ${byLevel.map((v,i) => `<div class="bar" style="height:${Math.max(4, (v/maxLv)*70)}px;background:${TRI_COLORS[i]}"></div>`).join('')}
    </div>`);
    const labels = ['T1 Immediate','T2 Emergent','T3 Urgent','T4 Semi-Urgent','T5 Non-Urgent'];
    setHTML('ad-queue-rank', byLevel.map((v,i) => `<div class="rank-row">
      <span class="nm"><span class="tri-num t${i+1}" style="margin-right:8px">T${i+1}</span>${labels[i]}</span>
      <span class="v">${v.toString().padStart(2,'0')}</span>
    </div>`).join(''));

    // Donut: triage mix
    const triSlices = byLevel.map((v,i) => ({ label:`T${i+1}`, value:v, color: TRI_COLORS[i] }))
      .filter(s => s.value > 0);
    setHTML('ad-donut-tri', donutChart(triSlices));
    setHTML('ad-donut-legend', triSlices.length
      ? triSlices.map(s => `<div class="lg-row"><span class="sw" style="background:${s.color}"></span>${s.label}: <strong>${s.value}</strong></div>`).join('')
      : '<div class="dim" style="font-size:12px">No active cases</div>');
  }

  // Donut: staff mix
  if (st.status === 'fulfilled') {
    const staff = st.value.data || [];
    const roles = {};
    staff.forEach(s => { roles[s.role] = (roles[s.role]||0) + 1; });
    const palette = ['#228be6','#12b886','#fd7e14','#be4bdb','#fa5252','#fab005'];
    const slices = Object.entries(roles).map(([k,v],i) => ({ label:k, value:v, color: palette[i%palette.length] }));
    setHTML('ad-donut-staff', donutChart(slices));
    setHTML('ad-donut-staff-legend', slices.length
      ? slices.map(s => `<div class="lg-row"><span class="sw" style="background:${s.color}"></span>${escapeHtml(s.label)}: <strong>${s.value}</strong></div>`).join('')
      : '<div class="dim" style="font-size:12px">No staff on duty</div>');
  }

  // Health
  if (h.status === 'fulfilled') {
    const v = h.value;
    setHTML('ad-health', `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px">
      ${[
        ['Status', v.status, 'color:var(--green-on);'],
        ['Uptime', `${Math.floor(v.uptime_s/3600)}h ${Math.floor((v.uptime_s%3600)/60)}m`, ''],
        ['RAM Used', `${v.memory.rss_mb} MB`, ''],
        ['Heap', `${v.memory.heap_used_mb}/${v.memory.heap_total_mb} MB`, ''],
        ['Database', v.db_status, v.db_status==='connected'?'color:var(--green-on);':'color:var(--red-on);'],
      ].map(([lbl,val,sty]) => `<div>
          <div style="font-size:11px;color:var(--dimmed);text-transform:uppercase;letter-spacing:.5px;font-weight:600">${lbl}</div>
          <div style="font-size:16px;font-weight:700;margin-top:4px;${sty}">${escapeHtml(String(val))}</div>
        </div>`).join('')}
    </div>`);
  }
}

const TRI_COLORS = ['#fa5252','#fd7e14','#fab005','#40c057','#adb5bd'];

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}
function lastNDays(n, isoList) {
  const buckets = new Array(n).fill(0);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayMs = today.getTime();
  const day = 24*3600*1000;
  isoList.forEach(iso => {
    if (!iso) return;
    const d = new Date(iso); d.setHours(0,0,0,0);
    const idx = n - 1 - Math.floor((todayMs - d.getTime())/day);
    if (idx >= 0 && idx < n) buckets[idx]++;
  });
  const ticks = [];
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n/6))) {
    const d = new Date(todayMs - (n-1-i)*day);
    ticks.push(d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
  }
  return { values: buckets, ticks };
}

/* ═══════════════════════════════════════════════════════════
   DOCTOR DASHBOARD
═══════════════════════════════════════════════════════════ */
async function renderDoctorDashboard(el) {
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Welcome, Dr. ${escapeHtml(currentUser?.split(' ').slice(-1)[0] || 'Doctor')}</h1>
        <div class="sub">${today}</div>
      </div>
      <button class="pill-btn" onclick="navigate('dashboard')">↻ Refresh</button>
    </div>
    <div class="grid cols-3 mb-4">
      ${[
        ['gray', 'In Queue', 'dd-waiting'],
        ['red',  'Critical (T1–T2)', 'dd-critical'],
        ['blue', 'Assigned to Me', 'dd-mine'],
      ].map(([tone,lbl,id]) => `<div class="stat-tile ${tone}" style="min-height:96px">
        <div class="lbl">${lbl}</div>
        <div class="ring"></div>
        <div class="val" id="${id}"><span class="skel skel-line" style="width:50%;height:24px;margin:0"></span></div>
      </div>`).join('')}
    </div>
    <div class="grid cols-6040 mb-4">
      <div class="card">
        <div class="card-head">
          <div><div class="title">🚑 Triage Priority Queue</div><div class="sub">Severity then arrival</div></div>
          <button class="btn btn-light btn-sm" onclick="showEnqueueModal(loadDoctorQueue)">+ Add</button>
        </div>
        <div id="dd-queue">${skelRows(5)}</div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="title">🔍 Quick Patient Lookup</div><div class="sub">Find any record</div></div></div>
        <div class="card-body" style="padding-top:0">
          <div class="filter-input" style="margin:0 0 12px">
            <input id="dd-lookup" placeholder="Search by name or reference…" autofocus>
          </div>
          <div id="dd-lookup-result"><div class="dim" style="font-size:12px">Type to find a patient — they'll appear here</div></div>
        </div>
      </div>
    </div>`;

  await loadDoctorQueue();

  const lookup = debounce(async () => {
    if (!$('dd-lookup') || !$('dd-lookup-result')) return;
    const q = $('dd-lookup').value.trim();
    if (!q) { setHTML('dd-lookup-result', '<div class="dim" style="font-size:12px">Type to find a patient — they\'ll appear here</div>'); return; }
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(q)}&limit=6`);
      setHTML('dd-lookup-result', data.length ? data.map(p => `
        <div class="recent-item" style="padding:10px 0;border-bottom:1px solid var(--border);justify-content:space-between">
          <div style="flex:1;min-width:0">
            <div class="nm ellipsis">${escapeHtml(p.full_name)}</div>
            <div class="mt">${escapeHtml(p.patient_ref)} · DOB ${escapeHtml(p.date_of_birth)}</div>
          </div>
          <button class="btn btn-xs btn-light" onclick="viewNotes(${p.id},'${escapeHtml(p.full_name).replace(/'/g,'&apos;')}')">📋 Notes</button>
        </div>`).join('')
        : '<div class="empty" style="padding:24px"><p>No patients found</p></div>');
    } catch(e) { setHTML('dd-lookup-result', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
  });
  $('dd-lookup').oninput = lookup;
}

async function loadDoctorQueue() {
  try {
    const { data } = await api('GET', '/queue?status=waiting');
    const mineCount = data.filter(r => r.assigned_to === currentUser).length;
    setText('dd-waiting', data.length);
    setText('dd-critical', data.filter(r => r.triage_level <= 2).length);
    setText('dd-mine', mineCount);

    setHTML('dd-queue', data.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Lvl</th><th>Patient</th><th>Complaint</th><th>Assigned</th><th></th></tr></thead>
      <tbody>${data.slice(0,8).map(r => `<tr class="tri-${r.triage_level} tri">
        <td><span class="tri-num t${r.triage_level}">T${r.triage_level}</span></td>
        <td>${escapeHtml(r.full_name||'—')}</td>
        <td class="ellipsis" style="max-width:140px">${escapeHtml(r.chief_complaint)}</td>
        <td>${r.assigned_to ? badge(r.assigned_to,'blue') : badge('Unassigned','gray')}</td>
        <td style="white-space:nowrap">
          ${r.assigned_to !== currentUser
            ? `<button class="btn btn-xs btn-light" onclick="assignToMe(${r.id})">Assign me</button>`
            : `<button class="btn btn-xs btn-subtle" onclick="resolveQueue(${r.id})">Done</button>`}
        </td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="icon">✅</div><p>Queue is clear</p></div>`);
  } catch(e) { toast(e.message, 'error'); }
}

window.assignToMe = async (id) => {
  try {
    await api('PATCH', `/queue/${id}`, { assigned_to: currentUser });
    toast('Case assigned to you', 'success');
    loadDoctorQueue();
  } catch(e) { toast(e.message, 'error'); }
};

/* ═══════════════════════════════════════════════════════════
   NURSE DASHBOARD
═══════════════════════════════════════════════════════════ */
async function renderNurseDashboard(el) {
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Welcome, ${escapeHtml(currentUser?.split(' ')[0] || 'Nurse')}</h1>
        <div class="sub">${today}</div>
      </div>
      <button class="pill-btn" onclick="navigate('dashboard')">↻ Refresh</button>
    </div>
    <div class="grid cols-3 mb-4">
      ${[
        ['violet', 'Queue Waiting', 'nd-waiting'],
        ['red',    'Low Stock', 'nd-stock'],
        ['green',  'On Duty',  'nd-staff'],
      ].map(([tone,lbl,id]) => `<div class="stat-tile ${tone}" style="min-height:96px">
        <div class="lbl">${lbl}</div>
        <div class="ring"></div>
        <div class="val" id="${id}"><span class="skel skel-line" style="width:50%;height:24px;margin:0"></span></div>
      </div>`).join('')}
    </div>
    <div class="grid cols-4060">
      <!-- Quick triage intake card -->
      <div class="card">
        <div class="card-head">
          <div><div class="title">➕ Quick Triage Intake</div><div class="sub">Patient → triage → submit</div></div>
        </div>
        <div class="card-body">
          <div class="form-group mb-3">
            <label>1. Patient Reference <span class="req">*</span></label>
            <div class="row" style="gap:6px">
              <input id="nd-ref" placeholder="e.g. PAT-001" style="flex:1;height:36px;padding:0 12px;border:1px solid var(--border-2);border-radius:var(--r-sm);outline:none">
              <button class="btn btn-outline btn-sm" id="nd-find-btn">Find</button>
            </div>
          </div>
          <div id="nd-patient-card" class="hidden" style="margin-bottom:12px;padding:10px 12px;background:var(--primary-light);border-radius:var(--r-sm);font-size:12px;border:1px solid var(--border)"></div>
          <div class="form-group mb-3">
            <label>2. Triage Level <span class="req">*</span></label>
            <select id="nd-level">
              <option value="1">T1 — Immediate</option>
              <option value="2">T2 — Emergent</option>
              <option value="3" selected>T3 — Urgent</option>
              <option value="4">T4 — Semi-Urgent</option>
              <option value="5">T5 — Non-Urgent</option>
            </select>
          </div>
          <div class="form-group mb-4">
            <label>3. Chief Complaint <span class="req">*</span></label>
            <textarea id="nd-complaint" rows="2" placeholder="What brings them in?"></textarea>
          </div>
          <button class="btn btn-filled" id="nd-submit" style="width:100%">Add to Triage Queue</button>
        </div>
      </div>
      <!-- Current queue preview -->
      <div class="card">
        <div class="card-head">
          <div><div class="title">🚑 Current Queue</div><div class="sub">Live</div></div>
          <button class="btn btn-subtle btn-sm" onclick="navigate('triage-queue')">View all →</button>
        </div>
        <div id="nd-queue">${skelRows(5)}</div>
      </div>
    </div>`;

  let foundId = null;

  $('nd-find-btn').onclick = async () => {
    const ref = $('nd-ref').value.trim();
    if (!ref) return;
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(ref)}&limit=1`);
      if (!data.length) {
        $('nd-patient-card').classList.add('hidden');
        foundId = null;
        toast('Patient not found — register them first', 'warning');
        return;
      }
      foundId = data[0].id;
      $('nd-patient-card').classList.remove('hidden');
      $('nd-patient-card').innerHTML = `<strong>${escapeHtml(data[0].full_name)}</strong>
        · ${escapeHtml(data[0].patient_ref)} · DOB ${escapeHtml(data[0].date_of_birth)}
        ${data[0].blood_group ? '· '+badge(data[0].blood_group,'red') : ''}`;
    } catch(e) { toast(e.message, 'error'); }
  };
  $('nd-ref').onkeydown = e => { if (e.key === 'Enter') $('nd-find-btn').click(); };

  $('nd-submit').onclick = async () => {
    if (!foundId) { toast('Find a patient first', 'warning'); return; }
    const complaint = $('nd-complaint').value.trim();
    if (!complaint) { toast('Enter the chief complaint', 'warning'); return; }
    try {
      await api('POST', '/queue', {
        patient_id: foundId, triage_level: +$('nd-level').value, chief_complaint: complaint,
      });
      toast('Patient added to triage queue', 'success');
      $('nd-ref').value = ''; $('nd-complaint').value = ''; $('nd-level').value = '3';
      $('nd-patient-card').classList.add('hidden');
      foundId = null;
      $('nd-ref').focus();
      loadNurseData();
    } catch(e) { toast(e.message, 'error'); }
  };

  await loadNurseData();
}

async function loadNurseData() {
  const [q, ls, st] = await Promise.allSettled([
    api('GET', '/queue?status=waiting'),
    api('GET', '/inventory/alerts/low-stock'),
    api('GET', '/queue/roster'),
  ]);
  if (q.status==='fulfilled') {
    const rows = q.value.data || [];
    setText('nd-waiting', rows.length);
    setHTML('nd-queue', rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Lvl</th><th>Patient</th><th>Complaint</th><th></th></tr></thead>
      <tbody>${rows.slice(0,7).map(r => `<tr class="tri-${r.triage_level} tri">
        <td><span class="tri-num t${r.triage_level}">T${r.triage_level}</span></td>
        <td>${escapeHtml(r.full_name||'—')}</td>
        <td class="ellipsis" style="max-width:140px">${escapeHtml(r.chief_complaint)}</td>
        <td><button class="btn btn-xs btn-subtle" onclick="resolveQueue(${r.id})">Done</button></td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="icon">✅</div><p>Queue is clear</p></div>`);
  }
  if (ls.status==='fulfilled') setText('nd-stock', ls.value.alert_count ?? 0);
  if (st.status==='fulfilled') setText('nd-staff', st.value.data?.length ?? 0);
}

/* ════════════════════════════════════════════════════════════════
   PATIENT SEARCH (live filter)
════════════════════════════════════════════════════════════════ */
PAGES['patient-search'] = async (el) => {
  const canRegister = ROLE_ACCESS[currentRole]?.includes('patients') &&
                      SECTIONS.patients.pages.some(p => p.id === 'patient-register');
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Patients</h1><div class="sub">Search by name or reference — results appear as you type</div></div>
      ${canRegister ? `<button class="btn btn-filled" onclick="navigate('patient-register')">+ New Patient</button>` : ''}
    </div>
    <div class="card">
      <div class="filter-row">
        <div class="filter-input"><input id="ps-input" placeholder="Start typing a name or reference…" autofocus></div>
      </div>
      <div id="ps-results">${skelRows(6)}</div>
    </div>`;

  const run = debounce(async () => {
    if (!$('ps-input')) return;
    const q = $('ps-input').value;
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(q)}&limit=50`);
      if (!data.length) {
        setHTML('ps-results', `<div class="empty">
          <div class="icon">👤</div>
          <p>No patients ${q ? 'match this search' : 'registered yet'}</p>
          ${canRegister ? `<button class="btn btn-filled btn-sm" onclick="navigate('patient-register')">+ Register First Patient</button>` : ''}
        </div>`);
        return;
      }
      setHTML('ps-results', `<div class="table-wrap"><table>
        <thead><tr><th>Reference</th><th>Name</th><th>DOB</th><th>Blood</th><th>Registered</th><th></th></tr></thead>
        <tbody>${data.map(p => `<tr>
          <td><span class="mono">${escapeHtml(p.patient_ref)}</span></td>
          <td><strong>${escapeHtml(p.full_name)}</strong></td>
          <td>${escapeHtml(p.date_of_birth)}</td>
          <td>${p.blood_group ? badge(p.blood_group,'red') : '<span class="dim">—</span>'}</td>
          <td class="dim">${fmt(p.registered_at)}</td>
          <td><button class="btn btn-xs btn-subtle" onclick="viewNotes(${p.id},'${escapeHtml(p.full_name).replace(/'/g,'&apos;')}')">📋 Notes</button></td>
        </tr>`).join('')}</tbody></table></div>`);
    } catch(e) { setHTML('ps-results', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
  });
  $('ps-input').oninput = run;
  run();
};

/* ════════════════════════════════════════════════════════════════
   CLINICAL NOTES MODAL
════════════════════════════════════════════════════════════════ */
window.viewNotes = async (id, name) => {
  openModal(`Clinical Notes — ${name}`, skelLines(4));
  try {
    const { data } = await api('GET', `/patients/${id}/notes`);
    const notesHtml = data.length
      ? data.map(n => `
        <div style="border-left:3px solid var(--primary);padding:10px 12px;margin-bottom:10px;background:var(--surface-2);border-radius:0 var(--r-sm) var(--r-sm) 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-weight:600;font-size:12px">${escapeHtml(n.authored_by)}</span>
            <span style="font-size:11px;color:var(--dimmed)">${fmt(n.created_at)}</span>
          </div>
          ${badge(n.note_type,'teal')}
          <p style="margin-top:7px;font-size:13px;line-height:1.5">${escapeHtml(n.body)}</p>
        </div>`).join('')
      : `<div class="empty" style="padding:24px"><p>No clinical notes on file yet</p></div>`;
    const canWrite = currentRole === 'Doctor' || currentRole === 'Administrator';
    const addForm = canWrite ? `
      <hr class="divider">
      <div style="font-weight:600;font-size:13px;margin-bottom:10px">Add note</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Authored by</label>
          <input id="note-author" value="${escapeHtml(currentUser||'')}">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select id="note-type">
            <option value="progress">Progress</option>
            <option value="admission">Admission</option>
            <option value="discharge">Discharge</option>
            <option value="procedure">Procedure</option>
          </select>
        </div>
        <div class="form-group full">
          <label>Note</label>
          <textarea id="note-body" rows="3" placeholder="Clinical note…"></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-filled" id="save-note">Save Note</button>
      </div>` : '';
    setHTML('modal-body', notesHtml + addForm);
    if (canWrite) {
      $('save-note').onclick = async () => {
        const body = $('note-body').value.trim();
        if (!body) { toast('Note cannot be empty', 'warning'); return; }
        try {
          await api('POST', `/patients/${id}/notes`, {
            authored_by: $('note-author').value, note_type: $('note-type').value, body,
          });
          toast('Note saved', 'success');
          viewNotes(id, name);
        } catch(e) { toast(e.message, 'error'); }
      };
    }
  } catch(e) { setHTML('modal-body', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
};

/* ════════════════════════════════════════════════════════════════
   PATIENT REGISTRATION (Save & Add Another)
════════════════════════════════════════════════════════════════ */
PAGES['patient-register'] = (el) => {
  const newRef = () => `PAT-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`;
  el.innerHTML = `
    <div class="page-header">
      <div><h1>New Patient</h1><div class="sub">Tab through fields, press Enter to save and add the next</div></div>
      <button class="btn btn-outline" onclick="navigate('patient-search')">← Back to search</button>
    </div>
    <div class="grid cols-6040">
      <div class="card">
        <div class="card-head"><div><div class="title">Patient Details</div><div class="sub">* required</div></div></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Patient Reference <span class="req">*</span></label>
              <input id="r-ref" value="${newRef()}" placeholder="PAT-2024-001">
              <span class="hint">Auto-generated — edit if your clinic uses a different scheme</span>
            </div>
            <div class="form-group">
              <label>Full Name <span class="req">*</span></label>
              <input id="r-name" placeholder="Full legal name" autofocus>
            </div>
            <div class="form-group">
              <label>Date of Birth <span class="req">*</span></label>
              <input id="r-dob" type="date">
            </div>
            <div class="form-group">
              <label>Sex</label>
              <select id="r-sex">
                <option value="">— Select —</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Blood Group</label>
              <select id="r-blood">
                <option value="">— Unknown —</option>
                <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
              </select>
            </div>
            <div class="form-group">
              <label>Contact Number</label>
              <input id="r-contact" placeholder="Phone number">
            </div>
            <div class="form-group full">
              <label>Address</label>
              <input id="r-address" placeholder="Full address">
            </div>
            <div class="form-group full">
              <label>Known Allergies</label>
              <textarea id="r-allergy" rows="2" placeholder="e.g. Penicillin, peanuts — or 'None known'"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-subtle" id="r-cancel">Clear</button>
            <button class="btn btn-outline" id="r-save-only">Save</button>
            <button class="btn btn-filled" id="r-save-next">Save &amp; Add Another</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><div class="title">📋 Recently Added</div><div class="sub">Today</div></div></div>
        <div id="r-recent">${skelLines(4)}</div>
      </div>
    </div>`;

  const fields = () => ({
    patient_ref:    $('r-ref').value.trim(),
    full_name:      $('r-name').value.trim(),
    date_of_birth:  $('r-dob').value,
    sex:            $('r-sex').value,
    blood_group:    $('r-blood').value,
    contact_number: $('r-contact').value,
    address:        $('r-address').value,
    allergy_notes:  $('r-allergy').value,
  });
  const clearForm = (newRefAgain = true) => {
    ['r-name','r-dob','r-contact','r-address','r-allergy'].forEach(id => $(id).value = '');
    $('r-sex').value = ''; $('r-blood').value = '';
    if (newRefAgain) $('r-ref').value = newRef();
    $('r-name').focus();
  };
  const save = async (andAnother) => {
    const f = fields();
    if (!f.patient_ref || !f.full_name || !f.date_of_birth) {
      toast('Reference, Name and DOB are required', 'warning'); return;
    }
    try {
      await api('POST', '/patients', f);
      toast(`Saved: ${f.full_name}`, 'success');
      await loadRecent();
      if (andAnother) clearForm(true);
      else navigate('patient-search');
    } catch(e) { toast(e.message, 'error'); }
  };
  $('r-cancel').onclick    = () => clearForm(true);
  $('r-save-only').onclick = () => save(false);
  $('r-save-next').onclick = () => save(true);

  async function loadRecent() {
    try {
      const { data } = await api('GET', '/patients?limit=6');
      setHTML('r-recent', data.length ? `<div class="recent-list">${data.map(p => `<div class="recent-item">
        <div>
          <div class="nm">${escapeHtml(p.full_name)}</div>
          <div class="mt">${escapeHtml(p.patient_ref)} · ${fmt(p.registered_at)}</div>
        </div>
      </div>`).join('')}</div>` : `<div class="empty" style="padding:24px"><p>No registrations yet</p></div>`);
    } catch(e) { /* silent */ }
  }
  loadRecent();
};

/* ════════════════════════════════════════════════════════════════
   STOCK LEDGER (live filter)
════════════════════════════════════════════════════════════════ */
PAGES['stock-ledger'] = async (el) => {
  const isAdmin = currentRole === 'Administrator';
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Stock Ledger</h1><div class="sub">Medicines, supplies and equipment</div></div>
      ${isAdmin ? `<button class="btn btn-filled" id="btn-add-item">+ Add Item</button>` : ''}
    </div>
    <div class="card">
      <div class="filter-row">
        <div class="filter-input"><input id="inv-q" placeholder="Filter by name or code…"></div>
        <select id="inv-cat" style="height:36px;padding:0 12px;border:1px solid var(--border-2);border-radius:var(--r-sm);outline:none;background:var(--surface);font-size:13px">
          <option value="">All categories</option>
          <option value="medicine">Medicine</option>
          <option value="supply">Supply</option>
          <option value="equipment">Equipment</option>
          <option value="consumable">Consumable</option>
        </select>
      </div>
      <div id="inv-table">${skelRows(6)}</div>
    </div>`;

  let allItems = [];
  const renderTable = (items) => {
    if (!items.length) {
      setHTML('inv-table', `<div class="empty">
        <div class="icon">📦</div>
        <p>No items found</p>
        ${isAdmin ? `<button class="btn btn-filled btn-sm" onclick="document.getElementById('btn-add-item').click()">+ Add First Item</button>` : ''}
      </div>`);
      return;
    }
    setHTML('inv-table', `<div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>On hand</th><th>Unit</th><th>Reorder at</th><th>Location</th><th>Expiry</th><th></th></tr></thead>
      <tbody>${items.map(i => {
        const low = i.quantity_on_hand <= i.reorder_threshold;
        return `<tr>
          <td><span class="mono">${escapeHtml(i.item_code)}</span></td>
          <td><strong>${escapeHtml(i.item_name)}</strong></td>
          <td>${badge(i.category,'teal')}</td>
          <td>${badge(i.quantity_on_hand, low ? 'red' : 'green')}</td>
          <td class="dim">${escapeHtml(i.unit)}</td>
          <td class="dim">${i.reorder_threshold}</td>
          <td class="dim">${escapeHtml(i.location||'—')}</td>
          <td class="dim">${i.expiry_date ? fmtDateOnly(i.expiry_date) : '—'}</td>
          <td><button class="btn btn-xs btn-subtle" onclick="openTxnModal(${i.id},'${escapeHtml(i.item_name).replace(/'/g,'&apos;')}',reloadInventory)">Transact</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`);
  };

  window.reloadInventory = async () => {
    const cat = $('inv-cat').value;
    try {
      const { data } = await api('GET', `/inventory${cat ? `?category=${cat}` : ''}`);
      allItems = data;
      filterAndRender();
    } catch(e) { setHTML('inv-table', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
  };
  const filterAndRender = () => {
    const q = ($('inv-q')?.value || '').toLowerCase().trim();
    const items = q
      ? allItems.filter(i => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q))
      : allItems;
    renderTable(items);
  };
  $('inv-q').oninput = debounce(filterAndRender, 200);
  $('inv-cat').onchange = reloadInventory;
  reloadInventory();

  if (isAdmin) $('btn-add-item').onclick = () => openAddItemModal(reloadInventory);
};

function openAddItemModal(onSaved) {
  openModal('Add Inventory Item', `
    <div class="form-grid">
      <div class="form-group"><label>Item Code <span class="req">*</span></label><input id="ni-code" placeholder="MED-001"></div>
      <div class="form-group"><label>Item Name <span class="req">*</span></label><input id="ni-name" placeholder="Paracetamol 500mg"></div>
      <div class="form-group"><label>Category <span class="req">*</span></label>
        <select id="ni-cat"><option value="medicine">Medicine</option><option value="supply">Supply</option><option value="equipment">Equipment</option><option value="consumable">Consumable</option></select>
      </div>
      <div class="form-group"><label>Unit <span class="req">*</span></label><input id="ni-unit" placeholder="tablet / vial / box"></div>
      <div class="form-group"><label>Initial Quantity</label><input id="ni-qty" type="number" value="0" min="0"></div>
      <div class="form-group"><label>Reorder At</label><input id="ni-reorder" type="number" value="10" min="0"></div>
      <div class="form-group"><label>Location</label><input id="ni-loc" placeholder="Ward A / Shelf 3"></div>
      <div class="form-group"><label>Expiry Date</label><input id="ni-expiry" type="date"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-subtle" onclick="closeModal()">Cancel</button>
      <button class="btn btn-filled" id="save-item">Add Item</button>
    </div>`);
  $('save-item').onclick = async () => {
    try {
      await api('POST', '/inventory', {
        item_code: $('ni-code').value, item_name: $('ni-name').value,
        category:  $('ni-cat').value,  unit: $('ni-unit').value,
        quantity_on_hand:  +$('ni-qty').value,
        reorder_threshold: +$('ni-reorder').value,
        location: $('ni-loc').value, expiry_date: $('ni-expiry').value || null,
      });
      toast('Item added', 'success'); closeModal(); onSaved?.();
    } catch(e) { toast(e.message, 'error'); }
  };
}

window.openTxnModal = (id, name, onSaved) => {
  openModal(`Record Transaction — ${name}`, `
    <div class="form-grid">
      <div class="form-group"><label>Type <span class="req">*</span></label>
        <select id="txn-type">
          <option value="restock">Restock (+)</option>
          <option value="dispense">Dispense (−)</option>
          <option value="adjustment">Adjustment</option>
          <option value="expired">Mark Expired (−)</option>
        </select>
      </div>
      <div class="form-group"><label>Quantity <span class="req">*</span></label><input id="txn-qty" type="number" min="1" value="1"></div>
      <div class="form-group full"><label>Performed by <span class="req">*</span></label><input id="txn-by" value="${escapeHtml(currentUser||'')}"></div>
      <div class="form-group full"><label>Notes</label><input id="txn-notes" placeholder="Optional"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-subtle" onclick="closeModal()">Cancel</button>
      <button class="btn btn-filled" id="save-txn">Record</button>
    </div>`);
  $('save-txn').onclick = async () => {
    const type = $('txn-type').value;
    const rawQty = +$('txn-qty').value;
    const delta = (type === 'dispense' || type === 'expired') ? -rawQty : rawQty;
    try {
      await api('POST', `/inventory/${id}/transactions`, {
        txn_type: type, quantity_delta: delta,
        performed_by: $('txn-by').value, notes: $('txn-notes').value,
      });
      toast('Transaction recorded', 'success'); closeModal(); onSaved?.();
    } catch(e) { toast(e.message, 'error'); }
  };
};

/* ════════════════════════════════════════════════════════════════
   LOW STOCK
════════════════════════════════════════════════════════════════ */
PAGES['low-stock'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Low Stock</h1><div class="sub">Items at or below reorder threshold</div></div>
      <button class="btn btn-outline btn-sm" onclick="navigate('low-stock')">↻ Refresh</button>
    </div>
    <div id="ls-content">${skelRows(6)}</div>`;
  try {
    const { data, alert_count } = await api('GET', '/inventory/alerts/low-stock');
    if (!data.length) {
      setHTML('ls-content', `<div class="card"><div class="empty">
        <div class="icon">✅</div><p>All stock levels are above their threshold</p>
      </div></div>`);
      return;
    }
    setHTML('ls-content', `
      <div class="alert alert-warn">⚠️ ${alert_count} item${alert_count!==1?'s':''} need restocking</div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>On hand</th><th>Threshold</th><th>Deficit</th><th>Location</th></tr></thead>
        <tbody>${data.map(i => `<tr>
          <td><span class="mono">${escapeHtml(i.item_code)}</span></td>
          <td><strong>${escapeHtml(i.item_name)}</strong></td>
          <td>${badge(i.category,'teal')}</td>
          <td>${badge(i.quantity_on_hand,'red')}</td>
          <td>${i.reorder_threshold}</td>
          <td>${badge(i.reorder_threshold - i.quantity_on_hand,'orange')}</td>
          <td class="dim">${escapeHtml(i.location||'—')}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`);
  } catch(e) { setHTML('ls-content', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
};

/* ════════════════════════════════════════════════════════════════
   TRIAGE QUEUE
════════════════════════════════════════════════════════════════ */
PAGES['triage-queue'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Triage Queue</h1><div class="sub">Sorted by severity, then arrival time</div></div>
      <div class="page-actions">
        <button class="btn btn-outline btn-sm" onclick="navigate('triage-queue')">↻ Refresh</button>
        <button class="btn btn-filled" onclick="showEnqueueModal(()=>navigate('triage-queue'))">+ Add to Queue</button>
      </div>
    </div>
    <div id="tq-content">${skelRows(6)}</div>`;
  await loadFullQueue();
};

async function loadFullQueue() {
  const el = $('tq-content');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue?status=waiting');
    if (!data.length) {
      el.innerHTML = `<div class="card"><div class="empty">
        <div class="icon">🚑</div><p>No patients in queue</p>
        <button class="btn btn-filled btn-sm" onclick="showEnqueueModal(()=>navigate('triage-queue'))">+ Add First Patient</button>
      </div></div>`;
      return;
    }
    const labels = { 1:'Immediate', 2:'Emergent', 3:'Urgent', 4:'Semi-Urgent', 5:'Non-Urgent' };
    el.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Triage</th><th>Patient</th><th>Complaint</th><th>Assigned</th><th>Queued</th><th></th></tr></thead>
      <tbody>${data.map(r => `<tr class="tri-${r.triage_level} tri">
        <td>
          <span class="tri-num t${r.triage_level}">T${r.triage_level}</span>
          <div style="font-size:10px;color:var(--dimmed);margin-top:3px">${labels[r.triage_level]}</div>
        </td>
        <td><strong>${escapeHtml(r.full_name||'—')}</strong>
          <div style="font-size:11px;color:var(--dimmed)">${escapeHtml(r.patient_ref||'')}</div></td>
        <td>${escapeHtml(r.chief_complaint)}</td>
        <td>${r.assigned_to ? badge(r.assigned_to,'blue') : badge('Unassigned','gray')}</td>
        <td class="dim" style="font-size:11px">${fmt(r.queued_at)}</td>
        <td><button class="btn btn-xs btn-light" onclick="resolveQueue(${r.id})">Mark Done</button></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;
  } catch(e) { el.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`; }
}

window.resolveQueue = async (id) => {
  try {
    await api('PATCH', `/queue/${id}`, { status: 'completed' });
    toast('Marked as done', 'success');
    if (currentPage === 'dashboard') {
      if (currentRole === 'Doctor')      loadDoctorQueue();
      else if (currentRole === 'Nurse')  loadNurseData();
      else                                navigate('dashboard');
    } else navigate('triage-queue');
  } catch(e) { toast(e.message, 'error'); }
};

window.showEnqueueModal = (onSuccess) => {
  openModal('Add to Triage Queue', `
    <div class="form-grid">
      <div class="form-group full"><label>Patient Reference <span class="req">*</span></label>
        <input id="eq-ref" placeholder="e.g. PAT-2024-001">
      </div>
      <div class="form-group"><label>Triage Level <span class="req">*</span></label>
        <select id="eq-level">
          <option value="1">T1 — Immediate</option>
          <option value="2">T2 — Emergent</option>
          <option value="3" selected>T3 — Urgent</option>
          <option value="4">T4 — Semi-Urgent</option>
          <option value="5">T5 — Non-Urgent</option>
        </select>
      </div>
      <div class="form-group"><label>Assign to</label>
        <input id="eq-assign" placeholder="Doctor / Nurse name" value="${currentRole==='Doctor' ? escapeHtml(currentUser||'') : ''}">
      </div>
      <div class="form-group full"><label>Chief Complaint <span class="req">*</span></label>
        <textarea id="eq-complaint" rows="2" placeholder="Presenting complaint…"></textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-subtle" onclick="closeModal()">Cancel</button>
      <button class="btn btn-filled" id="eq-save">Add</button>
    </div>`);
  $('eq-save').onclick = async () => {
    const ref = $('eq-ref').value.trim();
    if (!ref) { toast('Enter a patient reference', 'warning'); return; }
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(ref)}&limit=1`);
      if (!data.length) { toast('No patient with that reference', 'warning'); return; }
      await api('POST', '/queue', {
        patient_id:      data[0].id,
        triage_level:    +$('eq-level').value,
        chief_complaint: $('eq-complaint').value,
        assigned_to:     $('eq-assign').value || null,
      });
      toast('Added to queue', 'success'); closeModal(); onSuccess?.();
    } catch(e) { toast(e.message, 'error'); }
  };
};

/* ════════════════════════════════════════════════════════════════
   STAFF ROSTER
════════════════════════════════════════════════════════════════ */
PAGES['staff-roster'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Staff Roster</h1><div class="sub">Currently on-duty clinical staff</div></div>
      <button class="btn btn-filled" id="add-shift">+ Add Shift</button>
    </div>
    <div id="roster">${skelRows(5)}</div>`;
  $('add-shift').onclick = () => showAddShiftModal(loadRosterPage);
  loadRosterPage();
};

async function loadRosterPage() {
  const el = $('roster');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue/roster');
    if (!data.length) {
      el.innerHTML = `<div class="card"><div class="empty">
        <div class="icon">👥</div><p>No staff currently on duty</p>
        <button class="btn btn-filled btn-sm" onclick="showAddShiftModal(loadRosterPage)">+ Add First Shift</button>
      </div></div>`;
      return;
    }
    el.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Ward</th><th>Shift Start</th><th>Shift End</th></tr></thead>
      <tbody>${data.map(s => `<tr>
        <td><strong>${escapeHtml(s.staff_name)}</strong></td>
        <td>${badge(s.role,'teal')}</td>
        <td class="dim">${escapeHtml(s.ward||'—')}</td>
        <td>${fmt(s.shift_start)}</td>
        <td>${fmt(s.shift_end)}</td>
      </tr>`).join('')}</tbody></table></div></div>`;
  } catch(e) { el.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`; }
}

window.showAddShiftModal = (onSuccess) => {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const end = new Date(now.getTime() + 8*3600*1000);
  const endLocal = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
  openModal('Add Staff Shift', `
    <div class="form-grid">
      <div class="form-group"><label>Staff Name <span class="req">*</span></label><input id="sr-name" placeholder="Full name" value="${currentRole!=='Administrator' ? escapeHtml(currentUser||'') : ''}"></div>
      <div class="form-group"><label>Role <span class="req">*</span></label>
        <select id="sr-role">
          <option value="doctor">Doctor</option>
          <option value="nurse" ${currentRole==='Nurse'?'selected':''}>Nurse</option>
          <option value="technician">Technician</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="form-group"><label>Shift Start <span class="req">*</span></label><input id="sr-start" type="datetime-local" value="${local}"></div>
      <div class="form-group"><label>Shift End <span class="req">*</span></label><input id="sr-end" type="datetime-local" value="${endLocal}"></div>
      <div class="form-group full"><label>Ward</label><input id="sr-ward" placeholder="Ward / Department"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-subtle" onclick="closeModal()">Cancel</button>
      <button class="btn btn-filled" id="sr-save">Add to Roster</button>
    </div>`);
  $('sr-save').onclick = async () => {
    try {
      await api('POST', '/queue/roster', {
        staff_name:  $('sr-name').value, role: $('sr-role').value,
        shift_start: new Date($('sr-start').value).toISOString(),
        shift_end:   new Date($('sr-end').value).toISOString(),
        ward:        $('sr-ward').value,
      });
      toast('Shift added', 'success'); closeModal(); onSuccess?.();
    } catch(e) { toast(e.message, 'error'); }
  };
};

/* ════════════════════════════════════════════════════════════════
   DOCUMENT LIBRARY
════════════════════════════════════════════════════════════════ */
PAGES['doc-library'] = (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Document Library</h1><div class="sub">Offline clinical guidelines, SOPs and calculators</div></div>
    </div>
    <div class="card mb-4">
      <div class="card-body">
        <div class="alert alert-info">📚 Documents are stored locally on the Pi. Load guidelines via <code>POST /api/documents</code>.</div>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:16px">
          ${[
            ['📋','Clinical Guidelines','Standard treatment protocols','blue'],
            ['💊','Drug References','Dosage and interactions','teal'],
            ['🔬','Lab Reference','Normal value ranges','green'],
            ['🧮','Calculator','BMI, GFR, drug dose','violet'],
            ['📄','SOPs','Standard operating procedures','orange'],
            ['🩺','Triage Protocols','Emergency decision guides','red'],
          ].map(([i,t,d,c]) => `<div class="card metric-card" style="cursor:pointer">
            <div class="lbl-row"><div class="lbl">${escapeHtml(t)}</div><div class="ico ${c}">${i}</div></div>
            <div class="meta" style="margin-top:8px">${escapeHtml(d)}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
};
