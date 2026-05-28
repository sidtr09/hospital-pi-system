'use strict';

/* ════════════════════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
       + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}

function badge(text, type) { return `<span class="badge badge-${type}">${text}</span>`; }

/* ════════════════════════════════════════════════════════════════
   ROLE CONFIGURATION
════════════════════════════════════════════════════════════════ */
const ROLE_CONFIG = {
  Administrator: {
    bodyClass: 'role-admin',
    pill: 'Admin',
    nav: [
      { section: 'Overview' },
      { page: 'dashboard',        icon: '📊', label: 'Dashboard' },
      { section: '[ Patient Module ]' },
      { page: 'patient-search',   icon: '🔍', label: '[ Patient Search ]' },
      { page: 'patient-register', icon: '➕', label: '[ Registration Form ]' },
      { section: '[ Inventory Module ]' },
      { page: 'stock-ledger',     icon: '📦', label: '[ Stock Ledger ]' },
      { page: 'low-stock',        icon: '⚠️', label: '[ Low Stock Alerts ]' },
      { section: '[ Queue Module ]' },
      { page: 'triage-queue',     icon: '🚑', label: '[ Triage Queue ]' },
      { page: 'staff-roster',     icon: '👥', label: '[ Staff Roster ]' },
      { section: '[ Docs Module ]' },
      { page: 'doc-library',      icon: '📚', label: '[ Document Library ]' },
    ],
  },
  Doctor: {
    bodyClass: 'role-doctor',
    pill: 'Doctor',
    nav: [
      { section: 'Overview' },
      { page: 'dashboard',      icon: '📊', label: 'Dashboard' },
      { section: '[ Patient Module ]' },
      { page: 'patient-search', icon: '🔍', label: '[ Patient Search ]' },
      { section: '[ Queue Module ]' },
      { page: 'triage-queue',   icon: '🚑', label: '[ Triage Queue ]' },
      { section: '[ Docs Module ]' },
      { page: 'doc-library',    icon: '📚', label: '[ Document Library ]' },
    ],
  },
  Nurse: {
    bodyClass: 'role-nurse',
    pill: 'Nurse',
    nav: [
      { section: 'Overview' },
      { page: 'dashboard',        icon: '📊', label: 'Dashboard' },
      { section: '[ Patient Module ]' },
      { page: 'patient-register', icon: '➕', label: '[ Registration Form ]' },
      { section: '[ Queue Module ]' },
      { page: 'triage-queue',     icon: '🚑', label: '[ Triage Queue ]' },
      { page: 'staff-roster',     icon: '👥', label: '[ Staff Roster ]' },
      { section: '[ Inventory Module ]' },
      { page: 'stock-ledger',     icon: '📦', label: '[ Stock Ledger ]' },
    ],
  },
};

let currentRole = null;
let currentPage = null;

/* ════════════════════════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════════════════════════ */
function startClock() {
  const el = $('clock');
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-GB',
      { weekday:'short', day:'2-digit', month:'short',
        hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  tick(); setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════════════════
   MODAL
════════════════════════════════════════════════════════════════ */
function openModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal-overlay').classList.add('open');
}
function closeModal() { $('modal-overlay').classList.remove('open'); }
$('modal-close').onclick = closeModal;
$('modal-overlay').onclick = e => { if (e.target === $('modal-overlay')) closeModal(); };

/* ════════════════════════════════════════════════════════════════
   SIDEBAR BUILD
════════════════════════════════════════════════════════════════ */
function buildSidebar(role) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return;
  const sidebar = $('sidebar');
  sidebar.innerHTML = cfg.nav.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item" data-page="${item.page}">
      <span class="icon">${item.icon}</span>${item.label}
    </div>`;
  }).join('');

  sidebar.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = () => navigate(el.dataset.page);
  });
}

/* ════════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════════ */
function navigate(page) {
  currentPage = page;
  $('sidebar').querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
  const render = PAGES[page];
  if (render) render($('main-content'));
  else $('main-content').innerHTML =
    `<div class="empty-state"><div class="icon">🚧</div><p>${page} — coming soon</p></div>`;
}

/* ════════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════════ */
async function tryLogin() {
  const u = $('username').value.trim();
  const p = $('password').value;
  $('login-error').textContent = '';
  $('login-btn').textContent = 'Signing in…';
  try {
    const { name, role } = await api('POST', '/auth/login', { username: u, password: p });
    currentRole = role;
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.Administrator;

    // Apply role theme
    document.body.className = cfg.bodyClass;

    // Update navbar
    $('user-name').textContent = name;
    $('role-pill').textContent = cfg.pill;
    $('role-pill').className   = `role-pill ${cfg.bodyClass.replace('role-','')}`;

    // Build sidebar and show app
    buildSidebar(role);
    $('login-screen').style.display = 'none';
    $('app').style.display = 'block';
    startClock();
    navigate('dashboard');
  } catch (err) {
    $('login-error').textContent = err.message;
  }
  $('login-btn').textContent = 'Sign In';
}

$('login-btn').onclick = tryLogin;
$('password').onkeydown = e => { if (e.key === 'Enter') tryLogin(); };
$('logout-btn').onclick = async () => {
  await api('POST', '/auth/logout');
  document.body.className = '';
  currentRole = null;
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
  $('username').value = ''; $('password').value = '';
};

/* ════════════════════════════════════════════════════════════════
   PAGES REGISTRY
════════════════════════════════════════════════════════════════ */
const PAGES = {};

/* ────────────────────────────────────────────────────────────────
   DASHBOARD — routes to role-specific renderer
──────────────────────────────────────────────────────────────── */
PAGES['dashboard'] = (el) => {
  if (currentRole === 'Doctor')    renderDoctorDashboard(el);
  else if (currentRole === 'Nurse') renderNurseDashboard(el);
  else                              renderAdminDashboard(el);
};

/* ════════════════════════════════════════════════════════════════
   ADMIN DASHBOARD
════════════════════════════════════════════════════════════════ */
async function renderAdminDashboard(el) {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>Admin Dashboard</h2><p>System overview — all modules</p></div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('dashboard')">↻ Refresh</button>
    </div>
    <div class="stat-grid" id="a-stats">
      <div class="stat-card"><div class="stat-icon blue">👤</div><div><div class="stat-value" id="a-patients">—</div><div class="stat-label">Total Patients</div></div></div>
      <div class="stat-card"><div class="stat-icon orange">🚑</div><div><div class="stat-value" id="a-queue">—</div><div class="stat-label">In Triage Queue</div></div></div>
      <div class="stat-card"><div class="stat-icon red">⚠️</div><div><div class="stat-value" id="a-lowstock">—</div><div class="stat-label">Low Stock Alerts</div></div></div>
      <div class="stat-card"><div class="stat-icon green">👥</div><div><div class="stat-value" id="a-staff">—</div><div class="stat-label">Staff On Duty</div></div></div>
    </div>
    <div class="col-6040" style="margin-bottom:16px">
      <div class="card">
        <div class="card-header"><h3>🚑 Active Triage Queue</h3>
          <button class="btn btn-ghost btn-xs" onclick="navigate('triage-queue')">View all →</button>
        </div>
        <div id="a-queue-preview"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>⚠️ Low Stock</h3>
          <button class="btn btn-ghost btn-xs" onclick="navigate('low-stock')">View all →</button>
        </div>
        <div id="a-stock-preview"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>🖥️ System Health</h3></div>
      <div class="card-body" id="a-health">Loading…</div>
    </div>`;

  const [patients, queue, lowStock, staff, health] = await Promise.allSettled([
    api('GET', '/patients?limit=9999'),
    api('GET', '/queue?status=waiting'),
    api('GET', '/inventory/alerts/low-stock'),
    api('GET', '/queue/roster'),
    fetch('/api/health').then(r => r.json()),
  ]);

  if (patients.status === 'fulfilled') $('a-patients').textContent = patients.value.count ?? 0;
  if (queue.status === 'fulfilled') {
    $('a-queue').textContent = queue.value.data?.length ?? 0;
    const rows = queue.value.data || [];
    $('a-queue-preview').innerHTML = rows.length
      ? `<table><thead><tr><th>Level</th><th>Patient</th><th>Complaint</th></tr></thead><tbody>
          ${rows.slice(0,5).map(r => `<tr class="triage-${r.triage_level}">
            <td><strong>T${r.triage_level}</strong></td>
            <td>${r.full_name||'—'}</td>
            <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.chief_complaint}</td>
          </tr>`).join('')}</tbody></table>`
      : '<div class="empty-state" style="padding:20px"><p>Queue is clear</p></div>';
  }
  if (lowStock.status === 'fulfilled') {
    $('a-lowstock').textContent = lowStock.value.alert_count ?? 0;
    const items = lowStock.value.data || [];
    $('a-stock-preview').innerHTML = items.length
      ? `<table><thead><tr><th>Item</th><th>On Hand</th></tr></thead><tbody>
          ${items.slice(0,5).map(i => `<tr>
            <td>${i.item_name}</td>
            <td>${badge(i.quantity_on_hand,'red')}</td>
          </tr>`).join('')}</tbody></table>`
      : '<div class="empty-state" style="padding:20px"><div class="icon">✅</div><p>All stock OK</p></div>';
  }
  if (staff.status === 'fulfilled') $('a-staff').textContent = staff.value.data?.length ?? 0;
  if (health.status === 'fulfilled') {
    const h = health.value;
    $('a-health').innerHTML = `<div class="health-grid">
      <div class="health-item"><div class="val" style="color:var(--green)">${h.status}</div><div class="lbl">Status</div></div>
      <div class="health-item"><div class="val">${Math.floor(h.uptime_s/3600)}h ${Math.floor((h.uptime_s%3600)/60)}m</div><div class="lbl">Uptime</div></div>
      <div class="health-item"><div class="val">${h.memory.rss_mb} MB</div><div class="lbl">RAM Used</div></div>
      <div class="health-item"><div class="val">${h.memory.heap_used_mb}/${h.memory.heap_total_mb} MB</div><div class="lbl">Heap</div></div>
      <div class="health-item"><div class="val" style="color:${h.db_status==='connected'?'var(--green)':'var(--red)'}">${h.db_status}</div><div class="lbl">Database</div></div>
    </div>`;
  }
}

/* ════════════════════════════════════════════════════════════════
   DOCTOR DASHBOARD
════════════════════════════════════════════════════════════════ */
async function renderDoctorDashboard(el) {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>Doctor Dashboard</h2><p>Active queue and patient records</p></div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('dashboard')">↻ Refresh</button>
    </div>
    <div class="stat-grid" id="d-stats">
      <div class="stat-card"><div class="stat-icon teal">🚑</div><div><div class="stat-value" id="d-waiting">—</div><div class="stat-label">Patients Waiting</div></div></div>
      <div class="stat-card"><div class="stat-icon red">🔴</div><div><div class="stat-value" id="d-critical">—</div><div class="stat-label">T1–T2 Critical</div></div></div>
      <div class="stat-card"><div class="stat-icon teal">👤</div><div><div class="stat-value" id="d-patients">—</div><div class="stat-label">Total Patients</div></div></div>
    </div>
    <div class="col-6040">
      <div class="card">
        <div class="card-header">
          <h3>🚑 [ Triage Priority Queue ]</h3>
          <button class="btn btn-teal btn-xs" id="d-enqueue-btn">+ Add to Queue</button>
        </div>
        <div id="d-queue-table"></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>🔍 Patient Lookup</h3></div>
        <div class="card-body">
          <div class="search-bar" style="margin-bottom:8px">
            <input id="d-lookup-input" placeholder="Name or reference…" type="text">
            <button class="btn btn-teal btn-sm" id="d-lookup-btn">Go</button>
          </div>
          <div id="d-lookup-result"></div>
        </div>
      </div>
    </div>`;

  // Load queue stats
  const [queue, patients] = await Promise.allSettled([
    api('GET', '/queue?status=waiting'),
    api('GET', '/patients?limit=9999'),
  ]);

  if (queue.status === 'fulfilled') {
    const rows = queue.value.data || [];
    $('d-waiting').textContent  = rows.length;
    $('d-critical').textContent = rows.filter(r => r.triage_level <= 2).length;
    renderDoctorQueue(rows);
  }
  if (patients.status === 'fulfilled') $('d-patients').textContent = patients.value.count ?? 0;

  $('d-enqueue-btn').onclick = () => showEnqueueModal(loadDoctorQueue);
  $('d-lookup-btn').onclick  = doPatientLookup;
  $('d-lookup-input').onkeydown = e => { if (e.key === 'Enter') doPatientLookup(); };
}

function renderDoctorQueue(rows) {
  const el = $('d-queue-table');
  if (!el) return;
  if (!rows.length) { el.innerHTML = '<div class="empty-state" style="padding:20px"><p>Queue is clear</p></div>'; return; }
  el.innerHTML = `<table>
    <thead><tr><th>Lvl</th><th>Patient</th><th>Complaint</th><th>Assigned</th><th></th></tr></thead>
    <tbody>${rows.slice(0,8).map(r => `
      <tr class="triage-${r.triage_level}">
        <td><strong>T${r.triage_level}</strong></td>
        <td>${r.full_name||'—'}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.chief_complaint}</td>
        <td>${r.assigned_to ? badge(r.assigned_to,'teal') : badge('Unassigned','gray')}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-xs btn-teal" onclick="quickAssign(${r.id})">Assign Me</button>
          <button class="btn btn-xs btn-ghost" style="margin-left:3px" onclick="viewNotes(${r.id||0},'${(r.full_name||'').replace(/'/g,"\\'")}')">Notes</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function loadDoctorQueue() {
  try {
    const { data } = await api('GET', '/queue?status=waiting');
    if ($('d-waiting')) $('d-waiting').textContent = data.length;
    if ($('d-critical')) $('d-critical').textContent = data.filter(r => r.triage_level <= 2).length;
    renderDoctorQueue(data);
  } catch(e) { console.error(e); }
}

window.quickAssign = async (id) => {
  const name = $('user-name')?.textContent || 'Doctor';
  try {
    await api('PATCH', `/queue/${id}`, { assigned_to: name });
    loadDoctorQueue();
  } catch(e) { alert(e.message); }
};

async function doPatientLookup() {
  const q = $('d-lookup-input').value.trim();
  if (!q) return;
  const el = $('d-lookup-result');
  el.innerHTML = '<div style="color:var(--gray-400);font-size:12px">Searching…</div>';
  try {
    const { data } = await api('GET', `/patients?q=${encodeURIComponent(q)}&limit=5`);
    if (!data.length) { el.innerHTML = '<div style="color:var(--gray-400);font-size:12px">No patients found</div>'; return; }
    el.innerHTML = data.map(p => `
      <div style="padding:8px 0;border-bottom:1px solid var(--gray-100);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:12px">${p.full_name}</div>
          <div style="font-size:11px;color:var(--gray-600)">${p.patient_ref} · ${p.date_of_birth}</div>
        </div>
        <button class="btn btn-xs btn-teal" onclick="viewNotes(${p.id},'${p.full_name.replace(/'/g,"\\'")}')">📋 Notes</button>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<div class="alert-strip error" style="margin:0">${e.message}</div>`; }
}

/* ════════════════════════════════════════════════════════════════
   NURSE DASHBOARD
════════════════════════════════════════════════════════════════ */
async function renderNurseDashboard(el) {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>Nurse Dashboard</h2><p>Triage intake, queue and inventory</p></div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('dashboard')">↻ Refresh</button>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon purple">🚑</div><div><div class="stat-value" id="n-waiting">—</div><div class="stat-label">Queue Waiting</div></div></div>
      <div class="stat-card"><div class="stat-icon red">⚠️</div><div><div class="stat-value" id="n-lowstock">—</div><div class="stat-label">Low Stock Items</div></div></div>
      <div class="stat-card"><div class="stat-icon green">👥</div><div><div class="stat-value" id="n-staff">—</div><div class="stat-label">On Duty</div></div></div>
    </div>
    <div class="col-4060">
      <div class="intake-card">
        <div class="card-header"><h3>➕ Quick Triage Intake</h3></div>
        <div class="card-body">
          <div id="n-intake-msg"></div>
          <div class="form-group" style="margin-bottom:10px">
            <label>Patient Reference</label>
            <div class="inline-row">
              <input id="n-ref" placeholder="e.g. PAT-001">
              <button class="btn btn-purple btn-sm" id="n-lookup-btn">Find</button>
            </div>
          </div>
          <div id="n-patient-found" style="display:none;margin-bottom:10px;padding:8px 10px;background:var(--accent-light);border-radius:6px;font-size:12px"></div>
          <div class="form-group" style="margin-bottom:10px">
            <label>Triage Level</label>
            <select id="n-level">
              <option value="1">T1 — Immediate</option>
              <option value="2">T2 — Emergent</option>
              <option value="3" selected>T3 — Urgent</option>
              <option value="4">T4 — Semi-Urgent</option>
              <option value="5">T5 — Non-Urgent</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label>Chief Complaint</label>
            <textarea id="n-complaint" rows="2" placeholder="Presenting complaint…"></textarea>
          </div>
          <button class="btn btn-purple" id="n-enqueue-btn" style="width:100%">Add to Triage Queue</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>🚑 Current Queue</h3>
          <button class="btn btn-ghost btn-xs" onclick="navigate('triage-queue')">Full view →</button>
        </div>
        <div id="n-queue-preview"></div>
      </div>
    </div>`;

  let foundPatientId = null;

  $('n-lookup-btn').onclick = async () => {
    const ref = $('n-ref').value.trim();
    if (!ref) return;
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(ref)}&limit=1`);
      if (!data.length) {
        $('n-patient-found').style.display = 'none';
        $('n-intake-msg').innerHTML = '<div class="alert-strip error" style="margin-bottom:8px">Patient not found — register them first</div>';
        foundPatientId = null;
        return;
      }
      foundPatientId = data[0].id;
      $('n-intake-msg').innerHTML = '';
      $('n-patient-found').style.display = 'block';
      $('n-patient-found').innerHTML = `<strong>${data[0].full_name}</strong> · ${data[0].patient_ref} · DOB ${data[0].date_of_birth}`;
    } catch(e) { $('n-intake-msg').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
  };

  $('n-enqueue-btn').onclick = async () => {
    if (!foundPatientId) { $('n-intake-msg').innerHTML = '<div class="alert-strip error" style="margin-bottom:8px">Find a patient first</div>'; return; }
    const complaint = $('n-complaint').value.trim();
    if (!complaint) { $('n-intake-msg').innerHTML = '<div class="alert-strip error" style="margin-bottom:8px">Enter the chief complaint</div>'; return; }
    try {
      await api('POST', '/queue', {
        patient_id:      foundPatientId,
        triage_level:    +$('n-level').value,
        chief_complaint: complaint,
      });
      $('n-intake-msg').innerHTML = '<div class="alert-strip ok" style="margin-bottom:8px">✅ Patient added to queue</div>';
      $('n-ref').value = ''; $('n-complaint').value = '';
      $('n-patient-found').style.display = 'none';
      foundPatientId = null;
      loadNurseData();
    } catch(e) { $('n-intake-msg').innerHTML = `<div class="alert-strip error" style="margin-bottom:8px">${e.message}</div>`; }
  };

  loadNurseData();
}

async function loadNurseData() {
  const [queue, lowStock, staff] = await Promise.allSettled([
    api('GET', '/queue?status=waiting'),
    api('GET', '/inventory/alerts/low-stock'),
    api('GET', '/queue/roster'),
  ]);

  if (queue.status === 'fulfilled') {
    const rows = queue.value.data || [];
    if ($('n-waiting')) $('n-waiting').textContent = rows.length;
    const prev = $('n-queue-preview');
    if (prev) {
      prev.innerHTML = rows.length
        ? `<table><thead><tr><th>Lvl</th><th>Patient</th><th>Complaint</th><th></th></tr></thead><tbody>
            ${rows.slice(0,6).map(r => `<tr class="triage-${r.triage_level}">
              <td><strong>T${r.triage_level}</strong></td>
              <td>${r.full_name||'—'}</td>
              <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.chief_complaint}</td>
              <td><button class="btn btn-xs btn-ghost" onclick="markDone(${r.id})">Done</button></td>
            </tr>`).join('')}</tbody></table>`
        : '<div class="empty-state" style="padding:20px"><p>Queue is clear</p></div>';
    }
  }
  if (lowStock.status === 'fulfilled' && $('n-lowstock'))
    $('n-lowstock').textContent = lowStock.value.alert_count ?? 0;
  if (staff.status === 'fulfilled' && $('n-staff'))
    $('n-staff').textContent = staff.value.data?.length ?? 0;
}

window.markDone = async (id) => {
  try { await api('PATCH', `/queue/${id}`, { status: 'completed' }); loadNurseData(); }
  catch(e) { alert(e.message); }
};

/* ════════════════════════════════════════════════════════════════
   PAGE: PATIENT SEARCH
════════════════════════════════════════════════════════════════ */
PAGES['patient-search'] = async (el) => {
  const canRegister = currentRole === 'Administrator';
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Patient Search View ]</h2><p>Search by name or reference</p></div>
      ${canRegister ? '<button class="btn btn-accent" onclick="navigate(\'patient-register\')">+ Register Patient</button>' : ''}
    </div>
    <div class="card">
      <div class="card-body">
        <div class="search-bar">
          <input id="ps-input" placeholder="Search name or patient reference…" type="text">
          <button class="btn btn-accent" id="ps-btn">Search</button>
        </div>
        <div id="ps-results"></div>
      </div>
    </div>`;

  const doSearch = async () => {
    const q = $('ps-input').value;
    $('ps-results').innerHTML = '<div style="color:var(--gray-400);padding:8px">Loading…</div>';
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(q)}&limit=50`);
      if (!data.length) { $('ps-results').innerHTML = '<div class="empty-state"><div class="icon">👤</div><p>No patients found</p></div>'; return; }
      $('ps-results').innerHTML = `<table>
        <thead><tr><th>Reference</th><th>Name</th><th>DOB</th><th>Blood</th><th>Registered</th><th></th></tr></thead>
        <tbody>${data.map(p => `<tr>
          <td>${badge(p.patient_ref,'blue')}</td>
          <td><strong>${p.full_name}</strong></td>
          <td>${p.date_of_birth}</td>
          <td>${p.blood_group ? badge(p.blood_group,'red') : '—'}</td>
          <td>${fmt(p.registered_at)}</td>
          <td><button class="btn btn-xs btn-ghost" onclick="viewNotes(${p.id},'${p.full_name.replace(/'/g,"\\'")}')">📋 Notes</button></td>
        </tr>`).join('')}</tbody>
      </table>`;
    } catch(e) { $('ps-results').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
  };

  $('ps-btn').onclick = doSearch;
  $('ps-input').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
  doSearch();
};

/* ════════════════════════════════════════════════════════════════
   CLINICAL NOTES MODAL (shared — Doctor full access, Nurse read-only)
════════════════════════════════════════════════════════════════ */
window.viewNotes = async (id, name) => {
  openModal(`[ Clinical Notes Timeline ] — ${name}`, '<div style="color:var(--gray-400)">Loading…</div>');
  try {
    const { data } = await api('GET', `/patients/${id}/notes`);
    const notesHtml = data.length
      ? data.map(n => `
          <div style="border-left:3px solid var(--accent);padding:9px 12px;margin-bottom:10px;background:var(--gray-50);border-radius:0 6px 6px 0">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-weight:600;font-size:12px">${n.authored_by}</span>
              <span style="font-size:11px;color:var(--gray-400)">${fmt(n.created_at)}</span>
            </div>
            ${badge(n.note_type,'blue')}
            <p style="margin-top:7px;font-size:12px;line-height:1.5">${n.body}</p>
          </div>`).join('')
      : '<div class="empty-state" style="padding:20px"><p>No clinical notes on file</p></div>';

    const canWrite = currentRole === 'Doctor' || currentRole === 'Administrator';
    const addForm = canWrite ? `
      <hr class="divider">
      <div style="font-weight:600;font-size:12px;margin-bottom:10px">Add Note</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Authored By</label>
          <input id="note-author" value="${$('user-name')?.textContent||''}">
        </div>
        <div class="form-group">
          <label>Note Type</label>
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
        <button class="btn btn-accent" id="save-note-btn">Save Note</button>
      </div>` : '';

    $('modal-body').innerHTML = notesHtml + addForm;

    if (canWrite) {
      $('save-note-btn').onclick = async () => {
        try {
          await api('POST', `/patients/${id}/notes`, {
            authored_by: $('note-author').value,
            note_type:   $('note-type').value,
            body:        $('note-body').value,
          });
          viewNotes(id, name);
        } catch(e) { alert(e.message); }
      };
    }
  } catch(e) { $('modal-body').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
};

/* ════════════════════════════════════════════════════════════════
   PAGE: PATIENT REGISTRATION FORM
════════════════════════════════════════════════════════════════ */
PAGES['patient-register'] = (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Patient Registration Form ]</h2><p>Register a new patient</p></div>
    </div>
    <div class="card" style="max-width:600px">
      <div class="card-body">
        <div id="reg-msg"></div>
        <div class="form-grid">
          <div class="form-group">
            <label>Patient Reference *</label>
            <input id="reg-ref" placeholder="e.g. PAT-2024-001">
          </div>
          <div class="form-group">
            <label>Full Name *</label>
            <input id="reg-name" placeholder="Full legal name">
          </div>
          <div class="form-group">
            <label>Date of Birth *</label>
            <input id="reg-dob" type="date">
          </div>
          <div class="form-group">
            <label>Sex</label>
            <select id="reg-sex">
              <option value="">— Select —</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label>Blood Group</label>
            <select id="reg-blood">
              <option value="">— Unknown —</option>
              <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
            </select>
          </div>
          <div class="form-group">
            <label>Contact Number</label>
            <input id="reg-contact" placeholder="Phone number">
          </div>
          <div class="form-group full">
            <label>Address</label>
            <input id="reg-address" placeholder="Full address">
          </div>
          <div class="form-group full">
            <label>Allergy Notes</label>
            <textarea id="reg-allergy" rows="2" placeholder="Known allergies or none"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="navigate('dashboard')">Cancel</button>
          <button class="btn btn-accent" id="reg-submit">Register Patient</button>
        </div>
      </div>
    </div>`;

  $('reg-submit').onclick = async () => {
    const ref  = $('reg-ref').value.trim();
    const name = $('reg-name').value.trim();
    const dob  = $('reg-dob').value;
    if (!ref || !name || !dob) {
      $('reg-msg').innerHTML = '<div class="alert-strip error">Please fill all required (*) fields</div>'; return;
    }
    try {
      $('reg-submit').textContent = 'Registering…';
      await api('POST', '/patients', {
        patient_ref: ref, full_name: name, date_of_birth: dob,
        sex: $('reg-sex').value, blood_group: $('reg-blood').value,
        contact_number: $('reg-contact').value,
        address: $('reg-address').value,
        allergy_notes: $('reg-allergy').value,
      });
      $('reg-msg').innerHTML = `<div class="alert-strip ok">✅ <strong>${name}</strong> registered successfully</div>`;
      ['reg-ref','reg-name','reg-contact','reg-address','reg-allergy'].forEach(id => $(id).value = '');
      $('reg-dob').value = ''; $('reg-sex').value = ''; $('reg-blood').value = '';
    } catch(e) {
      $('reg-msg').innerHTML = `<div class="alert-strip error">${e.message}</div>`;
    }
    $('reg-submit').textContent = 'Register Patient';
  };
};

/* ════════════════════════════════════════════════════════════════
   PAGE: STOCK LEDGER
════════════════════════════════════════════════════════════════ */
PAGES['stock-ledger'] = async (el) => {
  const isAdmin = currentRole === 'Administrator';
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Stock Ledger View ]</h2><p>Medicines, supplies and equipment</p></div>
      ${isAdmin ? '<button class="btn btn-accent" id="btn-add-item">+ Add Item</button>' : ''}
    </div>
    <div class="card">
      <div class="card-body">
        <div class="search-bar">
          <select id="inv-cat" style="padding:8px 10px;border:1.5px solid var(--gray-200);border-radius:var(--radius);font-size:12px;outline:none">
            <option value="">All Categories</option>
            <option value="medicine">Medicine</option>
            <option value="supply">Supply</option>
            <option value="equipment">Equipment</option>
            <option value="consumable">Consumable</option>
          </select>
          <button class="btn btn-accent btn-sm" id="inv-load">Load</button>
        </div>
        <div id="inv-table">Loading…</div>
      </div>
    </div>`;

  const loadInv = async () => {
    const cat = $('inv-cat').value;
    try {
      const { data } = await api('GET', `/inventory${cat ? `?category=${cat}` : ''}`);
      if (!data.length) { $('inv-table').innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>No items found</p></div>'; return; }
      $('inv-table').innerHTML = `<table>
        <thead><tr><th>Code</th><th>Item</th><th>Cat</th><th>Qty</th><th>Unit</th><th>Threshold</th><th>Location</th><th>Expiry</th><th></th></tr></thead>
        <tbody>${data.map(i => {
          const low = i.quantity_on_hand <= i.reorder_threshold;
          return `<tr>
            <td>${badge(i.item_code,'gray')}</td>
            <td><strong>${i.item_name}</strong></td>
            <td>${badge(i.category,'blue')}</td>
            <td>${badge(i.quantity_on_hand, low ? 'red' : 'green')}</td>
            <td>${i.unit}</td>
            <td>${i.reorder_threshold}</td>
            <td>${i.location||'—'}</td>
            <td>${i.expiry_date||'—'}</td>
            <td><button class="btn btn-xs btn-ghost" onclick="openTxnModal(${i.id},'${i.item_name.replace(/'/g,"\\'")}',${loadInv})">Transact</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    } catch(e) { $('inv-table').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
  };

  $('inv-load').onclick = loadInv;
  $('inv-cat').onchange  = loadInv;
  loadInv();

  if (isAdmin) {
    $('btn-add-item').onclick = () => {
      openModal('Add Inventory Item', `
        <div class="form-grid">
          <div class="form-group"><label>Item Code *</label><input id="ni-code" placeholder="MED-001"></div>
          <div class="form-group"><label>Item Name *</label><input id="ni-name" placeholder="Paracetamol 500mg"></div>
          <div class="form-group"><label>Category *</label>
            <select id="ni-cat"><option value="medicine">Medicine</option><option value="supply">Supply</option><option value="equipment">Equipment</option><option value="consumable">Consumable</option></select>
          </div>
          <div class="form-group"><label>Unit *</label><input id="ni-unit" placeholder="tablet / vial / box"></div>
          <div class="form-group"><label>Initial Qty</label><input id="ni-qty" type="number" value="0" min="0"></div>
          <div class="form-group"><label>Reorder At</label><input id="ni-reorder" type="number" value="10" min="0"></div>
          <div class="form-group"><label>Location</label><input id="ni-loc" placeholder="Ward A / Shelf 3"></div>
          <div class="form-group"><label>Expiry Date</label><input id="ni-expiry" type="date"></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button class="btn btn-accent" id="save-item-btn">Add Item</button>
        </div>`);
      $('save-item-btn').onclick = async () => {
        try {
          await api('POST', '/inventory', {
            item_code: $('ni-code').value, item_name: $('ni-name').value,
            category: $('ni-cat').value,  unit: $('ni-unit').value,
            quantity_on_hand: +$('ni-qty').value, reorder_threshold: +$('ni-reorder').value,
            location: $('ni-loc').value,  expiry_date: $('ni-expiry').value || null,
          });
          closeModal(); loadInv();
        } catch(e) { alert(e.message); }
      };
    };
  }
};

window.openTxnModal = (id, name) => {
  openModal(`Record Transaction — ${name}`, `
    <div class="form-grid">
      <div class="form-group"><label>Type *</label>
        <select id="txn-type">
          <option value="restock">Restock (+)</option>
          <option value="dispense">Dispense (−)</option>
          <option value="adjustment">Adjustment</option>
          <option value="expired">Mark Expired (−)</option>
        </select>
      </div>
      <div class="form-group"><label>Quantity *</label><input id="txn-qty" type="number" min="1" value="1"></div>
      <div class="form-group full"><label>Performed By *</label>
        <input id="txn-by" value="${$('user-name')?.textContent||''}">
      </div>
      <div class="form-group full"><label>Notes</label><input id="txn-notes" placeholder="Optional"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-accent" id="save-txn-btn">Record</button>
    </div>`);
  $('save-txn-btn').onclick = async () => {
    const type = $('txn-type').value;
    const rawQty = +$('txn-qty').value;
    const delta = (type === 'dispense' || type === 'expired') ? -rawQty : rawQty;
    try {
      await api('POST', `/inventory/${id}/transactions`, {
        txn_type: type, quantity_delta: delta,
        performed_by: $('txn-by').value, notes: $('txn-notes').value,
      });
      closeModal();
      if (currentPage === 'stock-ledger') navigate('stock-ledger');
    } catch(e) { alert(e.message); }
  };
};

/* ════════════════════════════════════════════════════════════════
   PAGE: LOW STOCK ALERTS (Admin only)
════════════════════════════════════════════════════════════════ */
PAGES['low-stock'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Low Inventory Alert Dashboard ]</h2><p>Items at or below reorder threshold</p></div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('low-stock')">↻ Refresh</button>
    </div>
    <div id="ls-content">Loading…</div>`;
  try {
    const { data, alert_count } = await api('GET', '/inventory/alerts/low-stock');
    if (!data.length) {
      $('ls-content').innerHTML = '<div class="empty-state card" style="padding:40px"><div class="icon">✅</div><p>All stock levels are above threshold</p></div>';
      return;
    }
    $('ls-content').innerHTML = `
      <div class="alert-strip warn">⚠️ ${alert_count} item${alert_count!==1?'s':''} need restocking</div>
      <div class="card"><table>
        <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>On Hand</th><th>Threshold</th><th>Deficit</th><th>Location</th></tr></thead>
        <tbody>${data.map(i => `<tr>
          <td>${badge(i.item_code,'gray')}</td>
          <td><strong>${i.item_name}</strong></td>
          <td>${badge(i.category,'blue')}</td>
          <td>${badge(i.quantity_on_hand,'red')}</td>
          <td>${i.reorder_threshold}</td>
          <td>${badge(i.reorder_threshold - i.quantity_on_hand,'orange')}</td>
          <td>${i.location||'—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  } catch(e) { $('ls-content').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
};

/* ════════════════════════════════════════════════════════════════
   PAGE: TRIAGE QUEUE (shared — all roles)
════════════════════════════════════════════════════════════════ */
PAGES['triage-queue'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Triage Priority Queue ]</h2><p>Sorted by severity then arrival time</p></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="navigate('triage-queue')">↻ Refresh</button>
        <button class="btn btn-accent" id="tq-add-btn">+ Add to Queue</button>
      </div>
    </div>
    <div id="tq-content">Loading…</div>`;

  $('tq-add-btn').onclick = () => showEnqueueModal(() => navigate('triage-queue'));
  await loadFullQueue();
};

async function loadFullQueue() {
  const el = $('tq-content');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue?status=waiting');
    if (!data.length) { el.innerHTML = '<div class="empty-state card" style="padding:40px"><div class="icon">🚑</div><p>No patients in queue</p></div>'; return; }
    const labels = {1:'Immediate',2:'Emergent',3:'Urgent',4:'Semi-Urgent',5:'Non-Urgent'};
    el.innerHTML = `<div class="card"><table>
      <thead><tr><th>Triage</th><th>Patient</th><th>Complaint</th><th>Assigned To</th><th>Queued</th><th></th></tr></thead>
      <tbody>${data.map(r => `
        <tr class="triage-${r.triage_level}">
          <td><strong>T${r.triage_level}</strong><br><span style="font-size:10px;color:var(--gray-600)">${labels[r.triage_level]}</span></td>
          <td><strong>${r.full_name||'—'}</strong><br><span style="font-size:10px;color:var(--gray-600)">${r.patient_ref||''}</span></td>
          <td>${r.chief_complaint}</td>
          <td>${r.assigned_to||badge('Unassigned','orange')}</td>
          <td style="font-size:11px">${fmt(r.queued_at)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-xs btn-accent" onclick="resolveQueue(${r.id})">Done</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
}

window.resolveQueue = async (id) => {
  try { await api('PATCH', `/queue/${id}`, { status: 'completed' }); loadFullQueue(); }
  catch(e) { alert(e.message); }
};

function showEnqueueModal(onSuccess) {
  openModal('Add to [ Triage Priority Queue ]', `
    <div class="form-grid">
      <div class="form-group full"><label>Patient Reference *</label>
        <input id="eq-ref" placeholder="e.g. PAT-001">
      </div>
      <div class="form-group"><label>Triage Level *</label>
        <select id="eq-level">
          <option value="1">T1 — Immediate</option>
          <option value="2">T2 — Emergent</option>
          <option value="3" selected>T3 — Urgent</option>
          <option value="4">T4 — Semi-Urgent</option>
          <option value="5">T5 — Non-Urgent</option>
        </select>
      </div>
      <div class="form-group"><label>Assign To</label>
        <input id="eq-assign" placeholder="Doctor / Nurse name">
      </div>
      <div class="form-group full"><label>Chief Complaint *</label>
        <textarea id="eq-complaint" rows="2" placeholder="Presenting complaint…"></textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-accent" id="eq-save">Add to Queue</button>
    </div>`);

  $('eq-save').onclick = async () => {
    const ref = $('eq-ref').value.trim();
    if (!ref) { alert('Enter a patient reference'); return; }
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(ref)}&limit=1`);
      if (!data.length) { alert('No patient found with that reference'); return; }
      await api('POST', '/queue', {
        patient_id:      data[0].id,
        triage_level:    +$('eq-level').value,
        chief_complaint: $('eq-complaint').value,
        assigned_to:     $('eq-assign').value || null,
      });
      closeModal();
      if (typeof onSuccess === 'function') onSuccess();
    } catch(e) { alert(e.message); }
  };
}

/* ════════════════════════════════════════════════════════════════
   PAGE: STAFF ROSTER
════════════════════════════════════════════════════════════════ */
PAGES['staff-roster'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Staff Duty Roster ]</h2><p>Currently on-duty clinical staff</p></div>
      <button class="btn btn-accent" id="btn-add-staff">+ Add Shift</button>
    </div>
    <div id="roster-content">Loading…</div>`;
  $('btn-add-staff').onclick = () => showAddShiftModal(() => loadRosterPage());
  loadRosterPage();
};

async function loadRosterPage() {
  const el = $('roster-content');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue/roster');
    if (!data.length) { el.innerHTML = '<div class="empty-state card" style="padding:40px"><div class="icon">👥</div><p>No staff currently on duty</p></div>'; return; }
    el.innerHTML = `<div class="card"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Ward</th><th>Shift Start</th><th>Shift End</th></tr></thead>
      <tbody>${data.map(s => `<tr>
        <td><strong>${s.staff_name}</strong></td>
        <td>${badge(s.role,'blue')}</td>
        <td>${s.ward||'—'}</td>
        <td>${fmt(s.shift_start)}</td>
        <td>${fmt(s.shift_end)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
}

function showAddShiftModal(onSuccess) {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  openModal('Add Staff Shift', `
    <div class="form-grid">
      <div class="form-group"><label>Staff Name *</label><input id="sr-name" placeholder="Full name"></div>
      <div class="form-group"><label>Role *</label>
        <select id="sr-role">
          <option value="doctor">Doctor</option><option value="nurse">Nurse</option>
          <option value="technician">Technician</option><option value="pharmacist">Pharmacist</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="form-group"><label>Shift Start *</label><input id="sr-start" type="datetime-local" value="${local}"></div>
      <div class="form-group"><label>Shift End *</label><input id="sr-end" type="datetime-local"></div>
      <div class="form-group full"><label>Ward</label><input id="sr-ward" placeholder="Ward / Department"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-accent" id="sr-save">Add to Roster</button>
    </div>`);
  $('sr-save').onclick = async () => {
    try {
      await api('POST', '/queue/roster', {
        staff_name:  $('sr-name').value, role: $('sr-role').value,
        shift_start: new Date($('sr-start').value).toISOString(),
        shift_end:   new Date($('sr-end').value).toISOString(),
        ward:        $('sr-ward').value,
      });
      closeModal();
      if (typeof onSuccess === 'function') onSuccess();
    } catch(e) { alert(e.message); }
  };
}

/* ════════════════════════════════════════════════════════════════
   PAGE: DOCUMENT LIBRARY
════════════════════════════════════════════════════════════════ */
PAGES['doc-library'] = (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Document Library Browser ]</h2><p>Offline clinical guidelines, SOPs and calculators</p></div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="alert-strip info" style="margin-bottom:16px">
          📚 Documents are stored locally. Load guidelines via <code style="background:var(--gray-100);padding:1px 5px;border-radius:3px">POST /api/documents</code>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
          ${[['📋','Clinical Guidelines','Standard treatment protocols'],
             ['💊','Drug References','Dosage and interactions'],
             ['🔬','Lab Reference','Normal value ranges'],
             ['🧮','[ Interactive Calculator ]','BMI, GFR, drug dose'],
             ['📄','SOPs','Standard operating procedures'],
             ['🩺','Triage Protocols','Emergency decision guides'],
            ].map(([icon,title,desc]) => `
            <div style="border:1.5px solid var(--gray-200);border-radius:var(--radius);padding:14px;cursor:pointer;transition:border-color .15s"
                 onmouseover="this.style.borderColor='var(--accent)'"
                 onmouseout="this.style.borderColor='var(--gray-200)'">
              <div style="font-size:24px;margin-bottom:7px">${icon}</div>
              <div style="font-weight:600;font-size:12px">${title}</div>
              <div style="font-size:11px;color:var(--gray-600);margin-top:2px">${desc}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
};
