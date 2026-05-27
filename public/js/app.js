'use strict';

/* ═══════════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════════ */
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

function badge(text, type) {
  return `<span class="badge badge-${type}">${text}</span>`;
}

/* ═══════════════════════════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════════════════════════ */
function startClock() {
  const el = $('clock');
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-GB',
      { weekday:'short', year:'numeric', month:'short', day:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  tick(); setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════════════ */
function openModal(title, bodyHtml) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHtml;
  $('modal-overlay').classList.add('open');
}
function closeModal() { $('modal-overlay').classList.remove('open'); }

$('modal-close').onclick = closeModal;
$('modal-overlay').onclick = e => { if (e.target === $('modal-overlay')) closeModal(); };

/* ═══════════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════════ */
const PAGES = {};

function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const render = PAGES[page];
  if (render) render($('main-content'));
  else $('main-content').innerHTML = `<div class="empty-state"><div class="icon">🚧</div><p>[ ${page} ] — coming soon</p></div>`;
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.onclick = () => navigate(el.dataset.page);
});

/* ═══════════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════════ */
async function tryLogin() {
  const u = $('username').value.trim();
  const p = $('password').value;
  $('login-error').textContent = '';
  $('login-btn').textContent = 'Signing in…';
  try {
    const { name, role } = await api('POST', '/auth/login', { username: u, password: p });
    $('user-badge').textContent = `${name} · ${role}`;
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
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
  $('username').value = ''; $('password').value = '';
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE: DASHBOARD
═══════════════════════════════════════════════════════════════════ */
PAGES['dashboard'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>Dashboard</h2><p>System overview — live from local database</p></div>
    </div>
    <div class="stat-grid" id="stat-grid">
      <div class="stat-card"><div class="stat-icon blue">👤</div><div><div class="stat-value" id="stat-patients">—</div><div class="stat-label">Registered Patients</div></div></div>
      <div class="stat-card"><div class="stat-icon orange">🚑</div><div><div class="stat-value" id="stat-queue">—</div><div class="stat-label">In Triage Queue</div></div></div>
      <div class="stat-card"><div class="stat-icon red">⚠️</div><div><div class="stat-value" id="stat-lowstock">—</div><div class="stat-label">Low Stock Alerts</div></div></div>
      <div class="stat-card"><div class="stat-icon green">📦</div><div><div class="stat-value" id="stat-items">—</div><div class="stat-label">Inventory Items</div></div></div>
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-header"><h3>🚑 Active Triage Queue</h3></div>
        <div id="dash-queue"><div style="padding:20px;color:#9aa5b1;text-align:center">Loading…</div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>⚠️ Critical Low Stock</h3></div>
        <div id="dash-stock"><div style="padding:20px;color:#9aa5b1;text-align:center">Loading…</div></div>
      </div>
    </div>
    <div style="margin-top:20px" class="card">
      <div class="card-header"><h3>🖥️ System Health</h3></div>
      <div id="dash-health" class="card-body" style="color:#9aa5b1">Loading…</div>
    </div>`;

  // Load stats in parallel
  const [patients, queue, lowStock, inventory, health] = await Promise.allSettled([
    api('GET', '/patients?limit=1'),
    api('GET', '/queue?status=waiting'),
    api('GET', '/inventory/alerts/low-stock'),
    api('GET', '/inventory?limit=1'),
    fetch('/api/health').then(r => r.json()),
  ]);

  if (patients.status === 'fulfilled') {
    // crude count from search with no query
    api('GET', '/patients?limit=9999').then(d => { $('stat-patients').textContent = d.count ?? '—'; });
  }
  if (queue.status === 'fulfilled') {
    $('stat-queue').textContent = queue.value.data?.length ?? 0;
    renderDashQueue(queue.value.data || []);
  }
  if (lowStock.status === 'fulfilled') {
    $('stat-lowstock').textContent = lowStock.value.alert_count ?? 0;
    renderDashStock(lowStock.value.data || []);
  }
  if (inventory.status === 'fulfilled') {
    api('GET', '/inventory?limit=9999').then(d => { $('stat-items').textContent = d.data?.length ?? '—'; });
  }
  if (health.status === 'fulfilled') {
    const h = health.value;
    $('dash-health').innerHTML = `
      <div style="display:flex;gap:32px;flex-wrap:wrap">
        <div><div style="font-size:11px;color:#9aa5b1;text-transform:uppercase;letter-spacing:.5px">Status</div>
          <div style="font-weight:700;color:#1a8a4a;font-size:15px">${h.status}</div></div>
        <div><div style="font-size:11px;color:#9aa5b1;text-transform:uppercase;letter-spacing:.5px">Uptime</div>
          <div style="font-weight:700;font-size:15px">${Math.floor(h.uptime_s/3600)}h ${Math.floor((h.uptime_s%3600)/60)}m</div></div>
        <div><div style="font-size:11px;color:#9aa5b1;text-transform:uppercase;letter-spacing:.5px">RAM Used</div>
          <div style="font-weight:700;font-size:15px">${h.memory.rss_mb} MB</div></div>
        <div><div style="font-size:11px;color:#9aa5b1;text-transform:uppercase;letter-spacing:.5px">Heap</div>
          <div style="font-weight:700;font-size:15px">${h.memory.heap_used_mb} / ${h.memory.heap_total_mb} MB</div></div>
        <div><div style="font-size:11px;color:#9aa5b1;text-transform:uppercase;letter-spacing:.5px">Database</div>
          <div style="font-weight:700;font-size:15px;color:${h.db_status==='connected'?'#1a8a4a':'#c0392b'}">${h.db_status}</div></div>
      </div>`;
  }
};

function renderDashQueue(rows) {
  if (!rows.length) { $('dash-queue').innerHTML = '<div class="empty-state" style="padding:24px"><p>No patients in queue</p></div>'; return; }
  $('dash-queue').innerHTML = `<table>
    <thead><tr><th>Level</th><th>Patient</th><th>Complaint</th></tr></thead>
    <tbody>${rows.slice(0,5).map(r => `
      <tr class="triage-${r.triage_level}">
        <td><strong>T${r.triage_level}</strong></td>
        <td>${r.full_name || '—'}</td>
        <td>${r.chief_complaint}</td>
      </tr>`).join('')}</tbody>
  </table>`;
}

function renderDashStock(rows) {
  if (!rows.length) { $('dash-stock').innerHTML = '<div class="empty-state" style="padding:24px"><div class="icon">✅</div><p>All stock levels normal</p></div>'; return; }
  $('dash-stock').innerHTML = `<table>
    <thead><tr><th>Item</th><th>On Hand</th><th>Threshold</th></tr></thead>
    <tbody>${rows.slice(0,5).map(r => `
      <tr>
        <td>${r.item_name}</td>
        <td>${badge(r.quantity_on_hand, 'red')}</td>
        <td>${r.reorder_threshold}</td>
      </tr>`).join('')}</tbody>
  </table>`;
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE: PATIENT SEARCH
═══════════════════════════════════════════════════════════════════ */
PAGES['patient-search'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Patient Search View ]</h2><p>Search registered patients by name or reference</p></div>
      <button class="btn btn-blue" id="btn-add-patient">+ Register New Patient</button>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="search-bar">
          <input id="patient-search-input" placeholder="Search by name or patient reference…" type="text">
          <button class="btn btn-blue" id="patient-search-btn">Search</button>
        </div>
        <div id="patient-results"></div>
      </div>
    </div>`;

  $('btn-add-patient').onclick = () => navigate('patient-register');

  const doSearch = async () => {
    const q = $('patient-search-input').value;
    $('patient-results').innerHTML = '<div style="color:#9aa5b1;padding:10px">Loading…</div>';
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(q)}&limit=50`);
      if (!data.length) { $('patient-results').innerHTML = '<div class="empty-state"><div class="icon">👤</div><p>No patients found</p></div>'; return; }
      $('patient-results').innerHTML = `<table>
        <thead><tr><th>Ref</th><th>Name</th><th>DOB</th><th>Blood Group</th><th>Registered</th><th>Notes</th></tr></thead>
        <tbody>${data.map(p => `
          <tr>
            <td>${badge(p.patient_ref, 'blue')}</td>
            <td><strong>${p.full_name}</strong></td>
            <td>${p.date_of_birth}</td>
            <td>${p.blood_group ? badge(p.blood_group,'red') : '—'}</td>
            <td>${fmt(p.registered_at)}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="viewNotes(${p.id},'${p.full_name}')">📋 Notes</button></td>
          </tr>`).join('')}</tbody>
      </table>`;
    } catch(e) { $('patient-results').innerHTML = `<div class="alert-strip error">Error: ${e.message}</div>`; }
  };

  $('patient-search-btn').onclick = doSearch;
  $('patient-search-input').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
  doSearch();
};

window.viewNotes = async (id, name) => {
  openModal(`[ Clinical Notes Timeline ] — ${name}`, '<div style="color:#9aa5b1">Loading…</div>');
  try {
    const { data } = await api('GET', `/patients/${id}/notes`);
    const notesHtml = data.length
      ? data.map(n => `
          <div style="border-left:3px solid var(--blue);padding:10px 14px;margin-bottom:12px;background:var(--gray-50);border-radius:0 6px 6px 0">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-weight:600">${n.authored_by}</span>
              <span style="font-size:12px;color:#9aa5b1">${fmt(n.created_at)}</span>
            </div>
            ${badge(n.note_type,'blue')}
            <p style="margin-top:8px;font-size:13px;line-height:1.5">${n.body}</p>
          </div>`).join('')
      : '<div class="empty-state" style="padding:24px"><p>No clinical notes on file</p></div>';

    $('modal-body').innerHTML = notesHtml + `
      <hr style="margin:16px 0;border:none;border-top:1px solid var(--gray-200)">
      <strong style="display:block;margin-bottom:10px;font-size:13px">Add New Note</strong>
      <div class="form-grid">
        <div class="form-group">
          <label>Authored By</label>
          <input id="note-author" placeholder="Staff name">
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
          <textarea id="note-body" rows="3" placeholder="Clinical note text…"></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-blue" id="save-note-btn">Save Note</button>
      </div>`;

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
  } catch(e) { $('modal-body').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE: PATIENT REGISTRATION FORM
═══════════════════════════════════════════════════════════════════ */
PAGES['patient-register'] = (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Patient Registration Form ]</h2><p>Register a new patient in the system</p></div>
    </div>
    <div class="card" style="max-width:640px">
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
              <option>A+</option><option>A-</option>
              <option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option>
              <option>O+</option><option>O-</option>
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
          <button class="btn btn-ghost" onclick="navigate('patient-search')">Cancel</button>
          <button class="btn btn-blue" id="reg-submit">Register Patient</button>
        </div>
      </div>
    </div>`;

  $('reg-submit').onclick = async () => {
    const ref  = $('reg-ref').value.trim();
    const name = $('reg-name').value.trim();
    const dob  = $('reg-dob').value;
    if (!ref || !name || !dob) { $('reg-msg').innerHTML = '<div class="alert-strip error">Please fill all required fields (*)</div>'; return; }

    try {
      $('reg-submit').textContent = 'Registering…';
      await api('POST', '/patients', {
        patient_ref: ref, full_name: name, date_of_birth: dob,
        sex:          $('reg-sex').value,
        blood_group:  $('reg-blood').value,
        contact_number: $('reg-contact').value,
        address:      $('reg-address').value,
        allergy_notes: $('reg-allergy').value,
      });
      $('reg-msg').innerHTML = `<div class="alert-strip info">✅ Patient <strong>${name}</strong> registered successfully.</div>`;
      $('reg-submit').textContent = 'Register Patient';
      ['reg-ref','reg-name','reg-contact','reg-address','reg-allergy'].forEach(id => $(id).value = '');
      $('reg-dob').value = ''; $('reg-sex').value = ''; $('reg-blood').value = '';
    } catch(e) {
      $('reg-msg').innerHTML = `<div class="alert-strip error">${e.message}</div>`;
      $('reg-submit').textContent = 'Register Patient';
    }
  };
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE: STOCK LEDGER VIEW
═══════════════════════════════════════════════════════════════════ */
PAGES['stock-ledger'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Stock Ledger View ]</h2><p>Full inventory — medicines, supplies, equipment</p></div>
      <button class="btn btn-blue" id="btn-add-item">+ Add Item</button>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="search-bar">
          <select id="inv-cat-filter" style="padding:9px 12px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;outline:none">
            <option value="">All Categories</option>
            <option value="medicine">Medicine</option>
            <option value="supply">Supply</option>
            <option value="equipment">Equipment</option>
            <option value="consumable">Consumable</option>
          </select>
          <button class="btn btn-blue" id="inv-load-btn">Load</button>
        </div>
        <div id="inv-table">Loading…</div>
      </div>
    </div>`;

  const loadInventory = async () => {
    const cat = $('inv-cat-filter').value;
    const url = cat ? `/inventory?category=${cat}` : '/inventory';
    try {
      const { data } = await api('GET', url);
      if (!data.length) { $('inv-table').innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>No inventory items found</p></div>'; return; }
      $('inv-table').innerHTML = `<table>
        <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Reorder At</th><th>Location</th><th>Expiry</th><th>Action</th></tr></thead>
        <tbody>${data.map(i => {
          const low = i.quantity_on_hand <= i.reorder_threshold;
          return `<tr>
            <td>${badge(i.item_code,'gray')}</td>
            <td><strong>${i.item_name}</strong></td>
            <td>${badge(i.category,'blue')}</td>
            <td>${badge(i.quantity_on_hand, low ? 'red' : 'green')}</td>
            <td>${i.unit}</td>
            <td>${i.reorder_threshold}</td>
            <td>${i.location || '—'}</td>
            <td>${i.expiry_date ? i.expiry_date : '—'}</td>
            <td><button class="btn btn-sm btn-ghost" onclick="openTxnModal(${i.id},'${i.item_name.replace(/'/g,"\\'")}')">Transact</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    } catch(e) { $('inv-table').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
  };

  $('inv-load-btn').onclick = loadInventory;
  $('inv-cat-filter').onchange = loadInventory;
  loadInventory();

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
        <div class="form-group"><label>Reorder Threshold</label><input id="ni-reorder" type="number" value="10" min="0"></div>
        <div class="form-group"><label>Location</label><input id="ni-loc" placeholder="Ward A / Shelf 3"></div>
        <div class="form-group"><label>Expiry Date</label><input id="ni-expiry" type="date"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-blue" id="save-item-btn">Add Item</button>
      </div>`);

    $('save-item-btn').onclick = async () => {
      try {
        await api('POST', '/inventory', {
          item_code: $('ni-code').value, item_name: $('ni-name').value,
          category: $('ni-cat').value, unit: $('ni-unit').value,
          quantity_on_hand: +$('ni-qty').value, reorder_threshold: +$('ni-reorder').value,
          location: $('ni-loc').value, expiry_date: $('ni-expiry').value || null,
        });
        closeModal(); loadInventory();
      } catch(e) { alert(e.message); }
    };
  };
};

window.openTxnModal = (id, name) => {
  openModal(`Record Transaction — ${name}`, `
    <div class="form-grid">
      <div class="form-group"><label>Transaction Type *</label>
        <select id="txn-type">
          <option value="restock">Restock (+)</option>
          <option value="dispense">Dispense (−)</option>
          <option value="adjustment">Adjustment</option>
          <option value="expired">Mark Expired (−)</option>
        </select>
      </div>
      <div class="form-group"><label>Quantity *</label><input id="txn-qty" type="number" min="1" value="1"></div>
      <div class="form-group full"><label>Performed By *</label><input id="txn-by" placeholder="Staff name"></div>
      <div class="form-group full"><label>Notes</label><input id="txn-notes" placeholder="Optional notes"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-blue" id="save-txn-btn">Record</button>
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
    } catch(e) { alert(e.message); }
  };
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE: LOW INVENTORY ALERT DASHBOARD
═══════════════════════════════════════════════════════════════════ */
PAGES['low-stock'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Low Inventory Alert Dashboard ]</h2><p>Items at or below reorder threshold</p></div>
      <button class="btn btn-ghost" onclick="navigate('low-stock')">↻ Refresh</button>
    </div>
    <div id="low-stock-content">Loading…</div>`;

  try {
    const { data, alert_count } = await api('GET', '/inventory/alerts/low-stock');
    if (!data.length) {
      $('low-stock-content').innerHTML = '<div class="empty-state card" style="padding:48px"><div class="icon">✅</div><p>All stock levels are above threshold — no alerts</p></div>';
      return;
    }
    $('low-stock-content').innerHTML = `
      <div class="alert-strip warn" style="margin-bottom:16px">⚠️ ${alert_count} item${alert_count!==1?'s':''} require restocking</div>
      <div class="card">
        <table>
          <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>On Hand</th><th>Threshold</th><th>Deficit</th><th>Location</th></tr></thead>
          <tbody>${data.map(i => `
            <tr>
              <td>${badge(i.item_code,'gray')}</td>
              <td><strong>${i.item_name}</strong></td>
              <td>${badge(i.category,'blue')}</td>
              <td>${badge(i.quantity_on_hand,'red')}</td>
              <td>${i.reorder_threshold}</td>
              <td>${badge(i.reorder_threshold - i.quantity_on_hand,'orange')}</td>
              <td>${i.location || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) { $('low-stock-content').innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE: TRIAGE PRIORITY QUEUE
═══════════════════════════════════════════════════════════════════ */
PAGES['triage-queue'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Triage Priority Queue ]</h2><p>Active patients sorted by severity then arrival time</p></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" onclick="navigate('triage-queue')">↻ Refresh</button>
        <button class="btn btn-blue" id="btn-enqueue">+ Add to Queue</button>
      </div>
    </div>
    <div id="queue-content">Loading…</div>`;

  await loadQueue();

  $('btn-enqueue').onclick = () => showEnqueueModal();
};

async function loadQueue() {
  const el = $('queue-content');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue?status=waiting');
    if (!data.length) { el.innerHTML = '<div class="empty-state card" style="padding:48px"><div class="icon">🚑</div><p>No patients currently in queue</p></div>'; return; }

    const levels = { 1:'Immediate', 2:'Emergent', 3:'Urgent', 4:'Semi-Urgent', 5:'Non-Urgent' };
    el.innerHTML = `<div class="card"><table>
      <thead><tr><th>Triage</th><th>Patient</th><th>Complaint</th><th>Assigned To</th><th>Queued At</th><th>Action</th></tr></thead>
      <tbody>${data.map(r => `
        <tr class="triage-${r.triage_level}">
          <td><strong>T${r.triage_level}</strong><br><span style="font-size:11px">${levels[r.triage_level]}</span></td>
          <td><strong>${r.full_name || '—'}</strong><br><span style="font-size:11px;color:#9aa5b1">${r.patient_ref || ''}</span></td>
          <td>${r.chief_complaint}</td>
          <td>${r.assigned_to || badge('Unassigned','orange')}</td>
          <td style="font-size:12px">${fmt(r.queued_at)}</td>
          <td><button class="btn btn-sm btn-blue" onclick="resolveQueue(${r.id})">Mark Done</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
}

window.resolveQueue = async (id) => {
  try { await api('PATCH', `/queue/${id}`, { status: 'completed' }); loadQueue(); }
  catch(e) { alert(e.message); }
};

function showEnqueueModal() {
  openModal('Add Patient to [ Triage Priority Queue ]', `
    <div class="form-grid">
      <div class="form-group full"><label>Patient Reference</label><input id="eq-ref" placeholder="Search patient ref (e.g. PAT-001)"></div>
      <div class="form-group"><label>Triage Level *</label>
        <select id="eq-level">
          <option value="1">T1 — Immediate (life threatening)</option>
          <option value="2">T2 — Emergent (could deteriorate)</option>
          <option value="3" selected>T3 — Urgent (stable but needs care)</option>
          <option value="4">T4 — Semi-Urgent</option>
          <option value="5">T5 — Non-Urgent</option>
        </select>
      </div>
      <div class="form-group"><label>Assign To</label><input id="eq-assign" placeholder="Doctor / Nurse name"></div>
      <div class="form-group full"><label>Chief Complaint *</label>
        <textarea id="eq-complaint" rows="2" placeholder="Describe presenting complaint"></textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-blue" id="eq-save">Add to Queue</button>
    </div>`);

  $('eq-save').onclick = async () => {
    const ref = $('eq-ref').value.trim();
    if (!ref) { alert('Please enter a patient reference'); return; }
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(ref)}&limit=1`);
      if (!data.length) { alert('No patient found with that reference'); return; }
      await api('POST', '/queue', {
        patient_id:      data[0].id,
        triage_level:    +$('eq-level').value,
        chief_complaint: $('eq-complaint').value,
        assigned_to:     $('eq-assign').value || null,
      });
      closeModal(); loadQueue();
    } catch(e) { alert(e.message); }
  };
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE: STAFF DUTY ROSTER
═══════════════════════════════════════════════════════════════════ */
PAGES['staff-roster'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Staff Duty Roster ]</h2><p>Currently on-duty clinical staff</p></div>
      <button class="btn btn-blue" id="btn-add-staff">+ Add Shift</button>
    </div>
    <div id="roster-content">Loading…</div>`;

  await loadRoster();

  $('btn-add-staff').onclick = () => {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    openModal('Add Staff Shift', `
      <div class="form-grid">
        <div class="form-group"><label>Staff Name *</label><input id="sr-name" placeholder="Full name"></div>
        <div class="form-group"><label>Role *</label>
          <select id="sr-role">
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse</option>
            <option value="technician">Technician</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="form-group"><label>Shift Start *</label><input id="sr-start" type="datetime-local" value="${local}"></div>
        <div class="form-group"><label>Shift End *</label><input id="sr-end" type="datetime-local"></div>
        <div class="form-group full"><label>Ward</label><input id="sr-ward" placeholder="Ward / Department"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-blue" id="sr-save">Add to Roster</button>
      </div>`);

    $('sr-save').onclick = async () => {
      try {
        await api('POST', '/queue/roster', {
          staff_name:  $('sr-name').value,
          role:        $('sr-role').value,
          shift_start: new Date($('sr-start').value).toISOString(),
          shift_end:   new Date($('sr-end').value).toISOString(),
          ward:        $('sr-ward').value,
        });
        closeModal(); loadRoster();
      } catch(e) { alert(e.message); }
    };
  };
};

async function loadRoster() {
  const el = $('roster-content');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue/roster');
    if (!data.length) { el.innerHTML = '<div class="empty-state card" style="padding:48px"><div class="icon">👥</div><p>No staff currently on duty</p></div>'; return; }
    el.innerHTML = `<div class="card"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Ward</th><th>Shift Start</th><th>Shift End</th></tr></thead>
      <tbody>${data.map(s => `
        <tr>
          <td><strong>${s.staff_name}</strong></td>
          <td>${badge(s.role,'blue')}</td>
          <td>${s.ward || '—'}</td>
          <td>${fmt(s.shift_start)}</td>
          <td>${fmt(s.shift_end)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  } catch(e) { el.innerHTML = `<div class="alert-strip error">${e.message}</div>`; }
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE: DOCUMENT LIBRARY
═══════════════════════════════════════════════════════════════════ */
PAGES['doc-library'] = (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h2>[ Document Library Browser ]</h2><p>Offline-cached clinical guidelines, SOPs, and calculators</p></div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="alert-strip info">📚 Document storage is ready. Use the API <code>POST /api/documents</code> to load clinical guidelines and SOPs into the local database.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-top:20px">
          ${[['📋','Clinical Guidelines','Standard treatment protocols'],
             ['💊','Drug References','Dosage and interaction reference'],
             ['🔬','Lab Reference','Normal value ranges'],
             ['🧮','[ Interactive Calculator Interface ]','BMI, GFR, drug dose calculators'],
             ['📄','SOPs','Standard operating procedures'],
             ['🩺','Triage Protocols','Emergency triage decision guides']
            ].map(([icon,title,desc]) => `
            <div style="border:1.5px solid var(--gray-200);border-radius:8px;padding:16px;cursor:pointer;transition:border-color .2s" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--gray-200)'">
              <div style="font-size:28px;margin-bottom:8px">${icon}</div>
              <div style="font-weight:600;font-size:13px">${title}</div>
              <div style="font-size:12px;color:var(--gray-600);margin-top:3px">${desc}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
};
