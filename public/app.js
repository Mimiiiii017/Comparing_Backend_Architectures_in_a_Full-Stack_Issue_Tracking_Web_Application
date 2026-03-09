// ── API URLs ──────────────────────────────────────────────────────────────────
const API_A = 'https://caseflow-0m57.onrender.com';   // Architecture A — Monolithic
const API_B = 'https://caseflow-h1es.onrender.com';   // Architecture B — Modular

// ── State ─────────────────────────────────────────────────────────────────────
let currentRole = null;
let currentArch = 'A';
let API = API_A;

// ── Status colours ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  received:  '#3b82f6',
  approved:  '#10b981',
  rejected:  '#ef4444',
  rfe:       '#f59e0b',
  rfer:      '#8b5cf6',
  dos:       '#14b8a6',
  denied:    '#dc2626',
  withdrawn: '#6b7280',
};

function colorFor(s) { return STATUS_COLORS[(s||'').toLowerCase()] || '#94a3b8'; }

function badgeFor(s) {
  const k = (s||'').toLowerCase();
  const cls = STATUS_COLORS[k] ? `badge-${k}` : 'badge-default';
  return `<span class="badge ${cls}">${s||'—'}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

// ── Theme ──────────────────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.querySelector('.theme-btn').textContent = isDark ? '☀︎' : '☾';
  localStorage.setItem('vtv-theme', isDark ? 'light' : 'dark');
  redrawCharts();
}

// ── Init — check session on page load ─────────────────────────────────────────
(async function init() {
  // Restore theme first
  const saved = localStorage.getItem('vtv-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.querySelector('.theme-btn').textContent = saved === 'dark' ? '☾' : '☀︎';

  // Verify session server-side
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) { window.location.href = '/'; return; }
    const { role } = await res.json();
    currentRole = role;
  } catch {
    window.location.href = '/';
    return;
  }

  // Also authenticate against the Render API so charts work
  try {
    const fd = new FormData();
    fd.append('password', 'VTV404');
    await fetch(`${API_A}/login`, { method:'POST', body:fd, credentials:'include', redirect:'manual' });
  } catch {}

  // Show app
  document.getElementById('app').style.display = 'block';

  if (currentRole === 'tester') {
    document.getElementById('archNav').style.display = 'flex';
    document.getElementById('archBadge').style.display = 'block';
    updateArchBadge();
  }

  loadAll();
})();

// ── Logout ─────────────────────────────────────────────────────────────────────
async function doLogout() {
  try {
    await fetch(`${API}/logout`, { credentials: 'include' });
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch {}
  window.location.href = '/';
}

// ── Architecture switching ─────────────────────────────────────────────────────
async function switchArch(arch) {
  if (currentArch === arch) return;
  currentArch = arch;
  API = arch === 'A' ? API_A : API_B;

  document.getElementById('tabA').classList.toggle('active', arch === 'A');
  document.getElementById('tabB').classList.toggle('active', arch === 'B');
  updateArchBadge();

  try {
    const fd = new FormData();
    fd.append('password', 'VTV404');
    await fetch(`${API}/login`, { method:'POST', body:fd, credentials:'include', redirect:'manual' });
  } catch {}

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
  document.getElementById('pageSub').textContent =
    currentArch === 'A'
      ? 'I-129F K-1/K-2 case tracking — Architecture A (Monolithic)'
      : 'I-129F K-1/K-2 case tracking — Architecture B (Modular)';
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
  const gridColor = isDark ? 'rgba(175,201,240,0.22)' : 'rgba(0,0,0,0.06)';
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
    document.getElementById(legendId).innerHTML = datasets.map(d =>
      `<div class="legend-item"><div class="legend-dot" style="background:${d.backgroundColor}"></div>${d.label}</div>`
    ).join('');
  }
}

function buildPie(canvasId, labels, data, colors) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: isDark ? '#2b3445' : '#ffffff' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: isDark ? '#eef4ff' : '#18283f', font: { size: 12 }, padding: 14 }
        },
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
}

function toStackedDatasets(data) {
  const allStatuses = new Set();
  Object.values(data).forEach(d => Object.keys(d).forEach(s => allStatuses.add(s)));
  const labels = Object.keys(data).sort();
  const datasets = Array.from(allStatuses).map(status => ({
    label: status,
    data: labels.map(l => data[l][status] || 0),
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
    const { labels, datasets } = toStackedDatasets(d.data);
    buildStackedBar('chartByDay', labels, datasets, 'legendByDay');
  } catch {}
}

async function loadPieMonth() {
  const month = document.getElementById('pieMonthInput').value;
  if (!month) return;
  try {
    const res = await fetch(`${API}/api/charts/pie-month?month=${month}`, { credentials: 'include' });
    const d = await res.json();
    buildPie('chartPieMonth', d.data.map(r=>r.status), d.data.map(r=>r.count), d.data.map(r=>colorFor(r.status)));
  } catch {}
}

async function loadPieDayFiled() {
  const date = document.getElementById('pieDayFiledInput').value;
  if (!date) return;
  try {
    const res = await fetch(`${API}/api/charts/pie-day-filed?date=${date}`, { credentials: 'include' });
    const d = await res.json();
    if (!d.data.length) return;
    buildPie('chartPieDayFiled', d.data.map(r=>r.status), d.data.map(r=>r.count), d.data.map(r=>colorFor(r.status)));
  } catch {}
}

async function loadPieDayWorked() {
  const date = document.getElementById('pieDayWorkedInput').value;
  if (!date) return;
  try {
    const res = await fetch(`${API}/api/charts/pie-day-worked?date=${date}`, { credentials: 'include' });
    const d = await res.json();
    if (!d.data.length) return;
    buildPie('chartPieDayWorked', d.data.map(r=>r.status), d.data.map(r=>r.count), d.data.map(r=>colorFor(r.status)));
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