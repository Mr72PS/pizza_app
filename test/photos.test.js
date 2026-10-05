/* Fotos als Dateien im Volume, ausgeliefert hinter der Anmeldung. */
import {test, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {startApp, client, tempDir, removeDir, ORIGIN} from './helper.js';

// Kleinstes Gerüst einer JPEG-Datei: Startmarke, etwas Inhalt, Endmarke
const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64, 7), Buffer.from([0xFF, 0xD9])]);
const jpeg = {'content-type': 'image/jpeg'};

let dir, app, c;
const fotoDir = () => join(dir, 'fotos');
// inject liefert Binärdaten nur roh zuverlässig, darum hier ohne den JSON-Client
const holen = id => app.inject({method: 'GET', url: `/api/events/${id}/photo`, headers: {cookie: c.cookie}});
const hochladen = (id, body = JPEG, headers = jpeg) => app.inject({method: 'PUT', url: `/api/events/${id}/photo`, payload: body, headers: {origin: ORIGIN, cookie: c.cookie, ...headers}});

beforeEach(async () => {
  dir = tempDir(); app = await startApp(dir); c = client(app); await c.login();
  await c.call('PUT', '/api/events/ev1', {data: {name: 'Pizza-Abend'}});
});
afterEach(async () => { await app.close(); removeDir(dir); });

test('Foto hochladen, abrufen, ersetzen, löschen', async () => {
  assert.equal((await holen('ev1')).statusCode, 404);
  assert.equal((await hochladen('ev1')).statusCode, 204);
  assert.deepEqual(readdirSync(fotoDir()), ['ev1.jpg']);
  assert.deepEqual(readFileSync(join(fotoDir(), 'ev1.jpg')), JPEG);
  const r = await holen('ev1');
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['content-type'], 'image/jpeg');
  assert.match(r.headers['cache-control'], /private/);
  assert.deepEqual(r.rawPayload, JPEG);

  const neu = Buffer.concat([JPEG, Buffer.from([1, 2, 3])]);
  assert.equal((await hochladen('ev1', neu)).statusCode, 204);
  assert.deepEqual((await holen('ev1')).rawPayload, neu);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM photos').get().n, 1);

  assert.equal((await c.call('DELETE', '/api/events/ev1/photo')).status, 204);
  assert.equal((await holen('ev1')).statusCode, 404);
  assert.deepEqual(readdirSync(fotoDir()), []);
  assert.equal((await c.call('DELETE', '/api/events/ev1/photo')).status, 204, 'nochmals löschen ist kein Fehler');
});

test('Event löschen löscht auch das Foto', async () => {
  await hochladen('ev1');
  assert.equal((await c.call('DELETE', '/api/events/ev1')).status, 204);
  assert.deepEqual(readdirSync(fotoDir()), []);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM photos').get().n, 0);
});

test('Fotos gibt es nur mit Anmeldung', async () => {
  await hochladen('ev1');
  const fremd = client(app);
  assert.equal((await fremd.call('GET', '/api/events/ev1/photo')).status, 401);
  assert.equal((await app.inject({method: 'PUT', url: '/api/events/ev1/photo', payload: JPEG, headers: {origin: ORIGIN, ...jpeg}})).statusCode, 401);
  assert.equal((await fremd.call('DELETE', '/api/events/ev1/photo')).status, 401);
  assert.equal((await fremd.call('GET', '/fotos/ev1.jpg')).status, 404, 'kein direkter Weg an der API vorbei');
  assert.equal(existsSync(join(fotoDir(), 'ev1.jpg')), true);
});

test('nur JPEG, nur zu vorhandenen Events, nur bis 2 MB', async () => {
  assert.equal((await hochladen('ev1', Buffer.from('<svg onload=alert(1)>'))).statusCode, 400, 'kein JPEG');
  assert.equal((await hochladen('ev1', Buffer.from('GIF89a'), {'content-type': 'image/gif'})).statusCode, 415);
  assert.equal((await hochladen('gibtsnicht')).statusCode, 404);
  assert.equal((await hochladen('..%2F..%2Fx')).statusCode, 400, 'ungültige ID');
  const gross = Buffer.concat([JPEG.subarray(0, 4), Buffer.alloc(2 * 1024 * 1024 + 1)]);
  assert.equal((await hochladen('ev1', gross)).statusCode, 413);
  assert.deepEqual(readdirSync(fotoDir()), []);
});

test('ein zweiter Benutzer sieht dasselbe Foto', async () => {
  await hochladen('ev1');
  await c.call('POST', '/api/users', {username: 'gast', password: 'auch-geheim-1'});
  const gast = client(app); await gast.login({username: 'gast', password: 'auch-geheim-1'});
  const r = await app.inject({method: 'GET', url: '/api/events/ev1/photo', headers: {cookie: gast.cookie}});
  assert.deepEqual(r.rawPayload, JPEG);
});
