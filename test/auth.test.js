/* Anmeldung, Sitzungen, Benutzerverwaltung und Sicherheit nach Abschnitt 6 der Übergabe. */
import {test, beforeEach, afterEach, mock} from 'node:test';
import assert from 'node:assert/strict';
import {startApp, client, tempDir, removeDir, ADMIN, ORIGIN, EVENT} from './helper.js';

let dir, app, admin;
beforeEach(async () => { dir = tempDir(); app = await startApp(dir); admin = client(app); });
afterEach(async () => { mock.timers.reset(); await app.close(); removeDir(dir); });

const GAST = {username: 'gast', password: 'auch-geheim-1'};
const neuerBenutzer = async (u = GAST, role) => { await admin.login(); return (await admin.call('POST', '/api/users', {...u, ...(role ? {role} : {})})).body.user; };

test('ohne Sitzung sind alle API-Routen ausser Login gesperrt', async () => {
  const c = client(app);
  for (const [m, url, body] of [
    ['GET', '/api/state'], ['GET', '/api/me'], ['GET', '/api/users'], ['POST', '/api/logout'],
    ['PUT', '/api/recipes/napo', {data: {}}], ['DELETE', '/api/recipes/napo'], ['PUT', '/api/events/x', {data: {}}], ['DELETE', '/api/events/x'],
    ['POST', '/api/me/password', {current: 'a', password: 'bbbbbbbb'}], ['GET', '/api/gibtsnicht'],
  ]) assert.equal((await c.call(m, url, body)).status, 401, `${m} ${url}`);
  const s = await client(app).call('GET', '/api/state');
  assert.deepEqual(s.body, {error: 'auth'}, 'keine Daten in der Antwort');
});

test('erster Admin entsteht aus ADMIN_USER und ADMIN_PASSWORD, aber nur ohne vorhandene Benutzer', async () => {
  const rows = app.db.prepare('SELECT username, role, password_hash FROM users').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].username, ADMIN.username);
  assert.equal(rows[0].role, 'admin');
  assert.match(rows[0].password_hash, /^\$argon2id\$/);
  await app.close();
  app = await startApp(dir, {adminUser: 'anderer', adminPassword: 'anderes-passwort'});
  assert.deepEqual(app.db.prepare('SELECT username FROM users').all(), [{username: ADMIN.username}]);
  assert.equal((await client(app).login({username: 'anderer', password: 'anderes-passwort'})).status, 401);
});

test('ohne ADMIN_USER entsteht kein Benutzer, es gibt kein offenes Registrieren', async () => {
  await app.close(); removeDir(dir); dir = tempDir();
  app = await startApp(dir, {adminUser: undefined, adminPassword: undefined});
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM users').get().n, 0);
  assert.equal((await client(app).call('POST', '/api/users', GAST)).status, 401);
});

test('Anmelden setzt ein HttpOnly-Cookie mit SameSite=Lax und 30 Tagen Laufzeit', async () => {
  const r = await admin.login();
  assert.equal(r.status, 200);
  assert.deepEqual({username: r.body.user.username, role: r.body.user.role}, {username: ADMIN.username, role: 'admin'});
  assert.equal('password_hash' in r.body.user, false);
  assert.match(admin.setCookie, /^pizza_sid=[\w-]{43};/);
  assert.match(admin.setCookie, /HttpOnly/);
  assert.match(admin.setCookie, /SameSite=Lax/);
  assert.match(admin.setCookie, /Max-Age=2592000/);
  assert.match(admin.setCookie, /Path=\//);
  assert.equal((await admin.call('GET', '/api/me')).body.user.username, ADMIN.username);
});

test('über https trägt das Cookie Secure', async () => {
  await app.close();
  app = await startApp(dir, {baseUrl: 'https://pizza.example.test'});
  const c = client(app, 'https://pizza.example.test');
  assert.equal((await c.login()).status, 200);
  assert.match(c.setCookie, /; Secure/);
});

test('das Sitzungs-Token liegt nur gehasht in der Datenbank', async () => {
  await admin.login();
  const token = admin.cookie.split('=')[1];
  const ids = app.db.prepare('SELECT id FROM sessions').all().map(r => r.id);
  assert.equal(ids.length, 1);
  assert.notEqual(ids[0], token);
  assert.match(ids[0], /^[0-9a-f]{64}$/);
});

test('falsches Passwort und unbekannter Benutzer liefern dieselbe Antwort', async () => {
  const a = await client(app).login({username: ADMIN.username, password: 'falsch'});
  const b = await client(app).login({username: 'niemand', password: 'falsch'});
  assert.deepEqual([a.status, a.body], [401, {error: 'login'}]);
  assert.deepEqual([b.status, b.body], [401, {error: 'login'}]);
});

test('Benutzername ohne Rücksicht auf Gross- und Kleinschreibung', async () => {
  assert.equal((await client(app).login({username: 'PATRIC', password: ADMIN.password})).status, 200);
});

test('Abmelden widerruft die Sitzung auf dem Server', async () => {
  await admin.login();
  const alt = admin.cookie;
  assert.equal((await admin.call('POST', '/api/logout')).status, 204);
  assert.equal(admin.cookie, null, 'Cookie gelöscht');
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
  assert.equal((await client(app).call('GET', '/api/me', undefined, {cookie: alt})).status, 401);
});

test('abgelaufene Sitzung gilt nicht mehr', async () => {
  await admin.login();
  app.db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1);
  assert.equal((await admin.call('GET', '/api/me')).status, 401);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
});

test('nach 5 Fehlversuchen ist das Konto 15 Minuten gesperrt, auch für das richtige Passwort', async () => {
  const falsch = {username: ADMIN.username, password: 'falsch'};
  for (let i = 0; i < 4; i++) assert.equal((await client(app).login(falsch)).status, 401);
  assert.equal(app.db.prepare('SELECT locked_until FROM users').get().locked_until, null, 'nach 4 Versuchen noch offen');
  assert.equal((await client(app).login(falsch)).status, 401);
  const until = app.db.prepare('SELECT locked_until FROM users').get().locked_until;
  assert.ok(Math.abs(until - (Date.now() + 15 * 60 * 1000)) < 5000, '15 Minuten');
  const r = await client(app).login();
  assert.deepEqual([r.status, r.body.error], [429, 'locked']);
  // 15 Minuten später geht es wieder
  app.db.prepare('UPDATE users SET locked_until = ?').run(Date.now() - 1);
  assert.equal((await client(app).login()).status, 200);
  assert.deepEqual(app.db.prepare('SELECT failed_logins, locked_until FROM users').get(), {failed_logins: 0, locked_until: null});
});

test('erfolgreiche Anmeldung setzt den Zähler zurück', async () => {
  for (let i = 0; i < 4; i++) await client(app).login({username: ADMIN.username, password: 'falsch'});
  assert.equal((await client(app).login()).status, 200);
  for (let i = 0; i < 4; i++) await client(app).login({username: ADMIN.username, password: 'falsch'});
  assert.equal((await client(app).login()).status, 200);
});

test('Begrenzung pro IP beim Anmelden', async () => {
  await app.close();
  app = await startApp(dir, {loginPerIp: 3});
  const versuch = n => client(app).login({username: 'niemand' + n, password: 'falsch'});
  for (let i = 0; i < 3; i++) assert.equal((await versuch(i)).status, 401);
  assert.equal((await versuch(9)).status, 429);
  assert.equal((await client(app).login()).status, 429, 'auch mit richtigem Passwort');
});

test('schreibende Anfragen von fremder Herkunft werden abgelehnt', async () => {
  await admin.login();
  const fremd = client(app, 'https://boese.example.test'); fremd.cookie = admin.cookie;
  assert.equal((await fremd.call('DELETE', '/api/recipes/napo')).status, 403);
  assert.equal((await fremd.call('POST', '/api/login', ADMIN)).status, 403);
  const ohne = await app.inject({method: 'DELETE', url: '/api/recipes/napo', headers: {cookie: admin.cookie}});
  assert.equal(ohne.statusCode, 403, 'ohne Origin-Header');
  assert.equal((await fremd.call('GET', '/api/state')).status, 200, 'Lesen prüft die Herkunft nicht');
  assert.equal((await admin.call('GET', '/api/state')).body.recipes.some(r => r.id === 'napo'), true);
});

test('Sicherheits-Header und CSP ohne Inline-Skripte', async () => {
  const r = await client(app).call('GET', '/');
  const csp = r.headers['content-security-policy'];
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['referrer-policy'], 'same-origin');
  assert.equal(r.headers['x-powered-by'], undefined);
});

test('eigenes Passwort ändern: braucht das alte, beendet andere Sitzungen', async () => {
  await admin.login();
  const zweites = client(app); await zweites.login();
  assert.equal((await admin.call('POST', '/api/me/password', {current: 'falsch', password: 'neues-passwort'})).status, 403);
  assert.equal((await admin.call('POST', '/api/me/password', {current: ADMIN.password, password: 'kurz'})).status, 400);
  assert.equal((await admin.call('POST', '/api/me/password', {current: ADMIN.password, password: 'neues-passwort'})).status, 204);
  assert.equal((await admin.call('GET', '/api/me')).status, 200, 'eigene Sitzung bleibt');
  assert.equal((await zweites.call('GET', '/api/me')).status, 401, 'andere Sitzung beendet');
  assert.equal((await client(app).login()).status, 401, 'altes Passwort gilt nicht mehr');
  assert.equal((await client(app).login({username: ADMIN.username, password: 'neues-passwort'})).status, 200);
});

test('Admin legt Benutzer an; normale Benutzer nutzen die App, aber nicht die Verwaltung', async () => {
  const u = await neuerBenutzer();
  assert.deepEqual({username: u.username, role: u.role, disabled: u.disabled}, {username: 'gast', role: 'user', disabled: false});
  assert.equal((await admin.call('POST', '/api/users', GAST)).status, 409, 'Name vergeben');
  assert.equal((await admin.call('POST', '/api/users', {username: 'x2', password: 'kurz'})).status, 400);
  const gast = client(app);
  assert.equal((await gast.login(GAST)).status, 200);
  assert.equal((await gast.call('GET', '/api/state')).status, 200);
  assert.equal((await gast.call('GET', '/api/users')).status, 403);
  assert.equal((await gast.call('POST', '/api/users', {username: 'dritter', password: 'passwort-123'})).status, 403);
  assert.equal((await gast.call('PATCH', `/api/users/${u.id}`, {role: 'admin'})).status, 403);
  assert.equal((await gast.call('DELETE', `/api/users/${u.id}`)).status, 403);
  assert.equal((await gast.call('POST', '/api/me/password', {current: GAST.password, password: 'gast-neu-12345'})).status, 204);
  const liste = (await admin.call('GET', '/api/users')).body.users;
  assert.deepEqual(liste.map(x => x.username), ['gast', 'patric']);
  assert.equal(liste.some(x => 'password_hash' in x), false);
});

test('alle Benutzer sehen dieselben Daten, updated_by hält fest, wer geschrieben hat', async () => {
  const u = await neuerBenutzer();
  const gast = client(app); await gast.login(GAST);
  assert.equal((await gast.call('PUT', '/api/events/ev1', {data: {...EVENT, name: 'vom Gast'}})).status, 201);
  assert.equal((await admin.call('GET', '/api/state')).body.events[0].data.name, 'vom Gast');
  assert.equal(app.db.prepare('SELECT updated_by FROM events').get().updated_by, u.id);
});

test('Admin sperrt einen Benutzer: Sitzung endet sofort, Anmelden geht nicht mehr', async () => {
  const u = await neuerBenutzer();
  const gast = client(app); await gast.login(GAST);
  assert.equal((await admin.call('PATCH', `/api/users/${u.id}`, {disabled: true})).body.user.disabled, true);
  assert.equal((await gast.call('GET', '/api/state')).status, 401);
  assert.equal((await client(app).login(GAST)).status, 401);
  await admin.call('PATCH', `/api/users/${u.id}`, {disabled: false});
  assert.equal((await client(app).login(GAST)).status, 200);
});

test('Admin setzt ein Passwort zurück: alte Sitzungen enden, Sperre fällt weg', async () => {
  const u = await neuerBenutzer();
  const gast = client(app); await gast.login(GAST);
  for (let i = 0; i < 5; i++) await client(app).login({username: 'gast', password: 'falsch'});
  assert.equal((await admin.call('GET', '/api/users')).body.users.find(x => x.id === u.id).locked, true);
  assert.equal((await admin.call('PATCH', `/api/users/${u.id}`, {password: 'zurueckgesetzt-1'})).status, 200);
  assert.equal((await gast.call('GET', '/api/me')).status, 401);
  assert.equal((await client(app).login({username: 'gast', password: 'zurueckgesetzt-1'})).status, 200);
});

test('Admin kann sich nicht selbst aussperren, der letzte Admin bleibt', async () => {
  await admin.login();
  const ich = (await admin.call('GET', '/api/me')).body.user.id;
  assert.equal((await admin.call('PATCH', `/api/users/${ich}`, {disabled: true})).status, 400);
  assert.equal((await admin.call('PATCH', `/api/users/${ich}`, {role: 'user'})).status, 400);
  assert.equal((await admin.call('DELETE', `/api/users/${ich}`)).status, 400);
  // Mit einem zweiten Admin darf der erste gesperrt werden, aber nicht von sich selbst
  const zwei = await neuerBenutzer({username: 'zweite', password: 'zweites-passwort'}, 'admin');
  const c2 = client(app); await c2.login({username: 'zweite', password: 'zweites-passwort'});
  assert.equal((await c2.call('PATCH', `/api/users/${ich}`, {role: 'user'})).status, 200);
  assert.equal((await c2.call('PATCH', `/api/users/${zwei.id}`, {role: 'user'})).status, 400, 'letzter Admin');
  assert.equal((await admin.call('GET', '/api/users')).status, 403, 'herabgestuft');
});

test('Benutzer löschen beendet seine Sitzungen', async () => {
  const u = await neuerBenutzer();
  const gast = client(app); await gast.login(GAST);
  assert.equal((await admin.call('DELETE', `/api/users/${u.id}`)).status, 204);
  assert.equal((await gast.call('GET', '/api/me')).status, 401);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id = ?').get(u.id).n, 0);
});

test('Origin-Prüfung gegen BASE_URL: die Adresse hinter dem Reverse Proxy zählt', async () => {
  await app.close();
  app = await startApp(dir, {baseUrl: 'https://pizza.example.test', trustProxy: true});
  assert.equal((await client(app, 'https://pizza.example.test').login()).status, 200);
  assert.equal((await client(app, ORIGIN).login()).status, 403);
});
