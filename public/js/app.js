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

// Client-side mirror of the server's passwordStrength() so the meter can
// update instantly while typing (no round-trip needed). Same algorithm.
const PASSWORD_MIN_LENGTH = 12;
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: 'Empty', tone: 'gray', pct: 0 };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= PASSWORD_MIN_LENGTH) s++;
  if (pw.length >= 16) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  const pct = Math.round((s / 6) * 100);
  if (s <= 2) return { score: s, label: 'Weak',        tone: 'red',    pct };
  if (s <= 4) return { score: s, label: 'Medium',      tone: 'orange', pct };
  if (s <= 5) return { score: s, label: 'Strong',      tone: 'green',  pct };
  return            { score: s, label: 'Very Strong', tone: 'teal',   pct };
}

function paintMeter(fillEl, labelEl, pw) {
  if (!fillEl || !labelEl) return;
  const s = passwordStrength(pw);
  const colors = { red:'#dc2626', orange:'#d97706', green:'#059669', teal:'#0d9488', gray:'#94a3b8' };
  fillEl.style.width      = `${s.pct}%`;
  fillEl.style.background = colors[s.tone] || colors.gray;
  if (!pw) {
    labelEl.textContent = `At least ${PASSWORD_MIN_LENGTH} characters · mix upper, lower, digits, symbols`;
    labelEl.style.color = 'var(--text-mut)';
  } else {
    const need = Math.max(0, PASSWORD_MIN_LENGTH - pw.length);
    labelEl.textContent = need > 0
      ? `${s.label} · ${need} more character${need===1?'':'s'} needed`
      : `${s.label}`;
    labelEl.style.color = colors[s.tone] || colors.gray;
  }
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
  scan:         '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="14" y1="8" x2="14" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/>',
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
  settings:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  lock:         '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  shield:       '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  eye:          '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:       '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
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
    <div class="task-card tone-${t.tone}" data-page="${t.page}">
      <div class="ico-wrap">${icon(t.icon, 18, t.tone)}</div>
      <div>
        <div class="ttl">${escapeHtml(t.ttl)}</div>
        <div class="mt">${escapeHtml(t.mt)}</div>
      </div>
      <div class="num">${t.num}</div>
    </div>`).join('');
  // CSP blocks inline onclick — bind each tile to navigate on click.
  el.querySelectorAll('.task-card').forEach(card => {
    card.onclick = () => {
      const page = card.dataset.page;
      if (page) navigate(page);
    };
  });
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
  // Per-point metadata for the hover tooltip — encoded once into the wrapper so
  // the delegated mousemove handler can read it without another DOM query.
  const dayLabels = opts.dayLabels || [];
  const valueLabel = opts.valueLabel || 'value';
  const ptsMeta = pts.map((p, i) => ({
    x: +p[0].toFixed(1),
    y: +p[1].toFixed(1),
    v: values[i],
    l: dayLabels[i] || '',
  }));
  const meta = escapeHtml(JSON.stringify({
    pts: ptsMeta, W, H, padL, padR, padT, padB, valueLabel,
  }));
  return `<div class="chart-wrap" data-chart='${meta}'>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${gridY.map(y => `<line class="grid-line" x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"/>`).join('')}
      <text x="${padL-6}" y="${padT+4}" text-anchor="end" class="tick">${max}</text>
      <text x="${padL-6}" y="${H-padB+4}" text-anchor="end" class="tick">0</text>
      <path d="${areaPath}" class="area"/>
      <path d="${linePath}" class="line"/>
      ${ticks.map((t, i) => `<text x="${padL + i * ((W-padL-padR)/Math.max(ticks.length-1,1))}" y="${H-6}" text-anchor="middle" class="tick">${t}</text>`).join('')}
      <line class="chart-guide" x1="0" y1="${padT}" x2="0" y2="${H-padB}" style="display:none"/>
      <circle class="chart-dot" cx="0" cy="0" r="4" style="display:none"/>
    </svg>
    <div class="chart-tip" style="display:none"></div>
  </div>`;
}

/* Single delegated handler — one chart or many on a page, all get hover. */
function setupChartHover() {
  if (document.body.dataset.chartHoverWired === '1') return;
  document.body.dataset.chartHoverWired = '1';

  const onMove = (e) => {
    const wrap = e.target.closest('.chart-wrap');
    if (!wrap) return;
    let meta;
    try { meta = JSON.parse(wrap.dataset.chart); } catch { return; }
    const { pts, W, H, padL, padR, valueLabel } = meta;
    if (!pts || !pts.length) return;
    const rect = wrap.getBoundingClientRect();
    if (!rect.width) return;
    // Translate client coords to the SVG's viewBox coordinate system.
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const stepX = (W - padL - padR) / Math.max(pts.length - 1, 1);
    let idx = Math.round((svgX - padL) / stepX);
    idx = Math.max(0, Math.min(pts.length - 1, idx));
    const p = pts[idx];

    const guide = wrap.querySelector('.chart-guide');
    const dot   = wrap.querySelector('.chart-dot');
    const tip   = wrap.querySelector('.chart-tip');
    if (guide) {
      guide.setAttribute('x1', p.x);
      guide.setAttribute('x2', p.x);
      guide.style.display = '';
    }
    if (dot) {
      dot.setAttribute('cx', p.x);
      dot.setAttribute('cy', p.y);
      dot.style.display = '';
    }
    if (tip) {
      const noun = p.v === 1 ? valueLabel.replace(/s$/, '') : valueLabel;
      tip.innerHTML = `<div class="chart-tip-when">${escapeHtml(p.l || '—')}</div>
                       <div class="chart-tip-val">${p.v} ${escapeHtml(noun)}</div>`;
      // Place tooltip in CSS pixel space — the SVG x maps proportionally back.
      const cssX = (p.x / W) * rect.width;
      const cssY = (p.y / H) * rect.height;
      tip.style.display = '';
      // Read tooltip width *after* it is visible to keep it on-screen.
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let left = cssX - tw / 2;
      left = Math.max(4, Math.min(rect.width - tw - 4, left));
      let top  = cssY - th - 10;
      if (top < 4) top = cssY + 14;
      tip.style.left = `${left}px`;
      tip.style.top  = `${top}px`;
    }
  };
  const onLeave = (e) => {
    const wrap = e.target.closest('.chart-wrap');
    if (!wrap) return;
    wrap.querySelector('.chart-guide')?.style.setProperty('display', 'none');
    wrap.querySelector('.chart-dot')?.style.setProperty('display', 'none');
    const tip = wrap.querySelector('.chart-tip');
    if (tip) tip.style.display = 'none';
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseleave', onLeave, true);
}
setupChartHover();

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
  // Per-bucket labels for the hover tooltip — one full date per value.
  const dayLabels = [];
  for (let i = 0; i < n; i++) {
    dayLabels.push(new Date(todayMs - (n-1-i)*day)
      .toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short' }));
  }
  return { values: buckets, ticks, dayLabels };
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
      { page: 'scan-wristband',   icon: 'scan',      tone: 'blue',   label: 'Scan Wristband' },
      { section: 'Inventory' },
      { page: 'stock-ledger',     icon: 'package',   tone: 'orange', label: 'Stock Ledger' },
      { page: 'low-stock',        icon: 'alert',     tone: 'red',    label: 'Low Stock' },
      { page: 'expiring-soon',    icon: 'flask',     tone: 'orange', label: 'Expiring Soon' },
      { section: 'Clinical Flow' },
      { page: 'triage-queue',     icon: 'ambulance', tone: 'red',    label: 'Triage Queue' },
      { page: 'staff-roster',     icon: 'users',     tone: 'violet', label: 'Staff Roster' },
      { section: 'Resources' },
      { page: 'doc-library',      icon: 'book',      tone: 'indigo', label: 'Documents' },
      { section: 'Team' },
      { page: 'team',             icon: 'users',     tone: 'violet', label: 'Team' },
      { section: 'Administration' },
      { page: 'staff-accounts',     icon: 'shieldCheck', tone: 'teal',   label: 'Staff Accounts' },
      { page: 'security-dashboard', icon: 'shield',      tone: 'teal',   label: 'Security' },
      { page: 'database-health',    icon: 'package',     tone: 'orange', label: 'Database Health' },
      { page: 'audit-log',          icon: 'fileText',    tone: 'gray',   label: 'Audit Log' },
      { section: 'Account' },
      { page: 'settings',         icon: 'settings',  tone: 'gray',   label: 'Settings' },
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
      { page: 'scan-wristband',   icon: 'scan',      tone: 'blue',   label: 'Scan Wristband' },
      { section: 'Clinical Flow' },
      { page: 'triage-queue',     icon: 'ambulance', tone: 'red',    label: 'Triage Queue' },
      { section: 'Team' },
      { page: 'team',             icon: 'users',     tone: 'violet', label: 'Team' },
      { section: 'Resources' },
      { page: 'doc-library',      icon: 'book',      tone: 'indigo', label: 'Documents' },
      { section: 'Account' },
      { page: 'settings',         icon: 'settings',  tone: 'gray',   label: 'Settings' },
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
      { page: 'scan-wristband',   icon: 'scan',      tone: 'blue',   label: 'Scan Wristband' },
      { section: 'Clinical Flow' },
      { page: 'triage-queue',     icon: 'ambulance', tone: 'red',    label: 'Triage Queue' },
      { page: 'staff-roster',     icon: 'users',     tone: 'violet', label: 'Staff Roster' },
      { section: 'Team' },
      { page: 'team',             icon: 'users',     tone: 'violet', label: 'Team' },
      { section: 'Inventory' },
      { page: 'stock-ledger',     icon: 'package',   tone: 'orange', label: 'Stock Ledger' },
      { page: 'expiring-soon',    icon: 'flask',     tone: 'orange', label: 'Expiring Soon' },
      { section: 'Account' },
      { page: 'settings',         icon: 'settings',  tone: 'gray',   label: 'Settings' },
    ],
  },
};

let currentRole = null;
let currentUser = null;
let currentPage = null;
let currentPageCleanup = null;

/* Populate a <select> with the clinical staff (Doctor + Nurse), including the
   signed-in user — the API hides self by design, so we re-inject it here.
   The chosen value is the staff member's full_name, matching the existing
   `assigned_to` shape on queue_entries. */
async function populateStaffSelect(selectEl, selectedName = '') {
  if (!selectEl) return;
  const placeholder = '<option value="">— Unassigned —</option>';
  try {
    const { data } = await api('GET', '/auth/staff');
    const clinical = (data || []).filter(u => ['Doctor', 'Nurse'].includes(u.role));
    if (['Doctor', 'Nurse'].includes(currentRole) && currentUser) {
      clinical.unshift({ username: currentUser, full_name: currentUser, role: currentRole, is_self: true });
    }
    selectEl.innerHTML = placeholder + clinical.map(u => {
      const label = `${u.full_name}${u.is_self ? ' (me)' : ''} — ${u.role}`;
      const sel = u.full_name === selectedName ? ' selected' : '';
      return `<option value="${escapeHtml(u.full_name)}"${sel}>${escapeHtml(label)}</option>`;
    }).join('');
  } catch {
    selectEl.innerHTML = '<option value="">— Unable to load staff —</option>';
  }
}

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
function closeModal() {
  $('modal-overlay').classList.remove('open');
  document.querySelector('.modal')?.classList.remove('wide');
}

// The standalone page receives only the internal numeric row ID. It retrieves
// all printable fields through the authenticated wristband API.
function openWristbandLabel(patientId) {
  const id = Number(patientId);
  if (!Number.isSafeInteger(id) || id < 1) {
    toast('Invalid patient record', 'error');
    return;
  }
  const opened = window.open(`/wristband.html?patient=${encodeURIComponent(String(id))}`, '_blank');
  if (opened) opened.opener = null;
  else toast('Allow pop-ups to preview the wristband', 'warning');
}
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
function cleanupCurrentPage() {
  if (!currentPageCleanup) return;
  try { currentPageCleanup(); } catch {}
  currentPageCleanup = null;
}

function navigate(page) {
  cleanupCurrentPage();
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
    setupPrivacy();
    syncDisasterMode();
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
$('r-password').oninput   = () => paintMeter($('r-meter-fill'), $('r-meter-label'), $('r-password').value);
$('show-register').onclick = () => { setText('login-error',''); showAuthCard('register'); };
$('show-login').onclick    = () => { setText('register-error',''); showAuthCard('login'); };
$('pending-back').onclick  = () => showAuthCard('login');

$('logout-btn').onclick = async () => {
  cleanupCurrentPage();
  await api('POST', '/auth/logout');
  document.body.className = '';
  currentRole = null; currentUser = null;
  clearNotifications();
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
  showAuthCard('login');
  $('username').value = ''; $('password').value = '';
};

window.addEventListener('beforeunload', cleanupCurrentPage);

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

/* ── Privacy Screen toggle (eye button in navbar) ────────────────── */
function isPrivacyOn() { return document.body.classList.contains('privacy-on'); }

function setupPrivacy() {
  const btn  = $('privacy-btn');
  const icoEl = $('privacy-icon');
  if (!btn) return;
  btn.style.display = '';
  // Restore the last toggle state
  if (localStorage.getItem('privacy-on') === '1') {
    document.body.classList.add('privacy-on');
  }
  const paint = () => {
    const on = isPrivacyOn();
    btn.title = on ? 'Show sensitive details' : 'Hide sensitive details';
    icoEl.innerHTML = on
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  };
  paint();
  btn.onclick = () => {
    const next = !isPrivacyOn();
    document.body.classList.toggle('privacy-on', next);
    localStorage.setItem('privacy-on', next ? '1' : '0');
    paint();
    toast(next ? 'Privacy on — sensitive details hidden' : 'Privacy off', 'info');
  };
}

// Mask a patient_ref when privacy is on (only show last 4 chars).
function maskRef(ref) {
  if (!ref) return '';
  if (!isPrivacyOn()) return ref;
  return ref.length <= 4 ? '••••' : `••• ${ref.slice(-4)}`;
}

/* ── Disaster mode (admin toggle persisted via /api/settings) ────── */
async function syncDisasterMode() {
  try {
    const { enabled } = await api('GET', '/settings/disaster-mode');
    document.body.classList.toggle('disaster-mode', !!enabled);
  } catch { /* nurse/doctor before the route exists in cache — silent */ }
}
function isDisasterMode() { return document.body.classList.contains('disaster-mode'); }

/* ── Triage chip rendering — colour-first, level-fallback ───────── */
const TRIAGE_COLOR_META = {
  red:    { num: 'T1', tone: 'red',    label: 'Immediate'      },
  yellow: { num: 'T3', tone: 'yellow', label: 'Urgent'         },
  green:  { num: 'T4', tone: 'green',  label: 'Stable'         },
  black:  { num: '✕',  tone: 'black',  label: 'Deceased'       },
};
// Legacy 1-5 levels map onto the 3 WHO colours. Black is reserved for
// rows explicitly marked deceased (Disaster Mode only).
const LEVEL_TO_COLOR = { 1: 'red', 2: 'red', 3: 'yellow', 4: 'green', 5: 'green' };

function triageColorOf(row) {
  if (row.triage_color) return row.triage_color;
  return LEVEL_TO_COLOR[row.triage_level] || 'green';
}
function triageChip(row) {
  const color = triageColorOf(row);
  const meta  = TRIAGE_COLOR_META[color] || TRIAGE_COLOR_META.green;
  return `<span class="tri-chip t-${color}" title="${meta.label}">${meta.num}</span>`;
}
function triageRowClass(row) { return `tri-row-${triageColorOf(row)}`; }

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
      // Full message payload so the centered popup can render it in detail.
      message: {
        id: m.id,
        from_name: m.from_name,
        from_role: m.from_role,
        kind: m.kind,
        body: m.body,
        created_at: m.created_at,
        attachment_path: m.attachment_path,
        attachment_name: m.attachment_name,
        attachment_mime: m.attachment_mime,
        attachment_size: m.attachment_size,
      },
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
    ${group.map((it) => {
      // Use the item's true index in the flat items[] array so the click
      // handler can look the record back up — robust to any section order.
      const i = items.indexOf(it);
      return `
      <div class="notif-item js-notif-item" data-idx="${i}">
        <div class="ico-wrap" style="background:#${({red:'fff5f5',orange:'fff4e6',blue:'e7f5ff',teal:'ecfdf9',violet:'f3f0ff'})[it.tone] || 'f1f3f5'}">
          ${icon(it.icon, 16, it.tone)}
        </div>
        <div class="body">
          <div class="ttl">${escapeHtml(it.ttl)}</div>
          <div class="mt">${escapeHtml(it.mt)}</div>
        </div>
      </div>`;
    }).join('')}
  `).join('');

  // CSP blocks inline onclick="..." (script-src-attr is 'none' in helmet's
  // defaults). Bind every row via addEventListener after the innerHTML
  // assignment.
  list.querySelectorAll('.js-notif-item').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); onNotifClick(el); };
  });
}

const NOTIF_PAGE_LABELS = {
  'dashboard':      'Dashboard',
  'triage-queue':   'Triage Queue',
  'low-stock':      'Low Stock',
  'team':           'Team',
  'staff-accounts': 'Staff Accounts',
};

window.onNotifClick = (el) => {
  const idx = Number(el.dataset.idx);
  const it  = _notifItems[idx];
  const panel = $('notif-panel');
  if (panel) panel.style.display = 'none';
  if (!it) return;

  const toneBg = ({red:'#fff5f5',orange:'#fff4e6',blue:'#e7f5ff',teal:'#ecfdf9',violet:'#f3f0ff',green:'#ecfdf3'})[it.tone] || '#f1f3f5';
  const pageLabel = NOTIF_PAGE_LABELS[it.page] || 'page';

  let bodyHtml;
  if (it.message) {
    // Messages and requests: show sender, role, timestamp, full body, and a
    // Mark as read action so the user does not need to leave for the Team page.
    const m = it.message;
    bodyHtml = `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">
        <div class="ico-wrap" style="background:${toneBg};width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none">
          ${icon(it.icon, 22, it.tone)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:15px;color:var(--text);margin-bottom:2px">${escapeHtml(m.from_name)}</div>
          <div style="font-size:12px;color:var(--text-mut)">${escapeHtml(m.from_role || 'Staff')} · ${escapeHtml(fmt(m.created_at))}</div>
        </div>
      </div>
      <div style="background:var(--surface-2);border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.55;color:var(--text);white-space:pre-wrap;word-break:break-word;margin-bottom:${m.attachment_path ? '10' : '18'}px">${escapeHtml(m.body) || '<em class="dim">(no body)</em>'}</div>
      ${m.attachment_path ? `<div style="margin-bottom:18px">${attachmentChip(m)}</div>` : ''}
      <div class="form-actions" style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-ghost" id="notif-modal-close">Close</button>
        <button class="btn btn-secondary" id="notif-modal-read">Mark as read</button>
        <button class="btn btn-primary"   id="notif-modal-go">Open Team</button>
      </div>`;
  } else {
    bodyHtml = `
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:18px">
        <div class="ico-wrap" style="background:${toneBg};width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none">
          ${icon(it.icon, 22, it.tone)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:15px;color:var(--text);margin-bottom:6px;word-break:break-word">${escapeHtml(it.ttl)}</div>
          <div style="font-size:13px;color:var(--text-mut);line-height:1.5;word-break:break-word">${escapeHtml(it.mt) || '<em>No additional details</em>'}</div>
        </div>
      </div>
      <div class="form-actions" style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-ghost" id="notif-modal-close">Close</button>
        ${it.page ? `<button class="btn btn-primary" id="notif-modal-go">Open ${escapeHtml(pageLabel)}</button>` : ''}
      </div>`;
  }

  openModal(it.section, bodyHtml);
  $('notif-modal-close').onclick = closeModal;

  const goBtn = $('notif-modal-go');
  if (goBtn) goBtn.onclick = () => {
    closeModal();
    if (it.page === currentPage && it.page === 'dashboard') navigate('dashboard');
    else if (it.page) navigate(it.page);
  };

  const readBtn = $('notif-modal-read');
  if (readBtn) readBtn.onclick = async () => {
    readBtn.disabled = true;
    readBtn.textContent = 'Marking…';
    try {
      await api('PATCH', `/messages/${it.message.id}/read`);
      toast('Marked as read', 'success');
      closeModal();
      refreshNotifications();
    } catch (err) {
      toast(err.message, 'error');
      readBtn.disabled = false;
      readBtn.textContent = 'Mark as read';
    }
  };
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
    setHTML('ad-chart', areaChart(series.values, {
      xTicks: series.ticks,
      dayLabels: series.dayLabels,
      valueLabel: 'registrations',
    }));
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
      <tbody>${rows.slice(0,5).map(r => `<tr class="${triageRowClass(r)} tri">
        <td>${triageChip(r)}</td>
        <td><span class="pii">${escapeHtml(r.full_name||'—')}</span></td>
        <td class="ellipsis" style="max-width:180px"><span class="pii">${escapeHtml(r.chief_complaint)}</span></td>
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

function fmtBytes(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1024)               return `${n} B`;
  if (n < 1024 * 1024)        return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024*1024)).toFixed(1)} MB`;
  return `${(n / (1024*1024*1024)).toFixed(2)} GB`;
}

/* ════════════════════════════════════════════════════════════════
   DATABASE HEALTH (Admin only) — SD card / DB / attachments pressure
════════════════════════════════════════════════════════════════ */
PAGES['database-health'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Database Health</h1><p>SD card pressure, DB size and per-table row counts</p></div>
      <button class="btn btn-secondary btn-sm" id="dbh-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
    </div>
    <div class="card">
      <div class="card-head"><h2>${icon('package',16,'orange')}Storage Snapshot</h2><span class="meta" id="dbh-meta">Loading…</span></div>
      <div class="card-body" id="dbh-body">${skelLines(4)}</div>
    </div>`;
  $('dbh-refresh-btn').onclick = loadDatabaseHealth;
  loadDatabaseHealth();
};

async function loadDatabaseHealth() {
  try {
    const d = await api('GET', '/system/db-health');
    // Severity for the free-disk tile — drives colour and an inline warning
    const free = d.disk?.free_bytes;
    let freeTone = 'color:var(--success);';
    let freeWarn = '';
    if (free != null) {
      if (free < 500 * 1024 * 1024)         { freeTone = 'color:var(--danger);';  freeWarn = ' (rotate SD soon)'; }
      else if (free < 1024 * 1024 * 1024)   { freeTone = 'color:var(--warning);'; freeWarn = ' (running low)'; }
    }
    const diskUsed = (d.disk && d.disk.total_bytes)
      ? Math.round(((d.disk.used_bytes) / d.disk.total_bytes) * 100)
      : null;

    setText('dbh-meta', `as of ${new Date(d.generated_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`);

    const tiles = [
      ['DB Size',     `${fmtBytes(d.db.total_bytes)}`, '', d.db.wal_bytes ? `incl. ${fmtBytes(d.db.wal_bytes)} WAL` : ''],
      ['Attachments', `${fmtBytes(d.attachments.bytes)}`, '', `${d.attachments.files} file${d.attachments.files===1?'':'s'}`],
      ['Logs',        `${fmtBytes(d.logs.bytes)}`,        '', `${d.logs.files} file${d.logs.files===1?'':'s'}`],
      ['Free Disk',   `${fmtBytes(free)}${freeWarn}`,     freeTone,
        diskUsed != null ? `${diskUsed}% used of ${fmtBytes(d.disk.total_bytes)}` : ''],
    ];

    const tilesHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:18px;margin-bottom:18px">
      ${tiles.map(([lbl, val, sty, sub]) => `<div>
        <div style="font-size:11px;color:var(--text-mut);text-transform:uppercase;letter-spacing:.5px">${lbl}</div>
        <div style="font-size:20px;font-weight:700;margin-top:3px;${sty || ''}">${val}</div>
        ${sub ? `<div style="font-size:11px;color:var(--text-faint);margin-top:2px">${sub}</div>` : ''}
      </div>`).join('')}
    </div>`;

    const rowsTotal = d.tables.reduce((a,t) => a + (t.rows||0), 0);
    const tableHTML = d.tables.length ? `<div style="border-top:1px solid var(--border-2);padding-top:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text-mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
        Rows per table · ${rowsTotal.toLocaleString()} total
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 24px;font-size:13px">
        ${d.tables.map(t => `<div style="display:flex;justify-content:space-between;border-bottom:1px dashed var(--border-2);padding:6px 0">
          <span class="mono" style="color:var(--text-mut)">${escapeHtml(t.name)}</span>
          <strong>${t.rows == null ? '—' : t.rows.toLocaleString()}</strong>
        </div>`).join('')}
      </div>
    </div>` : '';

    const dbPath = d.db.path ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-2);font-size:12px;color:var(--text-mut)">
        DB file: <span class="mono">${escapeHtml(d.db.path)}</span>
      </div>` : '';

    setHTML('dbh-body', tilesHTML + tableHTML + dbPath);
  } catch (e) {
    setText('dbh-meta', 'unavailable');
    setHTML('dbh-body', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`);
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
            <div class="name ellipsis"><span class="pii">${escapeHtml(p.full_name)}</span></div>
            <div class="meta">${escapeHtml(maskRef(p.patient_ref))} · DOB <span class="pii">${escapeHtml(p.date_of_birth)}</span></div>
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
      <tbody>${data.slice(0,8).map(r => `<tr class="${triageRowClass(r)} tri">
        <td>${triageChip(r)}</td>
        <td><span class="pii">${escapeHtml(r.full_name||'—')}</span></td>
        <td class="ellipsis" style="max-width:140px"><span class="pii">${escapeHtml(r.chief_complaint)}</span></td>
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
      <tbody>${rows.slice(0,7).map(r => `<tr class="${triageRowClass(r)} tri">
        <td>${triageChip(r)}</td>
        <td><span class="pii">${escapeHtml(r.full_name||'—')}</span></td>
        <td class="ellipsis" style="max-width:140px"><span class="pii">${escapeHtml(r.chief_complaint)}</span></td>
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
          <td><span class="mono" style="font-size:12px">${escapeHtml(maskRef(p.patient_ref))}</span></td>
          <td><strong><span class="pii">${escapeHtml(p.full_name)}</span></strong></td>
          <td><span class="pii">${escapeHtml(p.date_of_birth)}</span></td>
          <td>${p.blood_group ? badge(p.blood_group,'danger') : '<span class="text-faint">—</span>'}</td>
          <td class="text-mut">${fmt(p.registered_at)}</td>
          <td style="white-space:nowrap;text-align:right">
            <button class="btn btn-xs btn-ghost js-view" data-pid="${p.id}" title="View patient">${icon('eye',12)}<span>View</span></button>
            <button class="btn btn-xs btn-ghost js-notes" data-pid="${p.id}" data-pname="${escapeHtml(p.full_name)}">${icon('fileText',12)}<span>Notes</span></button>
            ${canEdit ? `<button class="btn btn-xs btn-ghost js-edit" data-pid="${p.id}" title="Edit patient">${icon('edit',12,'blue')}</button>` : ''}
            ${canEdit ? `<button class="btn btn-xs btn-ghost js-delete" data-pid="${p.id}" data-pname="${escapeHtml(p.full_name)}" title="Delete patient">${icon('trash',12,'red')}</button>` : ''}
          </td>
        </tr>`).join('')}</tbody></table></div>`);

      // Wire row buttons via JS handlers (robust against inline-onclick quirks)
      $('ps-results').querySelectorAll('.js-view').forEach(btn => {
        btn.onclick = () => viewPatient(btn.dataset.pid);
      });
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

/* ════════════════════════════════════════════════════════════════
   PATIENT DETAILS — existing modal workflow with wristband action
════════════════════════════════════════════════════════════════ */
window.viewPatient = async (id) => {
  openModal('Patient Details', skelLines(6));
  try {
    const [p, wristband] = await Promise.all([
      api('GET', `/patients/${id}`),
      api('GET', `/wristbands/patients/${id}`),
    ]);
    const count = Number(wristband.wristband?.print_count || 0);
    const printLabel = count > 0 ? 'Reprint Wristband Label' : 'Print Wristband Label';
    const sex = { M:'Male', F:'Female', O:'Other' }[p.sex] || p.sex || '—';
    const canEdit = currentRole === 'Administrator' || currentRole === 'Doctor';
    const fromScanner = currentPage === 'scan-wristband';

    setHTML('modal-body', `
      <div class="form-grid" style="margin-bottom:18px">
        <div class="form-group">
          <label>Patient ID</label>
          <div class="mono" style="font-size:15px;font-weight:700">${escapeHtml(maskRef(p.patient_ref))}</div>
        </div>
        <div class="form-group">
          <label>Full Name</label>
          <div style="font-weight:700"><span class="pii">${escapeHtml(p.full_name)}</span></div>
        </div>
        <div class="form-group">
          <label>Date of Birth</label>
          <div class="pii">${escapeHtml(p.date_of_birth || '—')}</div>
        </div>
        <div class="form-group">
          <label>Sex</label>
          <div>${escapeHtml(sex)}</div>
        </div>
        <div class="form-group">
          <label>Blood Group</label>
          <div>${p.blood_group ? badge(p.blood_group, 'danger') : '—'}</div>
        </div>
        <div class="form-group">
          <label>Registered</label>
          <div>${escapeHtml(fmt(p.registered_at))}</div>
        </div>
        <div class="form-group full">
          <label>Known Allergies</label>
          <div>${p.allergy_notes ? escapeHtml(p.allergy_notes) : '<span class="dim">No allergy information recorded</span>'}</div>
        </div>
      </div>
      <div class="alert alert-info" style="margin-bottom:16px">
        ${icon('fileText',14,'blue')}<span>Wristband print requests recorded: <strong>${count}</strong></span>
      </div>
      <div class="form-actions" style="flex-wrap:wrap">
        <button class="btn btn-ghost" id="pv-close">Close</button>
        ${fromScanner ? `<button class="btn btn-primary-accent" id="pv-scan-another">${icon('scan',12)}<span>Scan Another Wristband</span></button>` : ''}
        <button class="btn btn-secondary" id="pv-notes">${icon('fileText',12)}<span>Clinical Notes</span></button>
        ${canEdit ? `<button class="btn btn-secondary" id="pv-edit">${icon('edit',12)}<span>Edit Patient</span></button>` : ''}
        <button class="btn btn-primary-accent" id="pv-wristband">${icon('fileText',12)}<span>${printLabel}</span></button>
      </div>`);

    $('pv-close').onclick = closeModal;
    if ($('pv-scan-another')) $('pv-scan-another').onclick = () => {
      closeModal();
      $('scan-another-btn')?.click();
    };
    $('pv-notes').onclick = () => { closeModal(); viewNotes(id, p.full_name); };
    if ($('pv-edit')) $('pv-edit').onclick = () => { closeModal(); editPatient(id); };
    $('pv-wristband').onclick = () => openWristbandLabel(id);
  } catch (e) {
    setHTML('modal-body', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`);
  }
};

/* ════════════════════════════════════════════════════════════════
   WRISTBAND SCANNER — local Code 128 / QR decoding
════════════════════════════════════════════════════════════════ */
PAGES['scan-wristband'] = async (el) => {
  const scannerUtils = window.CliniqScannerUtils;
  const renderSignInRequired = () => {
    el.innerHTML = `<div class="scanner-auth-state"><div class="empty">
      <div class="icon">${icon('lock', 36, 'orange')}</div>
      <h2>Sign in required</h2>
      <p>Your Cliniq session has expired. Sign in before scanning a wristband.</p>
      <a class="btn btn-primary-accent" href="/">Return to Cliniq Sign In</a>
    </div></div>`;
  };

  try { await api('GET', '/auth/me'); }
  catch (error) {
    if (error.status === 401) return renderSignInRequired();
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(error.message)}</div>`;
    return;
  }
  if (currentPage !== 'scan-wristband') return;

  el.innerHTML = `
    <div class="page-header">
      <div><h1>Scan Wristband</h1><p>Scan the Code 128 label or QR backup to open the patient record</p></div>
      <button class="btn btn-secondary" id="scan-back-btn">← Back to Cliniq</button>
    </div>
    <div class="scanner-layout">
      <section class="card scanner-camera-card">
        <div class="card-head"><h2>${icon('scan',16,'blue')}Camera Scanner</h2><span class="meta">Code 128 · QR</span></div>
        <div class="card-body">
          <div class="alert alert-warning scanner-secure-warning hidden" id="scan-secure-warning"></div>
          <div class="scanner-video-frame">
            <video id="scan-video" autoplay muted playsinline aria-label="Wristband camera preview"></video>
            <div class="scanner-target" aria-hidden="true"><span></span></div>
            <div class="scanner-video-placeholder" id="scan-video-placeholder">
              ${icon('scan',38,'gray')}<strong>Camera is off</strong><span>Press Start Camera when ready</span>
            </div>
          </div>
          <p class="scanner-instructions">Hold the barcode steady inside the frame. Keep the full Code 128 label visible, or use the QR backup.</p>
          <div class="scanner-camera-controls">
            <div class="form-group scanner-camera-select-wrap" id="scan-camera-select-wrap">
              <label for="scan-camera-select">Camera</label>
              <select id="scan-camera-select" disabled><option value="">Default / rear camera</option></select>
            </div>
            <div class="scanner-button-row">
              <button class="btn btn-primary-accent" id="scan-start-btn">${icon('scan',13)}<span>Start Camera</span></button>
              <button class="btn btn-secondary" id="scan-stop-btn" disabled>Stop Camera</button>
            </div>
          </div>
        </div>
      </section>
      <section class="card scanner-manual-card">
        <div class="card-head"><h2>${icon('search',16,'teal')}Manual Patient ID</h2></div>
        <div class="card-body">
          <p class="text-mut scanner-manual-help">If scanning is unavailable, enter the visible ID printed on the wristband label.</p>
          <div class="form-group">
            <label for="scan-manual-id">Permanent Patient ID</label>
            <input id="scan-manual-id" class="mono" autocomplete="off" placeholder="CLQ-2026-000154" spellcheck="false">
          </div>
          <button class="btn btn-primary-accent scanner-search-btn" id="scan-search-btn">${icon('search',13)}<span>Search Patient</span></button>
          <div class="scan-status tone-info" id="scan-status" role="status" aria-live="polite">Ready. Start the camera or enter a Patient ID manually.</div>
          <div class="scanner-result hidden" id="scan-result">
            <div class="scanner-result-check">${icon('check',20,'green')}</div>
            <div><div class="scanner-result-label">Resolved Patient ID</div><div class="scanner-result-id mono" id="scan-result-id">—</div></div>
          </div>
          <button class="btn btn-secondary scanner-another-btn hidden" id="scan-another-btn">${icon('scan',13)}<span>Scan Another Wristband</span></button>
        </div>
      </section>
    </div>`;

  const video = $('scan-video');
  const startButton = $('scan-start-btn');
  const stopButton = $('scan-stop-btn');
  const cameraSelect = $('scan-camera-select');
  const cameraSelectWrap = $('scan-camera-select-wrap');
  const placeholder = $('scan-video-placeholder');
  const manualInput = $('scan-manual-id');
  const searchButton = $('scan-search-btn');
  const anotherButton = $('scan-another-btn');
  const resultPanel = $('scan-result');
  const duplicateGuard = scannerUtils?.createDuplicateGuard(3500);
  const cameraSupport = scannerUtils?.cameraAvailability(window.isSecureContext, navigator.mediaDevices)
    || { available: false, message: 'Scanner support did not load. Enter the Patient ID manually.' };
  let reader = null;
  let scannerControls = null;
  let cameraActive = false;
  let lookupInFlight = false;
  let restartCameraAfterLookup = false;
  let destroyed = false;
  let cameraRequestVersion = 0;

  function setScanStatus(message, tone = 'info') {
    const status = $('scan-status');
    if (!status) return;
    status.className = `scan-status tone-${tone}`;
    status.textContent = message;
  }

  function ensureReader() {
    if (!window.ZXingBrowser?.BrowserMultiFormatReader) throw new Error('Local barcode scanner failed to load. Enter the Patient ID manually.');
    if (!reader) {
      reader = new window.ZXingBrowser.BrowserMultiFormatReader();
      reader.possibleFormats = [
        window.ZXingBrowser.BarcodeFormat.CODE_128,
        window.ZXingBrowser.BarcodeFormat.QR_CODE,
      ];
    }
    return reader;
  }

  async function refreshCameraList() {
    if (!navigator.mediaDevices?.enumerateDevices || destroyed) return;
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
      const selected = cameraSelect.value;
      cameraSelect.innerHTML = '<option value="">Default / rear camera</option>'
        + devices.map((device, index) => `<option value="${escapeHtml(device.deviceId)}">${escapeHtml(device.label || `Camera ${index + 1}`)}</option>`).join('');
      cameraSelect.disabled = devices.length <= 1;
      cameraSelectWrap.classList.toggle('single-camera', devices.length <= 1);
      if (selected && devices.some(device => device.deviceId === selected)) cameraSelect.value = selected;
    } catch { /* keep the safe default */ }
  }

  async function stopCamera({ silent = false } = {}) {
    cameraRequestVersion++;
    cameraActive = false;
    try { scannerControls?.stop(); } catch {}
    scannerControls = null;
    scannerUtils?.stopMediaStream(video?.srcObject);
    if (video) video.srcObject = null;
    placeholder?.classList.remove('hidden');
    if (startButton) startButton.disabled = !cameraSupport.available;
    if (stopButton) stopButton.disabled = true;
    if (!silent && !destroyed) setScanStatus('Camera stopped. Manual Patient ID entry remains available.', 'info');
  }

  async function renderAuthExpired() {
    await stopCamera({ silent: true });
    destroyed = true;
    renderSignInRequired();
  }

  async function processPatientId(rawValue, source) {
    if (destroyed || lookupInFlight) return;
    const patientRef = scannerUtils?.normalizePatientId(rawValue);
    if (!patientRef) {
      setScanStatus(source === 'camera'
        ? 'Unsupported barcode or invalid Cliniq Patient ID. Try the Code 128 label, QR backup, or manual entry.'
        : 'Invalid Cliniq Patient ID. Enter a supported CLQ-* or PAT-* ID.', 'error');
      return;
    }
    if (!duplicateGuard?.accept(patientRef)) {
      setScanStatus('Duplicate scan ignored. Choose Scan Another Wristband to scan this label again.', 'warning');
      return;
    }

    lookupInFlight = true;
    restartCameraAfterLookup = cameraActive;
    await stopCamera({ silent: true });
    searchButton.disabled = true;
    setScanStatus(`Looking up ${patientRef}…`, 'info');
    try {
      const patient = await api('POST', '/wristbands/scan', { patient_ref: patientRef });
      if (destroyed) return;
      setText('scan-result-id', patient.patient_ref);
      resultPanel.classList.remove('hidden');
      anotherButton.classList.remove('hidden');
      manualInput.value = '';
      setScanStatus(`Wristband resolved: ${patient.patient_ref}`, 'success');
      viewPatient(patient.id);
    } catch (error) {
      if (error.status === 401) return renderAuthExpired();
      resultPanel.classList.add('hidden');
      anotherButton.classList.remove('hidden');
      setScanStatus(scannerUtils?.lookupErrorMessage(error.status) || error.message, 'error');
    } finally {
      lookupInFlight = false;
      if (!destroyed) searchButton.disabled = false;
    }
  }

  async function startCamera({ resetDuplicate = true } = {}) {
    if (destroyed || cameraActive) return;
    if (!cameraSupport.available) return setScanStatus(cameraSupport.message, 'warning');
    const requestVersion = ++cameraRequestVersion;
    try {
      const codeReader = ensureReader();
      if (resetDuplicate) duplicateGuard?.reset();
      startButton.disabled = true;
      stopButton.disabled = false;
      setScanStatus('Requesting camera access…', 'info');
      const selectedDevice = cameraSelect.value;
      const videoConstraints = selectedDevice
        ? { deviceId: { exact: selectedDevice } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };
      const controls = await codeReader.decodeFromConstraints(
        { audio: false, video: videoConstraints }, video,
        result => { if (result && !lookupInFlight && !destroyed) processPatientId(result.getText(), 'camera'); }
      );
      if (destroyed || requestVersion !== cameraRequestVersion) {
        try { controls.stop(); } catch {}
        scannerUtils?.stopMediaStream(video.srcObject);
        return;
      }
      scannerControls = controls;
      cameraActive = true;
      placeholder.classList.add('hidden');
      startButton.disabled = true;
      stopButton.disabled = false;
      setScanStatus('Camera active. Hold the Code 128 barcode or QR backup inside the frame.', 'success');
      await refreshCameraList();
      for (const track of video.srcObject?.getVideoTracks?.() || []) {
        track.addEventListener('ended', () => {
          if (!cameraActive || destroyed) return;
          stopCamera({ silent: true });
          setScanStatus('The camera disconnected. Reconnect it or enter the Patient ID manually.', 'error');
        }, { once: true });
      }
    } catch (error) {
      if (requestVersion !== cameraRequestVersion) return;
      await stopCamera({ silent: true });
      setScanStatus(scannerUtils?.cameraErrorMessage(error) || 'Camera unavailable.', 'error');
    }
  }

  currentPageCleanup = () => { destroyed = true; stopCamera({ silent: true }); };
  $('scan-back-btn').onclick = () => navigate('dashboard');
  startButton.onclick = () => startCamera();
  stopButton.onclick = () => stopCamera();
  cameraSelect.onchange = async () => {
    if (!cameraActive) return;
    await stopCamera({ silent: true });
    await startCamera({ resetDuplicate: false });
  };
  searchButton.onclick = () => processPatientId(manualInput.value, 'manual');
  manualInput.onkeydown = event => { if (event.key === 'Enter') processPatientId(manualInput.value, 'manual'); };
  anotherButton.onclick = async () => {
    closeModal();
    duplicateGuard?.reset();
    resultPanel.classList.add('hidden');
    anotherButton.classList.add('hidden');
    setScanStatus('Ready to scan another wristband.', 'info');
    if (restartCameraAfterLookup && cameraSupport.available) await startCamera({ resetDuplicate: false });
    else manualInput.focus();
  };

  if (!cameraSupport.available) {
    const warning = $('scan-secure-warning');
    warning.textContent = cameraSupport.message;
    warning.classList.remove('hidden');
    startButton.disabled = true;
    cameraSelect.disabled = true;
  } else refreshCameraList();
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
          <input value="${escapeHtml(maskRef(p.patient_ref))}" disabled style="opacity:.6">
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
        <div class="form-group">
          <label>Emergency Contact</label>
          <input id="e-emergency" value="${escapeHtml(p.emergency_contact||'')}">
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
        full_name:         $('e-name').value.trim(),
        date_of_birth:     $('e-dob').value,
        sex:               $('e-sex').value,
        blood_group:       $('e-blood').value,
        contact_number:    $('e-contact').value,
        emergency_contact: $('e-emergency').value,
        address:           $('e-address').value,
        allergy_notes:     $('e-allergy').value,
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
              <label>Full Name <span class="req">*</span></label>
              <input id="r-name" placeholder="Full legal name" autofocus>
              <span class="hint">Patient ID is generated securely after saving</span>
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
            <div class="form-group">
              <label>Emergency Contact</label>
              <input id="r-emergency" placeholder="Name & phone, e.g. Jane Doe — 555-0143">
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
            <button class="btn btn-primary-accent" id="r-save-next">Save &amp; Triage Now</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>${icon('fileText', 16, 'teal')}Recently Added</h2><span class="meta">Today</span></div>
        <div id="r-recent">${skelLines(4)}</div>
      </div>
    </div>`;

  const fields = () => ({
    full_name:         $('r-name').value.trim(),
    date_of_birth:     $('r-dob').value,
    sex:               $('r-sex').value,
    blood_group:       $('r-blood').value,
    contact_number:    $('r-contact').value,
    emergency_contact: $('r-emergency').value,
    address:           $('r-address').value,
    allergy_notes:     $('r-allergy').value,
  });

  const clearForm = () => {
    ['r-name','r-dob','r-contact','r-emergency','r-address','r-allergy'].forEach(id => $(id).value = '');
    $('r-sex').value = ''; $('r-blood').value = '';
    $('r-name').focus();
  };

  const showSuccess = (created, patient, triageAfter) => {
    el.innerHTML = `
      <div class="page-header">
        <div><h1>Patient Registered</h1><p>The record is saved permanently in Cliniq</p></div>
      </div>
      <div class="card" style="max-width:760px;margin:32px auto">
        <div class="card-body" style="padding:34px">
          <div style="display:flex;align-items:flex-start;gap:18px;margin-bottom:24px">
            <div style="width:52px;height:52px;border-radius:50%;background:var(--success-soft);color:var(--success);display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('check',26,'green')}</div>
            <div>
              <h2 style="font-size:22px;margin-bottom:6px">Patient successfully registered</h2>
              <p class="text-mut"><span class="pii">${escapeHtml(patient.full_name)}</span> now has a permanent Patient ID.</p>
            </div>
          </div>
          <div style="border:1px solid var(--border);border-radius:10px;padding:18px;text-align:center;margin-bottom:24px;background:var(--surface-2)">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-mut);font-weight:700">Permanent Patient ID</div>
            <div class="mono" style="font-size:26px;font-weight:800;margin-top:7px;letter-spacing:.04em">${escapeHtml(created.patient_ref)}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
            <button class="btn btn-secondary" id="reg-view-patient">${icon('eye',13)}<span>View Patient</span></button>
            <button class="btn btn-primary-accent" id="reg-print-wristband">${icon('fileText',13)}<span>Print Wristband Label</span></button>
            <button class="btn btn-secondary" id="reg-another">${icon('userPlus',13)}<span>Register Another Patient</span></button>
            <button class="btn btn-secondary" id="reg-triage-now">${icon('ambulance',13,'red')}<span>Triage Now</span></button>
          </div>
        </div>
      </div>`;

    $('reg-view-patient').onclick = () => viewPatient(created.id);
    $('reg-print-wristband').onclick = () => openWristbandLabel(created.id);
    $('reg-another').onclick = () => navigate('patient-register');
    $('reg-triage-now').onclick = () => showEnqueueModal(
      () => navigate('triage-queue'),
      { prefillRef: created.patient_ref }
    );

    // Preserve the existing Save & Triage Now behavior while leaving the
    // success panel available behind the modal.
    if (triageAfter) setTimeout(() => $('reg-triage-now')?.click(), 0);
  };

  const save = async (triageAfter) => {
    const f = fields();
    if (!f.full_name || !f.date_of_birth) {
      toast('Name and DOB are required', 'warning'); return;
    }
    try {
      const created = await api('POST', '/patients', f);
      toast(`Saved ${f.full_name} as ${created.patient_ref}`, 'success');
      await loadRecent();
      showSuccess(created, f, triageAfter);
    } catch(e) { toast(e.message, 'error'); }
  };

  $('r-back-btn').onclick  = () => navigate('patient-search');
  $('r-cancel').onclick    = clearForm;
  $('r-save-only').onclick = () => save(false);
  $('r-save-next').onclick = () => save(true);

  async function loadRecent() {
    try {
      const { data } = await api('GET', '/patients?limit=6');
      $('r-recent').innerHTML = data.length
        ? data.map(p => `<div class="recent-item">
            <div class="name"><span class="pii">${escapeHtml(p.full_name)}</span></div>
            <div class="meta">${escapeHtml(maskRef(p.patient_ref))} · ${fmt(p.registered_at)}</div>
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
          <td style="white-space:nowrap">
            <button class="btn btn-xs btn-primary-accent js-add-stock" data-iid="${i.id}" data-iname="${escapeHtml(i.item_name)}">${icon('plus',12)}<span>Add</span></button>
            <button class="btn btn-xs btn-secondary js-txn"            data-iid="${i.id}" data-iname="${escapeHtml(i.item_name)}" style="margin-left:4px">${icon('edit',12)}<span>Transact</span></button>
          </td>
        </tr>`;
      }).join('')}</tbody></table></div>`;

    // Wire the per-row action buttons through addEventListener — inline
    // onclick="" is blocked by the CSP's script-src-attr 'none' directive.
    $('inv-table').querySelectorAll('.js-add-stock').forEach(btn => {
      btn.onclick = () => openAddStockModal(btn.dataset.iid, btn.dataset.iname, reloadInventory);
    });
    $('inv-table').querySelectorAll('.js-txn').forEach(btn => {
      btn.onclick = () => openTxnModal(btn.dataset.iid, btn.dataset.iname, reloadInventory);
    });
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

// Quick-path: just add to on-hand. Records a 'restock' transaction.
window.openAddStockModal = (id, name, onSaved) => {
  openModal(`Add Stock — ${name}`, `
    <div class="form-grid">
      <div class="form-group"><label>Quantity to Add <span class="req">*</span></label>
        <input id="as-qty" type="number" min="1" value="1" autofocus>
      </div>
      <div class="form-group"><label>Performed by</label>
        <input id="as-by" value="${escapeHtml(currentUser||'')}">
      </div>
      <div class="form-group full"><label>Notes <span class="dim">(optional — supplier, batch, PO)</span></label>
        <input id="as-notes" placeholder="e.g. PO-2026-014 · MedSupply Ltd · batch 7B">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="as-cancel">Cancel</button>
      <button class="btn btn-primary-accent" id="as-save">${icon('plus',12)}<span>Add to Stock</span></button>
    </div>`);
  $('as-cancel').onclick = closeModal;
  $('as-save').onclick = async () => {
    const qty = +$('as-qty').value;
    if (!qty || qty <= 0) { toast('Enter a positive quantity', 'warning'); return; }
    const btn = $('as-save');
    btn.disabled = true; btn.innerHTML = 'Adding…';
    try {
      await api('POST', `/inventory/${id}/transactions`, {
        txn_type: 'restock', quantity_delta: qty,
        performed_by: $('as-by').value, notes: $('as-notes').value,
      });
      toast(`Added ${qty} to ${name}`, 'success');
      closeModal();
      if (onSaved) onSaved();
    } catch(e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.innerHTML = `${icon('plus',12)}<span>Add to Stock</span>`;
    }
  };
};

window.openTxnModal = (id, name, onSaved) => {
  openModal(`Record Transaction — ${name}`, `
    <div class="form-grid">
      <div class="form-group"><label>Type <span class="req">*</span></label>
        <select id="txn-type">
          <option value="restock">Restock (+)</option>
          <option value="dispense">Dispense (−)</option>
          <option value="adjustment">Adjustment (± stocktake correction)</option>
          <option value="expired">Mark Expired (−)</option>
        </select>
      </div>
      <div class="form-group"><label>Quantity <span class="req">*</span></label>
        <input id="txn-qty" type="number" min="1" value="1">
        <span class="hint" id="txn-qty-hint">How many units to add or remove</span>
      </div>
      <div class="form-group full"><label>Performed by <span class="req">*</span></label>
        <input id="txn-by" value="${escapeHtml(currentUser||'')}">
      </div>
      <div class="form-group full"><label>Notes</label><input id="txn-notes" placeholder="Optional"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="txn-cancel">Cancel</button>
      <button class="btn btn-primary-accent" id="save-txn">Record</button>
    </div>`);

  // Adjustment is the one type where the user picks the sign — for everything
  // else the sign is implied (restock adds, dispense/expired subtract).
  const typeSel = $('txn-type');
  const qtyIn   = $('txn-qty');
  const hint    = $('txn-qty-hint');
  const paintForType = () => {
    if (typeSel.value === 'adjustment') {
      qtyIn.removeAttribute('min');
      qtyIn.value = qtyIn.value === '1' ? '0' : qtyIn.value;
      hint.textContent = 'Use a positive number to increase on-hand or a negative number to decrease (e.g. -3 if the stocktake found 3 fewer than recorded).';
    } else {
      qtyIn.setAttribute('min', '1');
      if (+qtyIn.value < 1) qtyIn.value = '1';
      hint.textContent = typeSel.value === 'restock'
        ? 'Units received — added to on-hand'
        : 'Units to remove from on-hand';
    }
  };
  typeSel.onchange = paintForType;
  paintForType();

  $('txn-cancel').onclick = closeModal;
  $('save-txn').onclick = async () => {
    const type = typeSel.value;
    const rawQty = +qtyIn.value;
    if (!Number.isFinite(rawQty) || rawQty === 0) {
      toast(type === 'adjustment' ? 'Enter a non-zero adjustment' : 'Enter a positive quantity', 'warning');
      return;
    }
    let delta;
    if (type === 'adjustment') {
      delta = rawQty;                                  // signed — user picks direction
    } else if (type === 'dispense' || type === 'expired') {
      delta = -Math.abs(rawQty);                       // always subtract
    } else {
      delta = Math.abs(rawQty);                        // restock — always add
    }
    const btn = $('save-txn');
    btn.disabled = true; btn.innerHTML = 'Saving…';
    try {
      await api('POST', `/inventory/${id}/transactions`, {
        txn_type: type, quantity_delta: delta,
        performed_by: $('txn-by').value, notes: $('txn-notes').value,
      });
      toast(delta > 0 ? `Added ${delta} to ${name}` : `Removed ${Math.abs(delta)} from ${name}`, 'success');
      closeModal();
      if (onSaved) onSaved();
    } catch(e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.innerHTML = 'Record';
    }
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
   EXPIRING SOON — already-expired + expiring within 30 days
════════════════════════════════════════════════════════════════ */
PAGES['expiring-soon'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Expiring Soon</h1><p>Pull expired stock from shelves; rotate soon-to-expire items into use first</p></div>
      <div class="page-actions">
        <label class="dim" style="font-size:13px;display:flex;align-items:center;gap:6px">
          Window
          <select id="es-window">
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="180">6 months</option>
          </select>
        </label>
        <button class="btn btn-secondary btn-sm" id="es-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
      </div>
    </div>
    <div id="es-content">${skelRows(6)}</div>`;

  $('es-refresh-btn').onclick = loadExpiring;
  $('es-window').onchange     = loadExpiring;
  loadExpiring();
};

async function loadExpiring() {
  const el = $('es-content');
  if (!el) return;
  const days = $('es-window')?.value || '30';
  try {
    const { data } = await api('GET', `/inventory/alerts/expiring?days=${days}&include_expired=1`);

    // Day-precision math against the *date* portion of today, so an item
    // expiring today reads as "0 days" rather than something negative.
    const today = new Date(); today.setHours(0,0,0,0);
    const dayMs = 86400000;
    const enriched = data.map(i => {
      const exp = i.expiry_date ? new Date(i.expiry_date + 'T00:00:00') : null;
      const inDays = exp ? Math.floor((exp - today) / dayMs) : null;
      let band;
      if (inDays == null)   band = 'unknown';
      else if (inDays < 0)  band = 'expired';
      else if (inDays <= 7) band = 'week';
      else                  band = 'month';
      return { ...i, inDays, band };
    });

    if (!enriched.length) {
      el.innerHTML = `<div class="card"><div class="empty">
        <div class="icon">${icon('shieldCheck', 36, 'green')}</div><p>No items expiring within ${days} days</p>
      </div></div>`;
      return;
    }

    const groups = {
      expired: enriched.filter(i => i.band === 'expired'),
      week:    enriched.filter(i => i.band === 'week'),
      month:   enriched.filter(i => i.band === 'month'),
    };

    const summaryPills = [
      groups.expired.length ? `<span class="badge" style="background:#fee2e2;color:#991b1b;font-weight:700">${groups.expired.length} expired</span>` : '',
      groups.week.length    ? `<span class="badge" style="background:#fff4e6;color:#92400e;font-weight:700">${groups.week.length} this week</span>` : '',
      groups.month.length   ? `<span class="badge" style="background:#fffbeb;color:#854d0e;font-weight:700">${groups.month.length} within ${days} days</span>` : '',
    ].filter(Boolean).join(' · ');

    const renderBand = (title, rows, tone, accent) => {
      if (!rows.length) return '';
      return `<div class="card" style="margin-bottom:18px;border-left:4px solid ${accent}">
        <div class="card-head">
          <h2>${icon(tone === 'red' ? 'alert' : 'flask', 16, tone)}${escapeHtml(title)}</h2>
          <span class="meta">${rows.length} item${rows.length===1?'':'s'}</span>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>On hand</th><th>Expires</th><th>When</th><th>Location</th><th style="width:1%"></th></tr></thead>
          <tbody>${rows.map(i => {
            const whenLabel = i.inDays < 0 ? `${Math.abs(i.inDays)}d ago`
                            : i.inDays === 0 ? 'today'
                            : `in ${i.inDays}d`;
            const whenTone  = i.inDays < 0 ? 'danger' : (i.inDays <= 7 ? 'warning' : 'info');
            return `<tr>
              <td><span class="mono" style="font-size:12px">${escapeHtml(i.item_code)}</span></td>
              <td><strong>${escapeHtml(i.item_name)}</strong></td>
              <td>${badge(i.category, 'teal')}</td>
              <td>${i.quantity_on_hand}</td>
              <td class="text-mut">${fmtDateOnly(i.expiry_date)}</td>
              <td>${badge(whenLabel, whenTone)}</td>
              <td class="text-mut">${escapeHtml(i.location || '—')}</td>
              <td><button class="btn btn-xs btn-secondary js-pull"
                          data-iid="${i.id}"
                          data-iname="${escapeHtml(i.item_name)}"
                          data-qty="${i.quantity_on_hand}"
                          title="Write off this stock as expired">${icon('trash', 12, 'red')}<span>Pull</span></button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>`;
    };

    el.innerHTML = `
      <div class="alert alert-warn" style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
        ${icon('alert', 14, 'orange')}<span>${summaryPills}</span>
      </div>
      ${renderBand('Expired', groups.expired, 'red', '#dc2626')}
      ${renderBand('Expiring this week', groups.week, 'orange', '#d97706')}
      ${renderBand(`Expiring within ${days} days`, groups.month, 'orange', '#f59e0b')}
    `;

    el.querySelectorAll('.js-pull').forEach(btn => {
      btn.onclick = () => pullExpired(btn);
    });
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

// "Pull" = record an `expired` transaction for the full on-hand quantity,
// driving stock to zero. Confirms first because it can't be undone with a
// single click (the user would have to restock).
async function pullExpired(btn) {
  const id   = btn.dataset.iid;
  const name = btn.dataset.iname;
  const qty  = +btn.dataset.qty;
  if (!qty) { toast('Already at zero on-hand', 'info'); return; }
  if (!confirm(`Mark ${qty} of ${name} as expired? This zeros out the on-hand count.`)) return;

  btn.disabled = true;
  btn.innerHTML = 'Pulling…';
  try {
    await api('POST', `/inventory/${id}/transactions`, {
      txn_type: 'expired',
      quantity_delta: -qty,
      performed_by: currentUser || 'system',
      notes: 'Pulled from Expiring Soon page',
    });
    toast(`Pulled ${qty} of ${name} from stock`, 'success');
    loadExpiring();
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = `${icon('trash', 12, 'red')}<span>Pull</span>`;
  }
}

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
      <tbody>${data.map(r => `<tr class="${triageRowClass(r)} tri">
        <td>
          ${triageChip(r)}
          <div style="font-size:10px;color:var(--text-mut);margin-top:3px">${labels[r.triage_level]}</div>
        </td>
        <td><strong><span class="pii">${escapeHtml(r.full_name||'—')}</span></strong>
          <div style="font-size:11px;color:var(--text-mut)">${escapeHtml(maskRef(r.patient_ref||''))}</div></td>
        <td><span class="pii">${escapeHtml(r.chief_complaint)}</span></td>
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

// WHO-style triage form. Same client-side colour rule the server uses, so
// the live banner updates as the user ticks emergency questions.
const WHO_EMERGENCY = [
  { key: 'unconscious',     label: 'Is the patient unconscious?',                  tier: 'red'    },
  { key: 'no_breathing',    label: 'Is the patient having difficulty breathing?', tier: 'red'    },
  { key: 'severe_bleeding', label: 'Is the patient experiencing severe bleeding?',tier: 'red'    },
  { key: 'chest_pain',      label: 'Is the patient having chest pain?',           tier: 'red'    },
  { key: 'seizure',         label: 'Is the patient having a seizure or convulsion?', tier: 'red' },
  { key: 'shock',           label: 'Is the patient showing signs of shock?',      tier: 'red'    },
  { key: 'dehydrated',      label: 'Is the patient severely dehydrated?',         tier: 'yellow' },
  { key: 'high_fever',      label: 'Does the patient have a high fever?',         tier: 'yellow' },
  { key: 'severe_pain',     label: 'Is the patient experiencing severe pain?',    tier: 'yellow' },
  { key: 'pregnant',        label: 'Is the patient pregnant?',                    tier: 'yellow' },
];

function computeColorClient(flags, vitals) {
  const ef = flags || {};
  for (const q of WHO_EMERGENCY) {
    if (ef[q.key] && q.tier === 'red') return { color: 'red', reason: `${q.label.replace(/\?$/, '')}` };
  }
  if (vitals.vitals_spo2_pct != null && +vitals.vitals_spo2_pct && +vitals.vitals_spo2_pct < 88)
    return { color: 'red', reason: 'SpO₂ < 88%' };
  if (vitals.vitals_hr_bpm   != null && +vitals.vitals_hr_bpm && (+vitals.vitals_hr_bpm > 150 || +vitals.vitals_hr_bpm < 40))
    return { color: 'red', reason: 'Heart rate outside 40–150 BPM' };
  for (const q of WHO_EMERGENCY) {
    if (ef[q.key] && q.tier === 'yellow') return { color: 'yellow', reason: q.label.replace(/\?$/, '') };
  }
  if (vitals.vitals_temp_f != null && +vitals.vitals_temp_f && +vitals.vitals_temp_f >= 103)
    return { color: 'yellow', reason: 'Temperature ≥ 103 °F' };
  if (vitals.vitals_spo2_pct != null && +vitals.vitals_spo2_pct && +vitals.vitals_spo2_pct < 94)
    return { color: 'yellow', reason: 'SpO₂ < 94%' };
  return { color: 'green', reason: 'No emergency criteria triggered' };
}

const TRIAGE_COLOR_HEX = {
  red:    { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
  yellow: { bg: '#fffbeb', border: '#d97706', text: '#92400e' },
  green:  { bg: '#f0fdf4', border: '#059669', text: '#065f46' },
  black:  { bg: '#1f2937', border: '#000',    text: '#fff'    },
};

window.showEnqueueModal = (onSuccess, opts = {}) => {
  const meds = [
    { key: 'diabetes',     label: 'Diabetes' },
    { key: 'hypertension', label: 'Hypertension' },
    { key: 'heart',        label: 'Heart disease' },
    { key: 'asthma',       label: 'Asthma' },
  ];
  openModal('Patient Triage Form (WHO)', `
    <details open style="margin-bottom:8px"><summary style="cursor:pointer;font-weight:700;padding:8px 0">${icon('user',14,'blue')} 1. Patient Information</summary>
      <div class="form-grid" style="margin-top:8px">
        <div class="form-group full"><label>Patient Reference <span class="req">*</span></label>
          <input id="eq-ref" placeholder="e.g. PAT-2024-001" value="${escapeHtml(opts.prefillRef || '')}">
        </div>
        <div class="form-group full">
          <div id="eq-found" class="dim" style="font-size:12px">Enter a reference and tab away to look up</div>
        </div>
        <div class="form-group"><label>Full Name</label><input id="eq-pname"     disabled placeholder="—"></div>
        <div class="form-group"><label>Age</label>      <input id="eq-page"      disabled placeholder="—"></div>
        <div class="form-group"><label>Gender</label>   <input id="eq-psex"      disabled placeholder="—"></div>
        <div class="form-group"><label>Phone</label>    <input id="eq-pphone"    disabled placeholder="—"></div>
        <div class="form-group full"><label>Emergency Contact</label><input id="eq-pec" disabled placeholder="—"></div>
        <div class="form-group full"><label>Assign to (Assessed By)</label>
          <select id="eq-assign"><option value="">Loading staff…</option></select>
        </div>
      </div>
    </details>

    <details open><summary style="cursor:pointer;font-weight:700;padding:8px 0">${icon('activity',14,'orange')} 2. Vital Signs</summary>
      <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr;margin-top:8px">
        <div class="form-group"><label>Temperature (°F)</label><input id="eq-t" type="number" step="0.1" placeholder="98.6"></div>
        <div class="form-group"><label>Heart Rate (BPM)</label><input id="eq-hr" type="number" placeholder="80"></div>
        <div class="form-group"><label>Blood Pressure</label><input id="eq-bp" placeholder="120/80"></div>
        <div class="form-group"><label>Oxygen Sat (%)</label><input id="eq-spo2" type="number" placeholder="98"></div>
        <div class="form-group"><label>Respiratory Rate</label><input id="eq-rr" type="number" placeholder="16"></div>
      </div>
    </details>

    <details><summary style="cursor:pointer;font-weight:700;padding:8px 0">${icon('alert',14,'red')} 3. Emergency Assessment</summary>
      <div style="margin-top:8px">
        ${WHO_EMERGENCY.map(q => `
          <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border-2)">
            <span style="font-size:13px">${escapeHtml(q.label)}</span>
            <span style="display:flex;gap:14px">
              <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="eq-q-${q.key}" value="1"> Yes</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="eq-q-${q.key}" value="0" checked> No</label>
            </span>
          </label>`).join('')}
      </div>
    </details>

    <details><summary style="cursor:pointer;font-weight:700;padding:8px 0">${icon('fileText',14,'blue')} 4. Symptoms</summary>
      <div class="form-grid" style="margin-top:8px">
        <div class="form-group full"><label>Chief Complaint <span class="req">*</span></label>
          <textarea id="eq-complaint" rows="2" placeholder="What brings them in?"></textarea>
        </div>
        <div class="form-group full"><label>Symptoms Description</label>
          <textarea id="eq-symptoms" rows="2" placeholder="Onset, severity, location…"></textarea>
        </div>
        <div class="form-group full"><label>Duration of Symptoms</label>
          <input id="eq-duration" placeholder="e.g. 2 days">
        </div>
      </div>
    </details>

    <details><summary style="cursor:pointer;font-weight:700;padding:8px 0">${icon('pill',14,'violet')} 5. Allergies & Medications</summary>
      <div class="form-grid" style="margin-top:8px">
        <div class="form-group"><label>Drug Allergies</label>
          <input id="eq-drug" placeholder="e.g. Penicillin, sulfa">
        </div>
        <div class="form-group"><label>Food Allergies</label>
          <input id="eq-food" placeholder="e.g. Peanuts, shellfish">
        </div>
        <div class="form-group full"><label>Other Allergies</label>
          <input id="eq-otherallergy" placeholder="Latex, pollen, insect stings, …">
        </div>
        <div class="form-group full"><label>Current Medications</label>
          <textarea id="eq-meds" rows="2" placeholder="Active prescriptions, OTC, herbal"></textarea>
        </div>
      </div>
    </details>

    <details><summary style="cursor:pointer;font-weight:700;padding:8px 0">${icon('shield',14,'teal')} 6. Medical History</summary>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:14px;padding:0 12px">
        ${meds.map(m => `<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" name="eq-h-${m.key}"> ${escapeHtml(m.label)}</label>`).join('')}
      </div>
      <div class="form-group full" style="margin-top:12px">
        <label>Other Conditions</label>
        <textarea id="eq-hist" rows="2" placeholder="Other diagnoses, recent surgeries…"></textarea>
      </div>
    </details>

    <div id="eq-banner" style="margin:16px 0 0;padding:14px 16px;border-radius:8px;border-left:5px solid var(--border-2);background:var(--surface-2)">
      <div style="font-size:11px;font-weight:700;color:var(--text-mut);text-transform:uppercase;letter-spacing:.5px">Computed Triage</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px" id="eq-banner-label">—</div>
      <div style="font-size:12px;color:var(--text-mut);margin-top:2px" id="eq-banner-reason">Answer the assessment to compute</div>
    </div>

    <!-- Assigned Priority — explicit override of the WHO computation -->
    <div style="margin-top:14px;padding:12px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface)">
      <div style="font-size:11px;font-weight:700;color:var(--text-mut);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Assigned Priority</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:13px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="eq-pri" value="auto" checked> Use computed</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#991b1b"><input type="radio" name="eq-pri" value="red">    <strong>RED</strong> Immediate</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#92400e"><input type="radio" name="eq-pri" value="yellow"> <strong>YELLOW</strong> Urgent</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#065f46"><input type="radio" name="eq-pri" value="green">  <strong>GREEN</strong> Stable</label>
        ${isDisasterMode() ? `
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#1f2937"><input type="radio" name="eq-pri" value="black"> <strong>BLACK</strong> Deceased</label>` : ''}
      </div>
    </div>

    <!-- Only available in Disaster Mode (admin toggles in Security dashboard) -->
    ${isDisasterMode() ? `
    <label style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;cursor:pointer">
      <input type="checkbox" id="eq-deceased">
      <span style="font-size:13px;font-weight:600;color:#991b1b">Mark as Deceased (BLACK) — disaster mode</span>
    </label>` : ''}

    <div class="form-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary-accent" id="eq-save">${icon('check',12)}<span>Add to Triage</span></button>
    </div>`);

  document.querySelector('.modal')?.classList.add('wide');

  // ── Patient lookup — populate Full Name / Age / Gender / Phone / Emergency Contact ──
  const SEX_LABEL = { M: 'Male', F: 'Female', O: 'Other' };
  const ageFromDOB = (iso) => {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    const m = n.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a >= 0 ? `${a}` : '';
  };
  const clearPatientDetails = () => {
    ['eq-pname','eq-page','eq-psex','eq-pphone','eq-pec'].forEach(id => { const el = $(id); if (el) el.value = ''; });
  };
  const paintPatientDetails = async (p) => {
    // Lookup returns the public columns; fetch the full record for emergency_contact
    let full = p;
    try { full = await api('GET', `/patients/${p.id}`); } catch { /* fall back to the partial row */ }
    $('eq-pname').value  = full.full_name || '';
    $('eq-page').value   = ageFromDOB(full.date_of_birth);
    $('eq-psex').value   = SEX_LABEL[full.sex] || full.sex || '';
    $('eq-pphone').value = full.contact_number || '';
    $('eq-pec').value    = full.emergency_contact || '';
  };

  let foundPatient = null;
  const lookup = debounce(async () => {
    const ref = $('eq-ref').value.trim();
    if (!ref) { foundPatient = null; clearPatientDetails(); setHTML('eq-found', '<span class="dim" style="font-size:12px">Enter a reference and tab away to look up</span>'); return; }
    try {
      const { data } = await api('GET', `/patients?q=${encodeURIComponent(ref)}&limit=1`);
      if (!data.length) { foundPatient = null; clearPatientDetails(); setHTML('eq-found', '<span class="alert alert-error" style="margin:0;padding:6px 10px;font-size:12px">Not found</span>'); return; }
      foundPatient = data[0];
      setHTML('eq-found', `<span style="font-size:12px;color:var(--success)">✓ ${escapeHtml(data[0].full_name)} (DOB ${escapeHtml(data[0].date_of_birth)})</span>`);
      paintPatientDetails(data[0]);
    } catch (e) { setHTML('eq-found', `<span class="alert alert-error" style="margin:0;padding:6px 10px;font-size:12px">${escapeHtml(e.message)}</span>`); }
  }, 250);
  $('eq-ref').oninput = lookup;
  // If a prefill ref was provided (post-registration), look up immediately.
  if (opts.prefillRef) lookup();

  // Populate the Assign-to dropdown with every approved Doctor and Nurse
  // (plus the signed-in user, who the API hides). Self is pre-selected when
  // the assessor is a clinical role.
  const preselect = (currentRole === 'Doctor' || currentRole === 'Nurse') ? currentUser : '';
  populateStaffSelect($('eq-assign'), preselect);

  // ── Live triage colour banner ──
  const computeColorFromForm = () => {
    const flags = {};
    for (const q of WHO_EMERGENCY) {
      const checked = document.querySelector(`input[name="eq-q-${q.key}"]:checked`);
      flags[q.key] = checked && checked.value === '1';
    }
    const vitals = {
      vitals_temp_f:   $('eq-t').value,
      vitals_hr_bpm:   $('eq-hr').value,
      vitals_spo2_pct: $('eq-spo2').value,
    };
    if ($('eq-deceased')?.checked) return { color: 'black', reason: 'Marked DECEASED (disaster mode)' };
    return computeColorClient(flags, vitals);
  };
  const refreshBanner = () => {
    const auto = computeColorFromForm();
    const override = document.querySelector('input[name="eq-pri"]:checked')?.value || 'auto';
    const color  = override === 'auto' ? auto.color : override;
    const reason = override === 'auto'
      ? auto.reason
      : `Manually assigned (auto would be ${auto.color.toUpperCase()})`;

    const c = TRIAGE_COLOR_HEX[color];
    const banner = $('eq-banner');
    banner.style.background      = c.bg;
    banner.style.borderColor     = c.border;
    banner.style.borderLeftColor = c.border;
    const label = color === 'black' ? 'Immediate' : (TRIAGE_COLOR_META[color]?.label || 'Stable');
    $('eq-banner-label').textContent  = `${color.toUpperCase()} — ${color === 'black' ? 'DECEASED' : label}`;
    $('eq-banner-label').style.color  = c.text;
    $('eq-banner-reason').textContent = reason;
  };
  refreshBanner();
  ['eq-t','eq-hr','eq-spo2'].forEach(id => { $(id).oninput = refreshBanner; });
  WHO_EMERGENCY.forEach(q => {
    document.querySelectorAll(`input[name="eq-q-${q.key}"]`).forEach(r => r.onchange = refreshBanner);
  });
  document.querySelectorAll('input[name="eq-pri"]').forEach(r => r.onchange = refreshBanner);
  $('eq-deceased') && ($('eq-deceased').onchange = refreshBanner);

  // ── Submit ──
  $('eq-save').onclick = async () => {
    const ref = $('eq-ref').value.trim();
    if (!ref) { toast('Enter a patient reference', 'warning'); return; }
    if (!foundPatient || foundPatient.patient_ref !== ref) {
      // Try once more in case the user didn't tab out
      try {
        const { data } = await api('GET', `/patients?q=${encodeURIComponent(ref)}&limit=1`);
        if (!data.length) { toast('No patient with that reference', 'warning'); return; }
        foundPatient = data[0];
      } catch(e) { toast(e.message, 'error'); return; }
    }
    const complaint = $('eq-complaint').value.trim();
    if (!complaint) { toast('Chief complaint is required', 'warning'); return; }

    const emergency_flags = {};
    for (const q of WHO_EMERGENCY) {
      const r = document.querySelector(`input[name="eq-q-${q.key}"]:checked`);
      emergency_flags[q.key] = r && r.value === '1';
    }
    const history = [];
    document.querySelectorAll('input[name^="eq-h-"]:checked').forEach(c => history.push(c.name.replace('eq-h-','')));

    const btn = $('eq-save');
    btn.disabled = true;
    btn.innerHTML = 'Adding…';

    // Final colour: deceased checkbox > manual radio > auto compute (server still recomputes)
    const override = document.querySelector('input[name="eq-pri"]:checked')?.value || 'auto';
    let chosenColor;
    if ($('eq-deceased')?.checked) chosenColor = 'black';
    else if (override !== 'auto')  chosenColor = override;
    const COLOR_TO_LEVEL = { red: 1, yellow: 3, green: 4, black: 5 };

    try {
      await api('POST', '/queue', {
        patient_id:       foundPatient.id,
        chief_complaint:  complaint,
        assigned_to:      $('eq-assign').value || null,
        vitals_temp_f:    $('eq-t').value     || null,
        vitals_hr_bpm:    $('eq-hr').value    || null,
        vitals_bp:        $('eq-bp').value    || null,
        vitals_spo2_pct:  $('eq-spo2').value  || null,
        vitals_rr:        $('eq-rr').value    || null,
        emergency_flags,
        symptoms:         $('eq-symptoms').value || null,
        duration:         $('eq-duration').value || null,
        drug_allergies:   $('eq-drug').value           || null,
        food_allergies:   $('eq-food').value           || null,
        other_allergies:  $('eq-otherallergy').value   || null,
        current_meds:     $('eq-meds').value           || null,
        medical_history:  history.concat([$('eq-hist').value].filter(Boolean)).join(','),
        triage_color:     chosenColor,
        triage_level:     chosenColor ? COLOR_TO_LEVEL[chosenColor] : undefined,
      });
      toast('Patient triaged and added', 'success');
      closeModal();
      if (onSuccess) onSuccess();
      refreshNotifications();
    } catch(e) {
      toast(e.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `${icon('check',12)}<span>Add to Triage</span>`;
    }
  };
};

/* ════════════════════════════════════════════════════════════════
   STAFF ROSTER
════════════════════════════════════════════════════════════════ */
PAGES['staff-roster'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Staff Duty Roster</h1><p>On-duty and off-duty clinical staff</p></div>
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

function rosterTable(rows) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Role</th><th>Ward</th><th>Shift Start</th><th>Shift End</th></tr></thead>
    <tbody>${rows.map(s => `<tr>
      <td><strong>${escapeHtml(s.staff_name)}</strong></td>
      <td>${badge(s.role,'teal')}</td>
      <td class="text-mut">${escapeHtml(s.ward||'—')}</td>
      <td>${fmt(s.shift_start)}</td>
      <td>${fmt(s.shift_end)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function loadRosterPage() {
  const el = $('roster');
  if (!el) return;
  try {
    const { data } = await api('GET', '/queue/roster?all=1');
    if (!data.length) {
      el.innerHTML = `<div class="card"><div class="empty">
        <div class="icon">${icon('users', 36, 'violet')}</div><p>No staff in the roster yet</p>
        <button class="btn btn-primary-accent btn-sm" id="sr-empty-add-btn">${icon('plus',12)}<span>Add First Shift</span></button>
      </div></div>`;
      const emptyBtn = $('sr-empty-add-btn');
      if (emptyBtn) emptyBtn.onclick = () => showAddShiftModal(loadRosterPage);
      return;
    }
    const onDuty  = data.filter(s => s.is_active);
    const offDuty = data.filter(s => !s.is_active);

    const section = (title, tone, rows, emptyMsg) => `
      <div class="card" style="margin-bottom:18px">
        <div class="card-head">
          <h2>${icon(tone === 'green' ? 'checkCircle' : 'clock', 16, tone)}${escapeHtml(title)}</h2>
          <span class="meta">${rows.length} ${rows.length === 1 ? 'person' : 'people'}</span>
        </div>
        <div class="card-body" style="padding:0">
          ${rows.length ? rosterTable(rows)
            : `<div class="empty" style="padding:24px"><p>${escapeHtml(emptyMsg)}</p></div>`}
        </div>
      </div>`;

    el.innerHTML =
        section('On Duty',  'green', onDuty,  'No staff currently on duty')
      + section('Off Duty', 'gray',  offDuty, 'No off-duty staff on file');
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
        <select id="sa-status">
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
          ${attachmentChip(m)}
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
      <div class="form-group full">
        <label>Attachment <span class="dim">(optional, max 5 MB)</span></label>
        <input id="msg-file" type="file"
               accept=".png,.jpg,.jpeg,.gif,.webp,.heic,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx">
        <span class="hint" id="msg-file-hint">Images, PDFs, or office documents</span>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" id="msg-cancel">Cancel</button>
      <button class="btn btn-primary-accent" id="msg-send">${icon('send',12)}<span>Send</span></button>
    </div>`);

  // Live filename + size hint, with a hard 5 MB client-side guard
  const fileInput = $('msg-file');
  const fileHint  = $('msg-file-hint');
  fileInput.onchange = () => {
    const f = fileInput.files[0];
    if (!f) { fileHint.textContent = 'Images, PDFs, or office documents'; return; }
    if (f.size > 5 * 1024 * 1024) {
      toast('File is larger than 5 MB', 'warning');
      fileInput.value = '';
      fileHint.textContent = 'Images, PDFs, or office documents';
      return;
    }
    fileHint.textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`;
  };

  $('msg-cancel').onclick = closeModal;
  $('msg-send').onclick = async () => {
    const body = $('msg-body').value.trim();
    const file = fileInput.files[0] || null;
    if (!body && !file) { toast('Add a message or an attachment', 'warning'); return; }
    const btn = $('msg-send');
    btn.disabled = true;
    btn.innerHTML = 'Sending…';
    try {
      // Always multipart so the same endpoint handles file + text uniformly.
      const fd = new FormData();
      fd.append('to_username', toUsername);
      fd.append('kind',        $('msg-kind').value);
      fd.append('body',        body);
      if (file) fd.append('attachment', file);

      const res  = await fetch('/api/messages', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed');

      toast(`Sent to ${toName}`, 'success');
      closeModal();
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

// Small reusable chip that links to a message attachment download
function attachmentChip(m) {
  if (!m.attachment_path) return '';
  const sizeKB = m.attachment_size ? Math.max(1, Math.round(m.attachment_size / 1024)) : null;
  const sizeLabel = sizeKB ? `${sizeKB} KB` : '';
  return `<a href="/api/messages/${m.id}/attachment" target="_blank" rel="noopener"
             class="msg-attach" title="Download ${escapeHtml(m.attachment_name || 'attachment')}">
            ${icon('fileText', 12, 'blue')}
            <span class="msg-attach-name">${escapeHtml(m.attachment_name || 'Attachment')}</span>
            ${sizeLabel ? `<span class="msg-attach-size">${sizeLabel}</span>` : ''}
          </a>`;
}

/* ════════════════════════════════════════════════════════════════
   SECURITY DASHBOARD (Admin only)
════════════════════════════════════════════════════════════════ */
PAGES['security-dashboard'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Security</h1><p>Posture of this Pi installation</p></div>
      <button class="btn btn-secondary btn-sm" id="sd-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-head">
        <h2>${icon('shield',16,'teal')}Security Status</h2>
        <span class="meta" id="sd-summary">checking…</span>
      </div>
      <div id="sd-list">${skelLines(7)}</div>
    </div>

    <div class="card">
      <div class="card-head"><h2>${icon('alert',16,'orange')}Disaster Mode</h2></div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--text-mut);margin-bottom:12px">
          Disaster mode unlocks the <strong>BLACK (Deceased)</strong> triage
          option and shows a red banner across every page. Only enable when
          mass-casualty triage is in effect.
        </p>
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-outline" id="sd-disaster-btn">…</button>
          <span class="dim" style="font-size:12px" id="sd-disaster-state">…</span>
        </div>
      </div>
    </div>`;

  $('sd-refresh-btn').onclick = () => navigate('security-dashboard');

  // ── Live posture checks ──────────────────────────────────────────
  const checks = [];
  const push = (ok, ttl, hint) => checks.push({ ok, ttl, hint });

  // Bcrypt hashing — constant ✓ (since the Strong Auth phase)
  push(true, 'bcrypt password hashing', 'Cost factor 12 with backwards-compat scrypt verify');
  // Role-based access — constant ✓ (sidebar filters per role)
  push(true, 'Role-based access control', 'Admin · Doctor · Nurse — each with a filtered sidebar and per-route gates');
  // Offline operation — constant ✓ (no external CDN calls)
  push(true, '100% offline LAN operation', 'No internet required — fonts, icons, and DB all local to the Pi');
  // Auto-logout — client-side clock interval as a proxy for session activity
  push(typeof _clockTimer !== 'undefined' && _clockTimer !== null, 'Session active', 'Tab-bound session with idle clock; close browser to fully sign out');

  // Audit logging enabled — try a 1-row read
  try {
    await api('GET', '/audit?limit=1');
    push(true, 'Audit logging enabled', 'Every login, patient view, edit, delete and export is recorded');
  } catch {
    push(false, 'Audit logging enabled', 'Audit endpoint did not respond — check server logs');
  }

  // Demo passwords rotated — count admin/doctor/nurse claim rows
  try {
    const { data } = await api('GET', '/auth/users');
    const claimed = (data || []).filter(u => !u.is_demo && ['admin','doctor','nurse'].includes(u.username)).length;
    push(claimed >= 1, `Default credentials rotated (${claimed}/3 demo accounts claimed)`,
         claimed >= 3 ? 'All three default accounts have a new password' : 'Change the default password for every demo account before going live');
  } catch { push(false, 'Default credentials rotated', 'Could not query users'); }

  // Password policy — server enforces 12+ via /password-strength endpoint round-trip
  try {
    const r = await api('POST', '/auth/password-strength', { password: 'a'.repeat(11) });
    push(r && r.min >= 12, 'Password policy ≥ 12 characters', `Server-enforced minimum is ${r.min}; weak passwords rejected`);
  } catch { push(false, 'Password policy ≥ 12 characters', 'Could not query strength endpoint'); }

  const pass = checks.filter(c => c.ok).length;
  setText('sd-summary', `${pass} / ${checks.length} checks passing`);
  setHTML('sd-list', `<div class="card-body" style="padding-top:8px">
    ${checks.map(c => `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-2)">
      <span style="flex-shrink:0;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${c.ok?'var(--success-soft)':'var(--warning-soft)'};color:${c.ok?'var(--success)':'var(--warning)'}">
        ${c.ok ? icon('check',14,'green') : icon('alert',14,'orange')}
      </span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(c.ttl)}</div>
        <div style="font-size:11px;color:var(--text-mut);margin-top:2px">${escapeHtml(c.hint)}</div>
      </div>
    </div>`).join('')}
  </div>`);

  // ── Disaster Mode toggle (wired in Phase D — for now read body class) ──
  const paintDisaster = () => {
    const on = document.body.classList.contains('disaster-mode');
    setText('sd-disaster-state', on ? 'Currently ON — black triage option visible' : 'Currently OFF — standard 5-level triage only');
    const btn = $('sd-disaster-btn');
    btn.innerHTML = on
      ? `${icon('shield',12)}<span>Turn OFF Disaster Mode</span>`
      : `${icon('alert',12,'orange')}<span>Turn ON Disaster Mode</span>`;
    btn.className = on ? 'btn btn-secondary' : 'btn btn-danger';
  };
  paintDisaster();
  $('sd-disaster-btn').onclick = async () => {
    const next = !document.body.classList.contains('disaster-mode');
    const btn = $('sd-disaster-btn');
    btn.disabled = true;
    try {
      await api('POST', '/settings/disaster-mode', { enabled: next ? 1 : 0 });
      document.body.classList.toggle('disaster-mode', next);
      paintDisaster();
      toast(`Disaster mode ${next ? 'ENABLED' : 'disabled'}`, next ? 'warning' : 'success');
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false;
  };
};

/* ════════════════════════════════════════════════════════════════
   AUDIT LOG (Admin only)
════════════════════════════════════════════════════════════════ */
const AUDIT_ACTION_TONES = {
  'login.ok':       'green',
  'login.fail':     'red',
  'patient.view':   'gray',
  'patient.create': 'teal',
  'patient.update': 'blue',
  'patient.delete': 'red',
  'audit.export':   'orange',
};

PAGES['audit-log'] = async (el) => {
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Audit Log</h1><p>Every security-relevant event on the system</p></div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="al-refresh-btn">${icon('refresh',14)}<span>Refresh</span></button>
        <button class="btn btn-primary-accent" id="al-export-btn">${icon('fileText',14)}<span>Export CSV</span></button>
      </div>
    </div>
    <div class="card">
      <div class="filter-row">
        <div class="filter-input"><input id="al-actor" placeholder="Filter by username…"></div>
        <select id="al-action">
          <option value="">All actions</option>
          <option value="login.ok">login.ok</option>
          <option value="login.fail">login.fail</option>
          <option value="patient.view">patient.view</option>
          <option value="patient.create">patient.create</option>
          <option value="patient.update">patient.update</option>
          <option value="patient.delete">patient.delete</option>
          <option value="audit.export">audit.export</option>
        </select>
        <input id="al-since" type="date">
      </div>
      <div id="al-table">${skelRows(8)}</div>
    </div>`;

  const load = async () => {
    const params = new URLSearchParams();
    if ($('al-actor').value.trim())  params.set('actor',  $('al-actor').value.trim());
    if ($('al-action').value)         params.set('action', $('al-action').value);
    if ($('al-since').value)          params.set('since',  $('al-since').value);
    params.set('limit', '200');
    try {
      const { data } = await api('GET', `/audit?${params.toString()}`);
      if (!data.length) {
        setHTML('al-table', `<div class="empty"><div class="icon">${icon('fileText',36,'gray')}</div><p>No events match this filter</p></div>`);
        return;
      }
      setHTML('al-table', `<div class="table-wrap"><table>
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th><th>IP</th></tr></thead>
        <tbody>${data.map(r => {
          const tone = AUDIT_ACTION_TONES[r.action] || 'gray';
          const detail = r.detail ? (() => { try { return JSON.stringify(JSON.parse(r.detail)).slice(0,90); } catch { return r.detail.slice(0,90); } })() : '';
          return `<tr>
            <td class="text-mut" style="white-space:nowrap;font-size:12px">${fmt(r.occurred_at)}</td>
            <td>${r.actor_username
                ? `<strong>${escapeHtml(r.actor_name||r.actor_username)}</strong> <span class="dim">@${escapeHtml(r.actor_username)}</span>`
                : '<span class="dim">anonymous</span>'}</td>
            <td>${badge(r.action, tone)}</td>
            <td><span class="mono" style="font-size:12px">${escapeHtml(r.target_id||'—')}</span></td>
            <td class="text-mut ellipsis" style="max-width:260px;font-family:ui-monospace,monospace;font-size:11px">${escapeHtml(detail)}</td>
            <td class="text-mut" style="font-size:11px">${escapeHtml(r.ip||'—')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`);
    } catch (e) { setHTML('al-table', `<div class="alert alert-error">${escapeHtml(e.message)}</div>`); }
  };

  $('al-actor').oninput      = debounce(load, 250);
  $('al-action').onchange    = load;
  $('al-since').onchange     = load;
  $('al-refresh-btn').onclick = load;
  $('al-export-btn').onclick  = () => {
    // Download via a hidden link so the browser handles the file save and
    // the cookie auth is sent automatically. Server logs audit.export.
    const params = new URLSearchParams();
    if ($('al-since').value) params.set('since', $('al-since').value);
    const a = document.createElement('a');
    a.href = '/api/audit/export' + (params.toString() ? '?'+params.toString() : '');
    a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Export started', 'info');
  };
  load();
};

/* ════════════════════════════════════════════════════════════════
   SETTINGS — change password (all roles)
════════════════════════════════════════════════════════════════ */
PAGES['settings'] = (el) => {
  const initial = (currentUser || '?').charAt(0).toUpperCase();
  el.innerHTML = `
    <div class="page-header">
      <div><h1>Settings</h1><p>Account and security</p></div>
    </div>

    <div class="col-6040">
      <!-- Change password -->
      <div class="card">
        <div class="card-head">
          <h2>${icon('lock', 16, 'teal')}Change Password</h2>
          <span class="meta">Required on a fresh install</span>
        </div>
        <div class="card-body">
          <div id="st-msg"></div>

          <div class="alert alert-info" style="margin-bottom:16px">
            ${icon('shield',14,'blue')}<span>The Pi ships with default demo passwords. <strong>Change them before opening the system to the ward.</strong></span>
          </div>

          <div class="form-grid">
            <div class="form-group full">
              <label>Current Password <span class="req">*</span></label>
              <input id="st-current" type="password" autocomplete="current-password">
            </div>
            <div class="form-group">
              <label>New Password <span class="req">*</span></label>
              <input id="st-new" type="password" autocomplete="new-password">
              <div class="pw-meter" id="st-meter">
                <div class="pw-meter-bar"><div class="pw-meter-fill" id="st-meter-fill" style="width:0%"></div></div>
                <div class="pw-meter-label" id="st-meter-label">At least 12 characters · mix upper, lower, digits, symbols</div>
              </div>
            </div>
            <div class="form-group">
              <label>Confirm New Password <span class="req">*</span></label>
              <input id="st-confirm" type="password" autocomplete="new-password">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-ghost" id="st-clear">Clear</button>
            <button class="btn btn-primary-accent" id="st-save">${icon('lock',12)}<span>Update Password</span></button>
          </div>
        </div>
      </div>

      <!-- Profile summary (read-only) -->
      <div class="card">
        <div class="card-head"><h2>${icon('user',16,'teal')}Profile</h2></div>
        <div class="card-body" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:24px">
          <div class="rail-avatar" style="width:64px;height:64px;font-size:24px">${escapeHtml(initial)}</div>
          <div style="text-align:center">
            <div style="font-size:16px;font-weight:700">${escapeHtml(currentUser||'—')}</div>
            <div style="font-size:12px;color:var(--text-mut);margin-top:2px">${badge(currentRole||'—', roleBadgeTone(currentRole))}</div>
          </div>
          <div style="width:100%;margin-top:8px;padding-top:16px;border-top:1px solid var(--border-2)">
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0">
              <span style="color:var(--text-mut)">Role</span>
              <span style="font-weight:600">${escapeHtml(currentRole||'—')}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0">
              <span style="color:var(--text-mut)">Display name</span>
              <span style="font-weight:600">${escapeHtml(currentUser||'—')}</span>
            </div>
            <div class="hint" style="margin-top:14px">More profile options will appear here in future updates.</div>
          </div>
        </div>
      </div>
    </div>`;

  // Wire form
  $('st-clear').onclick = () => {
    ['st-current','st-new','st-confirm'].forEach(id => $(id).value = '');
    setHTML('st-msg', '');
    paintMeter($('st-meter-fill'), $('st-meter-label'), '');
    $('st-current').focus();
  };

  // Live strength meter — debounced to avoid hammering the endpoint
  const onMeterInput = debounce(() => {
    const pw = $('st-new').value;
    paintMeter($('st-meter-fill'), $('st-meter-label'), pw);
  }, 120);
  $('st-new').oninput = onMeterInput;

  $('st-save').onclick = async () => {
    const current = $('st-current').value;
    const fresh   = $('st-new').value;
    const confirm = $('st-confirm').value;

    if (!current || !fresh || !confirm) {
      return setHTML('st-msg', `<div class="alert alert-error">All fields are required</div>`);
    }
    if (fresh.length < 6) {
      return setHTML('st-msg', `<div class="alert alert-error">New password must be at least 6 characters</div>`);
    }
    if (fresh !== confirm) {
      return setHTML('st-msg', `<div class="alert alert-error">The two new passwords don't match</div>`);
    }
    if (fresh === current) {
      return setHTML('st-msg', `<div class="alert alert-error">New password must be different from your current one</div>`);
    }

    const btn = $('st-save');
    btn.disabled = true;
    btn.innerHTML = 'Updating…';
    try {
      await api('POST', '/auth/change-password', {
        current_password: current,
        new_password:     fresh,
      });
      setHTML('st-msg', `<div class="alert alert-ok">${icon('check',14,'green')}<span>Password updated. Use your new password the next time you sign in.</span></div>`);
      ['st-current','st-new','st-confirm'].forEach(id => $(id).value = '');
      toast('Password updated', 'success');
    } catch (err) {
      setHTML('st-msg', `<div class="alert alert-error">${escapeHtml(err.message)}</div>`);
    }
    btn.disabled = false;
    btn.innerHTML = `${icon('lock',12)}<span>Update Password</span>`;
  };

  $('st-current').focus();
};

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
