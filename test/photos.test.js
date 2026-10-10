/* Fotos als Dateien im Volume, ausgeliefert hinter der Anmeldung. Die Sicherheitsprüfungen stehen in upload-security.test.js. */
import {test, before, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';
import Database from 'better-sqlite3';
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
const holen = (id, pid = 'f1', cookie = c.cookie) => app.inject({method: 'GET', url: `/api/events/${id}/photos/${pid}`, headers: {cookie}});
const hochladen = (id, body, pid = 'f1') => app.inject({method: 'PUT', url: `/api/events/${id}/photos/${pid}`, payload: body, headers: {origin: ORIGIN, cookie: c.cookie, 'content-type': 'image/jpeg'}});
const masse = async (id, pid) => { const m = await sharp((await holen(id, pid)).rawPayload).metadata(); return [m.width, m.height]; };
const liste = async () => (await c.call('GET', '/api/state')).body.photos;
const klein = (id, pid = 'f1', cookie = c.cookie) => app.inject({method: 'GET', url: `/api/events/${id}/photos/${pid}?klein=1`, headers: cookie ? {cookie} : {}});
const vorschauDir = () => join(dir, 'vorschau');
const zeilen = () => app.db.prepare('SELECT COUNT(*) n FROM event_photos').get().n;

beforeEach(async () => {
  dir = tempDir(); app = await startApp(dir); c = client(app); await c.login();
  await c.call('PUT', '/api/events/ev1', {data: EVENT});
});
afterEach(async () => { await app.close(); removeDir(dir); });

test('Fotos hochladen, abrufen, ersetzen, einzeln löschen', async () => {
  assert.equal((await holen('ev1')).statusCode, 404);
  assert.deepEqual(await liste(), []);
  assert.equal((await hochladen('ev1', KLEIN)).statusCode, 204);
  assert.equal((await hochladen('ev1', HOCHKANT, 'f2')).statusCode, 204);
  assert.deepEqual(readdirSync(fotoDir()).sort(), ['ev1.f1.jpg', 'ev1.f2.jpg']);
  assert.deepEqual(await masse('ev1', 'f1'), [320, 240]);
  assert.deepEqual(await liste(), [{eventId: 'ev1', id: 'f1'}, {eventId: 'ev1', id: 'f2'}], 'in der Reihenfolge des Hochladens');

  assert.equal((await hochladen('ev1', HOCHKANT)).statusCode, 204, 'dieselbe Kennung ersetzt das Foto');
  assert.deepEqual(await masse('ev1', 'f1'), [300, 400]);
  assert.equal(zeilen(), 2);

  assert.equal((await c.call('DELETE', '/api/events/ev1/photos/f1')).status, 204);
  assert.equal((await holen('ev1')).statusCode, 404);
  assert.equal((await holen('ev1', 'f2')).statusCode, 200, 'das andere Foto bleibt');
  assert.deepEqual(readdirSync(fotoDir()), ['ev1.f2.jpg']);
  assert.equal((await c.call('DELETE', '/api/events/ev1/photos/f1')).status, 204, 'nochmals löschen ist kein Fehler');
});

test('höchstens 10 Fotos pro Event', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await hochladen('ev1', KLEIN, 'f' + i)).statusCode, 204);
  const r = await hochladen('ev1', KLEIN, 'zuviel');
  assert.equal(r.statusCode, 409);
  assert.equal(readdirSync(fotoDir()).length, 10);
  assert.equal((await hochladen('ev1', KLEIN, 'f3')).statusCode, 204, 'ersetzen geht auch an der Grenze');
  await c.call('PUT', '/api/events/ev2', {data: EVENT});
  assert.equal((await hochladen('ev2', KLEIN)).statusCode, 204, 'die Grenze gilt pro Event');
});

test('gleiche Foto-Kennung in zwei Events sind zwei Fotos', async () => {
  await c.call('PUT', '/api/events/ev2', {data: EVENT});
  await hochladen('ev1', KLEIN); await hochladen('ev2', GROSS);
  assert.deepEqual(await masse('ev1', 'f1'), [320, 240]);
  assert.deepEqual(await masse('ev2', 'f1'), [1600, 1200]);
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

test('Event löschen löscht auch alle seine Fotos', async () => {
  await hochladen('ev1', KLEIN); await hochladen('ev1', KLEIN, 'f2');
  assert.equal((await c.call('DELETE', '/api/events/ev1')).status, 204);
  assert.deepEqual(readdirSync(fotoDir()), []);
  assert.equal(zeilen(), 0);
});

test('ein Foto gibt es nur zu einem vorhandenen Event', async () => {
  assert.equal((await hochladen('gibtsnicht', KLEIN)).statusCode, 404);
  assert.deepEqual(readdirSync(fotoDir()), []);
});

test('ein zweiter Benutzer sieht dasselbe Foto', async () => {
  await hochladen('ev1', KLEIN);
  await c.call('POST', '/api/users', {username: 'gast', password: 'auch-geheim-1'});
  const gast = client(app); await gast.login({username: 'gast', password: 'auch-geheim-1'});
  assert.deepEqual((await holen('ev1', 'f1', gast.cookie)).rawPayload, (await holen('ev1')).rawPayload);
});

test('Vorschaubild: quadratisch, höchstens 480 px, viel kleiner als das Foto, nur mit Anmeldung', async () => {
  await hochladen('ev1', GROSS);
  assert.deepEqual(readdirSync(vorschauDir()), [], 'entsteht erst beim ersten Abruf');
  const r = await klein('ev1');
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['content-type'], 'image/jpeg');
  const m = await sharp(r.rawPayload).metadata();
  assert.deepEqual([m.width, m.height], [480, 480]);
  assert.ok(r.rawPayload.length < (await holen('ev1')).rawPayload.length / 2);
  assert.deepEqual(readdirSync(vorschauDir()), ['ev1.f1.jpg']);
  assert.deepEqual((await klein('ev1')).rawPayload, r.rawPayload, 'der zweite Abruf liefert die gespeicherte Datei');
  assert.equal((await klein('ev1', 'f1', null)).statusCode, 401);
  assert.equal((await klein('ev1', 'gibtsnicht')).statusCode, 404);
});

test('Vorschaubild: ein kleines Foto wird nicht vergrössert', async () => {
  await hochladen('ev1', KLEIN);
  const m = await sharp((await klein('ev1')).rawPayload).metadata();
  assert.deepEqual([m.width, m.height], [240, 240]);
});

test('Vorschaubild: folgt dem Foto beim Ersetzen und Löschen', async () => {
  await hochladen('ev1', GROSS);
  const rot = (await klein('ev1')).rawPayload;
  const BLAU = await sharp({create: {width: 800, height: 600, channels: 3, background: '#1C3FC9'}}).jpeg().toBuffer();
  await hochladen('ev1', BLAU);
  const blau = (await klein('ev1')).rawPayload;
  assert.notDeepEqual(blau, rot, 'nach dem Ersetzen neu erzeugt');
  const {dominant} = await sharp(blau).stats();
  assert.ok(dominant.b > dominant.r, 'zeigt das neue Foto');

  await c.call('DELETE', '/api/events/ev1/photos/f1');
  assert.deepEqual(readdirSync(vorschauDir()), []);
  assert.equal((await klein('ev1')).statusCode, 404);

  await hochladen('ev1', GROSS); await klein('ev1');
  await c.call('DELETE', '/api/events/ev1');
  assert.deepEqual(readdirSync(vorschauDir()), [], 'mit dem Event gelöscht');
});

test('Umstellung: das eine Foto pro Event aus der alten Tabelle bleibt erhalten', async () => {
  // Datenordner im alten Format: Tabelle photos mit einer Zeile pro Event, Datei <Event>.jpg
  const alt = tempDir(); mkdirSync(join(alt, 'fotos'));
  writeFileSync(join(alt, 'fotos', 'evalt.jpg'), KLEIN);
  const db = new Database(join(alt, 'pizza_app.sqlite'));
  db.exec('CREATE TABLE photos (event_id TEXT PRIMARY KEY, filename TEXT NOT NULL, created_at INTEGER NOT NULL)');
  db.prepare('INSERT INTO photos VALUES (?, ?, ?)').run('evalt', 'evalt.jpg', 5);
  db.close();

  for (let lauf = 0; lauf < 2; lauf++) { // der zweite Start darf nichts mehr verändern
    const a = await startApp(alt), k = client(a); await k.login();
    try {
      assert.deepEqual((await k.call('GET', '/api/state')).body.photos, [{eventId: 'evalt', id: 'erstes'}]);
      const r = await a.inject({method: 'GET', url: '/api/events/evalt/photos/erstes', headers: {cookie: k.cookie}});
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.rawPayload, KLEIN, 'die Datei bleibt unverändert');
      assert.equal((await a.inject({method: 'GET', url: '/api/events/evalt/photos/erstes?klein=1', headers: {cookie: k.cookie}})).statusCode, 200, 'auch das Vorschaubild');
      assert.equal(a.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'photos'").get().n, 0, 'die alte Tabelle ist weg');
    } finally { await a.close(); }
  }
  removeDir(alt);
});
