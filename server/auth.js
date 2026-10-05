/* Anmeldung, Sitzungen und Benutzerverwaltung nach Abschnitt 6 der Übergabe. */
import argon2 from 'argon2';
import {createHmac, randomBytes} from 'node:crypto';

const COOKIE = 'pizza_sid';
const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MIN_PW = 8;

const hashPw = pw => argon2.hash(pw, {type: argon2.argon2id});
// Vergleichswert für unbekannte Benutzernamen, damit die Antwortzeit nichts verrät
const DUMMY = hashPw(randomBytes(16).toString('hex'));

export async function ensureAdmin(db, username, password) {
  if (db.prepare('SELECT COUNT(*) n FROM users').get().n > 0) return false;
  if (!username || !password) return false;
  db.prepare("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)").run(username.trim(), await hashPw(password), Date.now());
  return true;
}

export function registerAuth(app, {db, config}) {
  const tokenHash = token => createHmac('sha256', config.sessionSecret).update(token).digest('hex');
  const pub = u => ({id: u.id, username: u.username, role: u.role, disabled: !!u.disabled, locked: !!(u.locked_until && u.locked_until > Date.now()), createdAt: u.created_at});
  const cookieOpts = {path: '/', httpOnly: true, secure: config.secureCookie, sameSite: 'lax'};

  const q = {
    userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    users: db.prepare('SELECT * FROM users ORDER BY username COLLATE NOCASE'),
    admins: db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND disabled = 0"),
    session: db.prepare('SELECT s.id sid, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?'),
    newSession: db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'),
    dropSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    dropSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    dropOthers: db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?'),
    dropExpired: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
    fail: db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?'),
    setPw: db.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?'),
  };
  q.dropExpired.run(Date.now());

  /* Schreibende Anfragen müssen von der eigenen Adresse kommen */
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const erlaubt = config.baseUrl ? new URL(config.baseUrl).origin : `${req.protocol}://${req.host}`;
    if (req.headers.origin !== erlaubt) return reply.code(403).send({error: 'origin'});
  });

  /* Alle Routen unter /api ausser Login nur mit gültiger Sitzung */
  app.decorateRequest('user', null);
  app.decorateRequest('sid', null);
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    const token = req.cookies[COOKIE];
    if (token) {
      const row = q.session.get(tokenHash(token));
      if (row && row.expires_at > Date.now() && !row.disabled) { req.user = row; req.sid = row.sid; }
      else if (row) q.dropSession.run(row.sid);
    }
    if (!req.user && req.routeOptions.url !== '/api/login') return reply.code(401).send({error: 'auth'});
  });
  const adminOnly = async (req, reply) => { if (req.user.role !== 'admin') return reply.code(403).send({error: 'admin'}); };

  const cred = {type: 'string', minLength: 1, maxLength: 200};
  const username = {type: 'string', minLength: 2, maxLength: 40, pattern: '^[^\\s].*[^\\s]$'};
  const newPw = {type: 'string', minLength: MIN_PW, maxLength: 200};
  const idParams = {type: 'object', properties: {id: {type: 'integer'}}};

  app.post('/api/login', {
    config: {rateLimit: {max: config.loginPerIp, timeWindow: LOCK_MS}},
    schema: {body: {type: 'object', required: ['username', 'password'], additionalProperties: false, properties: {username: cred, password: cred}}},
  }, async (req, reply) => {
    const u = q.userByName.get(req.body.username.trim()), now = Date.now();
    if (u && u.locked_until && u.locked_until > now) return reply.code(429).send({error: 'locked', until: u.locked_until});
    const ok = await argon2.verify(u ? u.password_hash : await DUMMY, req.body.password);
    if (!u || !ok || u.disabled) {
      if (u && !ok) {
        // Nach Ablauf einer Sperre beginnt die Zählung neu
        const n = (u.locked_until ? 0 : u.failed_logins) + 1;
        q.fail.run(n >= MAX_FAILS ? 0 : n, n >= MAX_FAILS ? now + LOCK_MS : null, u.id);
      }
      return reply.code(401).send({error: 'login'});
    }
    q.fail.run(0, null, u.id);
    const token = randomBytes(32).toString('base64url');
    q.newSession.run(tokenHash(token), u.id, now + SESSION_DAYS * 864e5, now);
    reply.setCookie(COOKIE, token, {...cookieOpts, maxAge: SESSION_DAYS * 86400});
    return {user: pub(u)};
  });

  app.post('/api/logout', async (req, reply) => {
    q.dropSession.run(req.sid);
    reply.clearCookie(COOKIE, cookieOpts);
    return reply.code(204).send();
  });

  app.get('/api/me', async req => ({user: pub(req.user)}));

  app.post('/api/me/password', {
    schema: {body: {type: 'object', required: ['current', 'password'], additionalProperties: false, properties: {current: cred, password: newPw}}},
  }, async (req, reply) => {
    if (!await argon2.verify(req.user.password_hash, req.body.current)) return reply.code(403).send({error: 'current'});
    q.setPw.run(await hashPw(req.body.password), req.user.id);
    q.dropOthers.run(req.user.id, req.sid);
    return reply.code(204).send();
  });

  /* ---------- Benutzerverwaltung, nur Admin ---------- */
  app.get('/api/users', {preHandler: adminOnly}, async () => ({users: q.users.all().map(pub)}));

  app.post('/api/users', {
    preHandler: adminOnly,
    schema: {body: {type: 'object', required: ['username', 'password'], additionalProperties: false, properties: {username, password: newPw, role: {enum: ['admin', 'user']}}}},
  }, async (req, reply) => {
    const name = req.body.username.trim();
    if (q.userByName.get(name)) return reply.code(409).send({error: 'exists'});
    const r = db.prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)').run(name, await hashPw(req.body.password), req.body.role || 'user', Date.now());
    return reply.code(201).send({user: pub(q.userById.get(r.lastInsertRowid))});
  });

  // Der letzte aktive Admin darf weder gesperrt, herabgestuft noch gelöscht werden
  const letzterAdmin = u => u.role === 'admin' && !u.disabled && q.admins.get().n <= 1;

  app.patch('/api/users/:id', {
    preHandler: adminOnly,
    schema: {params: idParams, body: {type: 'object', additionalProperties: false, minProperties: 1, properties: {password: newPw, disabled: {type: 'boolean'}, role: {enum: ['admin', 'user']}, unlock: {const: true}}}},
  }, async (req, reply) => {
    const u = q.userById.get(req.params.id), b = req.body;
    if (!u) return reply.code(404).send({error: 'notfound'});
    const nimmtAdmin = b.disabled === true || (b.role === 'user' && u.role === 'admin');
    if (nimmtAdmin && u.id === req.user.id) return reply.code(400).send({error: 'self'});
    if (nimmtAdmin && letzterAdmin(u)) return reply.code(400).send({error: 'lastadmin'});
    if (b.password) { q.setPw.run(await hashPw(b.password), u.id); q.dropSessions.run(u.id); }
    if (b.unlock) q.fail.run(0, null, u.id);
    if (b.disabled !== undefined) { db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(b.disabled ? 1 : 0, u.id); if (b.disabled) q.dropSessions.run(u.id); }
    if (b.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, u.id);
    return {user: pub(q.userById.get(u.id))};
  });

  app.delete('/api/users/:id', {preHandler: adminOnly, schema: {params: idParams}}, async (req, reply) => {
    const u = q.userById.get(req.params.id);
    if (!u) return reply.code(204).send();
    if (u.id === req.user.id) return reply.code(400).send({error: 'self'});
    if (letzterAdmin(u)) return reply.code(400).send({error: 'lastadmin'});
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    return reply.code(204).send();
  });
}
