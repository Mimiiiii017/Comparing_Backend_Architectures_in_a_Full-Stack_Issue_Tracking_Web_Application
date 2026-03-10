// ── API URLs ──────────────────────────────────────────────────────────────────
const API_A = 'https://caseflow-0m57.onrender.com';   // Architecture A — Monolithic
const API_B = 'https://caseflow-h1es.onrender.com';   // Architecture B — Modular



// ── State ─────────────────────────────────────────────────────────────────────
let currentRole = null;
let currentArch = 'A';
let API = API_A;

// ── Status colours ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  received:     '#498dfa',
  approval:     '#0ea800',
  processing:   '#60a5fa',
  notice:       '#80e3f5',
  rfe:          '#f59e0b',
  rfer:         '#8b5cf6',
  biometrics:   '#b1cc16',
  withdrawal:   '#434549',
  expedite:     '#eb6505',
  dos:          '#00b6a1',
  others:       '#a8a29e',
  denied:       '#ff0000',
  rejected:     '#9b0000',
  closed:       '#64748b',
  return:       '#2563eb',
  document_mailed: '#7c8fb0',
  reopened:     '#3b82f6',
  revocation:   '#6b21a8',
};

function normalizeStatusKey(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

const STATUS_CANONICAL = {
  filed: 'received',
  approved: 'approval',
  transferred: 'dos',
  tranferred: 'dos',
  rfe_response: 'rfer',
  rfe_response_received: 'rfer',
  rfer_response: 'rfer',
  rfer_responce_recieved: 'rfer',
  withdrawn: 'withdrawal',
  withdrawat: 'withdrawal',
  rejection: 'rejected',
};

function canonicalStatusKey(s) {
  const k = normalizeStatusKey(s);
  return STATUS_CANONICAL[k] || k;
}

function statusLabelFor(s) {
  return canonicalStatusKey(s);
}

function colorFor(s) { return STATUS_COLORS[canonicalStatusKey(s)] || '#94a3b8'; }

function badgeFor(s) {
  const k = canonicalStatusKey(s);
  const cls = STATUS_COLORS[k] ? `badge-${k}` : 'badge-default';
  return `<span class="badge ${cls}">${s||'—'}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

// ── Theme ──────────────────────────────────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('vtv-theme', theme);
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;
  redrawCharts();
}

// ── SHA-256 helper ─────────────────────────────────────────────────────────────
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Auth ───────────────────────────────────────────────────────────────────────
async function doLogin() {
  const pw  = document.getElementById('passwordInput').value.trim();
  if (!pw) return;

  const btn    = document.getElementById('loginBtn');
  const spinner = document.getElementById('loginSpinner');
  const label  = document.getElementById('loginBtnLabel');
  const err    = document.getElementById('loginError');

  btn.disabled = true;
  spinner.classList.add('visible');
  label.textContent = 'Signing in…';
  err.style.display = 'none';

  const hash = await sha256(pw);
  // SHA-256 hashes — passwords never stored in plain text
  const HASH_USER   = 'b5d4c0d88ae4e65f3dbe6c16f76c30accaa623211cd93948df09fad2b2548be4';
  const HASH_TESTER = '85a9a04afb5aa00ee1bd1591aec5ccfb0a3c0ca19b3e2049ef74ef408f72676f';

  if (hash !== HASH_USER && hash !== HASH_TESTER) {
    err.style.display = 'block';
    btn.disabled = false; spinner.classList.remove('visible'); label.textContent = 'Sign In';
    return;
  }

  currentRole = hash === HASH_TESTER ? 'tester' : 'user';
  API = API_A;
  sessionStorage.setItem('vtv-role', currentRole);

  // Authenticate against Render in background
  try {
    const fd = new FormData(); fd.append('password', pw);
    await fetch(`${API_A}/login`, { method:'POST', body:fd, credentials:'include', redirect:'manual' });
  } catch {}
  if (currentRole === 'tester') {
    try {
      const fd = new FormData(); fd.append('password', 'VTV404');
      await fetch(`${API_B}/login`, { method:'POST', body:fd, credentials:'include', redirect:'manual' });
    } catch {}
  }

  btn.disabled = false; spinner.classList.remove('visible'); label.textContent = 'Sign In';
  showApp();
}

// ── Restore session on page load ───────────────────────────────────────────────
(function restoreSession() {
  const saved = localStorage.getItem('vtv-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = saved;
  const savedRole = sessionStorage.getItem('vtv-role');
  if (savedRole) { currentRole = savedRole; showApp(); }
})();

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  // Show arch nav only for tester
  if (currentRole === 'tester') {
    document.getElementById('archNav').style.display = 'flex';
    document.getElementById('archBadge').style.display = 'block';
    updateArchBadge();
  }

  loadAll();
}

function doLogout() {
  sessionStorage.removeItem('vtv-role');
  try { fetch(`${API_A}/logout`, { credentials:'include' }); } catch {}
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('passwordInput').value = '';
  document.getElementById('archNav').style.display = 'none';
  document.getElementById('archBadge').style.display = 'none';
  currentRole = null; currentArch = 'A'; API = API_A;
}

document.getElementById('passwordInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// ── Architecture switching ─────────────────────────────────────────────────────
async function switchArch(arch) {
  if (currentArch === arch) return;
  currentArch = arch;
  API = arch === 'A' ? API_A : API_B;

  // Update tab styles
  document.getElementById('tabA').classList.toggle('active', arch === 'A');
  document.getElementById('tabB').classList.toggle('active', arch === 'B');

  updateArchBadge();

  // Login against new API with tester password
  try {
    const fd = new FormData();
    fd.append('password', 'VTV404'); // both APIs share same password
    await fetch(`${API}/login`, {
      method: 'POST', body: fd, credentials: 'include', redirect: 'manual'
    });
  } catch {}

  // Reload everything from new API
  loadAll();
}

function updateArchBadge() {
  const badge = document.getElementById('archBadge');
  if (currentArch === 'A') {
    badge.textContent = 'Arch A — Monolithic';
    badge.className = 'arch-badge badge-a';
  } else {
    badge.textContent = 'Arch B — Modular';
    badge.className = 'arch-badge badge-b';
  }

  // Update page subtitle
  document.getElementById('pageSub').textContent =
    currentArch === 'A'
      ? 'Case tracking — Architecture A (Monolithic)'
      : 'Case tracking — Architecture B (Modular)';
}

// ── Load all ───────────────────────────────────────────────────────────────────
function loadAll() {
  loadStats();
  loadByMonth();
  loadByDay();
  loadPieMonth();
  loadPieDayFiled();
  loadPieDayWorked();
}

// ── Stats ──────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(`${API}/api/stats`, { credentials: 'include' });
    const d = await res.json();
    document.getElementById('statTotal').textContent  = d.total_cases?.toLocaleString() || '—';
    document.getElementById('statStatus').textContent = d.top_status || '—';
    document.getElementById('statImport').textContent = d.last_import ? fmtDate(d.last_import) : '—';
  } catch {}
}

// ── Chart helpers ──────────────────────────────────────────────────────────────
function buildStackedBar(canvasId, labels, datasets, legendId) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const isDark    = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(175, 201, 240, 0.22)' : 'rgba(0,0,0,0.06)';
  const tickColor = isDark ? '#c6d3e9' : '#4f6482';

  new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor, maxRotation: 45 } },
        y: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor } },
      },
    },
  });

  if (legendId) {
    document.getElementById(legendId).innerHTML = datasets.map((d, i) =>
      `<div class="legend-item" data-canvas="${canvasId}" data-index="${i}"><div class="legend-dot" style="background:${d.backgroundColor}"></div>${d.label}</div>`
    ).join('');
    document.getElementById(legendId).querySelectorAll('.legend-item').forEach(item => {
      item.addEventListener('click', () => {
        const c = Chart.getChart(item.dataset.canvas);
        const idx = parseInt(item.dataset.index);
        const meta = c.getDatasetMeta(idx);
        meta.hidden = !meta.hidden;
        c.update();
        item.classList.toggle('legend-hidden');
      });
    });
  }
}

function buildPie(canvasId, labels, data, colors, legendId) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data, backgroundColor: colors, borderWidth: 2,
        borderColor: isDark ? '#1e1b18' : '#ffffff'
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              return ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed/total)*100).toFixed(1)}%)`;
            }
          }
        }
      },
    },
  });

  if (legendId) {
    document.getElementById(legendId).innerHTML = labels.map((label, i) =>
      `<div class="legend-item" data-canvas="${canvasId}" data-index="${i}"><div class="legend-dot" style="background:${colors[i]}"></div>${label} <span class="legend-count">(${data[i]})</span></div>`
    ).join('');
    document.getElementById(legendId).querySelectorAll('.legend-item').forEach(item => {
      item.addEventListener('click', () => {
        const c = Chart.getChart(item.dataset.canvas);
        const idx = parseInt(item.dataset.index);
        c.toggleDataVisibility(idx);
        c.update();
        item.classList.toggle('legend-hidden');
      });
    });
  }
}

const STACK_ORDER = [
  'received',
  'processing',
  'notice',
  'approval',
  'dos',
  'rfe',
  'rfer',
  'biometrics',
  'expedite',
  'denied',
  'rejected',
  'withdrawal',
  'closed',
  'return',
  'reopened',
  'document_mailed',
  'revocation',
  'others',
];

function compareStatusOrder(a, b) {
  const ai = STACK_ORDER.indexOf(a);
  const bi = STACK_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function aggregateStatusMap(entry) {
  const out = {};
  Object.entries(entry || {}).forEach(([status, count]) => {
    const k = canonicalStatusKey(status);
    out[k] = (out[k] || 0) + (Number(count) || 0);
  });
  return out;
}

function canonicalizeSeriesMap(data) {
  const out = {};
  Object.entries(data || {}).forEach(([label, entry]) => {
    out[label] = aggregateStatusMap(entry);
  });
  return out;
}

function aggregatePieRows(rows) {
  const totals = {};
  (rows || []).forEach(r => {
    const k = canonicalStatusKey(r.status);
    totals[k] = (totals[k] || 0) + (Number(r.count) || 0);
  });
  return Object.keys(totals)
    .sort(compareStatusOrder)
    .map(status => ({ status, count: totals[status] }));
}

function toStackedDatasets(data) {
  const canonicalData = canonicalizeSeriesMap(data);
  const allStatuses = new Set();
  Object.values(canonicalData).forEach(d => Object.keys(d).forEach(s => allStatuses.add(s)));
  const labels = Object.keys(canonicalData).sort();

  // Sort by STACK_ORDER (bottom to top); unknown statuses go at the end
  const sorted = Array.from(allStatuses).sort(compareStatusOrder);

  const datasets = sorted.map(status => ({
    label: statusLabelFor(status),
    data: labels.map(l => {
      const entry = canonicalData[l] || {};
      return entry[status] || 0;
    }),
    backgroundColor: colorFor(status),
    stack: 'stack',
  }));
  return { labels, datasets };
}

// ── Chart loaders ──────────────────────────────────────────────────────────────
async function loadByMonth() {
  try {
    const res = await fetch(`${API}/api/charts/by-month`, { credentials: 'include' });
    const d = await res.json();
    const { labels, datasets } = toStackedDatasets(d.data);
    buildStackedBar('chartByMonth', labels, datasets, 'legendByMonth');
  } catch {}
}

async function loadByDay() {
  const month = document.getElementById('byDayMonth').value;
  if (!month) return;
  try {
    const res = await fetch(`${API}/api/charts/by-day?month=${month}`, { credentials: 'include' });
    const d = await res.json();

    // Generate every day in the selected month
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const allDayKeys = Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      return `${month}-${day}`;
    });
    const displayLabels = allDayKeys.map(k => String(parseInt(k.split('-')[2])));

    const data = canonicalizeSeriesMap(d.data || {});
    const allStatuses = new Set();
    Object.values(data).forEach(dd => Object.keys(dd).forEach(s => allStatuses.add(s)));

    const sorted = Array.from(allStatuses).sort(compareStatusOrder);

    const datasets = sorted.map(status => ({
      label: statusLabelFor(status),
      data: allDayKeys.map(day => {
        const entry = data[day] || {};
        if (!entry) return 0;
        return entry[status] || 0;
      }),
      backgroundColor: colorFor(status),
      stack: 'stack',
    }));

    buildStackedBar('chartByDay', displayLabels, datasets, 'legendByDay');
  } catch {}
}

async function loadPieMonth() {
  const month = document.getElementById('pieMonthInput').value;
  if (!month) return;
  try {
    const res = await fetch(`${API}/api/charts/pie-month?month=${month}`, { credentials: 'include' });
    const d = await res.json();
    const rows = aggregatePieRows(d.data);
    buildPie('chartPieMonth', rows.map(r=>statusLabelFor(r.status)), rows.map(r=>r.count), rows.map(r=>colorFor(r.status)), 'legendPieMonth');
  } catch {}
}

async function loadPieDayFiled() {
  const date = document.getElementById('pieDayFiledInput').value;
  if (!date) return;
  try {
    const res = await fetch(`${API}/api/charts/pie-day-filed?date=${date}`, { credentials: 'include' });
    const d = await res.json();
    const rows = aggregatePieRows(d.data);
    if (!rows.length) return;
    buildPie('chartPieDayFiled', rows.map(r=>statusLabelFor(r.status)), rows.map(r=>r.count), rows.map(r=>colorFor(r.status)), 'legendPieDayFiled');
  } catch {}
}

async function loadPieDayWorked() {
  const date = document.getElementById('pieDayWorkedInput').value;
  if (!date) return;
  try {
    const res = await fetch(`${API}/api/charts/pie-day-worked?date=${date}`, { credentials: 'include' });
    const d = await res.json();
    const rows = aggregatePieRows(d.data);
    if (!rows.length) return;
    buildPie('chartPieDayWorked', rows.map(r=>statusLabelFor(r.status)), rows.map(r=>r.count), rows.map(r=>colorFor(r.status)), 'legendPieDayWorked');
  } catch {}
}

function redrawCharts() {
  loadByMonth(); loadByDay(); loadPieMonth(); loadPieDayFiled(); loadPieDayWorked();
}

// ── Position finder ────────────────────────────────────────────────────────────
async function findPosition() {
  const wac = document.getElementById('wacInput').value.trim();
  if (!wac) return;
  document.getElementById('positionResult').classList.remove('visible');
  document.getElementById('positionError').style.display = 'none';

  try {
    const res = await fetch(`${API}/api/position?wac=${encodeURIComponent(wac)}`, { credentials: 'include' });
    const d = await res.json();
    if (!res.ok) {
      document.getElementById('positionError').style.display = 'block';
      document.getElementById('positionError').textContent = d.detail || 'Case not found';
      return;
    }
    document.getElementById('positionNumber').textContent = d.cases_ahead.toLocaleString();
    document.getElementById('positionMeta').innerHTML =
      `<strong>${d.case_number}</strong> &nbsp;·&nbsp;
       Filed: <strong>${fmtDate(d.application_filed_date)}</strong> &nbsp;·&nbsp;
       Status: <strong>${d.current_status}</strong>`;
    document.getElementById('positionResult').classList.add('visible');
  } catch {
    document.getElementById('positionError').style.display = 'block';
    document.getElementById('positionError').textContent = 'Could not reach the server.';
  }
}

document.getElementById('wacInput').addEventListener('keydown', e => { if (e.key === 'Enter') findPosition(); });

// ── Case search ────────────────────────────────────────────────────────────────
async function searchByCase() {
  const q = document.getElementById('searchCaseInput').value.trim();
  if (!q) return;
  renderSearchResults(null, true);
  try {
    const res = await fetch(`${API}/api/search?case_number=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d = await res.json();
    renderSearchResults(d.results);
  } catch { renderSearchResults([]); }
}

async function searchByDate() {
  const date = document.getElementById('searchDateInput').value;
  if (!date) return;
  renderSearchResults(null, true);
  try {
    const res = await fetch(`${API}/api/search?date=${date}`, { credentials: 'include' });
    const d = await res.json();
    renderSearchResults(d.results);
  } catch { renderSearchResults([]); }
}

function renderSearchResults(rows, loading = false) {
  const el = document.getElementById('searchResults');
  if (loading) { el.innerHTML = '<div class="loading">Searching…</div>'; return; }
  if (!rows || !rows.length) { el.innerHTML = '<div class="empty">No cases found.</div>'; return; }

  el.innerHTML = `
    <div style="overflow-x:auto;margin-top:12px">
      <table class="results-table">
        <thead><tr>
          <th>Case Number</th><th>Status</th><th>Case Type</th>
          <th>Filed Date</th><th>Last Received</th><th>Title</th>
        </tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td><span class="case-num">${r.case_number}</span></td>
            <td>${badgeFor(r.case_status)}</td>
            <td>${r.case_type || '—'}</td>
            <td>${fmtDate(r.application_filed_date)}</td>
            <td>${fmtDate(r.last_received_date)}</td>
            <td style="max-width:260px;font-size:12px;color:var(--muted)">${r.title || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-top:10px">${rows.length} result${rows.length !== 1 ? 's' : ''} found</div>
  `;
}

document.getElementById('searchCaseInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchByCase(); });

// ── Init ───────────────────────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('vtv-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
const _initSel = document.getElementById('themeSelect');
if (_initSel) _initSel.value = savedTheme;