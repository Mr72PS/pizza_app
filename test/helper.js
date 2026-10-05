/* Gemeinsame Helfer für die Backend-Tests: App im Wegwerf-Verzeichnis, Client mit Cookie. */
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../server/app.js';

export const ORIGIN = 'http://localhost';
export const ADMIN = {username: 'patric', password: 'geheim-zum-testen'};

export const tempDir = () => mkdtempSync(join(tmpdir(), 'pizza_app-'));
export const removeDir = dir => rmSync(dir, {recursive: true, force: true, maxRetries: 10, retryDelay: 100}); // Windows gibt die SQLite-Dateien manchmal verzögert frei

export const startApp = (dataDir, config = {}) => buildApp({
  dataDir,
  config: {adminUser: ADMIN.username, adminPassword: ADMIN.password, sessionSecret: 'test', baseUrl: ORIGIN, ...config},
});

/* Ein Client entspricht einem Browser: Er merkt sich das Sitzungs-Cookie. */
export function client(app, origin = ORIGIN) {
  const c = {
    cookie: null,
    async call(method, url, payload, headers = {}) {
      const res = await app.inject({method, url, payload, headers: {origin, ...(c.cookie ? {cookie: c.cookie} : {}), ...headers}});
      const set = res.headers['set-cookie'];
      if (set) { c.setCookie = String(set); const v = c.setCookie.split(';')[0]; c.cookie = v.endsWith('=') ? null : v; }
      let body = null; try { body = res.body ? res.json() : null; } catch { body = res.body; }
      return {status: res.statusCode, body, headers: res.headers};
    },
    login: (u = ADMIN) => c.call('POST', '/api/login', u),
  };
  return c;
}
