/* Sicherheitsprüfung des Foto-Uploads. Die Nummern entsprechen den Prüfpunkten 1 bis 5 der Prüfung vom 6. Oktober 2026.
   Prüfpunkt 6 (gespeicherte Texte in der Oberfläche) steht in render-security.test.js. */
import {test, before, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import sharp from 'sharp';
import {startApp, client, tempDir, removeDir, ORIGIN, EVENT} from './helper.js';

const MARKE = 'GEHEIM-MARKE-4711';
let ECHT, ECHT_EXIF, PNG, RIESIG;
before(async () => {
  const bild = () => sharp({create: {width: 320, height: 240, channels: 3, background: '#C9281C'}});
  ECHT = await bild().jpeg().toBuffer();
  ECHT_EXIF = await bild().withExif({IFD0: {Copyright: MARKE, ImageDescription: MARKE}}).jpeg().toBuffer();
  PNG = await bild().png().toBuffer();
  // Wenige Kilobyte auf der Leitung, aber 64 Megapixel im Speicher
  RIESIG = await sharp({create: {width: 8000, height: 8000, channels: 3, background: '#FFFFFF'}}).jpeg({quality: 30}).toBuffer();
});

let dir, app, c;
const fotoDir = () => join(dir, 'fotos');
const dateien = () => readdirSync(fotoDir());
const put = (id, body, headers = {}, query = '') => app.inject({method: 'PUT', url: `/api/events/${id}/photos/f1${query}`, payload: body, headers: {origin: ORIGIN, cookie: c.cookie, 'content-type': 'image/jpeg', ...headers}});
const get = (id, cookie = c.cookie) => app.inject({method: 'GET', url: `/api/events/${id}/photos/f1`, headers: cookie ? {cookie} : {}});

beforeEach(async () => {
  dir = tempDir(); app = await startApp(dir); c = client(app); await c.login();
  await c.call('PUT', '/api/events/ev1', {data: EVENT});
});
afterEach(async () => { await app.close(); removeDir(dir); });

/* ---------- 1: dekodieren und neu als JPEG speichern, alles andere ablehnen ---------- */

test('1a: ein echtes JPEG wird angenommen und ist danach ein gültiges JPEG', async () => {
  assert.equal((await put('ev1', ECHT)).statusCode, 204);
  const meta = await sharp((await get('ev1')).rawPayload).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.deepEqual([meta.width, meta.height], [320, 240]);
});

test('1b: eine Datei, die nur wie ein JPEG beginnt, wird abgelehnt', async () => {
  const falsch = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from('<html><script>alert(1)</script></html>')]);
  assert.equal((await put('ev1', falsch)).statusCode, 400);
  assert.deepEqual(dateien(), []);
});

test('1c: an ein JPEG angehängte Daten landen nicht auf der Platte', async () => {
  const mitAnhang = Buffer.concat([ECHT, Buffer.from(`<script>${MARKE}</script>`)]);
  const r = await put('ev1', mitAnhang);
  if (r.statusCode === 204) assert.equal(readFileSync(join(fotoDir(), dateien()[0])).includes(MARKE), false, 'Anhang wurde mitgespeichert');
  else assert.equal(r.statusCode, 400);
});

test('1d: Metadaten (EXIF, etwa der Aufnahmeort) werden beim Speichern entfernt', async () => {
  assert.equal(ECHT_EXIF.includes(MARKE), true, 'Testbild enthält die Marke');
  assert.equal((await put('ev1', ECHT_EXIF)).statusCode, 204);
  assert.equal(readFileSync(join(fotoDir(), dateien()[0])).includes(MARKE), false, 'EXIF wurde mitgespeichert');
  assert.equal((await get('ev1')).rawPayload.includes(MARKE), false, 'EXIF wird ausgeliefert');
});

test('1e: gespeichert wird immer JPEG, auch wenn ein anderes Bildformat als image/jpeg geschickt wird', async () => {
  const r = await put('ev1', PNG);
  if (r.statusCode === 204) assert.equal((await sharp((await get('ev1')).rawPayload).metadata()).format, 'jpeg');
  else assert.equal(r.statusCode, 400);
  for (const f of dateien()) assert.deepEqual([...readFileSync(join(fotoDir(), f)).subarray(0, 3)], [0xFF, 0xD8, 0xFF], f);
});

/* ---------- 2: Grössenlimit vor der Verarbeitung ---------- */

test('2a: mehr als 2 MB werden mit 413 abgelehnt, nichts wird gespeichert', async () => {
  const gross = Buffer.concat([ECHT, Buffer.alloc(2 * 1024 * 1024)]);
  assert.equal((await put('ev1', gross)).statusCode, 413);
  assert.deepEqual(dateien(), []);
});

test('2b: schon die angekündigte Länge reicht für die Ablehnung', async () => {
  const r = await put('ev1', ECHT, {'content-length': String(50 * 1024 * 1024)});
  assert.ok([400, 413].includes(r.statusCode), 'Status ' + r.statusCode);
  assert.deepEqual(dateien(), []);
});

test('2c: ein kleines Bild mit riesigen Abmessungen (Dekompressionsbombe) wird abgelehnt', async () => {
  assert.ok(RIESIG.length < 2 * 1024 * 1024, 'Testbild liegt unter dem Byte-Limit');
  assert.equal((await put('ev1', RIESIG)).statusCode, 400);
  assert.deepEqual(dateien(), []);
});

/* ---------- 3: Dateiname und Endung kommen vom Server ---------- */

test('3a: Name und Endung lassen sich vom Client nicht beeinflussen', async () => {
  const r = await put('ev1', ECHT, {'content-disposition': 'attachment; filename="../../boese.php"', 'x-file-name': 'boese.svg'}, '?filename=boese.html&name=..%2Fx.js');
  assert.equal(r.statusCode, 204);
  const liste = dateien();
  assert.equal(liste.length, 1);
  assert.match(liste[0], /^[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{1,64}\.jpg$/);
  assert.equal(app.db.prepare('SELECT filename FROM event_photos').get().filename, liste[0]);
});

test('3b: Event-IDs mit Pfadanteilen oder Punkten werden abgelehnt', async () => {
  for (const id of ['..%2F..%2Fx', '..', 'a.php', 'a%00b', 'a%5Cb', '%2Fetc%2Fpasswd', 'x'.repeat(65)]) {
    const r = await put(id, ECHT);
    assert.ok([400, 404].includes(r.statusCode), `${id}: Status ${r.statusCode}`);
  }
  for (const pid of ['..%2F..%2Fx', '..', 'a.php', 'a%00b', 'a%5Cb', 'x'.repeat(65)]) {
    const r = await app.inject({method: 'PUT', url: `/api/events/ev1/photos/${pid}`, payload: ECHT, headers: {origin: ORIGIN, cookie: c.cookie, 'content-type': 'image/jpeg'}});
    assert.ok([400, 404].includes(r.statusCode), `Foto-ID ${pid}: Status ${r.statusCode}`);
  }
  assert.deepEqual(dateien(), []);
  assert.deepEqual(readdirSync(dir).filter(f => !f.startsWith('pizza_app.sqlite')), ['fotos'], 'nichts ausserhalb von fotos/');
});

/* ---------- 4: Auslieferung nur mit Anmeldung, als image/jpeg, mit nosniff ---------- */

test('4a: ohne Anmeldung gibt es kein Foto', async () => {
  await put('ev1', ECHT);
  assert.equal((await get('ev1', null)).statusCode, 401);
  assert.equal((await get('ev1', 'pizza_sid=erfunden')).statusCode, 401);
  assert.equal((await app.inject({method: 'GET', url: '/fotos/ev1.f1.jpg'})).statusCode, 404, 'kein Weg an der API vorbei');
  assert.equal((await app.inject({method: 'GET', url: '/api/events/ev1/photos/../../../fotos/ev1.f1.jpg', headers: {cookie: c.cookie}})).statusCode, 404);
});

test('4b: ausgeliefert wird als image/jpeg mit nosniff', async () => {
  await put('ev1', ECHT);
  const r = await get('ev1');
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['content-type'], 'image/jpeg');
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.match(r.headers['content-security-policy'], /default-src 'self'/);
  assert.match(r.headers['cache-control'], /private/);
});

test('4c: auch Fehlerantworten der Foto-Route tragen nosniff und sind kein HTML', async () => {
  for (const r of [await get('gibtsnicht'), await get('ev1', null), await put('ev1', Buffer.from('<html>'))]) {
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.match(r.headers['content-type'], /^application\/json/);
  }
});

/* ---------- 5: SVG ist ausgeschlossen ---------- */

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');

test('5a: SVG wird abgelehnt, mit richtigem und mit falschem Content-Type', async () => {
  assert.equal((await put('ev1', SVG, {'content-type': 'image/svg+xml'})).statusCode, 415);
  assert.equal((await put('ev1', SVG)).statusCode, 400);
  assert.equal((await put('ev1', Buffer.concat([Buffer.from('﻿<?xml version="1.0"?>'), SVG]))).statusCode, 400);
  assert.deepEqual(dateien(), []);
});

test('5b: SVG hinter einem JPEG-Anfang wird abgelehnt', async () => {
  assert.equal((await put('ev1', Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), SVG]))).statusCode, 400);
  assert.deepEqual(dateien(), []);
});

test('5c: andere Bild- und Dokumenttypen werden abgelehnt', async () => {
  for (const typ of ['image/png', 'image/gif', 'image/webp', 'text/html', 'application/octet-stream', 'multipart/form-data; boundary=x']) {
    assert.equal((await put('ev1', ECHT, {'content-type': typ})).statusCode, 415, typ);
  }
  assert.deepEqual(dateien(), []);
});
