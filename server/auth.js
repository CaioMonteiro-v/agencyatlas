const crypto = require('crypto');

const TEAM_USER = process.env.ATLAS_TEAM_USER || 'equipe';
const TEAM_PASSWORD = process.env.ATLAS_TEAM_PASSWORD
  || (process.env.NODE_ENV === 'production' ? null : 'atlas');
const AUTH_SECRET = process.env.ATLAS_AUTH_SECRET
  || process.env.DATABASE_URL
  || 'atlas-dev-secret-change-me';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function issueToken(username) {
  const payload = b64url(JSON.stringify({
    u: username,
    exp: Date.now() + TOKEN_TTL_MS,
  }));
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return { username: data.u };
  } catch {
    return null;
  }
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.headers['x-atlas-token']) return String(req.headers['x-atlas-token']);
  return null;
}

function login(username, password) {
  if (!TEAM_PASSWORD) {
    return { ok: false, error: 'ATLAS_TEAM_PASSWORD não configurada no servidor' };
  }
  const userOk = String(username || TEAM_USER).trim() === TEAM_USER;
  const passOk = String(password || '') === TEAM_PASSWORD;
  if (!userOk || !passOk) {
    return { ok: false, error: 'Usuário ou senha inválidos' };
  }
  return {
    ok: true,
    token: issueToken(TEAM_USER),
    user: { username: TEAM_USER, role: 'equipe' },
  };
}

function authConfigured() {
  return Boolean(TEAM_PASSWORD);
}

function isPublicApi(req) {
  const { method, path } = req;
  if (path === '/api/health') return true;
  if (method === 'POST' && path === '/api/auth/login') return true;
  if (method === 'GET' && path === '/api/auth/me') return true;
  if (method === 'GET' && /^\/api\/campaigns\/[^/]+\/public$/.test(path)) return true;
  if (method === 'GET' && /^\/api\/events\/[^/]+$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/events\/[^/]+\/registrations$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/campaigns\/[^/]+\/registrations$/.test(path)) return true;
  if (method === 'GET' && /^\/api\/m\/[^/]+\/[^/]+$/.test(path)) return true;
  if (method === 'POST' && /^\/api\/m\/[^/]+\/[^/]+\/registrations$/.test(path)) return true;
  return false;
}

function requireAuth(req, res, next) {
  if (isPublicApi(req)) return next();
  if (!req.path.startsWith('/api')) return next();

  if (!TEAM_PASSWORD) {
    return res.status(503).json({
      error: 'Login não configurado. Defina ATLAS_TEAM_PASSWORD no Render.',
    });
  }

  const user = verifyToken(extractToken(req));
  if (!user) {
    return res.status(401).json({ error: 'Faça login para acessar o painel' });
  }
  req.user = user;
  return next();
}

module.exports = {
  login,
  verifyToken,
  extractToken,
  requireAuth,
  authConfigured,
  TEAM_USER,
};
