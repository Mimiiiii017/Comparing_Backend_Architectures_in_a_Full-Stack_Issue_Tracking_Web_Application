const crypto = require('crypto');

const PASSWORD_USER   = process.env.PASSWORD_USER;
const PASSWORD_TESTER = process.env.PASSWORD_TESTER;
const COOKIE_SECRET   = process.env.COOKIE_SECRET;

function sign(value) {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('hex');
}

function makeToken(role) {
  const payload = `${role}:${Date.now()}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const lastDot  = decoded.lastIndexOf('.');
    const payload  = decoded.slice(0, lastDot);
    const sig      = decoded.slice(lastDot + 1);
    if (sign(payload) !== sig) return null;
    const [role]   = payload.split(':');
    return role;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  // ── CORS for same-origin only ──────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;

  // ── POST /api/login ────────────────────────────────────────────────────────
  if (req.method === 'POST' && path === '/api/login') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    const password = params.get('password') || '';

    let role = null;
    if (password === PASSWORD_USER)   role = 'user';
    if (password === PASSWORD_TESTER) role = 'tester';

    if (!role) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    const token = makeToken(role);
    res.setHeader('Set-Cookie', `vtv_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);
    res.status(200).json({ role });
    return;
  }

  // ── GET /api/me ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && path === '/api/me') {
    const cookie = req.headers.cookie || '';
    const match  = cookie.match(/vtv_session=([^;]+)/);
    if (!match) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const role = verifyToken(match[1]);
    if (!role)  { res.status(401).json({ error: 'Invalid session' });   return; }
    res.status(200).json({ role });
    return;
  }

  // ── POST /api/logout ───────────────────────────────────────────────────────
  if (req.method === 'POST' && path === '/api/logout') {
    res.setHeader('Set-Cookie', 'vtv_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
    res.status(200).json({ ok: true });
    return;
  }

  res.status(404).json({ error: 'Not found' });
};