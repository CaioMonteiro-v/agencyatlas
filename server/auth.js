const crypto = require('crypto');

const TEAM_USER = process.env.ATLAS_TEAM_USER || 'equipe';
const TEAM_PASSWORD = process.env.ATLAS_TEAM_PASSWORD || null;
const INVITE_CODE = process.env.ATLAS_INVITE_CODE || null;
const AUTH_SECRET = process.env.ATLAS_AUTH_SECRET
  || process.env.DATABASE_URL
  || 'atlas-dev-secret-change-me';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_KEYLEN = 64;

let dbRef = null;

function setAuthDb(db) {
  dbRef = db;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false;
  const [salt, hash] = String(stored).split(':');
  const next = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(next);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function issueToken(user) {
  const payload = b64url(JSON.stringify({
    id: user.id || null,
    u: user.username,
    n: user.name || user.username,
    role: user.role || 'equipe',
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
    return {
      id: data.id,
      username: data.u,
      name: data.n || data.u,
      role: data.role || 'equipe',
    };
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

function countUsers() {
  if (!dbRef) return 0;
  try {
    return Number(dbRef.prepare('SELECT COUNT(*) AS c FROM team_users').get()?.c) || 0;
  } catch {
    return 0;
  }
}

function findUserByUsername(username) {
  if (!dbRef) return null;
  return dbRef.prepare(
    'SELECT * FROM team_users WHERE lower(username) = lower(?)'
  ).get(String(username || '').trim());
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role || 'equipe',
  };
}

function authConfigured() {
  return countUsers() > 0 || Boolean(TEAM_PASSWORD)
    || (process.env.NODE_ENV !== 'production' && !TEAM_PASSWORD);
}

function canSelfRegister() {
  return countUsers() === 0 || Boolean(INVITE_CODE);
}

function login(username, password) {
  const userName = String(username || '').trim();
  const pass = String(password || '');

  const row = findUserByUsername(userName);
  if (row) {
    if (!verifyPassword(pass, row.password_hash)) {
      return { ok: false, error: 'Usuário ou senha inválidos' };
    }
    const user = publicUser(row);
    return { ok: true, token: issueToken(user), user };
  }

  // Fallback: senha da equipe no ambiente (legado)
  const envUser = TEAM_USER;
  const envPass = TEAM_PASSWORD
    || (process.env.NODE_ENV !== 'production' ? 'atlas' : null);
  if (envPass && userName === envUser && pass === envPass) {
    const user = { id: null, username: envUser, name: 'Equipe Atlas', role: 'admin' };
    return { ok: true, token: issueToken(user), user };
  }

  if (!authConfigured()) {
    return {
      ok: false,
      error: 'Nenhuma conta ainda. Use Criar conta na tela de login.',
      can_register: true,
    };
  }

  return { ok: false, error: 'Usuário ou senha inválidos' };
}

function register({ name, username, password, invite_code }, actor = null) {
  if (!dbRef) return { ok: false, error: 'Banco indisponível' };

  const cleanName = String(name || '').trim();
  const cleanUser = String(username || '').trim().toLowerCase();
  const pass = String(password || '');

  if (!cleanName) return { ok: false, error: 'Informe o nome completo' };
  if (!cleanUser || cleanUser.length < 3) {
    return { ok: false, error: 'Usuário precisa ter ao menos 3 caracteres' };
  }
  if (!/^[a-z0-9._-]+$/.test(cleanUser)) {
    return { ok: false, error: 'Usuário: só letras, números, ponto, _ ou -' };
  }
  if (pass.length < 6) return { ok: false, error: 'Senha precisa ter ao menos 6 caracteres' };

  const total = countUsers();
  if (total > 0) {
    const adminOk = actor && actor.role === 'admin';
    const inviteOk = INVITE_CODE && String(invite_code || '') === INVITE_CODE;
    if (!adminOk && !inviteOk) {
      if (!INVITE_CODE) {
        return {
          ok: false,
          error: 'Peça ao admin para cadastrar você, ou configure ATLAS_INVITE_CODE no Render.',
        };
      }
      return { ok: false, error: 'Código de convite inválido' };
    }
  }

  if (findUserByUsername(cleanUser)) {
    return { ok: false, error: 'Este usuário já existe' };
  }

  const role = total === 0 ? 'admin' : 'equipe';
  const result = dbRef.prepare(`
    INSERT INTO team_users (name, username, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(cleanName, cleanUser, hashPassword(pass), role);

  const row = dbRef.prepare('SELECT * FROM team_users WHERE id = ?').get(result.lastInsertRowid);
  const user = publicUser(row);
  return { ok: true, token: issueToken(user), user };
}

function listUsers() {
  if (!dbRef) return [];
  return dbRef.prepare(`
    SELECT id, name, username, role, created_at
    FROM team_users
    ORDER BY created_at ASC
  `).all();
}

function isPublicApi(req) {
  const { method, path } = req;
  if (path === '/api/health') return true;
  if (method === 'POST' && path === '/api/auth/login') return true;
  if (method === 'POST' && path === '/api/auth/register') return true;
  if (method === 'GET' && path === '/api/auth/me') return true;
  if (method === 'GET' && path === '/api/auth/status') return true;
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

  if (!authConfigured()) {
    return res.status(503).json({
      error: 'Crie a primeira conta da equipe em /login',
      can_register: true,
    });
  }

  const user = verifyToken(extractToken(req));
  if (!user) {
    return res.status(401).json({ error: 'Faça login para acessar o painel' });
  }
  req.user = user;
  return next();
}

function hasTeamUsers() {
  return countUsers() > 0;
}

module.exports = {
  setAuthDb,
  login,
  register,
  listUsers,
  verifyToken,
  extractToken,
  requireAuth,
  authConfigured,
  canSelfRegister,
  hasTeamUsers,
  TEAM_USER,
};
