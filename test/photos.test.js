/* Fotos als Dateien im Volume, ausgeliefert hinter der Anmeldung. Die Sicherheitsprüfungen stehen in upload-security.test.js. */
import {test, before, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';
import {startApp, client, tempDir, removeDir, ORIGIN, EVENT} from './helper.js';

let KLEIN, GROSS, HOCHKANT;
before(async () => {
  const bild = (w, h) => sharp({create: {width: w, height: h, channels: 3, background: '#C9281C'}});
  KLEIN = await bild(320, 240).jpeg().toBuffer();
  GROSS = await bild(3200, 2400).jpeg().toBuffer();
  // Wie vom Handy: quer gespeichert, mit dem EXIF-Vermerk «um 90 Grad drehen»
  HOCHKANT = await bild(400, 300).withMetadata({orientation: 6}).jpeg().toBuffer();
});

let dir, app, c;
const fotoDir = () => join(dir, 'fotos');
const holen = (id, cookie = c.cookie) => app.inject({method: 'GET', url: `/api/events/${id}/photo`, headers: {cookie}});
const hochladen = (id, body) => app.inject({method: 'PUT', url: `/api/events/${id}/photo`, payload: body, headers: {origin: ORIGIN, cookie: c.cookie, 'content-type': 'image/jpeg'}});
const masse = async id => { const m = await sharp((await holen(id)).rawPayload).metadata(); return [m.width, m.height]; };

beforeEach(async () => {
  dir = tempDir(); app = await startApp(dir); c = client(app); await c.login();
  await c.call('PUT', '/api/events/ev1', {data: EVENT});
});
afterEach(async () => { await app.close(); removeDir(dir); });

test('Foto hochladen, abrufen, ersetzen, löschen', async () => {
  assert.equal((await holen('ev1')).statusCode, 404);
  assert.equal((await hochladen('ev1', KLEIN)).statusCode, 204);
  assert.deepEqual(readdirSync(fotoDir()), ['ev1.jpg']);
  assert.deepEqual(await masse('ev1'), [320, 240]);

  assert.equal((await hochladen('ev1', HOCHKANT)).statusCode, 204);
  assert.deepEqual(readdirSync(fotoDir()), ['ev1.jpg']);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM photos').get().n, 1);

  assert.equal((await c.call('DELETE', '/api/events/ev1/photo')).status, 204);
  assert.equal((await holen('ev1')).statusCode, 404);
  assert.deepEqual(readdirSync(fotoDir()), []);
  assert.equal((await c.call('DELETE', '/api/events/ev1/photo')).status, 204, 'nochmals löschen ist kein Fehler');
});

test('grosse Fotos werden auf höchstens 1600 px verkleinert, kleine nicht vergrössert', async () => {
  await hochladen('ev1', GROSS);
  assert.deepEqual(await masse('ev1'), [1600, 1200]);
  await hochladen('ev1', KLEIN);
  assert.deepEqual(await masse('ev1'), [320, 240]);
});

test('die Drehung vom Handy bleibt erhalten, obwohl die Metadaten entfernt werden', async () => {
  await hochladen('ev1', HOCHKANT);
  assert.deepEqual(await masse('ev1'), [300, 400]);
  assert.equal((await sharp((await holen('ev1')).rawPayload).metadata()).orientation, undefined);
});

test('Event löschen löscht auch das Foto', async () => {
  await hochladen('ev1', KLEIN);
  assert.equal((await c.call('DELETE', '/api/events/ev1')).status, 204);
  assert.deepEqual(readdirSync(fotoDir()), []);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM photos').get().n, 0);
});

test('ein Foto gibt es nur zu einem vorhandenen Event', async () => {
  assert.equal((await hochladen('gibtsnicht', KLEIN)).statusCode, 404);
  assert.deepEqual(readdirSync(fotoDir()), []);
});

test('ein zweiter Benutzer sieht dasselbe Foto', async () => {
  await hochladen('ev1', KLEIN);
  await c.call('POST', '/api/users', {username: 'gast', password: 'auch-geheim-1'});
  const gast = client(app); await gast.login({username: 'gast', password: 'auch-geheim-1'});
  assert.deepEqual((await holen('ev1', gast.cookie)).rawPayload, (await holen('ev1')).rawPayload);
});
