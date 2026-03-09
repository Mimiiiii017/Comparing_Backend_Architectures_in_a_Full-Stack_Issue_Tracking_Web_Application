const express = require('express');
const crypto  = require('crypto');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const PASSWORD_USER   = process.env.PASSWORD_USER;
const PASSWORD_TESTER = process.env.PASSWORD_TESTER;
const COOKIE_SECRET   = process.env.COOKIE_SECRET;

// ── Token helpers ──────────────────────────────────────────────────────────────
function sign(value) {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('hex');
}

function makeToken(role) {
  const payload = `${role}:${Date.now()}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString('base64url');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const lastDot = decoded.lastIndexOf('.');
    const payload = decoded.slice(0, lastDot);
    const sig     = decoded.slice(lastDot + 1);
    if (sign(payload) !== sig) return null;
    return payload.split(':')[0];
  } catch { return null; }
}

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: false }));

// Serve public/ folder at /public/ (matches HTML href="public/style.css" etc.)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve favicon.ico from public/favicon.png
app.get('/favicon.ico', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'))
);

// ── API routes ─────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const password = req.body?.password || '';
  let role = null;
  if (password === PASSWORD_USER)   role = 'user';
  if (password === PASSWORD_TESTER) role = 'tester';

  if (!role) { res.status(401).json({ error: 'Incorrect password' }); return; }

  const token = makeToken(role);
  res.setHeader('Set-Cookie',
    `vtv_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
  );
  res.status(200).json({ role });
});

app.get('/api/me', (req, res) => {
  const cookie = req.headers.cookie || '';
  const match  = cookie.match(/vtv_session=([^;]+)/);
  if (!match) { res.status(401).json({ error: 'Not authenticated' }); return; }
  const role = verifyToken(match[1]);
  if (!role)  { res.status(401).json({ error: 'Invalid session' });   return; }
  res.status(200).json({ role });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie',
    'vtv_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  );
  res.status(200).json({ ok: true });
});

// ── HTML pages ─────────────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) =>
  res.sendFile(path.join(__dirname, 'dashboard.html'))
);

app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'index.html'))
);

app.listen(PORT, () => console.log(`VTV server running on port ${PORT}`));
