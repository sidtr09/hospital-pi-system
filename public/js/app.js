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
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Request failed'), {
      status: res.status,
      code:   data.code,
    });
  }
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

function fmtDateOnly(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

const todayISO = () => new Date().toISOString().slice(0,10);

function badge(text, type='gray') {
  return `<span class="badge badge-${type}">${escapeHtml(text)}</span>`;
}

/* ─── Toast ───────────────────────────────────────────── */
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

/* ─── Skeleton helpers ────────────────────────────────── */
const skelLines = n => Array.from({length: n}, (_, i) =>
  `<div class="skel skel-line ${i % 2 ? 'med' : 'short'}"></div>`).join('');
const skelRows  = n => Array.from({length: n}, () =>
  `<div class="skel skel-row"></div>`).join('');

/* ─── Icon system (Lucide-style line SVGs, currentColor) ─ */
const ICONS = {
  // Navigation
  home:         '<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z"/>',
  search:       '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  userPlus:     '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  package:      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  alert:        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ambulance:    '<path d="M10 10h4M12 8v4"/><path d="M9 17h6"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M4 17h-2v-9a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3h3l3 4v3h-1"/>',
  users:        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  book:         '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  // Actions / UI
  plus:         '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  refresh:      '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  calendar:     '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  logout:       '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  x:            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  arrowRight:   '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  check:        '<polyline points="20 6 9 17 4 12"/>',
  // Status / state
  checkCircle:  '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  trendUp:      '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  trendDown:    '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  // Clinical / medical
  hospital:     '<path d="M3 21h18M3 7v14M21 7v14M6 21V11a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10M9 6V3h6v3M12 10v6M9 13h6"/>',
  cross:        '<rect x="9" y="3" width="6" height="18" rx="1"/><rect x="3" y="9" width="18" height="6" rx="1"/>',
  stethoscope:  '<path d="M11 2v2M5 2v2M5 3a2 2 0 0 0-2 2v4a4 4 0 0 0 4 4 4 4 0 0 0 4-4V5a2 2 0 0 0-2-2"/><path d="M8 13v3a5 5 0 0 0 10 0v-1"/><circle cx="18" cy="12" r="2"/>',
  user:         '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  fileText:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
  pill:         '<path d="M10.5 20.5L19 12a4.95 4.95 0 0 0-7-7L3.5 13.5a4.95 4.95 0 0 0 7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>',
  flask:        '<path d="M10 2v7.31"/><path d="M14 9.31V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 0 1-4 11.7 6.5 6.5 0 0 1-4-11.7"/>',
  calculator:   '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8.01" y2="10"/><line x1="12" y1="10" x2="12.01" y2="10"/><line x1="16" y1="10" x2="16.01" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="16" y1="18" x2="16.01" y2="18"/>',
  shieldCheck:  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  // System
  cpu:          '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  activity:     '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  edit:         '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash:        '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  alertCircle:  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  mail:         '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  inbox:        '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  send:         '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  zap:          '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
};

const ICON_TONES = {
  red:    '#dc2626',
  orange: '#d97706',
  amber:  '#b45309',
  green:  '#059669',
  teal:   '#0d9488',
  blue:   '#2563eb',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  rose:   '#e11d48',
  pink:   '#db2777',
  gray:   '#64748b',
};

function icon(name, size = 16, tone = null) {
  const path = ICONS[name];
  if (!path) return '';
  const color = tone && ICON_TONES[tone] ? `;color:${ICON_TONES[tone]}` : '';
  return `<span class="icon" style="width:${size}px;height:${size}px${color}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

/* ─── SVG chart helpers ───────────────────────────────── */
const TRI_COLORS = ['#fa5252', '#fd7e14', '#e67700', '#40c057', '#868e96'];

/* ─── Pending account approvals (admin only) ──────────────── */
async function loadPendingApprovals(toastOnNew = false) {
  if (currentRole !== 'Administrator') return;
  try {
    const { data, count } = await api('GET', '/auth/pending');
    const card = $('ad-pending-card');
    if (!card) return;
    if (!count) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    setText('ad-pending-count', `${count} pending`);
    setHTML('ad-pending-list', data.map(u => `
      <div class="pending-request" data-row-id="${u.id}">
        <div class="rail-avatar" style="width:34px;height:34px;font-size:13px;background:#fd7e14">${escapeHtml((u.full_name||'?').charAt(0).toUpperCase())}</div>
        <div class="who">
          <div class="nm">${escapeHtml(u.full_name)} <span style="font-weight:400;color:var(--text-mut)">· @${escapeHtml(u.username)}</span></div>
          <div class="mt">Requested role: <strong>${escapeHtml(u.role)}</strong> · ${fmt(u.requested_at)}</div>
        </div>
        <button class="btn btn-sm btn-primary-accent js-approve" data-uid="${u.id}" data-uname="${escapeHtml(u.full_name)}">${icon('check',12)}<span>Approve</span></button>
        <button class="btn btn-sm btn-secondary js-reject" data-uid="${u.id}" data-uname="${escapeHtml(u.full_name)}">${icon('x',12)}<span>Reject</span></button>
      </div>`).join(''));

    // Wire approve/reject via direct JS handlers — robust against any
    // weirdness from inline onclick and lets us disable buttons
    // mid-request to prevent double-fire.
    $('ad-pending-list').querySelectorAll('.js-approve').forEach(btn => {
      btn.onclick = () => decideUser(btn, 'approve');
    });
    $('ad-pending-list').querySelectorAll('.js-reject').forEach(btn => {
      btn.onclick = () => decideUser(btn, 'reject');
    });

    if (toastOnNew) toast(`${count} pending account request${count===1?'':'s'} need review`, 'warning');
  } catch (err) { /* silent — non-critical */ }
}

async function decideUser(btn, decision) {
  const id   = btn.dataset.uid;
  const name = btn.dataset.uname;
  if (!id) return;
  const row  = btn.closest('[data-row-id]');
  const pair = row ? row.querySelectorAll('button') : [];
  pair.forEach(b => b.disabled = true);
  btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML;
  btn.innerHTML = decision === 'approve' ? 'Approving…' : 'Rejecting…';

  try {
    if (decision === 'approve') {
      await api('POST', `/auth/users/${id}/approve`);
      toast(`Approved: ${name}`, 'success');
    } else {
      await api('DELETE', `/auth/users/${id}`);
      toast(`Rejected: ${name}`, 'info');
    }
    // Refresh every surface that shows pending data:
    await loadPendingApprovals();
    if (currentRole === 'Administrator') renderTasksBand('ad-tasks-band');
    refreshNotifications();
  } catch (err) {
    toast(err.message, 'error');
    pair.forEach(b => b.disabled = false);
    btn.innerHTML = btn.dataset.originalLabel || (decision === 'approve' ? 'Approve' : 'Reject');
  }
}

// Keep old function names as window aliases for any leftover inline references
window.approveUser = (id, name) => {
  const btn = document.querySelector(`.js-approve[data-uid="${id}"]`);
  if (btn) decideUser(btn, 'approve');
};
window.rejectUser = (id, name) => {
  const btn = document.querySelector(`.js-reject[data-uid="${id}"]`);
  if (btn) decideUser(btn, 'reject');
};

/* ─── Tasks band: small summary cards at top of dashboard ──── */
async function renderTasksBand(elId) {
  const el = $(elId);
  if (!el) return;
  const tiles = [];
  try {
    const calls = [api('GET', '/queue?status=waiting').catch(() => ({ data: [] }))];
    if (currentRole === 'Administrator') {
      calls.push(api('GET', '/auth/pending').catch(() => ({ data: [], count: 0 })));
      calls.push(api('GET', '/inventory/alerts/low-stock').catch(() => ({ data: [], alert_count: 0 })));
    }
    const results = await Promise.all(calls);
    const queue = results[0].data || [];
    const critical = queue.filter(r => r.triage_level <= 2).length;
    if (critical > 0) {
      tiles.push({
        tone: 'red', icon: 'ambulance', num: critical,
        ttl: 'Critical Triage', mt: 'T1 or T2 cases waiting',
        page: 'triage-queue',
      });
    }
    if (currentRole === 'Doctor') {
      const mine = queue.filter(r => r.assigned_to === currentUser).length;
      if (mine > 0) {
        tiles.push({
          tone: 'blue', icon: 'user', num: mine,
          ttl: 'Assigned to You', mt: 'Active cases',
          page: 'triage-queue',
        });
      }
    }
    if (currentRole === 'Administrator') {
      const pendingCount = results[1].count ?? 0;
      if (pendingCount > 0) {
        tiles.push({
          tone: 'orange', icon: 'userPlus', num: pendingCount,
          ttl: 'Account Approvals', mt: 'Awaiting review',
          page: 'dashboard',
        });
      }
      const lowCount = results[2].alert_count ?? 0;
      if (lowCount > 0) {
        tiles.push({
          tone: 'orange', icon: 'alert', num: lowCount,
          ttl: 'Low Stock', mt: 'Items below threshold',
          page: 'low-stock',
        });
      }
    }
  } catch { /* silent */ }

  if (!tiles.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = tiles.map(t => `
    <div class="task-card tone-${t.tone}" data-page="${t.page}" onclick="onNotifClick(this)">
      <div class="ico-wrap">${icon(t.icon, 18, t.tone)}</div>
      <div>
        <div class="ttl">${escapeHtml(t.ttl)}</div>
        <div class="mt">${escapeHtml(t.mt)}</div>
      </div>
      <div class="num">${t.num}</div>
    </div>`).join('');
}

function areaChart(values, opts = {}) {
  const W = opts.width  || 720;
  const H = opts.height || 200;
  const padL = 32, padR = 8, padT = 14, padB = 22;
  if (!values.length || values.every(v => v === 0))
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <text x="${W/2}" y="${H/2}" text-anchor="middle" class="tick">No activity yet</text></svg>`;
  const max = Math.max(...values, 1);
  const stepX = (W - padL - padR) / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [padL + i * stepX, padT + (H - padT - padB) * (1 - v/max)]);
  const linePath = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const areaPath = `${linePath} L${pts[pts.length-1][0].toFixed(1)},${H-padB} L${pts[0][0].toFixed(1)},${H-padB} Z`;
  const gridY = [0.25, 0.5, 0.75, 1].map(f => padT + (H - padT - padB) * f);
  const ticks = opts.xTicks || [];
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${gridY.map(y => `<line class="grid-line" x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"/>`).join('')}
    <text x="${padL-6}" y="${padT+4}" text-anchor="end" class="tick">${max}</text>
    <text x="${padL-6}" y="${H-padB+4}" text-anchor="end" class="tick">0</text>
    <path d="${areaPath}" class="area"/>
    <path d="${linePath}" class="line"/>
    ${ticks.map((t, i) => `<text x="${padL + i * ((W-padL-padR)/Math.max(ticks.length-1,1))}" y="${H-6}" text-anchor="middle" class="tick">${t}</text>`).join('')}
  </svg>`;
}

function donutChart(slices, size = 130, thickness = 16) {
  const total = slices.reduce((a, b) => a + b.value, 0);
  const r = size/2 - thickness/2;
  const cx = size/2, cy = size/2;
  if (!total) {
    return `<svg width="${size}" height="${size}" class="donut-svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e6e8ec" stroke-width="${thickness}"/>
    </svg>`;
  }
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
  (isoList || []).forEach(iso => {
    if (!iso) return;
    const d = new Date(iso); d.setHours(0,0,0,0);
    const idx = n - 1 - Math.floor((todayMs - d.getTime())/day);
    if (idx >= 0 && idx < n) buckets[idx]++;
  });
  const ticks = [];
  const step = Math.max(1, Math.floor(n/5));
  for (let i = 0; i < n; i += step) {
    ticks.push(new Date(todayMs - (n-1-i)*day)
      .toLocaleDateString('en-GB', { day:'2-digit', month:'short' }));
  }
  return { values: buckets, ticks };
}

/* ════════════════════════════════════════════════════════════════
   ROLE CONFIG
════════════════════════════════════════════════════════════════ */
const ROLE_CONFIG = {
  Administrator: {
    theme: 'role-admin',
    badge: 'Admin',
    nav: [
      { section: 'Overview' },
      { page: 'dashboard',        icon: 'home',      tone: 'blue',   label: 'Dashboard' },
      { section: 'Patients' },
      { page: 'patient-search',   icon: 'search',    tone: 'teal',   label: 'Patient Search' },
      { page: 'patient-register', icon: 'userPlus',  tone: 'green',  label: 'New Patient' },
      { section: 'Inventory' },
      { page: 'stock-ledger',     icon: 'package',   tone: 'orange', label: 'Stock Ledger' },
      { page: 'low-stock',        icon: 'alert',     tone: 'red',    label: 'Low Stock' },
      { section: 'Clinical Flow' },
      { page: 'triage-queue',     icon: 'ambulance', tone: 'red',    label: 'Triage Queue' },
      { page: 'staff-roster',     icon: 'users',     tone: 'violet', label: 'Staff Roster' },
      { section: 'Resources' },
      { page: 'doc-library',      icon: 'book',      tone: 'indigo', label: 'Documents' },
      { section: 'Team' },
      { page: 'team',             icon: 'users',     tone: 'violet', label: 'Team' },
      { section: 'Administration' },
      { page: 'staff-accounts',   icon: 'shieldCheck', tone: 'teal',  label: 'Staff Accounts' },
    ],
  },
  Doctor: {
    theme: 'role-doctor',
    badge: 'Doctor',
    nav: [
      { section: 'Overview' },
      { page: 'dashboard',        icon: 'home',      tone: 'blue',   label: 'Dashboard' },
      { section: 'Patients' },
      { page: 'patient-search',   icon: 'search',    tone: 'teal',   label: 'Patient Search' },
      { page: 'patient-register', icon: 'userPlus',  tone: 'green',  label: 'New Patient' },
      { section: 'Clinical Flow' },
      { page: 'triage-queue',     icon: 'ambulance', tone: 'red',    label: 'Triage Queue' },
      { section: 'Team' },
      { page: 'team',             icon: 'users',     tone: 'violet', label: 'Team' },
      { section: 'Resources' },
      { page: 'doc-library',      icon: 'book',      tone: 'indigo', label: 'Documents' },
    ],
  },
  Nurse: {
    theme: 'role-nurse',
    badge: 'Nurse',
    nav: [
      { section: 'Overview' },
      { page: 'dashboard',        icon: 'home',      tone: 'blue',   label: 'Dashboard' },
      { section: 'Patients' },
      { page: 'patient-search',   icon: 'search',    tone: 'teal',   label: 'Patient Search' },
      { page: 'patient-register', icon: 'userPlus',  tone: 'green',  label: 'New Patient' },
      { section: 'Clinical Flow' },
      { page: 'triage-queue',     icon: 'ambulance', tone: 'red',    label: 'Triage Queue' },
      { page: 'staff-roster',     icon: 'users',     tone: 'violet', label: 'Staff Roster' },
      { section: 'Team' },
      { page: 'team',             icon: 'users',     tone: 'violet', label: 'Team' },
      { section: 'Inventory' },
      { page: 'stock-ledger',     icon: 'package',   tone: 'orange', label: 'Stock Ledger' },
    ],
  },
};

let currentRole = null;
let currentUser = null;
let currentPage = null;

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
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal-overlay').classList.add('open');
}
function closeModal() { $('modal-overlay').classList.remove('open'); }
$('modal-close').onclick = closeModal;
$('modal-overlay').onclick = e => { if (e.target === $('modal-overlay')) closeModal(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === '/' && $('app').style.display === 'block' &&
      document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault(); $('global-search-input').focus();
  }
});

/* ════════════════════════════════════════════════════════════════
   SIDEBAR BUILD
════════════════════════════════════════════════════════════════ */
function buildSidebar(role) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return;
  $('sidebar').innerHTML = cfg.nav.map(it => it.section
    ? `<div class="nav-section">${escapeHtml(it.section)}</div>`
    : `<div class="nav-item" data-page="${it.page}">
         ${icon(it.icon, 16, it.tone || null)}<span class="nav-label">${escapeHtml(it.label)}</span>
       </div>`
  ).join('');
  $('sidebar').querySelectorAll('.nav-item').forEach(el => {
    el.onclick = () => navigate(el.dataset.page);
  });
}

/* ════════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════════ */
const PAGES = {};
function navigate(page) {
  currentPage = page;
  $('sidebar').querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));
  const fn = PAGES[page];
  if (fn) fn($('main-content'));
  else $('main-content').innerHTML = `<div class="empty"><div class="icon">${icon('alert', 36, 'orange')}</div><p>${escapeHtml(page)} — coming soon</p></div>`;
}

/* ════════════════════════════════════════════════════════════════
   AUTH — login / register / pending toggle
════════════════════════════════════════════════════════════════ */
function showAuthCard(which) {
  ['auth-login', 'auth-register', 'auth-pending'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('auth-card-hidden', id !== `auth-${which}`);
  });
}

async function tryLogin() {
  const u = $('username').value.trim();
  const p = $('password').value;
  setText('login-error', '');
  setText('login-btn', 'Signing in…');
  try {
    const { name, role } = await api('POST', '/auth/login', { username: u, password: p });
    currentRole = role;
    currentUser = name;
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.Administrator;

    document.body.className = cfg.theme;
    setText('user-name', name);
    setText('user-role', cfg.badge);
    setText('user-avatar', (name || '?').charAt(0).toUpperCase());

    buildSidebar(role);
    $('login-screen').style.display = 'none';
    $('app').style.display = 'block';
    startClock();
    setupGlobalSearch();
    setupNotifications();
    navigate('dashboard');
    toast(`Welcome back, ${name.split(' ')[0]}`, 'success');
  } catch (err) {
    if (err.code === 'pending' || err.code === 'rejected') {
      setText('pending-msg', err.message);
      showAuthCard('pending');
    } else {
      setText('login-error', err.message);
    }
  }
  setText('login-btn', 'Sign In');
}

async function tryRegister() {
  const fullName = $('r-fullname').value.trim();
  const username = $('r-username').value.trim();
  const role     = $('r-role').value;
  const password = $('r-password').value;
  setText('register-error', '');
  if (!fullName || !username || !password) {
    setText('register-error', 'Please fill all required fields'); return;
  }
  if (password.length < 6) {
    setText('register-error', 'Password must be at least 6 characters'); return;
  }
  setText('register-btn', 'Submitting…');
  try {
    const { message } = await api('POST', '/auth/register', {
      full_name: fullName, username, password, role,
    });
    setText('pending-msg', message || 'Your account is awaiting administrator approval.');
    ['r-fullname','r-username','r-password'].forEach(id => $(id).value = '');
    showAuthCard('pending');
  } catch (err) {
    setText('register-error', err.message);
  }
  setText('register-btn', 'Submit Request');
}

$('login-btn').onclick    = tryLogin;
$('register-btn').onclick = tryRegister;
$('password').onkeydown   = e => { if (e.key === 'Enter') tryLogin(); };
$('r-password').onkeydown = e => { if (e.key === 'Enter') tryRegister(); };
$('show-register').onclick = () => { setText('login-error',''); showAuthCard('register'); };
$('show-login').onclick    = () => { setText('register-error',''); showAuthCard('login'); };
$('pending-back').onclick  = () => showAuthCard('login');

$('logout-btn').onclick = async () => {
  await api('POST', '/auth/logout');
  document.body.className = '';
  currentRole = null; currentUser = null;
  clearNotifications();
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
  showAuthCard('login');
  $('username').value = ''; $('password').value = '';
};

/* ════════════════════════════════════════════════════════════════
   GLOBAL SEARCH (navbar)
════════════════════════════════════════════════════════════════ */
function setupGlobalSearch() {
  const input = $('global-search-input');
  const runSearch = debounce(async () => {
    const q = input.value.trim();
    if (!q) return;
    if (currentPage !== 'patient-search') navigate('patient-search');
    setTimeout(() => {
      const local = $('ps-input');
      if (local) { local.value = q; local.dispatchEvent(new Event('input')); }
    }, 60);
  }, 350);
  input.oninput = runSearch;
  input.onkeydown = e => {
    if (e.key === 'Escape') input.blur();
  };
}

/* ════════════════════════════════════════════════════════════════
   NOTIFICATIONS — bell button + dropdown panel + auto refresh
════════════════════════════════════════════════════════════════ */
let _notifTimer = null;
let _notifItems = [];

function setupNotifications() {
  const wrap = $('notif-wrap');
  if (!wrap) return;
  // Every signed-in clinical user gets the bell — Nurse needs it for messages,
  // Doctor and Admin keep their existing pending-task feeds plus messages.
  const allowed = ['Administrator', 'Doctor', 'Nurse'].includes(currentRole);
  wrap.style.display = allowed ? '' : 'none';
  if (!allowed) return;

  $('notif-btn').onclick = (e) => {
    e.stopPropagation();
    const panel = $('notif-panel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  };
  document.addEventListener('click', (e) => {
    const p = $('notif-panel');
    if (!p || p.style.display !== 'block') return;
    if (!wrap.contains(e.target)) p.style.display = 'none';
  });

  refreshNotifications();
  if (_notifTimer) clearInterval(_notifTimer);
  _notifTimer = setInterval(refreshNotifications, 30000);
}

function clearNotifications() {
  if (_notifTimer) { clearInterval(_notifTimer); _notifTimer = null; }
  _notifItems = [];
  const wrap = $('notif-wrap'); if (wrap) wrap.style.display = 'none';
}

async function refreshNotifications() {
  if (!['Administrator', 'Doctor', 'Nurse'].includes(currentRole)) return;
  try {
    const items = await collectNotifications();
    _notifItems = items;
    renderNotifPanel(items);
    updateNotifBadge(items.length);
    // Keep the dashboard's tasks band in sync
    if (currentPage === 'dashboard') {
      if (currentRole === 'Administrator') renderTasksBand('ad-tasks-band');
      else if (currentRole === 'Doctor')   renderTasksBand('dd-tasks-band');
    }
  } catch (err) { /* silent */ }
}

async function collectNotifications() {
  const items = [];
  const calls = [];

  // Pending account approvals — admin only
  if (currentRole === 'Administrator') {
    calls.push(api('GET', '/auth/pending').then(({ data }) => {
      (data || []).forEach(u => items.push({
        section: 'Account Approvals',
        ttl: `${u.full_name} wants ${u.role} access`,
        mt:  `Submitted ${fmt(u.requested_at)}`,
        icon: 'userPlus', tone: 'orange',
        page: 'dashboard',
      }));
    }).catch(() => {}));
  }

  // Critical triage queue — admin + doctor
  calls.push(api('GET', '/queue?status=waiting').then(({ data }) => {
    const rows = data || [];
    rows.filter(r => r.triage_level <= 2).forEach(r => items.push({
      section: 'Critical Triage',
      ttl: `T${r.triage_level} — ${r.full_name || 'Patient'}`,
      mt:  r.chief_complaint || '',
      icon: 'ambulance', tone: 'red',
      page: 'triage-queue',
    }));
    if (currentRole === 'Doctor') {
      rows.filter(r => r.assigned_to === currentUser).forEach(r => items.push({
        section: 'Assigned to You',
        ttl: `${r.full_name || 'Patient'} (T${r.triage_level})`,
        mt:  r.chief_complaint || '',
        icon: 'user', tone: 'blue',
        page: 'triage-queue',
      }));
    }
  }).catch(() => {}));

  // Low stock — admin only
  if (currentRole === 'Administrator') {
    calls.push(api('GET', '/inventory/alerts/low-stock').then(({ data }) => {
      (data || []).slice(0, 8).forEach(i => items.push({
        section: 'Low Stock',
        ttl: i.item_name,
        mt:  `${i.quantity_on_hand}/${i.reorder_threshold} ${i.unit||''} · ${i.location || 'Unknown location'}`,
        icon: 'alert', tone: 'orange',
        page: 'low-stock',
      }));
    }).catch(() => {}));
  }

  // Unread messages and requests — everyone signed in
  calls.push(api('GET', '/messages?unread=1').then(({ data }) => {
    (data || []).forEach(m => items.push({
      section: m.kind === 'request' ? 'New Requests' : 'New Messages',
      ttl: `${m.from_name}: ${truncate(m.body, 60)}`,
      mt:  `${m.from_role || 'Staff'} · ${fmt(m.created_at)}`,
      icon: m.kind === 'request' ? 'zap' : 'mail',
      tone: m.kind === 'request' ? 'orange' : 'blue',
      page: 'team',
    }));
  }).catch(() => {}));

  await Promise.all(calls);
  return items;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function updateNotifBadge(count) {
  const badge = $('notif-badge');
  const btn   = $('notif-btn');
  if (!badge || !btn) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
    btn.classList.add('has-items');
  } else {
    badge.style.display = 'none';
    btn.classList.remove('has-items');
  }
}

function renderNotifPanel(items) {
  setText('notif-summary', items.length ? `${items.length} pending` : 'All clear');
  const list = $('notif-list');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div class="notif-empty">${icon('checkCircle', 28, 'green')}<div style="margin-top:8px">You're all caught up</div></div>`;
    return;
  }
  const grouped = {};
  items.forEach(it => { (grouped[it.section] ||= []).push(it); });
  list.innerHTML = Object.entries(grouped).map(([section, group]) => `
    <div class="notif-section-head">${escapeHtml(section)} · ${group.length}</div>
    ${group.map((it, i) => `
      <div class="notif-item" data-page="${it.page}" onclick="onNotifClick(this)">
        <div class="ico-wrap" style="background:#${({red:'fff5f5',orange:'fff4e6',blue:'e7f5ff',teal:'ecfdf9',violet:'f3f0ff'})[it.tone] || 'f1f3f5'}">
          ${icon(it.icon, 16, it.tone)}
        </div>
        <div class="body">
          <div class="ttl">${escapeHtml(it.ttl)}</div>
          <div class="mt">${escapeHtml(it.mt)}</div>
        </div>
      </div>`).join('')}
  `).join('');
}

window.onNotifClick = (el) => {
  const page = el.dataset.page;
  $('notif-panel').style.display = 'none';
  if (page && page !== currentPage) navigate(page);
  else if (page === currentPage && page === 'dashboard') navigate('dashboard'); // refresh
};

/* ════════════════════════════════════════════════════════════════
   DASHBOARD — routes per role
════════════════════════════════════════════════════════════════ */
PAGES['dashboard'] = (el) => {
  if (currentRole === 'Doctor')      renderDoctorDashboard(el);
  else if (currentRole === 'Nurse')  renderNurseDashboard(el);
  else                                renderAdminDashboard(el);
};

/* ─────────────── ADMIN DASHBOARD ─────────────── */
async function renderAdminDashboard(el) {
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Welcome, ${escapeHtml(currentUser?.split(' ')[0] || 'Admin')}</h1>
        <p>${today}</p>
      </div>
      <div class="page-actions">
        <button class="pill-btn" id="ad-today-btn">${icon('calendar', 14)}<span>Today</span></button>
        <button class="btn btn-secondary btn-sm" id="ad-refresh-btn">${icon('refresh', 14)}<span>Refresh</span></button>
      </div>
    </div>

    <!-- Pending tasks band — always at the top -->
    <div class="tasks-band" id="ad-tasks-band" style="display:none"></div>

    <!-- Pending account approvals (detail card, only when items exist) -->
    <div class="card pending-card" id="ad-pending-card" style="margin-bottom:20px;display:none">
      <div class="card-head">
        <h2>${icon('userPlus', 16, 'orange')}Pending Account Approvals</h2>
        <span class="meta" id="ad-pending-count">—</span>
      </div>
      <div id="ad-pending-list"></div>
    </div>

    <!-- Polished stat tiles -->
    <div class="stat-tiles">
      ${[
        ['t-gray',   'Total Patients',  'ad-0'],
        ['t-orange', 'In Queue',        'ad-1'],
        ['t-red',    'Low Stock',       'ad-2'],
        ['t-green',  'Staff On Duty',   'ad-3'],
      ].map(([t,lbl,id]) => `<div class="stat-tile ${t}">
        <div class="lbl">${lbl}</div>
        <div class="ring"></div>
        <div class="num" id="${id}">—</div>
      </div>`).join('')}
    </div>

    <!-- Hero: Registration trend chart + Triage rank list -->
    <div class="grid-7030 mb-5">
      <div class="card">
        <div class="card-head">
          <h2>Patient Registrations</h2>
          <span class="meta">Last 14 days</span>
        </div>
        <div class="card-body" id="ad-chart">${skelRows(2)}</div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Triage Queue</h2>
          <span class="meta">By severity</span>
        </div>
        <div class="card-body">
          <div id="ad-queue-bars">${skelLines(2)}</div>
          <div class="rank-list" id="ad-queue-rank">${skelLines(4)}</div>
        </div>
      </div>
    </div>

    <!-- Donut breakdowns + tables -->
    <div class="col-6040 mb-5">
      <div class="card">
        <div class="card-head">
          <h2>${icon('ambulance', 16, 'red')}Active Triage Queue</h2>
          <a class="meta" href="#" onclick="event.preventDefault();navigate('triage-queue')">View all →</a>
        </div>
        <div id="ad-queue">${skelRows(4)}</div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Triage Mix</h2>
          <span class="meta">Live distribution</span>
        </div>
        <div class="card-body">
          <div class="donut-wrap">
            <div class="donut-pos" id="ad-tri-donut">${skelLines(2)}</div>
            <div class="donut-legend" id="ad-tri-legend"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="col-6040 mb-5">
      <div class="card">
        <div class="card-head">
          <h2>${icon('alert', 16, 'orange')}Critical Low Stock</h2>
          <a class="meta" href="#" onclick="event.preventDefault();navigate('low-stock')">View all →</a>
        </div>
        <div id="ad-stock">${skelRows(4)}</div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Staff Mix</h2>
          <span class="meta">Currently on duty</span>
        </div>
        <div class="card-body">
          <div class="donut-wrap">
            <div class="donut-pos" id="ad-staff-donut">${skelLines(2)}</div>
            <div class="donut-legend" id="ad-staff-legend"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('cpu', 16, 'teal')}System Health</h2><span class="meta">Live</span></div>
      <div class="card-body" id="ad-health">${skelLines(2)}</div>
    </div>`;

  $('ad-today-btn').onclick   = () => navigate('dashboard');
  $('ad-refresh-btn').onclick = () => navigate('dashboard');

  loadPendingApprovals(true);
  renderTasksBand('ad-tasks-band');

  const [pAll, q, ls, st, h] = await Promise.allSettled([
    api('GET', '/patients?limit=9999'),
    api('GET', '/queue?status=waiting'),
    api('GET', '/inventory/alerts/low-stock'),
    api('GET', '/queue/roster'),
    fetch('/api/health').then(r => r.json()),
  ]);

  // ── Stat tiles ──
  if (pAll.status === 'fulfilled') setText('ad-0', (pAll.value.count ?? 0).toLocaleString());
  if (q.status === 'fulfilled')    setText('ad-1', q.value.data?.length ?? 0);
  if (ls.status === 'fulfilled')   setText('ad-2', ls.value.alert_count ?? 0);
  if (st.status === 'fulfilled')   setText('ad-3', st.value.data?.length ?? 0);

  // ── Registration trend chart ──
  if (pAll.status === 'fulfilled') {
    const series = lastNDays(14, (pAll.value.data || []).map(p => p.registered_at));
    setHTML('ad-chart', areaChart(series.values, { xTicks: series.ticks }));
  }

  // ── Triage rank list + mini bars + donut ──
  if (q.status === 'fulfilled') {
    const rows = q.value.data || [];
    const byLevel = [1,2,3,4,5].map(L => rows.filter(r => r.triage_level === L).length);
    const maxLv = Math.max(...byLevel, 1);

    // Mini bars
    setHTML('ad-queue-bars', `<div class="bar-mini">
      ${byLevel.map((v,i) => `<div class="bar" style="height:${Math.max(4,(v/maxLv)*54)}px;background:${TRI_COLORS[i]}"></div>`).join('')}
    </div>`);

    // Rank list
    const labels = ['Immediate','Emergent','Urgent','Semi-Urgent','Non-Urgent'];
    setHTML('ad-queue-rank', `
      <div class="rank-head"><span>Triage Level</span><span>Cases</span></div>
      ${byLevel.map((v,i) => `<div class="rank-row">
        <span class="nm"><span class="tri-chip t${i+1}">T${i+1}</span> ${labels[i]}</span>
        <span class="v">${String(v).padStart(2,'0')}</span>
      </div>`).join('')}`);

    // Active queue table (left card)
    setHTML('ad-queue', rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Lvl</th><th>Patient</th><th>Complaint</th></tr></thead>
      <tbody>${rows.slice(0,5).map(r => `<tr class="tri-${r.triage_level} tri">
        <td><span class="tri-chip t${r.triage_level}">T${r.triage_level}</span></td>
        <td>${escapeHtml(r.full_name||'—')}</td>
        <td class="ellipsis" style="max-width:180px">${escapeHtml(r.chief_complaint)}</td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="icon">${icon('checkCircle', 36, 'green')}</div><p>Queue is clear</p></div>`);

    // Triage donut
    const triSlices = byLevel.map((v,i) => ({ label:`T${i+1} ${labels[i]}`, value:v, color: TRI_COLORS[i] }))
      .filter(s => s.value > 0);
    setHTML('ad-tri-donut', `${donutChart(triSlices)}
      <div class="donut-center"><div class="num">${rows.length}</div><div class="lbl">Cases</div></div>`);
    setHTML('ad-tri-legend', triSlices.length
      ? triSlices.map(s => `<div class="lg-row"><span class="sw" style="background:${s.color}"></span>${escapeHtml(s.label)} · <strong>${s.value}</strong></div>`).join('')
      : '<div class="text-faint" style="font-size:12px">No active cases</div>');
  }

  // ── Low stock table ──
  if (ls.status === 'fulfilled') {
    const items = ls.value.data || [];
    setHTML('ad-stock', items.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Item</th><th>On hand</th><th>Threshold</th></tr></thead>
      <tbody>${items.slice(0,5).map(i => `<tr>
        <td>${escapeHtml(i.item_name)}</td>
        <td>${badge(i.quantity_on_hand,'danger')}</td>
        <td>${i.reorder_threshold}</td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="icon">${icon('checkCircle', 36, 'green')}</div><p>All stock above threshold</p></div>`);
  }

  // ── Staff donut ──
  if (st.status === 'fulfilled') {
    const staff = st.value.data || [];
    const roleCounts = {};
    staff.forEach(s => { roleCounts[s.role] = (roleCounts[s.role]||0) + 1; });
    const palette = ['#228be6','#0d9488','#fd7e14','#7950f2','#fa5252','#fab005'];
    const slices = Object.entries(roleCounts).map(([k,v], i) => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      color: palette[i % palette.length],
    }));
    setHTML('ad-staff-donut', `${donutChart(slices)}
      <div class="donut-center"><div class="num">${staff.length}</div><div class="lbl">On Duty</div></div>`);
    setHTML('ad-staff-legend', slices.length
      ? slices.map(s => `<div class="lg-row"><span class="sw" style="background:${s.color}"></span>${escapeHtml(s.label)} · <strong>${s.value}</strong></div>`).join('')
      : '<div class="text-faint" style="font-size:12px">No staff on duty</div>');
  }

  // ── System health ──
  if (h.status === 'fulfilled') {
    const v = h.value;
    setHTML('ad-health', `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:16px">
      ${[['Status', v.status, 'color:var(--success);'],
         ['Uptime', `${Math.floor(v.uptime_s/3600)}h ${Math.floor((v.uptime_s%3600)/60)}m`, ''],
         ['RAM Used', `${v.memory.rss_mb} MB`, ''],
         ['Heap', `${v.memory.heap_used_mb}/${v.memory.heap_total_mb} MB`, ''],
         ['Database', v.db_status, v.db_status==='connected'?'color:var(--success);':'color:var(--danger);'],
        ].map(([lbl,val,sty]) => `<div>
          <div style="font-size:11px;color:var(--text-mut);text-transform:uppercase;letter-spacing:.5px">${lbl}</div>
          <div style="font-size:16px;font-weight:700;margin-top:3px;${sty}">${val}</div>
        </div>`).join('')}
    </div>`);
  }
}

/* ─────────────── DOCTOR DASHBOARD ─────────────── */
async function renderDoctorDashboard(el) {
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Welcome, Dr. ${escapeHtml(currentUser?.split(' ').slice(-1)[0] || 'Doctor')}</h1>
        <p>${today}</p>
      </div>
      <div class="page-actions">
        <button class="pill-btn" id="dd-today-btn">${icon('calendar', 14)}<span>Today</span></button>
        <button class="btn btn-secondary btn-sm" id="dd-refresh-btn">${icon('refresh', 14)}<span>Refresh</span></button>
      </div>
    </div>

    <!-- Pending tasks band — always at the top -->
    <div class="tasks-band" id="dd-tasks-band" style="display:none"></div>

    <div class="stat-tiles" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-tile t-blue">
        <div class="lbl">In Queue</div>
        <div class="ring"></div>
        <div class="num" id="dd-waiting">—</div>
      </div>
      <div class="stat-tile t-red">
        <div class="lbl">Critical (T1–T2)</div>
        <div class="ring"></div>
        <div class="num" id="dd-critical">—</div>
      </div>
      <div class="stat-tile t-violet">
        <div class="lbl">Assigned to Me</div>
        <div class="ring"></div>
        <div class="num" id="dd-mine">—</div>
      </div>
    </div>

    <div class="grid-7030 mb-5">
      <div class="card">
        <div class="card-head">
          <h2>${icon('ambulance', 16, 'red')}Triage Priority Queue</h2>
          <button class="btn btn-primary-accent btn-xs" onclick="showEnqueueModal(loadDoctorQueue)">+ Add</button>
        </div>
        <div id="dd-queue">${skelRows(5)}</div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Queue by Severity</h2>
          <span class="meta">Live</span>
        </div>
        <div class="card-body">
          <div id="dd-bars">${skelLines(2)}</div>
          <div class="rank-list" id="dd-rank">${skelLines(4)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('search', 16, 'blue')}Quick Patient Lookup</h2><span class="meta">Search by name or reference</span></div>
      <div class="card-body">
        <div class="live-search">
          <input id="dd-lookup" placeholder="Start typing a name or reference…" autofocus>
        </div>
        <div id="dd-lookup-result"></div>
      </div>
    </div>`;

  $('dd-today-btn').onclick   = () => navigate('dashboard');
  $('dd-refresh-btn').onclick = () => navigate('dashboard');

  renderTasksBand('dd-tasks-band');
  await loadDoctorQueue();

  const lookup = debounce(async () => {
    if (!$('dd-lookup') || !$('dd-lookup-result')) return;
    const q = $('dd-lookup').value.trim();
    if (!q) { setHTML('dd-lookup-result', '<div class="text-faint" style="font-size:12px;padding:8px 0">Type to find a patient — they\'ll appear here</div>'); return; }
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(q)}&limit=6`);
      setHTML('dd-lookup-result', data.length ? data.map(p => `
        <div class="recent-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="flex:1;min-width:0">
            <div class="name ellipsis">${escapeHtml(p.full_name)}</div>
            <div class="meta">${escapeHtml(p.patient_ref)} · DOB ${escapeHtml(p.date_of_birth)}</div>
          </div>
          <button class="btn btn-xs btn-primary-accent" data-pid="${p.id}" data-pname="${escapeHtml(p.full_name)}" onclick="viewNotes(this.dataset.pid, this.dataset.pname)">${icon('fileText',12)}<span>Notes</span></button>
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
    setText('dd-waiting',  data.length);
    setText('dd-critical', data.filter(r => r.triage_level <= 2).length);
    setText('dd-mine',     mineCount);

    // Queue severity bars + rank list (right side)
    const byLevel = [1,2,3,4,5].map(L => data.filter(r => r.triage_level === L).length);
    const maxLv = Math.max(...byLevel, 1);
    setHTML('dd-bars', `<div class="bar-mini">
      ${byLevel.map((v,i) => `<div class="bar" style="height:${Math.max(4,(v/maxLv)*54)}px;background:${TRI_COLORS[i]}"></div>`).join('')}
    </div>`);
    const labels = ['Immediate','Emergent','Urgent','Semi-Urgent','Non-Urgent'];
    setHTML('dd-rank', `
      <div class="rank-head"><span>Level</span><span>Cases</span></div>
      ${byLevel.map((v,i) => `<div class="rank-row">
        <span class="nm"><span class="tri-chip t${i+1}">T${i+1}</span> ${labels[i]}</span>
        <span class="v">${String(v).padStart(2,'0')}</span>
      </div>`).join('')}`);

    const el = $('dd-queue');
    if (!el) return;
    el.innerHTML = data.length ? `<div class="table-wrap"><table>
      <thead><tr><th>Lvl</th><th>Patient</th><th>Complaint</th><th>Assigned</th><th></th></tr></thead>
      <tbody>${data.slice(0,8).map(r => `<tr class="tri-${r.triage_level} tri">
        <td><span class="tri-chip t${r.triage_level}">T${r.triage_level}</span></td>
        <td>${escapeHtml(r.full_name||'—')}</td>
        <td class="ellipsis" style="max-width:140px">${escapeHtml(r.chief_complaint)}</td>
        <td>${r.assigned_to ? badge(r.assigned_to,'indigo') : badge('Unassigned','gray')}</td>
        <td style="white-space:nowrap">
          ${r.assigned_to !== currentUser
            ? `<button class="btn btn-xs btn-primary-accent js-assign-me" data-qid="${r.id}">${icon('user',12)}<span>Assign me</span></button>`
            : `<button class="btn btn-xs btn-ghost js-mark-done" data-qid="${r.id}">${icon('check',12)}<span>Mark done</span></button>`}
        </td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="icon">${icon('checkCircle', 36, 'green')}</div><p>Queue is clear</p></div>`;

    // Wire row buttons via JS — robust against inline-onclick quirks
    el.querySelectorAll('.js-assign-me').forEach(btn => { btn.onclick = () => assignSelf(btn); });
    el.querySelectorAll('.js-mark-done').forEach(btn => { btn.onclick = () => resolveSelf(btn); });
  } catch(e) { toast(e.message, 'error'); }
}

async function assignSelf(btn) {
  const id = btn.dataset.qid;
  if (!id) return;
  if (!currentUser) { toast('Please sign in again', 'warning'); return; }
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = 'Assigning…';
  try {
    await api('PATCH', `/queue/${id}`, { assigned_to: currentUser });
    toast('Case assigned to you', 'success');
    // Refresh the doctor dashboard's queue + the full triage queue + bell
    if (typeof loadDoctorQueue === 'function') await loadDoctorQueue();
    if (currentPage === 'triage-queue' && typeof loadFullQueue === 'function') await loadFullQueue();
    refreshNotifications();
    if (currentPage === 'dashboard' && currentRole === 'Doctor') renderTasksBand('dd-tasks-band');
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function resolveSelf(btn) {
  const id = btn.dataset.qid;
  if (!id) return;
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = 'Done…';
  try {
    await api('PATCH', `/queue/${id}`, { status: 'completed' });
    toast('Marked as done', 'success');
    if (typeof loadDoctorQueue === 'function') await loadDoctorQueue();
    if (currentPage === 'triage-queue' && typeof loadFullQueue === 'function') await loadFullQueue();
    refreshNotifications();
    if (currentPage === 'dashboard' && currentRole === 'Doctor') renderTasksBand('dd-tasks-band');
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// Back-compat aliases for any leftover inline references
window.assignToMe = (id) => {
  const btn = document.querySelector(`.js-assign-me[data-qid="${id}"]`);
  if (btn) assignSelf(btn);
  else assignSelf({ dataset: { qid: id }, disabled: false, innerHTML: '' });
};

/* ─────────────── NURSE DASHBOARD ─────────────── */
async function renderNurseDashboard(el) {
  const today = new Date().toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long'});
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Welcome, ${escapeHtml(currentUser?.split(' ')[0] || 'Nurse')}</h1>
        <p>${today}</p>
      </div>
      <div class="page-actions">
        <button class="pill-btn" id="nd-today-btn">${icon('calendar', 14)}<span>Today</span></button>
        <button class="btn btn-secondary btn-sm" id="nd-refresh-btn">${icon('refresh', 14)}<span>Refresh</span></button>
      </div>
    </div>
    <div class="stat-tiles" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-tile t-violet">
        <div class="lbl">Queue Waiting</div>
        <div class="ring"></div>
        <div class="num" id="nd-waiting">—</div>
      </div>
      <div class="stat-tile t-red">
        <div class="lbl">Low Stock</div>
        <div class="ring"></div>
        <div class="num" id="nd-stock">—</div>
      </div>
      <div class="stat-tile t-green">
        <div class="lbl">On Duty</div>
        <div class="ring"></div>
        <div class="num" id="nd-staff">—</div>
      </div>
    </div>
    <div class="col-4060">
      <div class="card">
        <div class="card-head"><h2>${icon('plus', 16, 'green')}Quick Triage Intake</h2><span class="meta">3 steps</span></div>
        <div class="card-body">
          <div id="nd-intake-msg"></div>
          <div class="form-group" style="margin-bottom:12px">
            <label>1. Patient Reference <span class="req">*</span></label>
            <div class="row" style="gap:6px">
              <input id="nd-ref" placeholder="e.g. PAT-001" style="flex:1;padding:0 12px;height:36px;border:1.5px solid var(--border);border-radius:var(--r);font-size:13px;outline:none;color:var(--text);background:var(--surface)">
              <button class="btn btn-secondary btn-sm" id="nd-find-btn" style="flex:0">Find</button>
            </div>
          </div>
          <div id="nd-patient-card" class="hidden" style="margin-bottom:12px;padding:10px 12px;background:var(--accent-tint);border-radius:var(--r);font-size:12px;border:1px solid var(--accent-soft)"></div>
          <div class="form-group" style="margin-bottom:12px">
            <label>2. Triage Level <span class="req">*</span></label>
            <select id="nd-level">
              <option value="1">T1 — Immediate (life-threatening)</option>
              <option value="2">T2 — Emergent</option>
              <option value="3" selected>T3 — Urgent</option>
              <option value="4">T4 — Semi-Urgent</option>
              <option value="5">T5 — Non-Urgent</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label>3. Chief Complaint <span class="req">*</span></label>
            <textarea id="nd-complaint" rows="2" placeholder="What brings them in?"></textarea>
          </div>
          <button class="btn btn-primary-accent" id="nd-submit" style="width:100%">Add to Triage Queue</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>${icon('ambulance', 16)}Current Queue</h2>
          <a class="meta" href="#" onclick="event.preventDefault();navigate('triage-queue')">View all →</a>
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
        ${data[0].blood_group ? '· '+badge(data[0].blood_group,'danger') : ''}`;
    } catch(e) { toast(e.message, 'error'); }
  };
  $('nd-ref').onkeydown = e => { if (e.key === 'Enter') $('nd-find-btn').click(); };

  $('nd-submit').onclick = async () => {
    if (!foundId) { toast('Find a patient first', 'warning'); return; }
    const complaint = $('nd-complaint').value.trim();
    if (!complaint) { toast('Enter the chief complaint', 'warning'); return; }
    try {
      await api('POST', '/queue', {
        patient_id: foundId,
        triage_level: +$('nd-level').value,
        chief_complaint: complaint,
      });
      toast('Patient added to triage queue', 'success');
      $('nd-ref').value = ''; $('nd-complaint').value = '';
      $('nd-patient-card').classList.add('hidden');
      $('nd-level').value = '3';
      foundId = null;
      $('nd-ref').focus();
      loadNurseData();
    } catch(e) { toast(e.message, 'error'); }
  };

  $('nd-today-btn').onclick   = () => navigate('dashboard');
  $('nd-refresh-btn').onclick = () => navigate('dashboard');

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
        <td><span class="tri-chip t${r.triage_level}">T${r.triage_level}</span></td>
        <td>${escapeHtml(r.full_name||'—')}</td>
        <td class="ellipsis" style="max-width:140px">${escapeHtml(r.chief_complaint)}</td>
        <td><button class="btn btn-xs btn-ghost" onclick="resolveQueue(${r.id})">Done</button></td>
      </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="icon">${icon('checkCircle', 36, 'green')}</div><p>Queue is clear</p></div>`);
  }
  if (ls.status==='fulfilled') setText('nd-stock', ls.value.alert_count ?? 0);
  if (st.status==='fulfilled') setText('nd-staff', st.value.data?.length ?? 0);
}

/* ════════════════════════════════════════════════════════════════
   PATIENT SEARCH (live filter)
════════════════════════════════════════════════════════════════ */
PAGES['patient-search'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Patient Search</h1><p>Search by name or reference — results appear as you type</p></div>
      <button class="btn btn-primary-accent" id="ps-new-btn">${icon('userPlus', 14)}<span>New Patient</span></button>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="live-search">
          <input id="ps-input" type="text" placeholder="Start typing a name or reference…" autofocus>
        </div>
        <div id="ps-results">${skelRows(6)}</div>
      </div>
    </div>`;

  $('ps-new-btn').onclick = () => navigate('patient-register');

  const run = debounce(async () => {
    if (!$('ps-input')) return;
    const q = $('ps-input').value;
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(q)}&limit=50`);
      if (!data.length) {
        setHTML('ps-results', `<div class="empty">
          <div class="icon">${icon('user', 36, 'teal')}</div>
          <p>No patients ${q ? 'match this search' : 'registered yet'}</p>
          <button class="btn btn-primary-accent btn-sm" id="ps-empty-btn">${icon('userPlus', 12)}<span>Register First Patient</span></button>
        </div>`);
        const emptyBtn = $('ps-empty-btn');
        if (emptyBtn) emptyBtn.onclick = () => navigate('patient-register');
        return;
      }
      const canEdit = currentRole === 'Administrator' || currentRole === 'Doctor';
      setHTML('ps-results', `<div class="table-wrap"><table>
        <thead><tr><th>Reference</th><th>Name</th><th>DOB</th><th>Blood</th><th>Registered</th><th style="width:1%"></th></tr></thead>
        <tbody>${data.map(p => `<tr data-row-pid="${p.id}">
          <td><span class="mono" style="font-size:12px">${escapeHtml(p.patient_ref)}</span></td>
          <td><strong>${escapeHtml(p.full_name)}</strong></td>
          <td>${escapeHtml(p.date_of_birth)}</td>
          <td>${p.blood_group ? badge(p.blood_group,'danger') : '<span class="text-faint">—</span>'}</td>
          <td class="text-mut">${fmt(p.registered_at)}</td>
          <td style="white-space:nowrap;text-align:right">
            <button class="btn btn-xs btn-ghost js-notes" data-pid="${p.id}" data-pname="${escapeHtml(p.full_name)}">${icon('fileText',12)}<span>Notes</span></button>
            ${canEdit ? `<button class="btn btn-xs btn-ghost js-edit" data-pid="${p.id}" title="Edit patient">${icon('edit',12,'blue')}</button>` : ''}
            ${canEdit ? `<button class="btn btn-xs btn-ghost js-delete" data-pid="${p.id}" data-pname="${escapeHtml(p.full_name)}" title="Delete patient">${icon('trash',12,'red')}</button>` : ''}
          </td>
        </tr>`).join('')}</tbody></table></div>`);

      // Wire row buttons via JS handlers (robust against inline-onclick quirks)
      $('ps-results').querySelectorAll('.js-notes').forEach(btn => {
        btn.onclick = () => viewNotes(btn.dataset.pid, btn.dataset.pname);
      });
      $('ps-results').querySelectorAll('.js-edit').forEach(btn => {
        btn.onclick = () => editPatient(btn.dataset.pid);
      });
      $('ps-results').querySelectorAll('.js-delete').forEach(btn => {
        btn.onclick = () => confirmDeletePatient(btn.dataset.pid, btn.dataset.pname);
      });
    } catch(e) { setHTML('ps-results', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
  });
  $('ps-input').oninput = run;
  run();
};

// Re-run the active patient search after a successful edit/delete so the
// row is updated or removed without the caller having to know about it.
function refreshPatientSearch() {
  if (currentPage !== 'patient-search') return;
  const inp = $('ps-input');
  if (inp) inp.dispatchEvent(new Event('input'));
}

/* ════════════════════════════════════════════════════════════════
   EDIT PATIENT (Admin + Doctor)
════════════════════════════════════════════════════════════════ */
window.editPatient = async (id) => {
  openModal('Edit Patient', skelLines(5));
  try {
    const p = await api('GET', `/patients/${id}`);
    setHTML('modal-body', `
      <div class="form-grid">
        <div class="form-group">
          <label>Patient Reference</label>
          <input value="${escapeHtml(p.patient_ref)}" disabled style="opacity:.6">
          <span class="hint">Reference is immutable after registration</span>
        </div>
        <div class="form-group">
          <label>Full Name <span class="req">*</span></label>
          <input id="e-name" value="${escapeHtml(p.full_name||'')}">
        </div>
        <div class="form-group">
          <label>Date of Birth <span class="req">*</span></label>
          <input id="e-dob" type="date" value="${escapeHtml(p.date_of_birth||'')}">
        </div>
        <div class="form-group">
          <label>Sex</label>
          <select id="e-sex">
            <option value="" ${!p.sex?'selected':''}>— Select —</option>
            <option value="M" ${p.sex==='M'?'selected':''}>Male</option>
            <option value="F" ${p.sex==='F'?'selected':''}>Female</option>
            <option value="O" ${p.sex==='O'?'selected':''}>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Blood Group</label>
          <select id="e-blood">
            <option value="" ${!p.blood_group?'selected':''}>— Unknown —</option>
            ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g =>
              `<option ${p.blood_group===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Contact Number</label>
          <input id="e-contact" value="${escapeHtml(p.contact_number||'')}">
        </div>
        <div class="form-group full">
          <label>Address</label>
          <input id="e-address" value="${escapeHtml(p.address||'')}">
        </div>
        <div class="form-group full">
          <label>Known Allergies</label>
          <textarea id="e-allergy" rows="2">${escapeHtml(p.allergy_notes||'')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="e-cancel">Cancel</button>
        <button class="btn btn-primary-accent" id="e-save">Save Changes</button>
      </div>`);

    $('e-cancel').onclick = closeModal;
    $('e-save').onclick = async () => {
      const payload = {
        full_name:      $('e-name').value.trim(),
        date_of_birth:  $('e-dob').value,
        sex:            $('e-sex').value,
        blood_group:    $('e-blood').value,
        contact_number: $('e-contact').value,
        address:        $('e-address').value,
        allergy_notes:  $('e-allergy').value,
      };
      if (!payload.full_name || !payload.date_of_birth) {
        toast('Name and DOB are required', 'warning'); return;
      }
      const saveBtn = $('e-save');
      saveBtn.disabled = true;
      saveBtn.innerHTML = 'Saving…';
      try {
        await api('PUT', `/patients/${id}`, payload);
        toast('Patient updated', 'success');
        closeModal();
        refreshPatientSearch();
        refreshNotifications();
      } catch(e) {
        toast(e.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Changes';
      }
    };
  } catch(e) { setHTML('modal-body', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
};

/* ════════════════════════════════════════════════════════════════
   DELETE PATIENT (Admin + Doctor)
════════════════════════════════════════════════════════════════ */
window.confirmDeletePatient = (id, name) => {
  openModal('Delete Patient', `
    <div class="alert alert-error">${icon('alertCircle',16,'red')}<span>This will permanently delete the patient record, clinical notes, and any queue entries. This cannot be undone.</span></div>
    <p style="font-size:13px;margin-bottom:16px">Delete <strong>${escapeHtml(name)}</strong>?</p>
    <div class="form-actions">
      <button class="btn btn-ghost" id="d-cancel">Cancel</button>
      <button class="btn btn-danger" id="d-confirm">${icon('trash',12)}<span>Delete</span></button>
    </div>`);
  $('d-cancel').onclick = closeModal;
  $('d-confirm').onclick = async () => {
    const btn = $('d-confirm');
    btn.disabled = true;
    btn.innerHTML = 'Deleting…';
    try {
      await api('DELETE', `/patients/${id}`);
      toast(`Deleted: ${name}`, 'success');
      closeModal();
      refreshPatientSearch();
      refreshNotifications();
    } catch(e) {
      toast(e.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${icon('trash',12)}<span>Delete</span>`;
    }
  };
};

/* ════════════════════════════════════════════════════════════════
   CLINICAL NOTES MODAL (write access for Doctor/Admin only)
════════════════════════════════════════════════════════════════ */
window.viewNotes = async (id, name) => {
  openModal(`[ Clinical Notes ] — ${name}`, skelLines(4));
  try {
    const { data } = await api('GET', `/patients/${id}/notes`);
    const notesHtml = data.length
      ? data.map(n => `
        <div style="border-left:3px solid var(--accent);padding:10px 12px;margin-bottom:10px;background:var(--surface-2);border-radius:0 var(--r) var(--r) 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-weight:600;font-size:12px">${escapeHtml(n.authored_by)}</span>
            <span style="font-size:11px;color:var(--text-mut)">${fmt(n.created_at)}</span>
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
        <button class="btn btn-primary-accent" id="save-note">Save Note</button>
      </div>` : '';

    $('modal-body').innerHTML = notesHtml + addForm;

    if (canWrite) {
      $('save-note').onclick = async () => {
        const body = $('note-body').value.trim();
        if (!body) { toast('Note cannot be empty', 'warning'); return; }
        try {
          await api('POST', `/patients/${id}/notes`, {
            authored_by: $('note-author').value,
            note_type:   $('note-type').value,
            body,
          });
          toast('Note saved', 'success');
          viewNotes(id, name);
        } catch(e) { toast(e.message, 'error'); }
      };
    }
  } catch(e) { $('modal-body').innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`; }
};

/* ════════════════════════════════════════════════════════════════
   PATIENT REGISTRATION (Save & Add Another)
════════════════════════════════════════════════════════════════ */
PAGES['patient-register'] = (el) => {
  const auto = `PAT-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`;
  el.innerHTML = `
    <div class="page-header">
      <div><h1>New Patient</h1><p>Register a patient — tab through fields, then Save</p></div>
      <button class="btn btn-secondary" id="r-back-btn">← Back to search</button>
    </div>
    <div class="col-6040">
      <div class="card">
        <div class="card-head"><h2>Patient Details</h2><span class="meta">* required</span></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Patient Reference <span class="req">*</span></label>
              <input id="r-ref" value="${auto}" placeholder="PAT-2024-001">
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
            <button class="btn btn-ghost" id="r-cancel">Clear</button>
            <button class="btn btn-secondary" id="r-save-only">Save</button>
            <button class="btn btn-primary-accent" id="r-save-next">Save &amp; Add Another</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>${icon('fileText', 16, 'teal')}Recently Added</h2><span class="meta">Today</span></div>
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

  const clearForm = (newRef = true) => {
    ['r-name','r-dob','r-contact','r-address','r-allergy'].forEach(id => $(id).value = '');
    $('r-sex').value = ''; $('r-blood').value = '';
    if (newRef) $('r-ref').value = `PAT-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`;
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

  $('r-back-btn').onclick  = () => navigate('patient-search');
  $('r-cancel').onclick    = () => clearForm(true);
  $('r-save-only').onclick = () => save(false);
  $('r-save-next').onclick = () => save(true);

  async function loadRecent() {
    try {
      const { data } = await api('GET', '/patients?limit=6');
      $('r-recent').innerHTML = data.length
        ? data.map(p => `<div class="recent-item">
            <div class="name">${escapeHtml(p.full_name)}</div>
            <div class="meta">${escapeHtml(p.patient_ref)} · ${fmt(p.registered_at)}</div>
          </div>`).join('')
        : `<div class="empty" style="padding:24px"><p>No registrations yet</p></div>`;
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
      <div><h1>Stock Ledger</h1><p>Medicines, supplies and equipment</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="inv-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
        ${isAdmin ? `<button class="btn btn-primary-accent" id="btn-add-item">${icon('plus',14)}<span>Add Item</span></button>` : ''}
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <div class="row" style="margin-bottom:14px">
          <div class="live-search" style="flex:1;margin:0">
            <input id="inv-q" placeholder="Filter by name or code…">
          </div>
          <select id="inv-cat" style="flex:0;height:40px;padding:0 12px;border:1.5px solid var(--border);border-radius:var(--r);font-size:13px;outline:none;background:var(--surface)">
            <option value="">All categories</option>
            <option value="medicine">Medicine</option>
            <option value="supply">Supply</option>
            <option value="equipment">Equipment</option>
            <option value="consumable">Consumable</option>
          </select>
        </div>
        <div id="inv-table">${skelRows(6)}</div>
      </div>
    </div>`;

  let allItems = [];

  const renderTable = (items) => {
    if (!items.length) {
      $('inv-table').innerHTML = `<div class="empty">
        <div class="icon">${icon('package', 36, 'orange')}</div>
        <p>No items found</p>
        ${isAdmin ? `<button class="btn btn-primary-accent btn-sm" id="inv-empty-add-btn">${icon('plus',12)}<span>Add First Item</span></button>` : ''}
      </div>`;
      if (isAdmin) {
        const emptyBtn = $('inv-empty-add-btn');
        if (emptyBtn) emptyBtn.onclick = () => openAddItemModal(reloadInventory);
      }
      return;
    }
    $('inv-table').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>On hand</th><th>Unit</th><th>Reorder at</th><th>Location</th><th>Expiry</th><th></th></tr></thead>
      <tbody>${items.map(i => {
        const low = i.quantity_on_hand <= i.reorder_threshold;
        return `<tr>
          <td><span class="mono" style="font-size:12px">${escapeHtml(i.item_code)}</span></td>
          <td><strong>${escapeHtml(i.item_name)}</strong></td>
          <td>${badge(i.category,'teal')}</td>
          <td>${badge(i.quantity_on_hand, low ? 'danger' : 'success')}</td>
          <td class="text-mut">${escapeHtml(i.unit)}</td>
          <td class="text-mut">${i.reorder_threshold}</td>
          <td class="text-mut">${escapeHtml(i.location||'—')}</td>
          <td class="text-mut">${i.expiry_date ? fmtDateOnly(i.expiry_date) : '—'}</td>
          <td><button class="btn btn-xs btn-ghost" data-iid="${i.id}" data-iname="${escapeHtml(i.item_name)}" onclick="openTxnModal(this.dataset.iid, this.dataset.iname, reloadInventory)">Transact</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  };

  window.reloadInventory = async () => {
    const cat = $('inv-cat').value;
    try {
      const { data } = await api('GET', `/inventory${cat ? `?category=${cat}` : ''}`);
      allItems = data;
      filterAndRender();
    } catch(e) { $('inv-table').innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`; }
  };

  const filterAndRender = () => {
    const q = $('inv-q').value.toLowerCase().trim();
    const items = q
      ? allItems.filter(i => i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q))
      : allItems;
    renderTable(items);
  };

  $('inv-q').oninput = debounce(filterAndRender, 200);
  $('inv-cat').onchange = reloadInventory;
  $('inv-refresh-btn').onclick = () => reloadInventory();
  reloadInventory();

  if (isAdmin) {
    $('btn-add-item').onclick = () => openAddItemModal(reloadInventory);
  }
};

function openAddItemModal(onSaved) {
  openModal('Add Inventory Item', `
    <div class="form-grid">
      <div class="form-group"><label>Item Code <span class="req">*</span></label><input id="ni-code" placeholder="MED-001"></div>
      <div class="form-group"><label>Item Name <span class="req">*</span></label><input id="ni-name" placeholder="Paracetamol 500mg"></div>
      <div class="form-group"><label>Category <span class="req">*</span></label>
        <select id="ni-cat">
          <option value="medicine">Medicine</option>
          <option value="supply">Supply</option>
          <option value="equipment">Equipment</option>
          <option value="consumable">Consumable</option>
        </select>
      </div>
      <div class="form-group"><label>Unit <span class="req">*</span></label><input id="ni-unit" placeholder="tablet / vial / box"></div>
      <div class="form-group"><label>Initial Quantity</label><input id="ni-qty" type="number" value="0" min="0"></div>
      <div class="form-group"><label>Reorder At</label><input id="ni-reorder" type="number" value="10" min="0"></div>
      <div class="form-group"><label>Location</label><input id="ni-loc" placeholder="Ward A / Shelf 3"></div>
      <div class="form-group"><label>Expiry Date</label><input id="ni-expiry" type="date"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary-accent" id="save-item">Add Item</button>
    </div>`);
  $('save-item').onclick = async () => {
    try {
      await api('POST', '/inventory', {
        item_code: $('ni-code').value, item_name: $('ni-name').value,
        category:  $('ni-cat').value,  unit: $('ni-unit').value,
        quantity_on_hand:  +$('ni-qty').value,
        reorder_threshold: +$('ni-reorder').value,
        location:    $('ni-loc').value,
        expiry_date: $('ni-expiry').value || null,
      });
      toast('Item added', 'success');
      closeModal();
      if (onSaved) onSaved();
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
      <div class="form-group full"><label>Performed by <span class="req">*</span></label>
        <input id="txn-by" value="${escapeHtml(currentUser||'')}">
      </div>
      <div class="form-group full"><label>Notes</label><input id="txn-notes" placeholder="Optional"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary-accent" id="save-txn">Record</button>
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
      toast('Transaction recorded', 'success');
      closeModal();
      if (onSaved) onSaved();
    } catch(e) { toast(e.message, 'error'); }
  };
};

/* ════════════════════════════════════════════════════════════════
   LOW STOCK (Admin only)
════════════════════════════════════════════════════════════════ */
PAGES['low-stock'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Low Stock Alerts</h1><p>Items at or below their reorder threshold</p></div>
      <button class="btn btn-secondary btn-sm" id="ls-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
    </div>
    <div id="ls-content">${skelRows(6)}</div>`;
  $('ls-refresh-btn').onclick = () => navigate('low-stock');
  try {
    const { data, alert_count } = await api('GET', '/inventory/alerts/low-stock');
    if (!data.length) {
      $('ls-content').innerHTML = `<div class="card"><div class="empty">
        <div class="icon">${icon('shieldCheck', 36, 'green')}</div><p>All stock levels are above their threshold</p>
      </div></div>`;
      return;
    }
    $('ls-content').innerHTML = `
      <div class="alert alert-warn">${icon('alert',14,'orange')}<span>${alert_count} item${alert_count!==1?'s':''} need${alert_count===1?'s':''} restocking</span></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>On hand</th><th>Threshold</th><th>Deficit</th><th>Location</th></tr></thead>
        <tbody>${data.map(i => `<tr>
          <td><span class="mono" style="font-size:12px">${escapeHtml(i.item_code)}</span></td>
          <td><strong>${escapeHtml(i.item_name)}</strong></td>
          <td>${badge(i.category,'teal')}</td>
          <td>${badge(i.quantity_on_hand,'danger')}</td>
          <td>${i.reorder_threshold}</td>
          <td>${badge(i.reorder_threshold - i.quantity_on_hand,'warning')}</td>
          <td class="text-mut">${escapeHtml(i.location||'—')}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
  } catch(e) { $('ls-content').innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`; }
};

/* ════════════════════════════════════════════════════════════════
   TRIAGE QUEUE
════════════════════════════════════════════════════════════════ */
PAGES['triage-queue'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Triage Priority Queue</h1><p>Sorted by severity, then arrival time</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="tq-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
        <button class="btn btn-primary-accent" id="tq-add-btn">${icon('plus',14)}<span>Add to Queue</span></button>
      </div>
    </div>
    <div id="tq-content">${skelRows(6)}</div>`;
  $('tq-refresh-btn').onclick = () => loadFullQueue();
  $('tq-add-btn').onclick     = () => showEnqueueModal(() => loadFullQueue());
  await loadFullQueue();
};

async function loadFullQueue() {
  const el = $('tq-content');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue?status=waiting');
    if (!data.length) {
      el.innerHTML = `<div class="card"><div class="empty">
        <div class="icon">${icon('ambulance', 36, 'red')}</div><p>No patients in queue</p>
        <button class="btn btn-primary-accent btn-sm" id="tq-empty-add-btn">${icon('plus',12)}<span>Add First Patient</span></button>
      </div></div>`;
      const emptyBtn = $('tq-empty-add-btn');
      if (emptyBtn) emptyBtn.onclick = () => showEnqueueModal(loadFullQueue);
      return;
    }
    const labels = { 1:'Immediate', 2:'Emergent', 3:'Urgent', 4:'Semi-Urgent', 5:'Non-Urgent' };
    const isDoctor = currentRole === 'Doctor';
    el.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Triage</th><th>Patient</th><th>Complaint</th><th>Assigned</th><th>Queued</th><th style="width:1%"></th></tr></thead>
      <tbody>${data.map(r => `<tr class="tri-${r.triage_level} tri">
        <td>
          <span class="tri-num t${r.triage_level}">T${r.triage_level}</span>
          <div style="font-size:10px;color:var(--text-mut);margin-top:3px">${labels[r.triage_level]}</div>
        </td>
        <td><strong>${escapeHtml(r.full_name||'—')}</strong>
          <div style="font-size:11px;color:var(--text-mut)">${escapeHtml(r.patient_ref||'')}</div></td>
        <td>${escapeHtml(r.chief_complaint)}</td>
        <td>${r.assigned_to ? badge(r.assigned_to,'indigo') : badge('Unassigned','gray')}</td>
        <td class="text-mut" style="font-size:11px">${fmt(r.queued_at)}</td>
        <td style="white-space:nowrap;text-align:right">
          ${isDoctor && r.assigned_to !== currentUser
            ? `<button class="btn btn-xs btn-light js-assign-me" data-qid="${r.id}">${icon('user',12)}<span>Assign me</span></button>`
            : ''}
          <button class="btn btn-xs btn-primary-accent js-mark-done" data-qid="${r.id}" style="margin-left:4px">${icon('check',12)}<span>Mark Done</span></button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;

    // Wire row buttons via JS
    el.querySelectorAll('.js-assign-me').forEach(btn => { btn.onclick = () => assignSelf(btn); });
    el.querySelectorAll('.js-mark-done').forEach(btn => { btn.onclick = () => resolveSelf(btn); });
  } catch(e) { el.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`; }
}

window.resolveQueue = async (id) => {
  try {
    await api('PATCH', `/queue/${id}`, { status: 'completed' });
    toast('Marked as done', 'success');
    if (currentPage === 'dashboard') {
      if (currentRole === 'Doctor') loadDoctorQueue();
      else if (currentRole === 'Nurse') loadNurseData();
      else navigate('dashboard');
    } else navigate('triage-queue');
  } catch(e) { toast(e.message, 'error'); }
};

window.showEnqueueModal = (onSuccess) => {
  openModal('Add to [ Triage Queue ]', `
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
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary-accent" id="eq-save">Add</button>
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
      toast('Added to queue', 'success');
      closeModal();
      if (onSuccess) onSuccess();
    } catch(e) { toast(e.message, 'error'); }
  };
};

/* ════════════════════════════════════════════════════════════════
   STAFF ROSTER
════════════════════════════════════════════════════════════════ */
PAGES['staff-roster'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Staff Duty Roster</h1><p>Currently on-duty clinical staff</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="sr-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
        <button class="btn btn-primary-accent" id="add-shift">${icon('plus',14)}<span>Add Shift</span></button>
      </div>
    </div>
    <div id="roster">${skelRows(5)}</div>`;
  $('add-shift').onclick      = () => showAddShiftModal(loadRosterPage);
  $('sr-refresh-btn').onclick = () => loadRosterPage();
  loadRosterPage();
};

async function loadRosterPage() {
  const el = $('roster');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue/roster');
    if (!data.length) {
      el.innerHTML = `<div class="card"><div class="empty">
        <div class="icon">${icon('users', 36, 'violet')}</div><p>No staff currently on duty</p>
        <button class="btn btn-primary-accent btn-sm" id="sr-empty-add-btn">${icon('plus',12)}<span>Add First Shift</span></button>
      </div></div>`;
      const emptyBtn = $('sr-empty-add-btn');
      if (emptyBtn) emptyBtn.onclick = () => showAddShiftModal(loadRosterPage);
      return;
    }
    el.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Ward</th><th>Shift Start</th><th>Shift End</th></tr></thead>
      <tbody>${data.map(s => `<tr>
        <td><strong>${escapeHtml(s.staff_name)}</strong></td>
        <td>${badge(s.role,'teal')}</td>
        <td class="text-mut">${escapeHtml(s.ward||'—')}</td>
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
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary-accent" id="sr-save">Add to Roster</button>
    </div>`);
  $('sr-save').onclick = async () => {
    try {
      await api('POST', '/queue/roster', {
        staff_name:  $('sr-name').value, role: $('sr-role').value,
        shift_start: new Date($('sr-start').value).toISOString(),
        shift_end:   new Date($('sr-end').value).toISOString(),
        ward:        $('sr-ward').value,
      });
      toast('Shift added', 'success');
      closeModal();
      if (onSuccess) onSuccess();
    } catch(e) { toast(e.message, 'error'); }
  };
};

/* ════════════════════════════════════════════════════════════════
   STAFF ACCOUNTS (Admin only)
════════════════════════════════════════════════════════════════ */
PAGES['staff-accounts'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Staff Accounts</h1><p>All user accounts on the system — demo, approved and pending</p></div>
      <button class="btn btn-secondary btn-sm" id="sa-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
    </div>
    <div class="card">
      <div class="filter-row">
        <div class="filter-input"><input id="sa-q" placeholder="Filter by name or username…" autofocus></div>
        <select id="sa-status" style="height:36px;padding:0 12px;border:1px solid var(--border-2);border-radius:var(--r-sm);outline:none;background:var(--surface);font-size:13px">
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div id="sa-table">${skelRows(6)}</div>
    </div>`;

  let all = [];

  const render = () => {
    const q = ($('sa-q')?.value || '').toLowerCase().trim();
    const rows = q ? all.filter(u =>
      (u.full_name||'').toLowerCase().includes(q) ||
      (u.username||'').toLowerCase().includes(q)
    ) : all;

    if (!rows.length) {
      setHTML('sa-table', `<div class="empty"><div class="icon">${icon('users', 36, 'teal')}</div><p>No accounts match this filter</p></div>`);
      return;
    }

    setHTML('sa-table', `<div class="table-wrap"><table>
      <thead><tr>
        <th style="width:1%"></th>
        <th>Name</th>
        <th>Username</th>
        <th>Role</th>
        <th>Status</th>
        <th>Requested</th>
        <th>Decided By</th>
        <th style="width:1%"></th>
      </tr></thead>
      <tbody>${rows.map(u => `
        <tr data-uid="${u.id}">
          <td>
            <span class="rail-avatar" style="width:32px;height:32px;font-size:12px;background:${roleColor(u.role)}">
              ${escapeHtml((u.full_name||'?').charAt(0).toUpperCase())}
            </span>
          </td>
          <td><strong>${escapeHtml(u.full_name)}</strong>${u.is_demo ? ` ${badge('Demo','gray')}` : ''}</td>
          <td><span class="mono" style="font-size:12px">@${escapeHtml(u.username)}</span></td>
          <td>${badge(u.role, roleBadgeTone(u.role))}</td>
          <td>${statusBadge(u.status)}</td>
          <td class="text-mut" style="font-size:12px">${u.requested_at ? fmt(u.requested_at) : '—'}</td>
          <td class="text-mut" style="font-size:12px">${escapeHtml(u.decided_by||'—')}</td>
          <td style="white-space:nowrap;text-align:right">${renderActions(u)}</td>
        </tr>`).join('')}</tbody>
    </table></div>`);

    // Wire row buttons via JS handlers
    $('sa-table').querySelectorAll('.sa-approve').forEach(btn => {
      btn.onclick = () => saDecide(btn, 'approve');
    });
    $('sa-table').querySelectorAll('.sa-reject').forEach(btn => {
      btn.onclick = () => saDecide(btn, 'reject');
    });
    $('sa-table').querySelectorAll('.sa-revoke').forEach(btn => {
      btn.onclick = () => saRevoke(btn);
    });
  };

  const renderActions = (u) => {
    if (u.is_demo) return '<span class="text-faint" style="font-size:11px">Demo (locked)</span>';
    if (u.status === 'pending') {
      return `
        <button class="btn btn-xs btn-primary-accent sa-approve" data-uid="${u.id}" data-uname="${escapeHtml(u.full_name)}" title="Approve">${icon('check',12)}<span>Approve</span></button>
        <button class="btn btn-xs btn-secondary sa-reject" data-uid="${u.id}" data-uname="${escapeHtml(u.full_name)}" title="Reject" style="margin-left:4px">${icon('x',12)}<span>Reject</span></button>`;
    }
    return `<button class="btn btn-xs btn-ghost sa-revoke" data-uid="${u.id}" data-uname="${escapeHtml(u.full_name)}" title="Revoke access">${icon('trash',12,'red')}<span>Revoke</span></button>`;
  };

  const load = async () => {
    const status = $('sa-status').value;
    try {
      const res = await api('GET', `/auth/users${status ? `?status=${status}` : ''}`);
      all = res.data || [];
      render();
    } catch (e) { setHTML('sa-table', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
  };

  // Wire filter
  $('sa-q').oninput      = debounce(render, 150);
  $('sa-status').onchange = load;
  $('sa-refresh-btn').onclick = () => load();
  load();

  // Local handlers
  window.saDecide = async (btn, decision) => {
    const id   = btn.dataset.uid;
    const name = btn.dataset.uname;
    const pair = btn.closest('tr').querySelectorAll('button');
    pair.forEach(b => b.disabled = true);
    btn.innerHTML = decision === 'approve' ? 'Approving…' : 'Rejecting…';
    try {
      if (decision === 'approve') {
        await api('POST', `/auth/users/${id}/approve`);
        toast(`Approved: ${name}`, 'success');
      } else {
        await api('DELETE', `/auth/users/${id}`);
        toast(`Rejected: ${name}`, 'info');
      }
      await load();
      refreshNotifications();
    } catch (err) {
      toast(err.message, 'error');
      pair.forEach(b => b.disabled = false);
    }
  };

  window.saRevoke = (btn) => {
    const id   = btn.dataset.uid;
    const name = btn.dataset.uname;
    openModal('Revoke Access', `
      <div class="alert alert-error">${icon('alertCircle',16,'red')}<span>This will permanently remove the account. <strong>${escapeHtml(name)}</strong> will no longer be able to sign in.</span></div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="rv-cancel">Cancel</button>
        <button class="btn btn-danger" id="rv-confirm">${icon('trash',12)}<span>Revoke Access</span></button>
      </div>`);
    $('rv-cancel').onclick = closeModal;
    $('rv-confirm').onclick = async () => {
      $('rv-confirm').disabled = true;
      $('rv-confirm').innerHTML = 'Revoking…';
      try {
        await api('DELETE', `/auth/users/${id}`);
        toast(`Revoked: ${name}`, 'info');
        closeModal();
        await load();
        refreshNotifications();
      } catch (err) {
        toast(err.message, 'error');
        $('rv-confirm').disabled = false;
        $('rv-confirm').innerHTML = `${icon('trash',12)}<span>Revoke Access</span>`;
      }
    };
  };
};

function roleColor(role) {
  return { 'Administrator': '#0d9488', 'Doctor': '#4f46e5', 'Nurse': '#e11d48' }[role] || '#64748b';
}
function roleBadgeTone(role) {
  return { 'Administrator': 'teal', 'Doctor': 'indigo', 'Nurse': 'rose' }[role] || 'gray';
}
function statusBadge(status) {
  if (status === 'approved') return badge('Active',   'success');
  if (status === 'pending')  return badge('Pending',  'warning');
  if (status === 'rejected') return badge('Rejected', 'danger');
  return badge(status || '—', 'gray');
}

/* ════════════════════════════════════════════════════════════════
   TEAM — Staff directory + Inbox (Doctor / Nurse)
════════════════════════════════════════════════════════════════ */
PAGES['team'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>My Team</h1><p>See fellow clinical staff and exchange messages and requests</p></div>
      <button class="btn btn-outline btn-sm" id="tm-refresh">${icon('refresh',14)}<span>Refresh</span></button>
    </div>

    <div class="col-6040">
      <!-- Staff directory -->
      <div class="card">
        <div class="card-head">
          <h2>${icon('users',16,'violet')}Staff Directory</h2>
          <span class="meta" id="tm-staff-count">—</span>
        </div>
        <div class="filter-row">
          <div class="filter-input"><input id="tm-q" placeholder="Filter by name or role…" autofocus></div>
        </div>
        <div id="tm-staff">${skelRows(6)}</div>
      </div>

      <!-- Inbox -->
      <div class="card">
        <div class="card-head">
          <h2>${icon('inbox',16,'blue')}Inbox</h2>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="meta" id="tm-inbox-meta">—</span>
            <button class="btn btn-xs btn-ghost" id="tm-read-all" title="Mark all as read">${icon('check',12)}<span>Mark all read</span></button>
          </div>
        </div>
        <div id="tm-inbox">${skelRows(6)}</div>
      </div>
    </div>`;

  let allStaff = [];

  // ── Load staff directory ──
  const renderStaff = () => {
    const q = ($('tm-q')?.value || '').toLowerCase().trim();
    const list = q ? allStaff.filter(u =>
      (u.full_name||'').toLowerCase().includes(q) ||
      (u.role||'').toLowerCase().includes(q)
    ) : allStaff;

    setText('tm-staff-count', `${list.length} ${list.length === 1 ? 'colleague' : 'colleagues'}`);

    if (!list.length) {
      setHTML('tm-staff', `<div class="empty"><div class="icon">${icon('users',36,'violet')}</div><p>No colleagues match this filter</p></div>`);
      return;
    }

    setHTML('tm-staff', list.map(u => `
      <div class="pending-request" data-staff="${escapeHtml(u.username)}">
        <span class="rail-avatar" style="width:36px;height:36px;background:${roleColor(u.role)}">
          ${escapeHtml((u.full_name||'?').charAt(0).toUpperCase())}
        </span>
        <div class="who">
          <div class="nm">${escapeHtml(u.full_name)} ${u.is_demo ? badge('Demo','gray') : ''}</div>
          <div class="mt">${badge(u.role, roleBadgeTone(u.role))} · <span class="mono">@${escapeHtml(u.username)}</span></div>
        </div>
        <button class="btn btn-sm btn-light tm-send-msg"
                data-uname="${escapeHtml(u.username)}"
                data-name="${escapeHtml(u.full_name)}"
                data-kind="message">${icon('mail',12)}<span>Message</span></button>
        <button class="btn btn-sm btn-secondary tm-send-req"
                data-uname="${escapeHtml(u.username)}"
                data-name="${escapeHtml(u.full_name)}"
                data-kind="request" style="margin-left:4px">${icon('zap',12,'orange')}<span>Request</span></button>
      </div>`).join(''));

    $('tm-staff').querySelectorAll('.tm-send-msg, .tm-send-req').forEach(btn => {
      btn.onclick = () => openComposeModal(btn.dataset.uname, btn.dataset.name, btn.dataset.kind);
    });
  };

  const loadStaff = async () => {
    try {
      const { data } = await api('GET', '/auth/staff');
      allStaff = data || [];
      renderStaff();
    } catch (e) {
      setHTML('tm-staff', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`);
    }
  };

  // ── Load inbox ──
  const loadInbox = async () => {
    try {
      const { data, unread, count } = await api('GET', '/messages');
      const totalLabel = `${count} total${unread ? ` · ${unread} unread` : ''}`;
      setText('tm-inbox-meta', totalLabel);
      if (!count) {
        setHTML('tm-inbox', `<div class="empty"><div class="icon">${icon('inbox',36,'blue')}</div><p>Your inbox is empty</p></div>`);
        return;
      }
      setHTML('tm-inbox', data.map(m => renderInboxItem(m)).join(''));
      $('tm-inbox').querySelectorAll('.tm-read-btn').forEach(btn => {
        btn.onclick = () => markRead(btn.dataset.mid);
      });
      $('tm-inbox').querySelectorAll('.tm-reply-btn').forEach(btn => {
        btn.onclick = () => openComposeModal(btn.dataset.uname, btn.dataset.name, 'message');
      });
      $('tm-inbox').querySelectorAll('.tm-del-btn').forEach(btn => {
        btn.onclick = () => deleteMessage(btn.dataset.mid);
      });
    } catch (e) {
      setHTML('tm-inbox', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`);
    }
  };

  const renderInboxItem = (m) => {
    const kindIcon = m.kind === 'request' ? icon('zap',14,'orange') : icon('mail',14,'blue');
    const kindBadge = m.kind === 'request' ? badge('Request','warning') : badge('Message','blue');
    const unreadDot = m.is_read ? '' : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--danger);margin-right:6px;vertical-align:middle"></span>';
    return `
      <div class="pending-request" style="${m.is_read ? 'opacity:.85' : ''};border-left:${m.is_read ? '0' : '3px solid var(--danger)'}">
        <span class="rail-avatar" style="width:36px;height:36px;background:${roleColor(m.from_role)}">
          ${escapeHtml((m.from_name||'?').charAt(0).toUpperCase())}
        </span>
        <div class="who" style="flex:1;min-width:0">
          <div class="nm">${unreadDot}${escapeHtml(m.from_name)} ${kindBadge}</div>
          <div class="mt" style="margin-top:4px;color:var(--text);font-size:13px;line-height:1.4;white-space:normal">${escapeHtml(m.body)}</div>
          <div class="mt" style="margin-top:4px">${kindIcon} <span style="font-size:11px">${fmt(m.created_at)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${!m.is_read ? `<button class="btn btn-xs btn-ghost tm-read-btn" data-mid="${m.id}" title="Mark as read">${icon('check',12,'green')}</button>` : ''}
          <button class="btn btn-xs btn-ghost tm-reply-btn" data-uname="${escapeHtml(m.from_username)}" data-name="${escapeHtml(m.from_name)}" title="Reply">${icon('mail',12,'blue')}</button>
          <button class="btn btn-xs btn-ghost tm-del-btn" data-mid="${m.id}" title="Delete">${icon('trash',12,'red')}</button>
        </div>
      </div>`;
  };

  // ── Actions ──
  const markRead = async (id) => {
    try { await api('PATCH', `/messages/${id}/read`); await loadInbox(); refreshNotifications(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const deleteMessage = async (id) => {
    try { await api('DELETE', `/messages/${id}`); await loadInbox(); refreshNotifications(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const markAllRead = async () => {
    try { await api('POST', '/messages/read-all'); await loadInbox(); refreshNotifications(); toast('Inbox cleared', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  $('tm-q').oninput      = debounce(renderStaff, 150);
  $('tm-refresh').onclick = () => { loadStaff(); loadInbox(); };
  $('tm-read-all').onclick = markAllRead;

  // Initial load
  loadStaff();
  loadInbox();
};

// ── Compose modal — shared by directory and inbox-reply ──────────────
function openComposeModal(toUsername, toName, kindDefault = 'message') {
  const kindLabel = kindDefault === 'request' ? 'Request' : 'Message';
  openModal(`Send ${kindLabel} to ${toName}`, `
    <div class="form-grid">
      <div class="form-group full">
        <label>To</label>
        <input value="${escapeHtml(toName)} · @${escapeHtml(toUsername)}" disabled style="opacity:.7">
      </div>
      <div class="form-group full">
        <label>Type <span class="req">*</span></label>
        <select id="msg-kind">
          <option value="message" ${kindDefault==='message'?'selected':''}>Message</option>
          <option value="request" ${kindDefault==='request'?'selected':''}>Request</option>
        </select>
      </div>
      <div class="form-group full">
        <label>Body <span class="req">*</span></label>
        <textarea id="msg-body" rows="4" placeholder="Type your message…" autofocus></textarea>
        <span class="hint">Up to 2000 characters</span>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="msg-cancel">Cancel</button>
      <button class="btn btn-primary-accent" id="msg-send">${icon('send',12)}<span>Send</span></button>
    </div>`);

  $('msg-cancel').onclick = closeModal;
  $('msg-send').onclick = async () => {
    const body = $('msg-body').value.trim();
    if (!body) { toast('Body cannot be empty', 'warning'); return; }
    const btn = $('msg-send');
    btn.disabled = true;
    btn.innerHTML = 'Sending…';
    try {
      await api('POST', '/messages', {
        to_username: toUsername,
        kind:        $('msg-kind').value,
        body,
      });
      toast(`Sent to ${toName}`, 'success');
      closeModal();
      // If we sent from the Team page, refresh the inbox to show our reply landed
      if (currentPage === 'team') {
        const inbox = $('tm-inbox'); if (inbox) inbox.dispatchEvent(new Event('refresh'));
      }
      refreshNotifications();
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${icon('send',12)}<span>Send</span>`;
    }
  };
}

/* ════════════════════════════════════════════════════════════════
   DOCUMENT LIBRARY
════════════════════════════════════════════════════════════════ */
PAGES['doc-library'] = (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>[ Document Library ]</h1><p>Offline clinical guidelines, SOPs and calculators</p></div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-body">
        <div class="alert alert-info">${icon('book',14,'blue')}<span>Documents are stored locally on the Pi. Load guidelines via <code>POST /api/documents</code>.</span></div>
        <div class="doc-grid" style="margin-top:16px">
          ${[
            ['fileText',   'blue',   'Clinical Guidelines','Standard treatment protocols'],
            ['pill',       'teal',   'Drug References',    'Dosage and interactions'],
            ['flask',      'violet', 'Lab Reference',      'Normal value ranges'],
            ['calculator', 'orange', 'Calculator',         'BMI, GFR, drug dose'],
            ['book',       'indigo', 'SOPs',               'Standard operating procedures'],
            ['stethoscope','red',    'Triage Protocols',   'Emergency decision guides'],
          ].map(([n,c,t,d]) => `<div class="doc-tile" data-ttl="${escapeHtml(t)}">
            <div class="ico ico-${c}">${icon(n, 20, c)}</div>
            <div class="ttl">${escapeHtml(t)}</div>
            <div class="dsc">${escapeHtml(d)}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;

  // Tiles look clickable (cursor:pointer + hover lift) — give them honest
  // feedback until real content is loaded into /api/documents
  el.querySelectorAll('.doc-tile').forEach(tile => {
    tile.onclick = () => toast(`${tile.dataset.ttl} — coming soon`, 'info');
  });
};
